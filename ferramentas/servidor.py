"""Servidor local: serve a raiz do repositório (app de revisão, página de render, projetos e biblioteca) com Range
(o player e o Chromium precisam pular no vídeo) e as rotas do app (revisões, calibragem, referências e biblioteca).

    uv run ferramentas/servidor.py [porta]      → http://localhost:8719/app/
Também importado pelo render (`servir(0)` sobe numa porta livre, numa thread). Só biblioteca padrão.

Rotas (JSON; um erro volta como {"erro": "…"}, com 422 numa validação):
- GET /api/lista?pasta=… (nomes numa pasta pública) · GET /api/projetos (o início do app) · GET /api/motions/fonte/<pro|
  rounded|mono> (as SF da Apple, lidas do Mac: o biblioteca/motions/fonts.css as pede) · PUT /api/revisao/<slug>/v<N> (a
  revisão inteira; as respostas do Claude no arquivo são mantidas).
- Calibragem (chama ferramentas/calibragem.py): GET|POST /api/referencias (POST: o vídeo cru no corpo, o nome do arquivo
  no cabeçalho X-Nome) · GET /api/referencias/clipes · GET /api/referencias/<id>/revisao · PUT …/<id>/direcao {itens} ·
  PUT …/<id>/status {revisado} · PUT …/<id>/nome {nome} · PUT …/<id>/favorito {inicio, fim, favorito} · POST
  …/<id>/reanalisar · POST …/<id>/tentar · DELETE /api/referencias/<id>.
- GET|PUT /api/heuristica: as regras da direção (exemplos/regras.md) e os roteiros de exemplo, com os tempos dos planos.
- PUT /api/presets/<id> {aprovado} · PUT /api/presets/ordem {chave, ids, favoritos} · PUT /api/transicoes/<id> {aprovado}
  · PUT /api/transicoes/ordem {chave, ids, favoritas} · GET|PUT|DELETE /api/banco/<id> · PUT /api/motions/<id>/aprovar.
"""
import json
import os
import re
import shutil
import sys
import tempfile
import threading
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

sys.path.insert(0, str(Path(__file__).parent))
from base import BIBLIOTECA, PROJETOS, RAIZ, gravar_json, ler_json  # noqa: E402

PORTA = 8719
PUBLICOS = ('app', 'render', 'projetos', 'biblioteca')
FONTES_DO_MAC = {'pro': 'SFNS.ttf', 'rounded': 'SFNSRounded.ttf', 'mono': 'SFNSMono.ttf'}  # não vão para o git
EXEMPLOS = RAIZ / '.claude' / 'skills' / 'editor' / 'exemplos'
REFERENCIAS = BIBLIOTECA / 'referencias'
ID = r'([\w.-]+)'
CHAVE_PRESET = re.compile(r'^(dividida|vertical|atras):(1:(pe|deitada)|2|2\+)$')
CHAVE_TRANSICAO = re.compile(r'^familia:(ator|dividida|cheia)>(ator|dividida|cheia)$')
JSON_DO_MOTION = re.compile(r'(<script type="application/json" id="preset">)(.*?)(</script>)', re.DOTALL)


class Erro(Exception):
    """Um erro que vai para o app como {"erro": mensagem}, com o status."""

    def __init__(self, mensagem: str, status: int = 400):
        super().__init__(mensagem)
        self.status = status


def versoes(projeto: Path) -> list[int]:
    """As versões entregues (as que já têm o proxy.mp4), em ordem."""
    return sorted(int(v.name[1:]) for v in projeto.glob('versoes/v*') if v.name[1:].isdigit() and (v / 'proxy.mp4').is_file())


def projetos() -> list[dict]:
    """Os projetos com ao menos uma versão, do mais recente para o mais antigo, com o estado da revisão da última."""
    lista = []
    for p in PROJETOS.iterdir() if PROJETOS.is_dir() else []:
        vs = versoes(p)
        if not vs:
            continue
        ultima = vs[-1]
        rev = ler_json(p / 'revisoes' / f'v{ultima}.json', {}) or {}
        info = ler_json(p / 'versoes' / f'v{ultima}' / 'info.json', {}) or {}
        estado = 'aprovado' if rev.get('aprovado') else 'enviada' if rev.get('enviado_em') else 'em_revisao'
        lista.append({'slug': p.name, 'nome': (ler_json(p / 'edicao.json', {}) or {}).get('nome') or p.name,
                      'versoes': vs, 'ultima': ultima, 'duracao': info.get('duracao'), 'estado': estado,
                      'comentarios': len(rev.get('comentarios', [])),
                      'atualizado': (p / 'versoes' / f'v{ultima}' / 'proxy.mp4').stat().st_mtime})
    return sorted(lista, key=lambda x: -x['atualizado'])


def juntar_respostas(nova: dict, atual: dict) -> dict:
    """O app grava a revisão inteira; o que o Claude respondeu no arquivo (status, resposta) nunca é apagado por ela."""
    respondidos = {c.get('id'): c for c in atual.get('comentarios', []) if c.get('resposta') or c.get('status', 'pendente') != 'pendente'}
    for c in nova.get('comentarios', []):
        r = respondidos.get(c.get('id'))
        if r and c.get('status', 'pendente') == 'pendente' and not c.get('resposta'):
            c['status'], c['resposta'] = r.get('status'), r.get('resposta')
    if atual.get('resposta_geral') and not nova.get('resposta_geral'):
        nova['resposta_geral'] = atual['resposta_geral']
    return nova


# ---------------------------------------------------------------- rotas

ROTAS: list[tuple[str, re.Pattern, callable]] = []


def rota(metodo: str, padrao: str):
    def registrar(f):
        ROTAS.append((metodo, re.compile(f'^{padrao}$'), f))
        return f
    return registrar


def calibragem():
    """O módulo da calibragem (importado na hora: ele é escrito à parte e só usa a biblioteca padrão na importação)."""
    try:
        import calibragem as c
    except ImportError as e:
        raise Erro(f'A calibragem ainda não está disponível no servidor ({e}).', 503) from e
    return c


def arquivo_json(pasta: Path, id_: str) -> Path:
    caminho = pasta / f'{id_}.json'
    if not caminho.is_file():
        raise Erro(f'Não encontrei {id_} em {pasta.relative_to(RAIZ)}', 404)
    return caminho


@rota('GET', '/api/projetos')
def _projetos(h, q):
    return projetos()


@rota('GET', '/api/lista')
def _lista(h, q):  # nomes de arquivos de uma pasta pública: ?pasta=biblioteca/presets
    alvo = (RAIZ / q.get('pasta', [''])[0]).resolve()
    if not alvo.is_dir() or not str(alvo).startswith(str(RAIZ)) or alvo.relative_to(RAIZ).parts[:1] not in [(p,) for p in PUBLICOS]:
        raise Erro('pasta inválida')
    return sorted(p.name + ('/' if p.is_dir() else '') for p in alvo.iterdir() if not p.name.startswith('.'))


@rota('PUT', r'/api/revisao/([\w-]+)/v(\d+)')
def _revisao(h, q, slug, v):  # o app grava a revisão inteira
    if not (PROJETOS / slug).is_dir():
        raise Erro('rota inválida', 404)
    destino = PROJETOS / slug / 'revisoes' / f'v{v}.json'
    gravar_json(destino, juntar_respostas(h.corpo(), ler_json(destino, {}) or {}))
    return {'ok': True}


# ---- calibragem e referências

@rota('GET', '/api/referencias')
def _referencias(h, q):
    return calibragem().listar_referencias()


@rota('POST', '/api/referencias')
def _subir_referencia(h, q):
    """O vídeo vem cru no corpo (o nome em X-Nome): vai para um temporário com o nome original e entra na fila."""
    nome = Path(unquote(h.headers.get('X-Nome') or 'video.mp4')).name
    if Path(nome).suffix.lower() not in ('.mp4', '.mov', '.m4v', '.webm'):
        raise Erro(f'{nome}: não é um vídeo (mp4, mov, m4v ou webm).', 422)
    resta = int(h.headers.get('Content-Length') or 0)
    if not resta:
        raise Erro('Arquivo vazio.', 422)
    pasta = Path(tempfile.mkdtemp(prefix='referencia-'))
    try:
        destino = pasta / re.sub(r'[^\w. -]', '_', nome)
        with open(destino, 'wb') as f:
            while resta > 0:
                bloco = h.rfile.read(min(1 << 20, resta))
                if not bloco:
                    break
                f.write(bloco)
                resta -= len(bloco)
        if resta:
            raise Erro('O envio parou no meio.', 400)
        return {'id': calibragem().enfileirar_analise(str(destino), Path(nome).stem)}
    finally:
        shutil.rmtree(pasta, ignore_errors=True)


@rota('GET', '/api/referencias/clipes')
def _clipes(h, q):
    return calibragem().clipes()


@rota('GET', f'/api/referencias/{ID}/revisao')
def _revisao_referencia(h, q, id_):
    return calibragem().revisao(id_)


@rota('PUT', f'/api/referencias/{ID}/direcao')
def _salvar_direcao(h, q, id_):
    return calibragem().salvar_edicao(id_, h.corpo().get('itens') or [])


@rota('PUT', f'/api/referencias/{ID}/status')
def _status(h, q, id_):
    return calibragem().marcar_revisada(id_, bool(h.corpo().get('revisado'))) or {'ok': True}


@rota('PUT', f'/api/referencias/{ID}/nome')
def _renomear(h, q, id_):
    return calibragem().renomear(id_, str(h.corpo().get('nome') or '').strip()[:120]) or {'ok': True}


@rota('PUT', f'/api/referencias/{ID}/favorito')
def _favoritar(h, q, id_):
    c = h.corpo()
    return calibragem().favoritar(id_, float(c['inicio']), float(c['fim']), bool(c.get('favorito'))) or {'ok': True}


@rota('POST', f'/api/referencias/{ID}/reanalisar')
def _reanalisar(h, q, id_):
    return calibragem().reanalisar(id_) or {'ok': True}


@rota('POST', f'/api/referencias/{ID}/tentar')
def _tentar(h, q, id_):
    return calibragem().tentar_de_novo(id_) or {'ok': True}


@rota('DELETE', f'/api/referencias/{ID}')
def _apagar_referencia(h, q, id_):
    return calibragem().apagar(id_) or {'ok': True}


# ---- heurística: as regras (Markdown) e os roteiros de exemplo

def roteiros() -> list[dict]:
    """Os roteiros de exemplo (exemplos/roteiros/<ref>.md), linha a linha: a marcação entre [ ] e a fala. A linha k é o
    plano k da direção da referência (os roteiros são escritos dela, um bloco por plano): daí vêm o tipo e os tempos."""
    out = []
    for md in sorted((EXEMPLOS / 'roteiros').glob('*.md')):
        base = REFERENCIAS / md.stem
        info = ler_json(base / 'referencia.json', {}) or {}
        itens = (ler_json(base / 'direcao.json', {}) or {}).get('itens') or []
        planos = sorted((i for i in itens if i.get('camada') == 'plano'), key=lambda i: i['inicio'])
        titulo, linhas = md.stem, []
        for s in md.read_text(encoding='utf-8').splitlines():
            s = s.strip()
            if s.startswith('# '):
                titulo = s[2:].strip()
            elif s.startswith('[') and s.endswith(']'):
                linhas.append({'marcacao': s[1:-1], 'fala': ''})
            elif s and linhas:
                linhas[-1]['fala'] = (linhas[-1]['fala'] + ' ' + s.strip('“”"')).strip()
        if len(planos) == len(linhas):
            for linha, p in zip(linhas, planos):
                linha |= {'tipo': p.get('tipo'), 'inicio': p['inicio'], 'fim': p['fim']}
        out.append({'ref': md.stem, 'nome': info.get('nome') or titulo, 'revisado': info.get('status') == 'revisado',
                    'proxy': (base / 'proxy.mp4').is_file(), 'linhas': linhas})
    return out


@rota('GET', '/api/heuristica')
def _heuristica(h, q):
    arq = EXEMPLOS / 'regras.md'
    return {'regras': arq.read_text(encoding='utf-8') if arq.is_file() else '', 'roteiros': roteiros()}


@rota('PUT', '/api/heuristica')
def _salvar_heuristica(h, q):
    regras = h.corpo().get('regras')
    if not isinstance(regras, str) or not regras.strip():
        raise Erro('As regras não podem ficar vazias.', 422)
    if len(regras) > 20000:
        raise Erro('As regras passaram de 20.000 caracteres.', 422)
    (EXEMPLOS / 'regras.md').write_text(regras.rstrip() + '\n', encoding='utf-8')
    return {'ok': True}


# ---- presets, transições, banco e motions

def gravar_ordem(arq: Path, chave: str, ids, favoritos, campo: str, maximo: int) -> dict:
    """A ordem de uma situação (presets) ou de um par (transições), no formato do 18: {ids, favoritos|favoritas}."""
    if not isinstance(ids, list) or not all(isinstance(i, str) for i in ids):
        raise Erro('ids deve ser uma lista de ids', 422)
    ordem = ler_json(arq, {}) or {}
    if ids:
        ordem[chave] = {'ids': ids, campo: max(0, min(int(favoritos or 0), maximo, len(ids)))}
    else:
        ordem.pop(chave, None)  # "Limpar a ordem": volta a uma lista só
    gravar_json(arq, ordem)
    return ordem


@rota('PUT', '/api/presets/ordem')
def _ordem_presets(h, q):
    c = h.corpo()
    if not CHAVE_PRESET.match(str(c.get('chave'))):
        raise Erro(f'Situação inválida: {c.get("chave")}', 422)
    return gravar_ordem(BIBLIOTECA / 'presets' / 'ordem.json', c['chave'], c.get('ids'), c.get('favoritos'), 'favoritos', 3)


@rota('PUT', '/api/transicoes/ordem')
def _ordem_transicoes(h, q):
    c = h.corpo()
    if not CHAVE_TRANSICAO.match(str(c.get('chave'))):
        raise Erro(f'Par inválido: {c.get("chave")}', 422)
    return gravar_ordem(BIBLIOTECA / 'transicoes' / 'ordem.json', c['chave'], c.get('ids'), c.get('favoritas'), 'favoritas', 2)


def aprovar_json(pasta: Path, id_: str, aprovado) -> dict:
    arq = arquivo_json(pasta, id_)
    dados = ler_json(arq)
    dados['aprovado'] = bool(aprovado)
    gravar_json(arq, dados)
    return dados


@rota('PUT', f'/api/presets/{ID}')
def _aprovar_preset(h, q, id_):
    return aprovar_json(BIBLIOTECA / 'presets', id_, h.corpo().get('aprovado'))


@rota('PUT', f'/api/transicoes/{ID}')
def _aprovar_transicao(h, q, id_):
    return aprovar_json(BIBLIOTECA / 'transicoes', id_, h.corpo().get('aprovado'))


def _banco():
    import banco
    return banco


def ler_midia(b, id_: str) -> dict:
    try:
        return b.ler_item(id_)
    except SystemExit as e:
        raise Erro(str(e), 404) from e


@rota('GET', r'/api/banco/(\w+)')
def _midia(h, q, id_):
    b = _banco()
    item, usos = ler_midia(b, id_), b.usos()
    trechos = sorted((t for t in b.todos() if t.get('pai') == id_), key=lambda t: t.get('inicio', 0))
    return {'item': item, 'usos': usos.get(id_, []), 'trechos': [{**t, 'usos': usos.get(t['id'], [])} for t in trechos]}


@rota('PUT', r'/api/banco/(\w+)')
def _editar_midia(h, q, id_):
    b = _banco()
    ler_midia(b, id_)
    c, item = h.corpo(), ler_json(b.pasta_item(id_) / 'item.json')
    if 'nome' in c:
        if not str(c['nome']).strip():
            raise Erro('O nome não pode ficar vazio.', 422)
        item['nome'] = str(c['nome']).strip()[:200]
    if 'descricao' in c and not item.get('pai'):
        item['descricao'] = str(c['descricao'] or '').strip()
    if 'palavras' in c and not item.get('pai'):
        item['palavras'] = [str(p).strip() for p in c['palavras'] or [] if str(p).strip()][:30]
    b.salvar_item(item)
    return {'item': b.ler_item(id_)}


@rota('DELETE', r'/api/banco/(\w+)')
def _apagar_midia(h, q, id_):
    b = _banco()
    ler_midia(b, id_)
    try:
        return {'apagados': b.apagar(id_)}
    except SystemExit as e:  # está em uso num projeto
        raise Erro(str(e), 409) from e


@rota('PUT', r'/api/motions/([\w-]+)/aprovar')
def _aprovar_motion(h, q, id_):
    """Tira o "a_revisar" do JSON do topo do preset (só aquele JSON é reescrito; o resto do arquivo fica igual)."""
    arq = BIBLIOTECA / 'motions' / 'presets' / f'{id_}.html'
    if not arq.is_file():
        raise Erro(f'Motion não encontrado: {id_}', 404)
    html = arq.read_text(encoding='utf-8')
    m = JSON_DO_MOTION.search(html)
    if not m:
        raise Erro(f'{arq.name} não tem o JSON do preset no topo.', 422)
    dados = json.loads(m.group(2))
    dados.pop('a_revisar', None)
    arq.write_text(html[:m.start(2)] + json.dumps(dados, ensure_ascii=False) + html[m.end(2):], encoding='utf-8')
    return dados


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(RAIZ), **k)

    def log_message(self, format, *args):  # noqa: A002 — silencioso: o render faz milhares de pedidos
        pass

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Accept-Ranges', 'bytes')
        super().end_headers()

    def _json(self, dados, status=200):
        corpo = json.dumps(dados, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(corpo)))
        self.end_headers()
        self.wfile.write(corpo)

    def corpo(self) -> dict:
        try:
            return json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))) or b'{}')
        except ValueError as e:
            raise Erro('JSON inválido no corpo') from e

    def _api(self, metodo: str) -> bool:
        """Responde se a rota é da API (True); senão, deixa para os arquivos estáticos."""
        url = urlparse(self.path)
        for m, padrao, f in ROTAS:
            achou = padrao.match(url.path)
            if achou and m == metodo:
                break
        else:
            if url.path.startswith('/api/'):
                self._json({'erro': 'rota inválida'}, 404)
                return True
            return False
        try:
            self._json(f(self, parse_qs(url.query), *achou.groups()))
        except Erro as e:
            self._json({'erro': str(e)}, e.status)
        except ValueError as e:  # a validação da calibragem: a mensagem é para o criador ler
            self._json({'erro': str(e)}, 422)
        except (FileNotFoundError, KeyError) as e:
            self._json({'erro': f'Não encontrado: {e}'}, 404)
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as e:  # noqa: BLE001 — o app mostra a mensagem em vez de ficar sem resposta
            self._json({'erro': f'{type(e).__name__}: {e}'}, 500)
        return True

    def do_GET(self):
        url = urlparse(self.path)
        if url.path == '/':
            self.send_response(HTTPStatus.FOUND)
            self.send_header('Location', '/app/')
            self.end_headers()
            return
        if url.path.startswith('/api/motions/fonte/'):
            fonte = Path('/System/Library/Fonts') / FONTES_DO_MAC.get(url.path.rsplit('/', 1)[1], '-')
            if not fonte.is_file():
                return self.send_error(404)
            corpo = fonte.read_bytes()
            self.send_response(200)
            self.send_header('Content-Type', 'font/ttf')
            self.send_header('Content-Length', str(len(corpo)))
            self.end_headers()
            return self.wfile.write(corpo)
        if self._api('GET'):
            return
        partes = Path(url.path).parts
        if len(partes) < 2 or partes[1] not in PUBLICOS:
            return self.send_error(404)
        if 'Range' in self.headers:
            return self._range()
        super().do_GET()

    def do_PUT(self):
        self._api('PUT') or self._json({'erro': 'rota inválida'}, 404)

    def do_POST(self):
        self._api('POST') or self._json({'erro': 'rota inválida'}, 404)

    def do_DELETE(self):
        self._api('DELETE') or self._json({'erro': 'rota inválida'}, 404)

    def _range(self):
        caminho = Path(self.translate_path(self.path))
        if not caminho.is_file():
            return self.send_error(404)
        tamanho = caminho.stat().st_size
        m = re.match(r'bytes=(\d*)-(\d*)', self.headers['Range'])
        ini = int(m.group(1)) if m and m.group(1) else 0
        fim = int(m.group(2)) if m and m.group(2) else tamanho - 1
        if m and not m.group(1) and m.group(2):  # bytes=-N: os últimos N
            ini, fim = max(tamanho - int(m.group(2)), 0), tamanho - 1
        fim = min(fim, tamanho - 1)
        if ini > fim:
            self.send_response(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
            self.send_header('Content-Range', f'bytes */{tamanho}')
            return self.end_headers()
        self.send_response(HTTPStatus.PARTIAL_CONTENT)
        self.send_header('Content-Type', self.guess_type(str(caminho)))
        self.send_header('Content-Range', f'bytes {ini}-{fim}/{tamanho}')
        self.send_header('Content-Length', str(fim - ini + 1))
        self.end_headers()
        with open(caminho, 'rb') as f:
            f.seek(ini)
            resta = fim - ini + 1
            try:
                while resta > 0:
                    bloco = f.read(min(1 << 20, resta))
                    if not bloco:
                        break
                    self.wfile.write(bloco)
                    resta -= len(bloco)
            except (BrokenPipeError, ConnectionResetError):
                pass


Handler.extensions_map |= {'.mjs': 'text/javascript', '.webm': 'video/webm', '.m4a': 'audio/mp4', '.cube': 'text/plain'}


def servir(porta: int = 0) -> ThreadingHTTPServer:
    """Sobe o servidor numa thread (porta 0 = livre) e devolve-o; a porta fica em `.server_address[1]`."""
    srv = ThreadingHTTPServer(('127.0.0.1', porta), Handler)
    srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


if __name__ == '__main__':
    porta = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get('PORTA', PORTA))
    print(f'Editor: http://localhost:{porta}/app/')
    ThreadingHTTPServer(('127.0.0.1', porta), Handler).serve_forever()
