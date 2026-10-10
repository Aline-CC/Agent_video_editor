# /// script
# requires-python = ">=3.11"
# dependencies = ["playwright==1.63.0", "numpy", "opencv-python-headless"]
# ///
"""Para criar um preset à mão a partir de um trecho de referência (etapa 13; do 18: ferramentas/preset_tira.py,
preset_curva.py e preset_pose.py juntos):

    uv run ferramentas/preset_tira.py quadros <ref> <inicio> <fim> [passo=0.1] [saida.jpg]
    uv run ferramentas/preset_tira.py comparar <teste.json> [saida.jpg]
    uv run ferramentas/preset_tira.py curva '{"t": [0, 0.1, ...], "p": [0, 0.3, ...]}'
    uv run ferramentas/preset_tira.py pose '[[x,y] sup-esq, sup-dir, inf-dir, inf-esq]' '[cx,cy,w,h,rot,rx,ry]' ['[larg, alt da área]']

`ref`: a pasta em biblioteca/referencias/ (o proxy 720×1280) ou `externa:<nome>` (biblioteca/presets/externas/).
`quadros`: uma tira com grade a cada 10% (para medir posição e tamanho no olho), o tempo desde o início do trecho.
`comparar`: a referência (em cima) e a recriação desenhada pelo motor do 19 (render/src, embaixo) nos mesmos instantes.
O JSON: {"ref", "inicio", "fim", "preset": <o preset inteiro, ou o caminho do .json>, "formato": "vertical"|"dividida",
"midias": [[x0, y0, x1, y1, t] (o recorte de cada mídia num quadro da referência, px de 720×1280) | {"arquivo": img} |
{"quad": [4 cantos], "t", "w", "h"} (desentorta um card em perspectiva)], "tempos": [...] (opcional, s desde o início),
"ajustes": {...}, "divisao": "atras" (opcionais)}. Na dividida, a parte de baixo da recriação mostra o quadro da referência.
`curva`: a cubic-bezier (CSS) que passa pelos pontos medidos (t e progresso de 0 a 1).
`pose`: cx, cy, w, h (% da área), rot, rx, ry de um card pelos 4 cantos medidos (o transform do motor)."""
import base64
import itertools
import json
import math
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import cv2
import numpy as np

RAIZ = Path(__file__).resolve().parents[1]
REFS = RAIZ / 'biblioteca' / 'referencias'
EXTERNAS = RAIZ / 'biblioteca' / 'presets' / 'externas'
RENDER = RAIZ / 'render'


def video(ref: str) -> Path:
    if ref.startswith('externa:'):
        return next(EXTERNAS.glob(ref.split(':', 1)[1] + '.*'))
    return REFS / ref / 'proxy.mp4'


def quadro(ref: str, t: float) -> np.ndarray:
    """O quadro no instante t, cortado em 9:16 (pelo centro) e em 720×1280."""
    cap = cv2.VideoCapture(str(video(ref)))
    cap.set(cv2.CAP_PROP_POS_MSEC, max(t, 0) * 1000)
    ok, f = cap.read()
    if not ok:
        raise SystemExit(f'Sem quadro em {ref} @ {t:.2f}s')
    h, w = f.shape[:2]
    if abs(w / h - 9 / 16) > 0.01:
        nw = int(h * 9 / 16) if w / h > 9 / 16 else w
        nh = h if w / h > 9 / 16 else int(w * 16 / 9)
        f = f[(h - nh) // 2:(h - nh) // 2 + nh, (w - nw) // 2:(w - nw) // 2 + nw]
    return cv2.resize(f, (720, 1280))


def rotulo(img: np.ndarray, texto: str) -> np.ndarray:
    img = img.copy()
    cv2.rectangle(img, (0, 0), (img.shape[1], 34), (0, 0, 0), -1)
    cv2.putText(img, texto, (8, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
    return img


def grade(img: np.ndarray) -> np.ndarray:
    img = img.copy()
    h, w = img.shape[:2]
    for k in range(1, 10):
        cor = (0, 255, 0) if k == 5 else (80, 80, 80)
        cv2.line(img, (w * k // 10, 0), (w * k // 10, h), cor, 1)
        cv2.line(img, (0, h * k // 10), (w, h * k // 10), cor, 1)
    return img


def tira(imgs: list[np.ndarray], por_linha: int = 8) -> np.ndarray:
    vazio = np.zeros_like(imgs[0])
    return np.vstack([np.hstack(imgs[i:i + por_linha] + [vazio] * (por_linha - len(imgs[i:i + por_linha])))
                      for i in range(0, len(imgs), por_linha)])


def quadros(ref: str, ini: float, fim: float, passo: float = 0.1, saida: str = 'quadros.jpg', largura: int = 240):
    ts = np.arange(ini, fim + 1e-6, passo)
    imgs = [cv2.resize(rotulo(grade(quadro(ref, t)), f'{t - ini:.2f}'), (largura, largura * 16 // 9)) for t in ts]
    cv2.imwrite(saida, tira(imgs))
    print(saida, len(ts), 'quadros')


# ---------------------------------------------------------------- a recriação pelo motor do 19 (render/src)

ENTRADA = """
import { desenhar, insertNoLugar } from '%(src)s/desenho'
import { receitaDoInsert } from '%(src)s/inserts'
import { divisaoDe } from '%(src)s/divisao'
const d = (window as any).__teste
const banco = new Map<string, any>(d.midias.map((m: any, i: number) => [`b${i}`, { id: `b${i}`, tipo: 'imagem', largura: m.w, altura: m.h, duracao: 0, arquivo: '', url: m.url }]))
const pedido: any = { id: 'x', plano: 'p', tipo: '', formato: d.formato, descricao: '', texto: null, fala: '', inicio: 0, duracao: d.dur,
  midias: d.midias.map((_: any, i: number) => ({ id: `m${i}`, banco: `b${i}` })), enriquecimento: { preset: d.preset.id, ajustes: d.ajustes, divisao: d.divisao }, t: { inicio: 0, fim: d.dur } }
const raiz = document.getElementById('camada')!
;(window as any).__ir = async (t: number) => {
  const divisao = divisaoDe(pedido, banco, [d.preset])
  const receita = receitaDoInsert(pedido, banco, [d.preset])
  const f = divisao && divisao.modo !== 'atras' ? divisao.f : 1
  desenhar(raiz, insertNoLugar({ pedido, banco, tempo: t, fundo: d.fundo || 'gradiente', receita, divisao, caixa: [raiz.clientWidth, raiz.clientHeight * f] }))
  await Promise.all([...document.images].map((i) => (i.complete ? null : i.decode().catch(() => {}))))
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  return f
}
"""


def _pagina(pasta: Path) -> Path:
    """index.html + teste.js numa pasta temporária: o CSS de render/index.html e as funções de render/src."""
    (pasta / 'entrada.ts').write_text(ENTRADA % {'src': (RENDER / 'src').as_posix()})
    subprocess.run(['npx', '-y', 'esbuild@0.25.10', str(pasta / 'entrada.ts'), '--bundle', '--format=iife',
                    '--target=chrome120', f'--outfile={pasta / "teste.js"}', '--log-level=warning'], check=True)
    css = re.search(r'<style>.*?</style>', (RENDER / 'index.html').read_text(), re.S).group(0)
    html = pasta / 'index.html'
    html.write_text(f'<!doctype html><html><head><meta charset="utf-8">{css}</head><body>'
                    '<div id="camada" class="fixed inset-0 overflow-hidden"></div><script src="teste.js"></script></body></html>')
    return html


def _data_url(img: np.ndarray) -> str:
    ok, buf = cv2.imencode('.png', img)
    return 'data:image/png;base64,' + base64.b64encode(buf.tobytes()).decode()


def recriar(teste: dict, tempos: list[float]) -> list[tuple[np.ndarray, float]]:
    from playwright.sync_api import sync_playwright
    out = []
    with tempfile.TemporaryDirectory() as tmp, sync_playwright() as p:
        html = _pagina(Path(tmp))
        b = p.chromium.launch(channel='chromium')
        pg = b.new_page(viewport={'width': 540, 'height': 960})
        pg.add_init_script(f'window.__teste = {json.dumps(teste)}')
        pg.goto(html.as_uri())
        pg.wait_for_function('() => !!window.__ir')
        for t in tempos:
            f = pg.evaluate('(t) => window.__ir(t)', t)
            png = pg.screenshot(omit_background=True)
            out.append((cv2.resize(cv2.imdecode(np.frombuffer(png, np.uint8), cv2.IMREAD_UNCHANGED), (720, 1280)), f))
        b.close()
    return out


def comparar(arq: str, saida: str = 'comparar.jpg', largura: int = 200):
    d = json.loads(Path(arq).read_text())
    ref, ini, fim = d['ref'], d['inicio'], d['fim']
    dur = fim - ini
    preset = d['preset'] if isinstance(d['preset'], dict) else json.loads(Path(d['preset']).read_text())
    tempos = d.get('tempos') or [round(float(x), 3) for x in np.linspace(0, dur - 0.02, 10)]
    midias = []
    for m in d['midias']:
        if isinstance(m, dict) and 'arquivo' in m:
            img = cv2.imread(str(Path(m['arquivo'])))
        elif isinstance(m, dict):  # card em perspectiva: os 4 cantos desentortados
            H = cv2.getPerspectiveTransform(np.float32(m['quad']), np.float32([[0, 0], [m['w'], 0], [m['w'], m['h']], [0, m['h']]]))
            img = cv2.warpPerspective(quadro(ref, ini + m['t']), H, (m['w'], m['h']))
        else:
            x0, y0, x1, y1, t = m
            img = quadro(ref, ini + t)[int(y0):int(y1), int(x0):int(x1)]
        midias.append({'url': _data_url(img), 'w': img.shape[1], 'h': img.shape[0]})
    teste = {'preset': preset, 'formato': d.get('formato', preset['formato']), 'midias': midias, 'dur': dur,
             'ajustes': d.get('ajustes'), 'divisao': d.get('divisao'), 'fundo': d.get('fundo')}
    cima, baixo = [], []
    for t, (rgba, f) in zip(tempos, recriar(teste, tempos)):
        q = quadro(ref, ini + t)
        fundo = q.copy()
        fundo[:int(1280 * f)] = 0  # na dividida, embaixo fica o ator da referência
        a = rgba[:, :, 3:4] / 255.0 if rgba.shape[2] == 4 else 1.0  # sem transparência: a tela toda coberta
        rec = (rgba[:, :, :3] * a + fundo * (1 - a)).astype(np.uint8)
        cima.append(cv2.resize(rotulo(grade(q), f'ref {t:.2f}'), (largura, largura * 16 // 9)))
        baixo.append(cv2.resize(rotulo(grade(rec), f'rec {t:.2f}'), (largura, largura * 16 // 9)))
    cv2.imwrite(saida, np.vstack([np.hstack(cima), np.hstack(baixo)]))
    print(saida)


# ---------------------------------------------------------------- medidas

def _bezier(x1, y1, x2, y2, t):
    s = np.linspace(0, 1, 400)
    X = 3 * (1 - s) ** 2 * s * x1 + 3 * (1 - s) * s ** 2 * x2 + s ** 3
    Y = 3 * (1 - s) ** 2 * s * y1 + 3 * (1 - s) * s ** 2 * y2 + s ** 3
    return np.interp(t, X, Y)


def curva(ts, ps):
    ts, ps = np.array(ts), np.array(ps)
    melhor = None
    g, gy = np.linspace(0, 1, 21), np.linspace(-0.2, 1.4, 33)
    for x1, y1, x2, y2 in itertools.product(g, gy, g, gy):
        e = np.mean((_bezier(x1, y1, x2, y2, ts) - ps) ** 2)
        if melhor is None or e < melhor[0]:
            melhor = (e, [x1, y1, x2, y2])
    return [round(float(v), 3) for v in melhor[1]], round(float(np.sqrt(melhor[0])), 4)


def _cantos(p, area_w=720, area_h=1280):
    """O transform do motor (desenho.ts): perspective(138.9cqw) rotateX rotateY rotate, origem no centro."""
    cx, cy, w, h, rot, rx, ry = p
    W, H, P = w / 100 * area_w, h / 100 * area_h, 1.389 * area_w
    pts = np.array([[-W / 2, -H / 2, 0], [W / 2, -H / 2, 0], [W / 2, H / 2, 0], [-W / 2, H / 2, 0]], float)
    a, b, c = map(math.radians, (rot, ry, rx))
    Rz = np.array([[math.cos(a), -math.sin(a), 0], [math.sin(a), math.cos(a), 0], [0, 0, 1]])
    Ry = np.array([[math.cos(b), 0, math.sin(b)], [0, 1, 0], [-math.sin(b), 0, math.cos(b)]])
    Rx = np.array([[1, 0, 0], [0, math.cos(c), -math.sin(c)], [0, math.sin(c), math.cos(c)]])
    q = pts @ Rz.T @ Ry.T @ Rx.T
    k = P / (P - q[:, 2])
    return np.c_[q[:, 0] * k + cx / 100 * area_w, q[:, 1] * k + cy / 100 * area_h]


def pose(alvo, p0, area=(720, 1280)):
    alvo, p = np.array(alvo, float), np.array(p0, float)
    for _ in range(60):
        r = (_cantos(p, *area) - alvo).ravel()
        J = np.zeros((len(r), len(p)))
        for i in range(len(p)):
            dp = np.zeros(len(p))
            dp[i] = 1e-3
            J[:, i] = ((_cantos(p + dp, *area) - alvo).ravel() - r) / 1e-3
        p = p - np.linalg.lstsq(J, r, rcond=None)[0] * 0.7
    return [round(float(x), 2) for x in p], round(float(np.abs(_cantos(p, *area) - alvo).max()), 1)


if __name__ == '__main__':
    cmd, *a = sys.argv[1:] or ['']
    if cmd == 'quadros':
        quadros(a[0], float(a[1]), float(a[2]), *(float(x) for x in a[3:4]), *a[4:5])
    elif cmd == 'comparar':
        comparar(*a[:2], *(int(x) for x in a[2:3]))
    elif cmd == 'curva':
        d = json.loads(a[0])
        print(curva(d['t'], d['p']))
    elif cmd == 'pose':
        print(*pose(json.loads(a[0]), json.loads(a[1]), json.loads(a[2]) if len(a) > 2 else (720, 1280)), sep='  erro px ')
    else:
        print(__doc__)
