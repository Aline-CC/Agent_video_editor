# /// script
# requires-python = ">=3.11"
# dependencies = ["mediapipe>=1.1.0", "numpy"]
# ///
"""A máscara da pessoa (o recorte) ao longo do bruto: `midia/recorte/<fonte>_mascara.mp4`, cinza (branco = a pessoa), no
mesmo tempo do bruto. É o que o render usa no "ator embaixo" em janela: a cabeça e o cabelo saem por cima da janela
(render.py procura este arquivo; sem ele, a janela corta a cabeça).

    uv run ferramentas/recorte.py <slug>

O segmentador multiclasse do MediaPipe (local, ~16 MB, baixado para a biblioteca na 1ª vez) roda em cada quadro do bruto
reduzido; a máscara é suavizada no tempo (contra tremor na borda do cabelo) e gravada a 30 quadros/s.
"""
import subprocess
import sys
import urllib.request
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from base import BIBLIOTECA, PROJETOS  # noqa: E402

# o multiclasse (fundo, cabelo, pele, roupa…): recorta o cabelo junto e não pega a parede ao lado dele, como o simples
MODELO = BIBLIOTECA / 'modelos' / 'selfie_multiclass_256x256.tflite'
URL_MODELO = ('https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/'
              'selfie_multiclass_256x256.tflite')
W, H, FPS = 540, 960, 30
SUAVE = 0.6  # o peso do quadro novo na média móvel (1 = sem suavizar)


def main(slug: str) -> None:
    import mediapipe as mp
    from mediapipe.tasks.python import BaseOptions, vision

    if not MODELO.exists():
        MODELO.parent.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(URL_MODELO, MODELO)
    p = PROJETOS / slug
    import json
    edicao = json.loads((p / 'edicao.json').read_text())
    fonte = next(f for f in edicao['fontes'] if f['papel'] == 'bruto')
    bruto = p / fonte['arquivo']
    destino = p / 'midia' / 'recorte' / f"{fonte['id']}_mascara.mp4"
    destino.parent.mkdir(parents=True, exist_ok=True)

    seg = vision.ImageSegmenter.create_from_options(vision.ImageSegmenterOptions(
        base_options=BaseOptions(model_asset_path=str(MODELO)), output_confidence_masks=True,
        running_mode=vision.RunningMode.VIDEO))
    ler = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', str(bruto), '-vf', f'fps={FPS},scale={W}:{H}', '-pix_fmt', 'rgb24',
                            '-f', 'rawvideo', '-'], stdout=subprocess.PIPE)
    gravar = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'gray', '-s', f'{W}x{H}', '-r', str(FPS),
                               '-i', '-', '-c:v', 'libx264', '-crf', '12', '-g', '6', '-pix_fmt', 'yuv420p', str(destino)], stdin=subprocess.PIPE)
    media = None
    n = 0
    while True:
        bruto_q = ler.stdout.read(W * H * 3)
        if len(bruto_q) < W * H * 3:
            break
        img = mp.Image(image_format=mp.ImageFormat.SRGB, data=np.frombuffer(bruto_q, np.uint8).reshape(H, W, 3))
        conf = 1 - seg.segment_for_video(img, int(n * 1000 / FPS)).confidence_masks[0].numpy_view()  # a classe 0 é o fundo
        media = conf if media is None else SUAVE * conf + (1 - SUAVE) * media
        gravar.stdin.write((np.clip((media - 0.5) / 0.25, 0, 1) * 255).astype(np.uint8).tobytes())
        n += 1
    gravar.stdin.close()
    gravar.wait()
    ler.wait()
    print(f'{n} quadros → {destino.relative_to(PROJETOS.parent)}')


if __name__ == '__main__':
    main(sys.argv[1])
