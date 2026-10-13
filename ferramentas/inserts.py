# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Inserts e motions: liga as mídias do banco a cada pedido de insert e põe o motion de cada plano de motion (do 18:
backend/app/inserts.py `definir_midias` e motions.py `usar`). Os pedidos saem da direção (direcao.py aplicar).

    uv run ferramentas/inserts.py listar <slug>
    uv run ferramentas/inserts.py ligar <slug> <plano> <banco_id> [<banco_id>…]     (até 12, na ordem)
    uv run ferramentas/inserts.py juntar <slug>        liga o que cada subagente achou (projetos/<slug>/inserts/<plano>.json)
    uv run ferramentas/inserts.py motion <slug> <plano> <preset> [--valores '{"campo": "texto"}'] [--fundo id]
    uv run ferramentas/inserts.py motion <slug> <plano> --video <banco_id>

O resultado de um subagente: {"plano": "p5", "midias": ["<banco_id>", …], "fontes": ["url", …], "nota": "…"}.
"""
import argparse
import json
import re
import sys
import uuid
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import banco  # noqa: E402
from base import BIBLIOTECA, gravar, ler, ler_json, pasta  # noqa: E402
from cortes import num, seg  # noqa: E402
from direcao import PLANOS, saida_do, tempos  # noqa: E402

MAX_MIDIAS = 12
PRESETS_MOTION = BIBLIOTECA / 'motions' / 'presets'
FORMATO_MOTION = {'motion_tela_cheia': 'vertical', 'tela_dividida_motion': 'dividida'}
FUNDOS = ('verde_claro', 'papel', 'nevoa', 'chuva', 'gradiente', 'cinza', 'preto')  # do 18: inserts.FUNDOS


def pedido(edicao: dict, plano: str) -> dict:
    for x in (edicao.get('inserts') or {}).get('pedidos') or []:
        if plano in (x.get('plano'), x.get('id')):
            return x
    planos = [x.get('plano') for x in (edicao.get('inserts') or {}).get('pedidos') or []]
    raise SystemExit(f'O plano {plano} não tem pedido de insert (têm: {", ".join(planos) or "nenhum; rode direcao.py aplicar"}).')


def definir_midias(x: dict, ids: list[str]) -> list[dict]:
    """As mídias do pedido, em ordem (a mesma mídia mantém o seu id de ligação)."""
    if len(ids) > MAX_MIDIAS:
        raise SystemExit(f'No máximo {MAX_MIDIAS} mídias por insert ({len(ids)} pedidas).')
    faltam = [b for b in ids if not banco.existe(b)]
    if faltam:
        raise SystemExit(f'Mídia não encontrada no banco: {", ".join(faltam)}')
    antigas = {m['banco']: m['id'] for m in x.get('midias') or []}
    x['midias'] = [{'id': antigas.pop(b, None) or uuid.uuid4().hex[:8], 'banco': b} for b in ids]
    return x['midias']


def descrever_midia(bid: str) -> str:
    if not banco.existe(bid):
        return f'{bid} (não existe mais no banco)'
    i = banco.ler_item(bid)
    tipo = 'trecho' if i.get('pai') else {'video': 'vídeo'}.get(i['tipo'], i['tipo'])
    dur = f', {num(i.get("duracao") or 0, 1)} s' if i['tipo'] == 'video' else ''
    return f'{bid} {i.get("nome")} ({tipo} {i.get("formato")}{dur})'


def nome_preset(pid: str | None) -> str:
    p = ler_json(BIBLIOTECA / 'presets' / f'{pid}.json') if pid else None
    return f'{pid} {p.get("nome")}' if p else (pid or '')


# ---------------------------------------------------------------- presets de motion

def ler_preset_motion(pid: str) -> dict:
    """O JSON do topo do preset (`id="preset"`: nome, fundo sugerido…) e os campos (`id="campos"`); do 18: motions.ler_preset."""
    arq = PRESETS_MOTION / f'{pid}.html'
    if not re.fullmatch(r'[a-z0-9-]{1,40}', pid or '') or not arq.exists():
        existentes = ', '.join(sorted(a.stem for a in PRESETS_MOTION.glob('*.html')))
        raise SystemExit(f'Preset de motion não encontrado: {pid} (existem: {existentes})')
    html = arq.read_text(encoding='utf-8')

    def bloco(sid):
        m = re.search(rf'<script[^>]*id=["\']{sid}["\'][^>]*>(.*?)</script>', html, re.S)
        try:
            d = json.loads(m.group(1)) if m else {}
        except ValueError:
            return {}
        return d if isinstance(d, dict) else {}
    info = bloco('preset')
    return {'id': pid, 'nome': str(info.get('nome') or pid), 'fundo': info.get('fundo') or 'gradiente', 'campos': bloco('campos')}


def motion(slug: str, plano: str, preset: str | None, valores: dict, fundo: str | None, video: str | None) -> None:
    edicao = ler(slug)
    item = next((i for i in (edicao.get('direcao') or {}).get('itens') or [] if i['id'] == plano and i['camada'] == 'plano'), None)
    if item is None:
        raise SystemExit(f'O plano {plano} não existe na direção.')
    formato = FORMATO_MOTION.get(item['tipo'])
    if formato is None:
        raise SystemExit(f'O plano {plano} é {PLANOS.get(item["tipo"], item["tipo"])}: só planos de motion (Motion tela cheia, '
                         'Tela dividida · motion) recebem motion.')
    if video:
        if not banco.existe(video):
            raise SystemExit(f'Mídia não encontrada no banco: {video}')
        i = banco.ler_item(video)
        if i['tipo'] != 'video':
            raise SystemExit(f'{video} é {i["tipo"]}: o motion por vídeo precisa de um vídeo do banco.')
        info = {'tipo': 'video', 'banco': video, 'nome': i.get('nome') or 'Vídeo', 'formato': formato}
    else:
        p = ler_preset_motion(preset)
        desconhecidos = [k for k in valores if k not in p['campos']]
        if desconhecidos:
            raise SystemExit(f'Campos que o preset {preset} não tem: {", ".join(desconhecidos)} (tem: {", ".join(p["campos"]) or "nenhum"})')
        for k, c in p['campos'].items():
            if (c or {}).get('tipo') == 'imagem' and k in valores and not banco.existe(str(valores[k])):
                raise SystemExit(f'O campo {k} é uma imagem do banco: {valores[k]} não existe lá.')
        fundo = fundo or p['fundo']
        if fundo not in FUNDOS:
            raise SystemExit(f'Fundo desconhecido: {fundo} (use: {", ".join(FUNDOS)})')
        info = {'tipo': 'preset', 'preset': p['id'], 'nome': p['nome'], 'formato': formato,
                'valores': {k: str(v)[:500] for k, v in valores.items()}, 'fundo': fundo}
    info['usado_em'] = datetime.now().isoformat(timespec='seconds')
    edicao.setdefault('motions', {})[plano] = info
    gravar(slug, edicao)
    print(f'{plano}: {resumo_motion(info)}')


def resumo_motion(m: dict | None) -> str:
    if not m:
        return 'SEM MOTION'
    if m['tipo'] == 'video':
        return f'vídeo {descrever_midia(m["banco"])}'
    valores = ', '.join(f'{k}: «{v}»' for k, v in (m.get('valores') or {}).items()) or 'valores padrão'
    return f'preset {m["preset"]} «{m.get("nome")}» · {valores} · fundo {m.get("fundo")}'


# ---------------------------------------------------------------- comandos

def listar(slug: str) -> None:
    edicao = ler(slug)
    itens = (edicao.get('direcao') or {}).get('itens') or []
    if not itens:
        raise SystemExit(f'O projeto {slug} ainda não tem direção (rode direcao.py aplicar).')
    saida = saida_do(slug, edicao)
    t = tempos(itens, saida)
    idx = {w['id']: k for k, w in enumerate(saida)}
    pedidos = {x.get('plano'): x for x in (edicao.get('inserts') or {}).get('pedidos') or []}
    motions = edicao.get('motions') or {}
    feitos = total = 0
    for pl in (i for i in itens if i['camada'] == 'plano'):
        x = pedidos.get(pl['id'])
        if x is None and pl['tipo'] not in FORMATO_MOTION:
            continue
        total += 1
        a, b = t[pl['id']]
        formato = x['formato'] if x else FORMATO_MOTION[pl['tipo']]
        print(f'{pl["id"]}  {PLANOS.get(pl["tipo"], pl["tipo"])} · {formato}  {seg(a)} +{num(b - a, 1)} s')
        fala = x['fala'] if x else ' '.join(w['texto'] for w in saida[idx[pl['palavra_ini']]:idx[pl['palavra_fim']] + 1])
        print(f'    fala: “{fala}”')
        print(f'    marcação: {pl.get("descricao") or "—"}')
        if pl.get('texto'):
            print(f'    texto: «{pl["texto"]}»')
        if x:
            midias = x.get('midias') or []
            feitos += bool(midias)
            print('    mídias: ' + ('; '.join(descrever_midia(m['banco']) for m in midias) if midias else 'SEM MÍDIA'))
            if (x.get('enriquecimento') or {}).get('preset'):
                print(f'    preset: {nome_preset(x["enriquecimento"]["preset"])}')
        else:
            feitos += pl['id'] in motions
            print(f'    motion: {resumo_motion(motions.get(pl["id"]))}')
        print()
    print(f'{feitos}/{total} com mídia ou motion')


def ligar(slug: str, plano: str, ids: list[str]) -> None:
    edicao = ler(slug)
    x = pedido(edicao, plano)
    midias = definir_midias(x, ids)
    gravar(slug, edicao)
    print(f'{x["plano"]}: ' + '; '.join(descrever_midia(m['banco']) for m in midias))


def juntar(slug: str) -> None:
    edicao = ler(slug)
    arquivos = sorted((pasta(slug) / 'inserts').glob('*.json'))
    if not arquivos:
        raise SystemExit(f'Nenhum resultado em projetos/{slug}/inserts/ (um <plano>.json por subagente).')
    for arq in arquivos:
        try:
            r = json.loads(arq.read_text(encoding='utf-8'))
        except ValueError as e:
            print(f'{arq.name}: JSON inválido ({e}); pulado')
            continue
        plano = str(r.get('plano') or arq.stem)
        nota = f'  ({r["nota"]})' if r.get('nota') else ''
        try:
            x = pedido(edicao, plano)
        except SystemExit as e:
            print(f'{arq.name}: {e}')
            continue
        ids = [str(b) for b in r.get('midias') or []]
        validos = [b for b in ids if banco.existe(b)]
        if len(validos) < len(ids):
            print(f'{plano}: fora do banco, ignoradas: {", ".join(b for b in ids if b not in validos)}')
        if not validos:
            print(f'{plano}: nada para ligar{nota}')
            continue
        definir_midias(x, validos[:MAX_MIDIAS])
        print(f'{plano}: ligou {"; ".join(descrever_midia(b) for b in validos[:MAX_MIDIAS])}{nota}')
    gravar(slug, edicao)
    sem = [x['plano'] for x in edicao['inserts']['pedidos'] if not x.get('midias')]
    print(f'\nSem mídia: {", ".join(sem)}' if sem else '\nTodos os inserts têm mídia.')


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description='Inserts e motions de um projeto.', usage=__doc__)
    sub = ap.add_subparsers(dest='cmd', required=True)
    sub.add_parser('listar').add_argument('slug')
    li = sub.add_parser('ligar')
    li.add_argument('slug')
    li.add_argument('plano')
    li.add_argument('ids', nargs='+')
    sub.add_parser('juntar').add_argument('slug')
    mo = sub.add_parser('motion')
    mo.add_argument('slug')
    mo.add_argument('plano')
    mo.add_argument('preset', nargs='?')
    mo.add_argument('--valores', default='{}')
    mo.add_argument('--fundo')
    mo.add_argument('--video')
    a = ap.parse_args()
    if a.cmd == 'listar':
        listar(a.slug)
    elif a.cmd == 'ligar':
        ligar(a.slug, a.plano, a.ids)
    elif a.cmd == 'juntar':
        juntar(a.slug)
    else:
        if bool(a.preset) == bool(a.video):
            raise SystemExit('Diga um preset ou --video <banco_id> (um dos dois).')
        try:
            valores = json.loads(a.valores)
            assert isinstance(valores, dict)
        except (ValueError, AssertionError):
            raise SystemExit('--valores é um objeto JSON: \'{"campo": "texto"}\'')
        motion(a.slug, a.plano, a.preset, valores, a.fundo, a.video)
