"""A transcrição e o áudio que ela usa (do 18: midia.extrair_audio, midia.silencios, motores.transcrever_elevenlabs).

Importado pelo preparar.py e pelo calibragem.py. Só biblioteca padrão no topo (o httpx, de quem chama, só dentro do
`transcrever`): o calibragem é importado pelo servidor, que roda sem dependências.
"""
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from base import env, ffmpeg  # noqa: E402


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


def transcrever_local(audio: Path) -> list[dict]:
    """A transcrição no próprio Mac, de graça: whisper.cpp (`whisper-cli`, Homebrew) com o modelo small, em português,
    uma palavra por segmento. Os tempos são mais soltos que os do Scribe (os cortes se prendem às pausas medidas)."""
    import json
    import tempfile
    modelo = Path(__file__).parent.parent / 'biblioteca' / 'modelos' / 'ggml-small.bin'
    with tempfile.TemporaryDirectory() as d:
        wav, saida = Path(d) / 'a.wav', Path(d) / 'a'
        r = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(audio), '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', str(wav)], capture_output=True, text=True)
        if r.returncode:
            raise RuntimeError(r.stderr.strip()[-300:])
        # `-dtw`: o tempo de cada palavra pelo alinhamento fino (os do segmento escorregam perto de silêncios longos); `-mc 0`: sem o
        # texto anterior como contexto (com ele, o whisper repete frases que não foram ditas)
        r = subprocess.run(['whisper-cli', '-m', str(modelo), '-l', 'pt', '-ml', '1', '-sow', '-ojf', '-np', '-nfa', '-dtw', 'small', '-mc', '0',
                            '-of', str(saida), '-f', str(wav)], capture_output=True, text=True)
        if r.returncode or not saida.with_suffix('.json').exists():
            raise RuntimeError(f'whisper-cli falhou: {r.stderr.strip()[-300:]}')
        segs = json.loads(saida.with_suffix('.json').read_text(encoding='utf-8'))['transcription']
    palavras = []
    for s in segs:
        toks = [t for t in s.get('tokens', []) if not t['text'].startswith('[_') and t.get('t_dtw', -1) >= 0]
        # o 1º token marca o começo da palavra; o último com letra, quase o fim (a pontuação vem marcada depois da pausa)
        letras = [t for t in toks if t['text'].strip(' .,!?;:…')]
        if s['text'].strip() and letras:
            palavras.append([s['text'].strip(), max(toks[0]['t_dtw'] / 100 - 0.04, 0), letras[-1]['t_dtw'] / 100 + 0.12])
    for k in range(len(palavras) - 1):  # nunca invade a próxima
        palavras[k][2] = max(min(palavras[k][2], palavras[k + 1][1]), palavras[k][1] + 0.02)
    _nos_vales(palavras, audio)
    return [{'id': f'w{i:05d}', 'texto': t, 'inicio': round(a, 3), 'fim': round(b, 3)} for i, (t, a, b) in enumerate(palavras)]


def _nos_vales(palavras: list[list], audio: Path) -> None:
    """O alinhamento do whisper marca o começo da palavra um pouco tarde (no meio da 1ª sílaba): cada começo recua até o
    ponto mais baixo do volume logo antes dele (até 0,35 s, sem passar do começo da anterior) e cada fim avança até o
    mais baixo logo depois (até 0,3 s, sem passar do começo da próxima). Assim os cortes caem no vão entre as palavras."""
    import numpy as np
    sr, passo = 16000, 160  # envelope de 10 ms
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(audio), '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'], capture_output=True)
    x = np.frombuffer(r.stdout, np.float32)
    n = len(x) // passo
    env = np.convolve(np.sqrt((x[: n * passo].reshape(n, passo) ** 2).mean(1)), np.ones(3) / 3, 'same')
    q = lambda t: min(max(int(round(t * 100)), 0), n - 1)  # noqa: E731
    for k, w in enumerate(palavras):
        lo = q(max(w[1] - 0.35, palavras[k - 1][1] + 0.05 if k else 0))
        hi = q(w[1])
        if hi > lo:
            w[1] = (lo + int(np.argmin(env[lo:hi + 1]))) / 100
    for k, w in enumerate(palavras):
        lo = q(w[2])
        hi = q(min(w[2] + 0.3, palavras[k + 1][1] if k + 1 < len(palavras) else w[2] + 0.3))
        if hi > lo:
            w[2] = (lo + int(np.argmin(env[lo:hi + 1]))) / 100
        quieto = env[q(w[1]):q(w[2]) + 1] < 0.01  # −40 dB: um silêncio de 0,3 s dentro da palavra é o fim dela
        for i in range(len(quieto) - 30):
            if quieto[i:i + 30].all():
                w[2] = (q(w[1]) + i) / 100 + 0.05
                break
        w[2] = max(w[2], w[1] + 0.02)

