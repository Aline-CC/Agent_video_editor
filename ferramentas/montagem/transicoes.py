"""As transições entre planos no render (do 18: backend/app/transicoes.py, SPEC §8.8; docs/transicoes.md): os efeitos
(zoom com desfoque, brilho e a luz colorida) sobre o quadro já montado, só nas janelas deles. Quais cortes têm qual
transição a página de render decide (`__render.transicoes`, no tempo do vídeo final); o som delas vem em `__render.sons`."""
import math

from base import BIBLIOTECA

EFEITOS = BIBLIOTECA / 'transicoes'  # luz.webm


def _curva(t0: float, t1: float, subir: bool, var: str = 'T') -> str:
    """Uma rampa suave (smoothstep) de 0 a 1 entre t0 e t1 (ou de 1 a 0), em expressão do ffmpeg sobre o tempo `var`
    (`T` no geq, `t` no scale)."""
    u = f'clip(({var}-{t0:.4f})/{max(t1 - t0, 1e-3):.4f},0,1)'
    s = f'({u}*{u}*(3-2*{u}))'
    return s if subir else f'(1-{s})'


def _janela(t: float, antes: float, depois: float, pico: float = 1.0, var: str = 'T') -> str:
    """O envelope de um efeito em volta do corte `t`: sobe até o corte (em `antes` s) e desce depois (em `depois` s).
    Sem `antes`, nada antes do corte; sem `depois`, nada depois (igual a `envelope` em transicoes.ts)."""
    sobe = _curva(t - antes, t, True, var) if antes > 0 else '0'
    desce = _curva(t, t + depois, False, var) if depois > 0 else '0'
    return f'({pico:.3f}*if(lt({var},{t:.4f}),{sobe},{desce}))'


def envelope(antes: float, depois: float, t_corte: float, t: float) -> float:
    """O mesmo envelope em número (para os comandos do desfoque, quadro a quadro)."""
    def suave(u: float) -> float:
        x = min(max(u, 0.0), 1.0)
        return x * x * (3 - 2 * x)
    if t < t_corte:
        return suave((t - (t_corte - antes)) / antes) if antes > 0 else 0.0
    return 1 - suave((t - t_corte) / depois) if depois > 0 else 0.0


def _janela_em_quadros(x: dict, fps: int) -> tuple[int, int]:
    """O primeiro e o último quadro (do vídeo final) que a transição toca (nunca antes do começo do vídeo)."""
    return max(math.floor((x['t'] - x['antes']) * fps + 1e-6), 0), max(math.ceil((x['t'] + x['depois']) * fps - 1e-6), 0)


def _quadros(x: dict, fps: int) -> range:
    q0, q1 = _janela_em_quadros(x, fps)
    return range(q0, q1 + 1)


def filtros(transicoes: list[dict] | None, rotulo_in: str, saida: str, w: int, h: int, primeira_entrada: int,
            fps: int = 30) -> tuple[list[str], list[str]]:
    """Os filtros das transições sobre o quadro já montado (SPEC §13), de `[rotulo_in]` para `[saida]`, e as entradas que
    elas pedem (o vídeo da luz, uma vez por uso). Cada transição: `{t, tipo, antes, depois, forca}` (t no vídeo final).
    Fora das janelas das transições o quadro passa intocado e quase de graça (medido em 4K: o custo é o das janelas,
    não o da duração do vídeo):
    - zoom: o quadro aproxima até o corte e chega aproximado depois, voltando (`scale` com `eval=frame` + recorte
      central; com o tamanho igual, o `scale` só repassa), e desfoca pela mesma curva — o σ do `gblur` muda quadro a
      quadro por `sendcmd` e o `gblur` só liga na janela (como o `blur()` da prévia, que cresce com a curva);
    - brilho: um branco (uma fonte `color` só do tamanho da janela, com a transparência pela curva) por cima, por
      `overlay`; o vídeo fora da janela não passa por conversão nenhuma;
    - luz: o vídeo da luz colorida (com transparência) sobreposto, começando `antes` s antes do corte."""
    ts = [x for x in (transicoes or []) if x.get('tipo') in ('luz', 'brilho', 'zoom')]
    if not ts:
        return [], [f'[{rotulo_in}]null[{saida}]']
    entradas: list[str] = []
    # o quadro montado já no formato de saída: sem isso o ffmpeg podia negociar yuva420p na saída das sobreposições e o
    # `scale` do zoom convertia (refazendo o conversor a cada quadro, por causa do `eval=frame`) o vídeo inteiro. As cores:
    # só bt709 (aceitar também `unknown`/bt601 deixava a negociação escolher outra matriz, e com o look ligado o vídeo
    # inteiro saía ~3 níveis mais escuro em R e B); medido em vídeo sintético e no bruto real, com e sem look, para os três
    # efeitos: fora das janelas, o quadro sai idêntico ao de uma exportação sem transições
    f: list[str] = [f'[{rotulo_in}]format=pix_fmts=yuv420p:color_spaces=bt709:color_ranges=tv[tf]']
    atual = 'tf'
    k = 0
    sigma = max(w, h) / 120
    zooms = [x for x in ts if x['tipo'] == 'zoom']
    if zooms:
        z = '+'.join(_janela(x['t'], x['antes'], x['depois'], 0.22 * x.get('forca', 1), 't') for x in zooms)
        en = '+'.join(f"between(t,{x['t'] - x['antes']:.4f},{x['t'] + x['depois']:.4f})" for x in zooms)
        # o σ de cada quadro das janelas (o maior entre os zooms, como na prévia), mandado um pouco antes do quadro
        quadros = sorted({q for x in zooms for q in _quadros(x, fps)})
        cmds = ';'.join(f"{max(q - 0.25, 0) / fps:.4f} gblur@tz sigma "
                        f"{sigma * max(min(x.get('forca', 1) * envelope(x['antes'], x['depois'], x['t'], q / fps), 1) for x in zooms):.2f}"
                        for q in quadros)
        f.append(f"[{atual}]scale=w='trunc(iw*(1+{z})/2)*2':h='trunc(ih*(1+{z})/2)*2':eval=frame,crop={w}:{h},setsar=1,"
                 f"sendcmd=c='{cmds}',gblur@tz=sigma=0:enable='{en}'[tz]")
        atual = 'tz'
    for x in [x for x in ts if x['tipo'] == 'brilho']:
        # a fonte começa num quadro inteiro (sem arredondar o começo) e a curva corre no relógio dela (T local)
        q0, q1 = _janela_em_quadros(x, fps)
        t0 = q0 / fps
        a = _janela(x['t'] - t0, x['antes'], x['depois'], 0.85 * x.get('forca', 1))
        f.append(f"color=c=white:s=16x16:r={fps}:d={(q1 - q0 + 1) / fps:.4f},format=yuva420p,"
                 f"geq=lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':a='255*{a}',scale={w}:{h}:flags=neighbor,"
                 f"setpts=PTS-STARTPTS+{q0}/({fps}*TB)[tw{k}]")
        f.append(f'[{atual}][tw{k}]overlay=0:0:format=auto:eof_action=pass[tb{k}]')
        atual = f'tb{k}'
        k += 1
    for x in [x for x in ts if x['tipo'] == 'luz']:
        idx = primeira_entrada + entradas.count('-i')
        entradas += ['-c:v', 'libvpx-vp9', '-i', str(EFEITOS / 'luz.webm')]
        t0 = x['t'] - x['antes']
        # o webm não diz o espaço de cor: marcado bt709 como o quadro (senão o overlay negociava outro e o vídeo inteiro
        # mudava de cor com o look ligado)
        f.append(f'[{idx}:v]scale={w}:{h},format=yuva420p,setparams=colorspace=bt709:range=tv,setpts=PTS-STARTPTS+{t0:.4f}/TB[tl{k}]')
        f.append(f'[{atual}][tl{k}]overlay=0:0:format=auto:eof_action=pass[to{k}]')
        atual = f'to{k}'
        k += 1
    f.append(f'[{atual}]null[{saida}]')
    return entradas, f
