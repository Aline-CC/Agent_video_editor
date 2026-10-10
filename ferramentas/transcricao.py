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
