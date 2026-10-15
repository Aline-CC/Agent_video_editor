"""O look do ator (do 18: backend/app/look.py; docs/preprocessamento.md, "Look"): um LUT 3D (em `biblioteca/luts/`) com
intensidade e a vinheta (bordas escurecidas), só no ator. Vale para o projeto inteiro; a prévia (WebGL) e o render
(ffmpeg) usam a mesma tabela e a mesma fórmula da vinheta, para ficarem iguais."""
import math
from pathlib import Path

from base import BIBLIOTECA

LUTS = BIBLIOTECA / 'luts'
NOMES = {'natural': 'Natural', 'casa': 'Casa', 'frio': 'Frio / limpo', 'collect-3-niveis': 'Collect 3 níveis (Premiere)', 'collect-3-niveis-suave': 'Collect 3 níveis, menos magenta', 'collect-3-niveis-quente': 'Collect 3 níveis, leve amarelo', 'collect-lp-3-niveis': 'Collect LP 3 níveis (Premiere)', 'collect-lp-ext': 'Collect LP ext (Premiere)', 'collect-vsl-ext': 'Collect VSL ext (Premiere)', 'collect-lp-ext-ref': 'Collect LP ext, pela referência da criadora', 'lp-ext-ref2': 'LP ext, pela 2ª referência (fundo frio, pele viva)', 'vsl-ext-ref-lp': 'VSL ext, pela cor do LP ext'}
# a vinheta: o quanto as bordas escurecem (0 = sem) e a forma (uma elipse do quadro 9:16, centro um pouco acima do meio,
# borda bem suave). A mesma fórmula no shader da prévia e na máscara do render (`mascara_vinheta`).
VINHETAS = {'sem': 0.0, 'leve': 0.25, 'normal': 0.4, 'forte': 0.55}
FORMA = {'cy': 0.45, 'rx': 0.62, 'ry': 0.62, 'ini': 0.45, 'fim': 1.25}
PADRAO = {'lut': 'casa', 'intensidade': 1.0, 'vinheta': 'normal'}


def arquivo_lut(lut: str) -> Path:
    if lut not in NOMES:
        raise FileNotFoundError(lut)
    return LUTS / f'{lut}.cube'


def do_projeto(p: dict) -> dict:
    """O look do projeto (o padrão onde nada foi escolhido)."""
    return {**PADRAO, **(p.get('look') or {})}


def ativo(look: dict | None) -> bool:
    return bool(look) and ((look.get('lut') and look.get('intensidade', 1) > 0) or VINHETAS.get(look.get('vinheta'), 0) > 0)


def fator_vinheta(x: float, y: float, forca: float) -> float:
    """O multiplicador da vinheta num ponto (x, y em 0–1 do quadro do ator): 1 no centro, 1 − forca nas bordas, com uma
    transição suave (smoothstep) entre `ini` e `fim` da distância elíptica."""
    d = math.hypot((x - 0.5) / FORMA['rx'], (y - FORMA['cy']) / FORMA['ry'])
    t = min(max((d - FORMA['ini']) / (FORMA['fim'] - FORMA['ini']), 0), 1)
    return 1 - forca * t * t * (3 - 2 * t)


def mascara_vinheta(w: int, h: int, forca: float, destino: Path) -> Path:
    """A máscara da vinheta (cinza, 16 bits) no tamanho do vídeo, para o ffmpeg multiplicar sobre o ator. (No 18, gravada
    pelo OpenCV; aqui pelo Pillow, o mesmo PNG de 16 bits, sem mais uma dependência.)"""
    import numpy as np
    from PIL import Image
    x = (np.arange(w) + 0.5) / w
    y = (np.arange(h) + 0.5) / h
    xx, yy = np.meshgrid(x, y)
    d = np.hypot((xx - 0.5) / FORMA['rx'], (yy - FORMA['cy']) / FORMA['ry'])
    t = np.clip((d - FORMA['ini']) / (FORMA['fim'] - FORMA['ini']), 0, 1)
    m = 1 - forca * t * t * (3 - 2 * t)
    destino.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(np.round(m * 65535).astype(np.uint16)).save(destino)
    return destino


def filtros(look: dict, entrada: str, saida: str, idx_mascara: int | None) -> list[str]:
    """Os filtros do ffmpeg do look, de `[entrada]` para `[saida]`, em RGB (gbrp: o LUT e a multiplicação da vinheta
    valem por canal de cor, não em YUV): o LUT (trilinear, como o WebGL), misturado com o original pela intensidade, e a
    máscara da vinheta (a entrada `idx_mascara` do ffmpeg: a imagem, decodificada e convertida uma vez só e repetida
    pelo `loop`; o `-loop 1` na entrada a decodificava de novo a cada quadro) multiplicada."""
    f = [f'[{entrada}]format=gbrp[lk0]']
    atual = 'lk0'
    k = float(look.get('intensidade', 1))
    if look.get('lut') and k > 0:
        cube = str(arquivo_lut(look['lut'])).replace("'", r"'\''")
        if k >= 0.999:
            f.append(f"[{atual}]lut3d=file='{cube}':interp=trilinear[lk1]")
        else:
            f.append(f'[{atual}]split=2[lka][lkb]')
            f.append(f"[lkb]lut3d=file='{cube}':interp=trilinear[lkc]")
            # o blend normal dá primeira·opacity + segunda·(1 − opacity): o LUT vai primeiro, para sair
            # LUT·k + original·(1 − k), a mesma conta do mix() do shader da prévia
            f.append(f'[lkc][lka]blend=all_mode=normal:all_opacity={k:.3f}[lk1]')
        atual = 'lk1'
    if idx_mascara is not None:
        f.append(f'[{idx_mascara}:v]format=gray16le,format=gbrp,loop=loop=-1:size=1[lkm]')
        f.append(f'[{atual}][lkm]blend=all_mode=multiply:shortest=1[lk2]')
        atual = 'lk2'
    f.append(f'[{atual}]null[{saida}]')
    return f
