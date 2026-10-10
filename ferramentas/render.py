# /// script
# requires-python = ">=3.12"
# dependencies = ["playwright==1.63.0", "pillow", "numpy"]
# ///
"""O render: o vídeo do projeto com tudo queimado (cortes, 9:16, look, inserts, motions, transições, legenda e áudio).

    uv run ferramentas/render.py <slug>            → projetos/<slug>/versoes/vN/ (proxy.mp4 720×1280 H.264 + os JSONs da revisão)
    uv run ferramentas/render.py <slug> --final    → projetos/<slug>/final/<nome> · <AAAA-MM-DD HHhMM>.mp4 (2160×3840 HEVC)

Como a exportação do 18 (SPEC §13; a cola de backend/app/exportacao.py `_gravar`/`_trechos`, reescrita aqui): a página
de render (`render/`, servida por `servidor.servir`) calcula no navegador o que a prévia calcula (`window.__render`) e é
fotografada quadro a quadro por navegadores escondidos (`montagem/render_quadros.py`); o ator e o áudio saem do bruto
pelo ffmpeg, numa passada só (`montagem/exportacao.py`).
"""
import math
import multiprocessing
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import servidor  # noqa: E402
from base import BIBLIOTECA, ffmpeg, gravar_json, inspecionar, ler, ler_json, pasta  # noqa: E402
from montagem import audio, exportacao, legenda, look, render_quadros, sons  # noqa: E402
from montagem.exportacao import dur_saida  # noqa: E402

FPS = 24
PROXY = (720, 1280, 'h264')
FINAL = (2160, 3840, 'hevc')
VELOCIDADE = (1.0, 1.5)


def pagina(slug: str, porta: int) -> str:
    """A página de render. `RENDER_PAGINA` troca por outra, só para testar contra a do 18 (o mesmo `window.__render`):
    RENDER_PAGINA='http://localhost:5173/render/p/{slug}'."""
    return os.environ.get('RENDER_PAGINA', 'http://127.0.0.1:{porta}/render/?projeto={slug}').format(slug=slug, porta=porta)


# ---------------------------------------------------------------- o projeto no tempo do vídeo final

def v1_tocada(edicao: dict) -> list[dict]:
    """Os clipes da V1 em ordem, cada um com a aceleração do ator (`vel`). Do 18: projeto.v1_tocada."""
    try:
        v = round(min(max(float(edicao.get('velocidade') or 1), VELOCIDADE[0]), VELOCIDADE[1]), 3)
    except (TypeError, ValueError):
        v = 1.0
    return [{**c, 'vel': v} for c in sorted((edicao.get('timeline') or {}).get('V1') or [], key=lambda c: c['inicio'])]


def palavras_na_saida(palavras: list[dict], clipes: list[dict]) -> list[dict]:
    """As palavras que tocam no vídeo final, com início e fim no tempo da saída. Do 18: direcao_projeto.palavras_na_saida."""
    acc, posicoes = 0.0, []
    for c in clipes:
        posicoes.append((c, acc))
        acc += dur_saida(c)
    out = []
    for w in palavras:
        for c, base in posicoes:
            if w['inicio'] < c['fim'] and w['fim'] > c['inicio']:
                v = c.get('vel', 1)
                out.append({**w, 'saida_ini': round(base + (max(w['inicio'], c['inicio']) - c['inicio']) / v, 3),
                            'saida_fim': round(base + (min(w['fim'], c['fim']) - c['inicio']) / v, 3)})
                break
    return out


def notas(edicao: dict, transcricao: list[dict], saida: list[dict], duracao: float) -> list[dict]:
    """As notas do Claude e as dúvidas dos cortes no tempo do vídeo final: `{id, ini, fim, texto, fala}`. Um trecho todo
    cortado vira um ponto, onde o corte ficou. `fala`: o que foi dito no trecho (a transcrição, cortado ou não)."""
    ordem = {w['id']: k for k, w in enumerate(transcricao)}
    tempo = {w['id']: (float(w.get('saida_ini', w.get('ini', 0))), float(w.get('saida_fim', w.get('fim', 0)))) for w in saida if 'id' in w}
    itens = [(f'n{k}', x.get('palavra_ini'), x.get('palavra_fim'), x.get('texto', '')) for k, x in enumerate(edicao.get('notas') or [], 1)]
    itens += [(f'd{k}', x.get('ini'), x.get('fim'), x.get('motivo', '')) for k, x in enumerate((edicao.get('cortes') or {}).get('duvidas') or [], 1)]
    out = []
    for id_, ini, fim, texto in itens:
        if ini not in ordem:
            continue
        a, b = ordem[ini], ordem.get(fim, ordem[ini])
        dentro = [w for w in transcricao[a:b + 1] if w['id'] in tempo]
        if dentro:
            t0, t1 = tempo[dentro[0]['id']][0], tempo[dentro[-1]['id']][1]
        else:  # cortado: o ponto da emenda (a primeira palavra que toca depois, ou o fim)
            depois = next((tempo[w['id']][0] for w in transcricao[b + 1:] if w['id'] in tempo), duracao)
            t0 = t1 = depois
        out.append({'id': id_, 'ini': round(t0, 3), 'fim': round(t1, 3), 'texto': texto,
                    'fala': ' '.join(w['texto'].strip() for w in transcricao[a:b + 1])})
    return out


# ---------------------------------------------------------------- o banco, a página e as fotos

def copias_do_banco(edicao: dict) -> int:
    """A cópia de exportação de cada vídeo do banco usado (o original, ou o pai de um trecho): a resolução original com
    quadro-chave a cada 6 quadros, para a busca quadro a quadro ser rápida; refeita se o original mudou. Do 18:
    banco.arquivo_para_exportar. Devolve quantas fez."""
    feitas = 0
    usados = {m['banco'] for x in (edicao.get('inserts') or {}).get('pedidos', []) for m in x.get('midias', []) if m.get('banco')}
    for base in sorted({(ler_json(BIBLIOTECA / 'banco' / b / 'item.json') or {}).get('pai') or b for b in usados}):
        pasta_item = BIBLIOTECA / 'banco' / base
        item = ler_json(pasta_item / 'item.json')
        if not item or item.get('tipo') != 'video' or not (pasta_item / item['arquivo']).exists():
            continue  # imagem (vai a original) ou mídia apagada do banco: a página mostra o que houver
        original, pronto = pasta_item / item['arquivo'], pasta_item / 'exportacao.mp4'
        if pronto.exists() and pronto.stat().st_mtime >= original.stat().st_mtime:
            continue
        tmp = pasta_item / 'exportacao.tmp.mp4'
        ffmpeg('-i', str(original), '-map', '0:v:0', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-preset', 'veryfast',
               '-crf', '14', '-g', '6', '-keyint_min', '6', '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', str(tmp))
        tmp.replace(pronto)
        feitas += 1
    return feitas


def ler_pagina(url: str) -> dict:
    """O que a página de render calcula (`window.__render`, no tempo do vídeo final): os inserts e motions (`trechos`), os
    sons, as transições, os blocos da legenda, os movimentos do Full ator e, para a revisão, as palavras e os planos
    (null se a página não os tiver). Do 18: exportacao._trechos."""
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel='chromium')
        try:
            pg = render_quadros.abrir_render(browser, url)
            return pg.evaluate("""async () => {
                const r = window.__render
                const ler = async (f) => (typeof f === 'function' ? await f() : f ?? null)
                return { duracao: r.duracao, trechos: r.trechos, sons: r.sons ? await r.sons() : [], transicoes: await ler(r.transicoes),
                         legenda: await ler(r.legenda), movimentos: await ler(r.movimentos), palavras: await ler(r.palavras),
                         planos: await ler(r.planos) }
            }""")
        finally:
            browser.close()


def fotografar(url: str, trechos: list[dict], w: int, h: int, tmp: Path, navegadores: int) -> list[tuple[Path, float]]:
    """A camada dos inserts: os quadros de cada trecho em pedaços, fotografados em paralelo (cada navegador grava os seus
    pedaços em clipes ProRes 4444 com transparência); depois, um clipe por trecho, os pedaços emendados sem recodificar.
    Devolve os clipes com o instante de cada um."""
    grupos = exportacao.pedacos(trechos, FPS, navegadores)
    total = sum(len(x) for g in grupos for x in g)
    if not total:
        return []
    tarefas = [(qs, FPS, w, h, str(tmp / f'{i:03d}_{j:03d}.mov')) for i, g in enumerate(grupos) for j, qs in enumerate(g)]
    print(f'      {total} quadros em {len(tarefas)} pedaços, {min(navegadores, len(tarefas))} navegadores', flush=True)
    pool = multiprocessing.get_context('spawn').Pool(min(navegadores, len(tarefas)), initializer=render_quadros.iniciar,
                                                      initargs=(url, w, h))
    try:
        feitos, marca = 0, 0.25
        for n in pool.imap_unordered(render_quadros.pedaco, tarefas):
            feitos += n
            if feitos / total >= marca:
                print(f'      {feitos}/{total} quadros', flush=True)
                marca = math.floor(feitos / total * 4 + 1) / 4
        pool.close()
        pool.join()
    finally:
        pool.terminate()
    camadas = []
    for i, g in enumerate(grupos):
        lista = tmp / f'{i:03d}.txt'
        lista.write_text(''.join(f"file '{i:03d}_{j:03d}.mov'\n" for j in range(len(g))))
        clipe = tmp / f'{i:03d}.mov'
        ffmpeg('-f', 'concat', '-safe', '0', '-i', str(lista), '-c', 'copy', str(clipe))
        camadas.append((clipe, g[0][0] / FPS))
    return camadas


# ---------------------------------------------------------------- o áudio

def som(p: Path, edicao: dict, fonte: dict, clipes: list[dict], transcricao: list[dict], avisos: list[str]) -> dict:
    """O que o áudio precisa (`audio.filtros`): a voz da escolha (`midia/voz/<fonte>_<limpeza>.wav`, feita pelo preparar;
    se faltar, a do bruto com um aviso, como no 18), a sonoridade dela, o fundo e o laço, e as falas para o ducking.
    Do 18: audio.da_exportacao."""
    a = audio.do_projeto(edicao)
    limpeza = a['voz']['limpeza']
    voz = p / 'midia' / 'voz' / f"{fonte['id']}_{limpeza}.wav"
    if limpeza != 'sem' and not voz.exists():
        avisos.append(f'Falta a voz limpa ({voz.relative_to(p)}): o vídeo saiu com a voz do bruto.')
        limpeza = 'sem'
    if limpeza == 'sem':
        voz = p / fonte['arquivo']
    voz_lufs = ((edicao.get('audio') or {}).get('voz_lufs') or {}).get(f"{fonte['id']}_{limpeza}")
    if voz_lufs is None:
        voz_lufs = round(audio.lufs(voz, como_voz=True), 1)
    fundo = audio.arquivo_trilha(a['fundo'])
    if a['fundo'] and not fundo:
        avisos.append(f"A faixa de fundo {a['fundo']} não está em biblioteca/trilhas/: o vídeo saiu sem fundo.")
    return {'voz': voz, 'voz_lufs': voz_lufs, 'timbre': a['voz']['timbre'], 'niveis': a['niveis'], 'fundo': fundo,
            'laco': audio.laco(fundo) if fundo else None, 'fundo_mudo': a['fundo_mudo'],
            'falas': audio.falas(palavras_na_saida(transcricao, clipes)), 'ducking_db': audio.DUCKING_DB, 'limpeza': limpeza}


# ---------------------------------------------------------------- o render

def _nome_livre(destino: Path) -> Path:
    k = 2
    alvo = destino
    while alvo.exists():
        alvo = destino.with_name(f'{destino.stem} ({k}){destino.suffix}')
        k += 1
    return alvo


def render(slug: str, final: bool = False) -> Path:
    t_ini = time.time()
    p = pasta(slug)
    edicao = ler(slug)
    clipes = v1_tocada(edicao)
    if not clipes:
        raise SystemExit(f'O projeto {slug} ainda não tem cortes (timeline.V1 vazia).')
    fonte = next(f for f in edicao['fontes'] if f['papel'] == 'bruto')
    duracao = sum(dur_saida(c) for c in clipes)
    w, h, codec = FINAL if final else PROXY
    horizontal = (fonte.get('largura') or 0) > (fonte.get('altura') or 0)
    transcricao = (ler_json(p / 'transcricao.json') or {}).get('palavras', [])
    fases: dict[str, float] = {}
    avisos: list[str] = []
    marca = [time.time()]

    def fase(nome: str) -> None:
        fases[nome] = round(time.time() - marca[0], 1)
        print(f'      {fases[nome]:.1f} s', flush=True)
        marca[0] = time.time()

    if final:
        nome = re.sub(r'\s+', ' ', re.sub(r'[/\\:*?"<>|\n\r\t]+', ' ', edicao.get('nome') or slug)).strip().strip('.')[:120]
        destino = _nome_livre(p / 'final' / f'{nome} · {datetime.now():%Y-%m-%d %Hh%M}.mp4')
        pasta_versao = None
        versao = None
    else:
        versao = 1 + max([int(m.group(1)) for x in (p / 'versoes').glob('v*') if (m := re.fullmatch(r'v(\d+)', x.name))], default=0)
        pasta_versao = p / 'versoes' / f'.v{versao}.parte'  # vira vN no fim: o app nunca vê uma versão pela metade
        shutil.rmtree(pasta_versao, ignore_errors=True)
        pasta_versao.mkdir(parents=True)
        destino = pasta_versao / 'proxy.mp4'
    destino.parent.mkdir(parents=True, exist_ok=True)
    tmp = Path(tempfile.mkdtemp(prefix='.render-', dir=p))
    srv = servidor.servir(0)
    print(f'Render de {slug}: {"final 2160×3840 HEVC" if final else f"proxy v{versao} 720×1280 H.264"}, {duracao:.1f} s de vídeo', flush=True)
    try:
        print('[1/5] Banco: cópias de exportação dos vídeos', flush=True)
        n = copias_do_banco(edicao)
        if n:
            print(f'      {n} feita(s)', flush=True)
        fase('banco')

        url = pagina(slug, srv.server_address[1])
        print(f'[2/5] Página de render: {url}', flush=True)
        r = ler_pagina(url)
        if r.get('duracao') is not None and abs(float(r['duracao']) - duracao) > 0.05:
            avisos.append(f"A página diz {float(r['duracao']):.2f} s de vídeo e a V1 dá {duracao:.2f} s.")
        trechos = r['trechos'] or []
        print(f"      {len(trechos)} trechos de insert/motion, {len(r['sons'] or [])} sons, {len(r['transicoes'] or [])} transições, "
              f"{len((r['legenda'] or {}).get('blocos') or [])} blocos de legenda", flush=True)
        fase('pagina')

        print('[3/5] Fotos da camada dos inserts', flush=True)
        camadas = fotografar(url, trechos, w, h, tmp, exportacao.NAVEGADORES)
        fase('fotos')

        print('[4/5] Áudio: a voz, o fundo e o −14 LUFS', flush=True)
        nivel = edicao.get('nivel_voz') or {}
        db_voz = nivel.get('db') if nivel.get('fonte') == fonte['id'] else sons.nivel_da_voz(p / fonte['arquivo'])
        fator = sons.fator_da_voz(db_voz)  # os sons na mesma relação com a voz deste vídeo que nas referências
        eventos = [{**ev, 'ganho': float(ev.get('ganho', sons.INTENSIDADES['baixo'])) * fator} for ev in r['sons'] or []]
        a = som(p, edicao, fonte, clipes, transcricao, avisos)
        a['medida'] = audio.medir(a, clipes, eventos, duracao)
        print(f"      voz {a['limpeza']}, fundo {(edicao.get('audio') or {}).get('fundo') or '—'}, ganho {a['medida']['ganho']:+.1f} dB → "
              f"{a['medida']['i']:.1f} LUFS, pico {a['medida']['pico']} dBFS", flush=True)
        fase('audio')

        print('[5/5] Montagem (ffmpeg, uma passada)', flush=True)
        divisoes = [(t['ini'], t['fim'], t.get('divisao') or {'modo': 'metade', 'f': 0.5}) for t in trechos if t['dividida']]
        mascara = p / 'midia' / 'recorte' / f"{fonte['id']}_mascara.mp4"
        lk = look.do_projeto(edicao)
        arq_leg = legenda.escrever(r.get('legenda'), w, h, tmp / 'legenda.ass')
        vinheta = look.mascara_vinheta(w, h, look.VINHETAS[lk['vinheta']], tmp / 'vinheta.png') if look.ativo(lk) else None
        parte = destino.with_name(destino.stem + '.parte.mp4')
        # no proxy, o ator sai do proxy 720p (a mesma linha do tempo do bruto): decodificar e escalar o 4K pesava mais que tudo
        video = p / fonte['arquivo']
        if not final and not horizontal and fonte.get('proxy') and (p / fonte['proxy']).exists():
            video = p / fonte['proxy']
        cmd = exportacao.comando_final(video, clipes, horizontal, (edicao.get('enquadramento') or {}).get('x', 0.5), w, h, FPS,
                                       divisoes, camadas, codec, duracao, parte, mascara if mascara.exists() else None, eventos,
                                       r.get('transicoes'), {'arquivo': arq_leg} if arq_leg else None, lk, vinheta, a, r.get('movimentos'))
        log = tmp / 'ffmpeg.log'
        with open(log, 'wb') as erros:
            ff = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=erros, text=True)
            proximo = 0.25
            for linha in ff.stdout:
                if linha.startswith('out_time_us=') and linha.strip()[12:].isdigit():
                    feito = int(linha.strip()[12:]) / 1e6 / duracao
                    if feito >= proximo:
                        print(f'      {min(feito, 1):.0%}', flush=True)
                        proximo += 0.25
            if ff.wait() != 0:
                raise RuntimeError(f'ffmpeg falhou: {log.read_text(errors="replace")[-600:]}')
        parte.replace(destino)
        fase('montagem')
    except BaseException:
        if pasta_versao:
            shutil.rmtree(pasta_versao, ignore_errors=True)
        else:
            destino.with_name(destino.stem + '.parte.mp4').unlink(missing_ok=True)
        raise
    finally:
        srv.shutdown()
        shutil.rmtree(tmp, ignore_errors=True)

    fases['total'] = round(time.time() - t_ini, 1)
    duracao_real = inspecionar(destino)['duracao']
    if not final:
        gravar_json(pasta_versao / 'edicao.json', edicao)
        for campo in ('palavras', 'planos'):
            if r.get(campo) is None:
                avisos.append(f'A página não entregou __render.{campo}: {campo}.json ficou de fora.')
            else:
                gravar_json(pasta_versao / f'{campo}.json', r[campo])
        saida = r.get('palavras') or palavras_na_saida(transcricao, clipes)
        gravar_json(pasta_versao / 'notas.json', notas(edicao, transcricao, saida, duracao))
        gravar_json(pasta_versao / 'info.json', {'versao': versao, 'duracao': duracao_real, 'criado_em': datetime.now().isoformat(timespec='seconds'),
                                                 'fases': fases, 'avisos': avisos})
        final_dir = p / 'versoes' / f'v{versao}'
        pasta_versao.replace(final_dir)
        destino = final_dir / 'proxy.mp4'
    for x in avisos:
        print(f'Aviso: {x}')
    print(f'Pronto: {destino}')
    print(f'Duração {duracao_real:.2f} s · ' + ' · '.join(f'{k} {v:.1f} s' for k, v in fases.items()))
    return destino


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if a != '--final']
    if len(args) != 1:
        raise SystemExit(__doc__)
    render(args[0], final='--final' in sys.argv[1:])
