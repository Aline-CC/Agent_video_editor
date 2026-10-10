# /// script
# requires-python = ">=3.11,<3.13"
# dependencies = ["mediapipe>=1.1.0", "numpy", "httpx"]
# ///
"""Etapa 1 do editor: do vídeo bruto até a matéria-prima pronta para os cortes (do 18: backend/app/pipeline.py, SPEC §6.3
do 18, menos os cortes pela IA e os motores extras).

    uv run ferramentas/preparar.py <vídeo> [--nome "Nome do projeto"] [--slug slug] [--briefing "texto ou arquivo"]

Cria projetos/<slug>/ (contrato em .claude/skills/editor/edicao.md) com o bruto clonado e, em paralelo: o 9:16 pelo rosto
(só num vídeo horizontal, antes do que depende dele), o proxy 720p e o rosto (numa leitura só do vídeo), o áudio e os
silêncios, a transcrição (ElevenLabs Scribe v2), a voz limpa Leve e o nível da voz; por fim, o edicao.json inicial. Se um
passo falha, diz qual e por quê, e a pasta é apagada (rodar de novo é o "tentar de novo").
"""
import argparse
import re
import shutil
import subprocess
import sys
import threading
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor, wait
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import enquadramento  # noqa: E402
import rosto  # noqa: E402
import voz  # noqa: E402
from base import PROJETOS, env, ffmpeg, gravar_json, inspecionar  # noqa: E402

ROTULOS = {'enquadramento': 'enquadramento 9:16', 'proxy': 'proxy 720p e rosto', 'audio': 'áudio e silêncios',
           'transcricao': 'transcrição', 'voz': 'voz limpa (Leve)', 'nivel': 'nível da voz'}
# o que se diz quando um passo para (do 18: pipeline.FALHA); o detalhe vai junto, curto e sem caminhos
FALHA = {
    'enquadramento': 'Não consegui enquadrar o vídeo em 9:16',
    'proxy': 'Não consegui preparar o vídeo para o player (proxy e rosto)',
    'audio': 'Não consegui medir as pausas do áudio',
    'transcricao': 'Não consegui transcrever o áudio',
    'voz': 'Não consegui limpar a voz',
    'nivel': 'Não consegui medir o nível da voz',
}
# os padrões do 18 para um projeto novo (look.PADRAO, audio.PADRAO, o fundo dos inserts no front)
LOOK = {'lut': 'casa', 'intensidade': 1, 'vinheta': 'normal'}
FUNDO_INSERTS = 'gradiente'


class Recusa(RuntimeError):
    """Um erro já escrito para gente (passa como está)."""


class _Parou(Exception):
    """Um passo falhou (a mensagem já foi impressa): o resto da cadeia dele não roda."""


# ---------------------------------------------------------------- o projeto

def slug(nome: str) -> str:
    """Do 18: projeto.slug (minúsculas, sem acentos, hífens)."""
    s = unicodedata.normalize('NFKD', nome).encode('ascii', 'ignore').decode()
    s = re.sub(r'[^a-zA-Z0-9]+', '-', s).strip('-').lower()
    return s or 'projeto'


def pasta_livre(base: str) -> Path:
    """`projetos/<base>`, ou `<base>-2`, `<base>-3`… se já existir (do 18: projeto.novo_id)."""
    n, nome = 1, base
    while (PROJETOS / nome).exists():
        n += 1
        nome = f'{base}-{n}'
    return PROJETOS / nome


def clonar(de: Path, para: Path) -> None:
    """Clone do APFS (instantâneo, sem ocupar espaço); entre volumes diferentes, uma cópia comum."""
    para.parent.mkdir(parents=True, exist_ok=True)
    if subprocess.run(['cp', '-c', str(de), str(para)], capture_output=True).returncode:
        shutil.copy2(de, para)


# ---------------------------------------------------------------- os passos

def proxy_e_rosto(video: Path, pasta: Path) -> dict:
    """O proxy e o rosto numa leitura só do vídeo (o ffmpeg decodifica uma vez e entrega as duas saídas: o rosto não
    espera o proxy ficar pronto).
    - O proxy (do 18: midia.proxy): cópia leve para o player, lado menor 720 px, H.264 por hardware, um quadro-chave a
      cada 0,5 s (o player salta muito entre trechos), AAC 128k, a linha do tempo do bruto; num `.parte.mp4`, trocado no
      fim → `midia/proxy/f1.mp4`.
    - O rosto (do 18: rosto.py, que media o proxy pronto): 6 amostras/s nos mesmos quadros, reduzidos como o 18 reduz
      → `midia/rosto/f1.json`."""
    destino = pasta / 'midia' / 'proxy' / 'f1.mp4'
    destino.parent.mkdir(parents=True, exist_ok=True)
    tmp = destino.with_name(destino.stem + '.parte.mp4')
    escala = "scale='if(gt(iw,ih),-2,720)':'if(gt(iw,ih),720,-2)'"
    try:
        medida = rosto.medir(video, junto=['-vf', escala, '-c:v', 'h264_videotoolbox', '-b:v', '3M', '-force_key_frames', 'expr:gte(t,n_forced*0.5)',
                                           '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', str(tmp)])
        tmp.replace(destino)
    finally:
        tmp.unlink(missing_ok=True)
    gravar_json(pasta / 'midia' / 'rosto' / 'f1.json', medida)
    achados = sum(1 for a in medida['amostras'] if a['conf'])
    return {'resumo': f'rosto em {achados} de {len(medida["amostras"])} amostras' if medida['amostras'] else 'sem rosto'}


def extrair_audio(video: Path, destino: Path) -> None:
    """Do 18: midia.extrair_audio. WAV mono 16 kHz, preservando o atraso inicial do áudio (first_pts=0)."""
    ffmpeg('-i', str(video), '-vn', '-af', 'aresample=16000:async=1:first_pts=0', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', str(destino))


def silencios(audio: Path, db: float = -35, minimo: float = 0.3) -> list[dict]:
    """Do 18: midia.silencios. Silêncios reais (silencedetect); o que vai até o fim do arquivo não tem fim e fica de fora."""
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(audio), '-af', f'silencedetect=n={db}dB:d={minimo}',
                        '-f', 'null', '-'], capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(r.stderr.strip()[-300:])
    inicios = [max(float(x), 0) for x in re.findall(r'silence_start: (-?[\d.]+)', r.stderr)]
    fins = re.findall(r'silence_end: ([\d.]+) \| silence_duration: ([\d.]+)', r.stderr)
    return [{'inicio': round(s, 3), 'fim': float(e), 'dur': float(d)} for s, (e, d) in zip(inicios, fins)]


def transcrever(audio: Path) -> list[dict]:
    """Do 18: motores.transcrever_elevenlabs. ElevenLabs Scribe v2 (manda o áudio da voz a um terceiro), em português, com
    o tempo de cada palavra no áudio inteiro; nada é limpo (repetições e retomadas ficam: são o que os cortes decidem)."""
    import httpx

    with audio.open('rb') as f:
        try:
            r = httpx.post(
                'https://api.elevenlabs.io/v1/speech-to-text',
                headers={'xi-api-key': env('ELEVENLABS_API_KEY')},
                data={'model_id': 'scribe_v2', 'language_code': 'por', 'timestamps_granularity': 'word', 'tag_audio_events': 'false', 'diarize': 'false'},
                files={'file': (audio.name, f, 'audio/wav')},
                timeout=300,
            )
        except httpx.HTTPError as e:
            raise RuntimeError(f'sem resposta do ElevenLabs: {e.__class__.__name__}') from e
    if r.status_code >= 400:
        try:  # a frase do ElevenLabs, se houver (ex.: "Invalid API key"), em vez do JSON inteiro
            d = r.json().get('detail')
            motivo = d.get('message') if isinstance(d, dict) else d
        except ValueError:
            motivo = None
        raise RuntimeError(f'ElevenLabs respondeu {r.status_code}: {str(motivo or r.text)[:200]}')
    palavras = [w for w in r.json().get('words', []) if w.get('type') == 'word']
    return [{'id': f'w{i:05d}', 'texto': w['text'].strip(), 'inicio': round(float(w['start']), 3), 'fim': round(float(w['end']), 3)}
            for i, w in enumerate(palavras)]


# ---------------------------------------------------------------- a execução

def _s(x: float) -> str:
    return f'{x:.1f}'.replace('.', ',')


def _mensagem(nome: str, e: Exception, pasta: Path) -> str:
    """Do 18: pipeline._mensagem. O erro já escrito para gente passa como está; o resto vira a frase do passo, com o
    detalhe curto (a última linha) e sem os caminhos."""
    if isinstance(e, Recusa):
        return str(e)
    linhas = [x for x in str(e).replace(f'{pasta}/', '').replace(f'{PROJETOS.parent}/', '').splitlines() if x.strip()]
    detalhe = ' '.join(linhas[-1].split()).rstrip('.') if linhas else ''
    detalhe = detalhe[:160] + ('…' if len(detalhe) > 160 else '')
    return FALHA[nome] + (f' ({detalhe}).' if detalhe else '.')


class Execucao:
    """Roda os passos (cada um medido) e imprime cada um assim que termina."""

    def __init__(self, pasta: Path):
        self.pasta = pasta
        self.erros: list[str] = []
        self._trava = threading.Lock()

    def passo(self, nome: str, fazer, *args):
        t0 = time.perf_counter()
        try:
            r = fazer(*args)
        except Exception as e:  # noqa: BLE001 — vira a mensagem do passo
            msg = _mensagem(nome, e, self.pasta)
            with self._trava:
                self.erros.append(f'{ROTULOS[nome]}: {msg}')
                print(f'  ✗ {ROTULOS[nome]}: {msg}', flush=True)
            raise _Parou from e
        dt = time.perf_counter() - t0
        resumo = r.get('resumo') if isinstance(r, dict) else None
        with self._trava:
            print(f'  ✓ {ROTULOS[nome]:<20}{_s(dt):>6} s' + (f'   {resumo}' if resumo else ''), flush=True)
        return r


def preparar(video: Path, nome: str, pasta: Path, briefing: str | None) -> None:
    t0 = time.perf_counter()
    midia = pasta / 'midia'
    bruto = midia / f'bruto{video.suffix.lower()}'
    clonar(video, bruto)
    try:
        info = inspecionar(bruto)
    except RuntimeError:
        raise Recusa('Não consegui ler o vídeo (formato não suportado ou arquivo corrompido).') from None
    if 'largura' not in info:
        raise Recusa('Este arquivo não tem imagem: escolha um vídeo.')
    if not info['tem_audio']:
        raise Recusa('Este vídeo não tem áudio: o editor precisa da fala para transcrever e cortar.')
    if briefing:
        (pasta / 'briefing.md').write_text(briefing.strip() + '\n', encoding='utf-8')
    horizontal = info['largura'] > info['altura']
    if horizontal:  # do 18: enquadramento._aplicar — o enviado vai para midia/original/ (intocado)
        original = midia / 'original' / bruto.name
        original.parent.mkdir(parents=True, exist_ok=True)
        bruto.rename(original)
        bruto = original
    fonte = {'id': 'f1', 'papel': 'bruto', 'arquivo': str(bruto.relative_to(pasta)), 'nome_original': video.name, **info}
    m, s = divmod(round(info['duracao']), 60)
    print(f'Preparando "{nome}" em projetos/{pasta.name}/ ({m}:{s:02d}, {info["largura"]}×{info["altura"]}'
          f'{", horizontal: vira 9:16 pelo rosto" if horizontal else ""})', flush=True)

    ex = Execucao(pasta)
    res: dict = {'enquadramento': {'x': 0.5}}

    def enquadrar():  # o 9:16 passa a ser a fonte
        r = enquadramento.aplicar(pasta, bruto)
        res['enquadramento'] = r['enquadramento']
        fonte.update(r['fonte'])
        return {'resumo': f'recorte de {r["recorte"]} px, rosto em {r["rostos"]} amostras' + (f' ({r["aviso"]})' if r.get('aviso') else '')}

    def cadeia_video():  # o 9:16 antes do que depende dele (o proxy e o rosto)
        if horizontal:
            ex.passo('enquadramento', enquadrar)
        ex.passo('proxy', proxy_e_rosto, pasta / fonte['arquivo'], pasta)
        fonte['proxy'] = 'midia/proxy/f1.mp4'

    def cadeia_audio():  # o áudio do enviado (num 16:9, o 9:16 leva o mesmo áudio, copiado): não espera o enquadramento
        def audio():
            extrair_audio(bruto, pasta / 'audio.wav')
            lista = silencios(pasta / 'audio.wav')
            gravar_json(pasta / 'silencios.json', {'silencios': lista})
            return {'resumo': f'{len(lista)} silêncio' + ('s' if len(lista) != 1 else '')}
        ex.passo('audio', audio)

        def transcricao():
            palavras = transcrever(pasta / 'audio.wav')
            if not palavras:
                raise Recusa('Não encontrei fala neste vídeo: a transcrição não achou nenhuma palavra. O editor precisa da fala para cortar.')
            gravar_json(pasta / 'transcricao.json', {'motor': 'elevenlabs', 'palavras': palavras})
            res['palavras'] = len(palavras)
            return {'resumo': f'{len(palavras)} palavras'}
        ex.passo('transcricao', transcricao)

    def voz_limpa():
        arq = voz.limpar(bruto, midia / 'voz' / 'f1_leve.wav', 'leve')
        res['voz_lufs'] = round(voz.lufs(arq, como_voz=True), 1)
        return {'resumo': f'{_s(res["voz_lufs"])} LUFS'}

    def nivel():
        res['nivel_voz'] = voz.nivel_da_voz(bruto)
        return {'resumo': f'{_s(res["nivel_voz"])} dB'}

    def rodar(f, *a):
        try:
            f(*a)
        except _Parou:
            pass

    with ThreadPoolExecutor(4) as pool:
        wait([pool.submit(rodar, cadeia_video), pool.submit(rodar, cadeia_audio),
              pool.submit(rodar, ex.passo, 'voz', voz_limpa), pool.submit(rodar, ex.passo, 'nivel', nivel)])
    if ex.erros:
        raise _Parou

    edicao = {
        'id': pasta.name, 'nome': nome, 'criado_em': datetime.now().isoformat(timespec='seconds'),
        'formato': 'reels', 'saida': {'largura': 1080, 'altura': 1920},
        'fontes': [fonte],
        'enquadramento': res['enquadramento'],
        'look': LOOK,
        'velocidade': 1.0,
        'nivel_voz': {'fonte': 'f1', 'db': res['nivel_voz']},
        'timeline': {'V1': []},
        'cortes': {},
        'direcao': {'roteiro': '', 'itens': []},
        'inserts': {'pedidos': [], 'fundo': FUNDO_INSERTS, 'ator_planos': {}},
        'motions': {},
        'transicoes': {},
        'audio': {'voz': {'limpeza': 'leve', 'timbre': 'natural'}, 'fundo': None, 'fundo_mudo': False,
                  'niveis': {'ator': 0.0, 'presets': 0.0, 'transicoes': 0.0, 'fundo': 0.0}, 'voz_lufs': {'f1_leve': res['voz_lufs']}},
        'legenda': {'ligada': True, 'modo': 'palavra', 'ajustes': {}},
        'notas': [],
    }
    gravar_json(pasta / 'edicao.json', edicao)
    f = edicao['fontes'][0]
    print(f'Pronto em {_s(time.perf_counter() - t0)} s: {f["largura"]}×{f["altura"]}, {_s(f["duracao"])} s, '
          f'{res["palavras"]} palavras → projetos/{pasta.name}/edicao.json', flush=True)


def main() -> None:
    ap = argparse.ArgumentParser(description='Prepara um vídeo bruto para a edição (etapa 1).')
    ap.add_argument('video', help='o vídeo bruto')
    ap.add_argument('--nome', help='o nome do projeto (padrão: o nome do arquivo)')
    ap.add_argument('--slug', help='a pasta em projetos/ (padrão: do nome)')
    ap.add_argument('--briefing', help='o briefing: o texto ou o caminho de um arquivo')
    a = ap.parse_args()
    video = Path(a.video).expanduser().resolve()
    if not video.is_file():
        raise SystemExit(f'Não achei o vídeo: {a.video}')
    env('ELEVENLABS_API_KEY')  # sem a chave, nem começa
    briefing = a.briefing
    if briefing and Path(briefing).expanduser().is_file():
        briefing = Path(briefing).expanduser().read_text(encoding='utf-8')
    nome = (a.nome or video.stem).strip()
    pasta = pasta_livre(slug(a.slug or nome))
    pasta.mkdir(parents=True)
    try:
        preparar(video, nome, pasta, briefing)
    except (Exception, KeyboardInterrupt) as e:
        shutil.rmtree(pasta, ignore_errors=True)
        if isinstance(e, Recusa):
            raise SystemExit(str(e)) from None
        if isinstance(e, _Parou):
            raise SystemExit('O preparo parou (a pasta do projeto foi apagada; rode de novo depois de resolver).') from None
        if isinstance(e, KeyboardInterrupt):
            raise SystemExit('Interrompido (a pasta do projeto foi apagada).') from None
        raise


if __name__ == '__main__':
    main()
