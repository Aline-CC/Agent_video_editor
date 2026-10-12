# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///
"""Os CTAs: trechos finais de vídeos já editados (com legenda, motion e áudio prontos), que entram inteiros no fim de um
orgânico e dão as saídas do projeto (📱 Reels ManyChat, 📱 ManyChat TikTok, 💰 Ad LP, 💰 Ad VSL…).

Cada CTA mora em `biblioteca/ctas/<id>/`: `original.<ext>` (o vídeo editado inteiro), `proxy.mp4`, `miniatura.jpg` e
`cta.json` {id, nome, categoria, produto, inicio, fim, duracao, favorito, fonte, criado_em}. `inicio`/`fim`: onde o CTA começa e
termina no vídeo (sem marcar, o vídeo todo). As categorias (e a saída que cada uma dá) ficam em `biblioteca/ctas/
categorias.json`; o favorito de cada categoria é o que entra por padrão.

    uv run ferramentas/ctas.py adicionar <arquivo> [--nome N] [--categoria C] [--fonte url]
    uv run ferramentas/ctas.py listar
"""
import argparse
import shutil
import sys
import uuid
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from base import BIBLIOTECA, ffmpeg, gravar_json, inspecionar, ler_json  # noqa: E402

RAIZ = BIBLIOTECA / 'ctas'
EXT = ('.mp4', '.mov', '.m4v', '.webm')
# a categoria de um CTA define a saída que ele dá ao projeto (o criador pode criar mais em categorias.json)
CATEGORIAS = [
    {'id': 'manychat-instagram', 'nome': 'ManyChat Instagram', 'saida': 'Reels ManyChat', 'emoji': '📱'},
    {'id': 'manychat-tiktok', 'nome': 'ManyChat TikTok/Shorts', 'saida': 'ManyChat TikTok', 'emoji': '📱'},
    {'id': 'lp', 'nome': 'Landing page', 'saida': 'Ad LP', 'emoji': '💰'},
    {'id': 'vsl', 'nome': 'VSL', 'saida': 'Ad VSL', 'emoji': '💰'},
    {'id': 'vsl-isca', 'nome': 'VSL-isca', 'saida': 'Ad VSL-isca', 'emoji': '💰'},
]


# os produtos a que um CTA leva (o criador edita no painel da página CTAs)
PRODUTOS = [
    {'id': 'claude', 'nome': 'Claude', 'emoji': '✴️'},
    {'id': 'fia', 'nome': 'FIA', 'emoji': '🤖'},
    {'id': 'fid', 'nome': 'FID', 'emoji': '🎨'},
]


def produtos() -> list[dict]:
    arq = RAIZ / 'produtos.json'
    if not arq.exists():
        RAIZ.mkdir(parents=True, exist_ok=True)
        gravar_json(arq, PRODUTOS)
    return ler_json(arq, PRODUTOS) or []


def salvar_produtos(lista: list[dict]) -> list[dict]:
    """Grava a lista inteira (nome e emoji editados, novos sem id ganham um). Um produto apagado sai dos CTAs."""
    out, vistos = [], set()
    for p in lista:
        nome = str(p.get('nome') or '').strip()[:60]
        if not nome:
            continue
        pid = str(p.get('id') or '').strip() or uuid.uuid4().hex[:8]
        if pid in vistos:
            continue
        vistos.add(pid)
        out.append({'id': pid, 'nome': nome, 'emoji': str(p.get('emoji') or '').strip()[:8]})
    gravar_json(RAIZ / 'produtos.json', out)
    for c in todos():
        if c.get('produto') and c['produto'] not in vistos:
            c['produto'] = None
            salvar(c)
    return out


def categorias() -> list[dict]:
    arq = RAIZ / 'categorias.json'
    if not arq.exists():
        RAIZ.mkdir(parents=True, exist_ok=True)
        gravar_json(arq, CATEGORIAS)
    return ler_json(arq, CATEGORIAS) or CATEGORIAS


def ler(cid: str) -> dict:
    d = ler_json(RAIZ / cid / 'cta.json')
    if not d:
        raise SystemExit(f'CTA não encontrado: {cid}')
    return d


def salvar(c: dict) -> dict:
    gravar_json(RAIZ / c['id'] / 'cta.json', c)
    return c


def todos() -> list[dict]:
    return sorted((ler_json(a, {}) for a in RAIZ.glob('*/cta.json')), key=lambda c: c.get('criado_em') or '', reverse=True)


def adicionar(arquivo: Path, nome: str | None = None, categoria: str | None = None, fonte: str = 'upload', mover: bool = False) -> dict:
    arquivo = Path(arquivo)
    if arquivo.suffix.lower() not in EXT:
        raise SystemExit(f'Use um vídeo (MP4, MOV, M4V ou WebM): {arquivo.name}')
    cid = uuid.uuid4().hex[:10]
    pasta = RAIZ / cid
    pasta.mkdir(parents=True)
    alvo = pasta / f'original{arquivo.suffix.lower()}'
    (shutil.move if mover else shutil.copy2)(str(arquivo), alvo)
    try:
        info = inspecionar(alvo)
        ffmpeg('-i', str(alvo), '-vf', "scale='if(gt(iw,ih),min(1280,iw),-2)':'if(gt(iw,ih),-2,min(1280,ih))'", '-c:v', 'libx264',
               '-pix_fmt', 'yuv420p', '-crf', '23', '-preset', 'veryfast', '-g', '12', '-keyint_min', '12', '-sc_threshold', '0',
               '-c:a', 'aac', '-movflags', '+faststart', str(pasta / 'proxy.mp4'))
        dur = info.get('duracao') or 0.0
        ffmpeg('-ss', f'{max(dur - 2, 0):.2f}', '-i', str(pasta / 'proxy.mp4'), '-frames:v', '1', '-vf', 'scale=-2:360', '-q:v', '4',
               str(pasta / 'miniatura.jpg'))
    except Exception:
        shutil.rmtree(pasta, ignore_errors=True)
        raise
    return salvar({'id': cid, 'nome': (nome or arquivo.stem).strip()[:200], 'categoria': categoria, 'inicio': 0.0, 'fim': round(dur, 3),
                   'duracao': round(dur, 3), 'largura': info.get('largura'), 'altura': info.get('altura'), 'favorito': False,
                   'fonte': fonte, 'arquivo': alvo.name, 'criado_em': datetime.now().isoformat(timespec='seconds')})


def editar(cid: str, dados: dict) -> dict:
    c = ler(cid)
    if 'nome' in dados and str(dados['nome']).strip():
        c['nome'] = str(dados['nome']).strip()[:200]
    if 'categoria' in dados:
        if dados['categoria'] and dados['categoria'] not in {k['id'] for k in categorias()}:
            raise SystemExit(f'Categoria desconhecida: {dados["categoria"]}')
        c['categoria'] = dados['categoria'] or None
    if 'produto' in dados:
        if dados['produto'] and dados['produto'] not in {p['id'] for p in produtos()}:
            raise SystemExit(f'Produto desconhecido: {dados["produto"]}')
        c['produto'] = dados['produto'] or None
    if 'inicio' in dados or 'fim' in dados:
        ini = round(max(float(dados.get('inicio', c['inicio'])), 0.0), 3)
        fim = round(min(float(dados.get('fim', c['fim'])), c['duracao']), 3)
        if fim - ini < 0.5:
            raise SystemExit('O CTA precisa de pelo menos 0,5 s')
        c['inicio'], c['fim'] = ini, fim
        ffmpeg('-ss', f'{(ini + fim) / 2:.3f}', '-i', str(RAIZ / cid / 'proxy.mp4'), '-frames:v', '1', '-vf', 'scale=-2:360', '-q:v', '4',
               str(RAIZ / cid / 'miniatura.jpg'))
    if dados.get('favorito'):  # um favorito por categoria
        for o in todos():
            if o['id'] != cid and o.get('categoria') == c.get('categoria') and o.get('favorito'):
                o['favorito'] = False
                salvar(o)
        c['favorito'] = True
    elif 'favorito' in dados:
        c['favorito'] = False
    return salvar(c)


def tira(cid: str) -> Path:
    """A tira de quadros do vídeo (24 quadros numa linha), o fundo da linha do tempo de marcar o CTA."""
    c = ler(cid)
    alvo = RAIZ / cid / 'tira.jpg'
    if not alvo.exists():
        ffmpeg('-i', str(RAIZ / cid / 'proxy.mp4'), '-vf', f'fps={24 / max(c["duracao"], 0.1):.6f},scale=-2:90,tile=24x1',
               '-frames:v', '1', '-q:v', '5', str(alvo))
    return alvo


def apagar(cid: str) -> None:
    ler(cid)
    lixeira = RAIZ / '_lixeira'
    lixeira.mkdir(exist_ok=True)
    shutil.move(str(RAIZ / cid), str(lixeira / f'{cid}-{datetime.now():%Y%m%d-%H%M%S}'))


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description='Os CTAs (biblioteca/ctas/).')
    sub = ap.add_subparsers(dest='cmd', required=True)
    a = sub.add_parser('adicionar')
    a.add_argument('arquivo')
    a.add_argument('--nome')
    a.add_argument('--categoria')
    a.add_argument('--fonte', default='upload')
    sub.add_parser('listar')
    args = ap.parse_args()
    if args.cmd == 'adicionar':
        c = adicionar(Path(args.arquivo), args.nome, args.categoria, args.fonte)
        print(c['id'], c['nome'], f'{c["duracao"]} s')
    else:
        cats = {k['id']: k['nome'] for k in categorias()}
        for c in todos():
            print(f'{c["id"]}  {cats.get(c.get("categoria"), "sem categoria"):<24} {c["inicio"]:.1f}–{c["fim"]:.1f} s'
                  f'{"  ★" if c.get("favorito") else ""}  {c["nome"]}')
