# /// script
# requires-python = ">=3.11"
# dependencies = ["mediapipe>=1.1.0", "numpy"]
# ///
"""A conferência de rostos da legenda: nenhum bloco em cima de olhos, nariz ou boca — do ator ou de quem aparece num
insert. Lê a versão renderizada (`versoes/vN/proxy.mp4` e `legenda.json`, os blocos que o render gravou), procura os
rostos no vídeo montado nos instantes de cada bloco (o detector de rosto do MediaPipe, o mesmo do rosto.py) e, onde a
legenda cai sobre um rosto, escolhe a altura livre mais perto (de preferência abaixo) e grava em
`edicao.legenda.alturas` (pela 1ª palavra do bloco). A altura é uma só por plano (a legenda não pula de bloco em bloco);
onde não há lugar livre (rostos na tela toda), fica onde cobre menos rosto. Depois, renderize de novo.

    uv run ferramentas/legenda_rostos.py <slug> [vN] [--y 0.56]

Com `--y`, a legenda fica nessa altura em todos os planos (ex.: logo abaixo do meio) e só sai dela onde cobre um rosto.
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from base import BIBLIOTECA, PROJETOS  # noqa: E402

MODELO = BIBLIOTECA / 'modelos' / 'blaze_face_short_range.tflite'
W, H = 360, 640
ALTURA_LINHA = 0.045  # a faixa que um bloco ocupa (fração da altura do quadro), com a sombra
LETRA = 0.026  # a largura média de uma letra (fração da largura), SF Pro Display Bold no tamanho da legenda
MARGEM_ROSTO = 0.1  # o rosto medido cresce isso em cada direção (a caixa do detector já vai da testa ao queixo)
LIMITE_BAIXO = 0.8  # abaixo disso a interface do Instagram (legenda, botões) cobre o texto


def quadro(video: Path, t: float) -> np.ndarray:
    o = subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{t:.3f}', '-i', str(video), '-frames:v', '1', '-vf', f'scale={W}:{H}',
                        '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-'], capture_output=True).stdout
    return np.frombuffer(o, np.uint8).reshape(H, W, 3) if len(o) == W * H * 3 else np.zeros((H, W, 3), np.uint8)


def rostos(det, mp, img: np.ndarray) -> list[tuple[float, float, float, float]]:
    """As caixas (x0, y0, x1, y1 em fração) dos rostos: no quadro inteiro e nas duas metades ampliadas (rostos pequenos)."""
    caixas = []
    for y0, y1 in ((0, H), (0, H // 2), (H // 2, H)):
        parte = np.ascontiguousarray(img[y0:y1])
        r = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=parte))
        for d in r.detections:
            b = d.bounding_box
            if d.categories[0].score < 0.5:
                continue
            ph = y1 - y0
            x0, x1 = b.origin_x / W, (b.origin_x + b.width) / W
            a0, a1 = (y0 + b.origin_y) / H, (y0 + b.origin_y + b.height) / H
            mw, mh = (x1 - x0) * MARGEM_ROSTO, (a1 - a0) * MARGEM_ROSTO
            caixas.append((x0 - mw, a0 - mh, x1 + mw, a1 + mh))
            del ph
    return caixas


def bate(y: float, largura: float, caixas) -> bool:
    l0, l1 = 0.5 - largura / 2, 0.5 + largura / 2
    return any(not (y + ALTURA_LINHA / 2 < c[1] or y - ALTURA_LINHA / 2 > c[3] or l1 < c[0] or l0 > c[2]) for c in caixas)


def sobreposicao(y: float, largura: float, caixas) -> float:
    l0, l1, a0, a1 = 0.5 - largura / 2, 0.5 + largura / 2, y - ALTURA_LINHA / 2, y + ALTURA_LINHA / 2
    return sum(max(0, min(l1, c[2]) - max(l0, c[0])) * max(0, min(a1, c[3]) - max(a0, c[1])) for c in caixas)


def main(slug: str, versao: str | None, preferida: float | None = None) -> None:
    import mediapipe as mp
    from mediapipe.tasks.python import BaseOptions, vision

    p = PROJETOS / slug
    vs = sorted((x for x in (p / 'versoes').glob('v*') if (x / 'legenda.json').exists()), key=lambda x: float(x.name[1:]))
    pasta = p / 'versoes' / versao if versao else vs[-1]
    blocos = json.loads((pasta / 'legenda.json').read_text())['blocos']
    video = pasta / 'proxy.mp4'
    det = vision.FaceDetector.create_from_options(vision.FaceDetectorOptions(base_options=BaseOptions(model_asset_path=str(MODELO)),
                                                                             min_detection_confidence=0.5))
    edicao = json.loads((p / 'edicao.json').read_text())
    alturas = edicao.setdefault('legenda', {}).setdefault('alturas', {})
    planos = json.loads((pasta / 'planos.json').read_text())
    mudou = 0
    for pl in planos:
        bs = [b for b in blocos if b.get('palavra') and pl['ini'] - 0.2 <= b['ini'] < pl['fim'] - 0.05]
        if not bs:
            continue
        largura = min(0.95, LETRA * max(len(b['texto']) for b in bs) + 0.04)
        ts = [b['ini'] + (b['fim'] - b['ini']) * k for b in bs for k in (0.2, 0.8)]
        caixas = [c for t in ts for c in rostos(det, mp, quadro(video, t))]
        y0 = preferida if preferida is not None else bs[0]['y']
        if not bate(y0, largura, caixas) and (preferida is not None or not any(bate(b['y'], largura, caixas) for b in bs)):
            if preferida is not None:
                for b in bs:
                    alturas[b['palavra']] = round(float(y0), 3)
                mudou += len(bs)
            continue
        cands = list(np.arange(0.12, LIMITE_BAIXO + 0.001, 0.005))
        livres = [y for y in cands if not bate(y, largura, caixas)]
        if livres:  # o mais perto, preferindo abaixo (o queixo, o colo) a acima (a testa, o cabelo)
            y = min(livres, key=lambda y: abs(y - y0) * (1 if y > y0 else 1.6))
        else:  # rostos na tela toda: onde cobre menos rosto
            y = min(cands, key=lambda y: (sobreposicao(y, largura, caixas), abs(y - y0)))
        for b in bs:
            alturas[b['palavra']] = round(float(y), 3)
        mudou += len(bs)
        print(f"  {pl['id']:>4} {pl['ini']:6.2f}s ({len(bs)} blocos): {y0:.3f} → {y:.3f}{'' if livres else ' (o menos coberto)'}")
    (p / 'edicao.json').write_text(json.dumps(edicao, ensure_ascii=False, indent=1))
    print(f'{mudou} de {len(blocos)} blocos saíram de cima de um rosto ({pasta.name}); renderize de novo.')


if __name__ == '__main__':
    a = sys.argv[1:]
    y = float(a[a.index('--y') + 1]) if '--y' in a else None
    if '--y' in a:
        del a[a.index('--y'):a.index('--y') + 2]
    main(a[0], a[1] if len(a) > 1 else None, y)
