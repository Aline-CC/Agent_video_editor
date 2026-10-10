# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Pergunta ao Gemini (OpenRouter) sobre vídeos e imagens e imprime a resposta em texto.

    uv run ferramentas/gemini.py <arquivo> [<arquivo>…] "<pergunta>"

Como o 18 manda mídia (backend/app/comum.py e direcao.py): o vídeo vai como `video_url` (data URL base64), reduzido a
640 px de altura (o Gemini amostra ~1 quadro/s e ouve o áudio); um vídeo com menos de 1 s vai como o quadro do meio (o
Gemini recusa vídeo curto demais); imagem vai como `image_url`. HTTP direto, sem LangChain. Também importado pelo banco.py.
"""
import base64
import json
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from base import env, ffmpeg, inspecionar  # noqa: E402

URL = 'https://openrouter.ai/api/v1/chat/completions'
EXT_VIDEO = ('.mp4', '.mov', '.m4v', '.webm', '.mkv')
EXT_IMAGEM = {'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif'}
MIN_VIDEO = 1.0  # do 18: direcao.MIN_VIDEO_INSERT (abaixo disso o Gemini responde "Provider returned error")
MAX_IMAGEM = 4 * 1024 * 1024  # imagens maiores vão reduzidas (uma página inteira capturada passa fácil disso)
TIMEOUT = 180


def _data_url(arq: Path, mime: str) -> str:
    return f'data:{mime};base64,' + base64.b64encode(arq.read_bytes()).decode()


def bloco(arq: Path, tmp: Path, preparado: bool = False) -> dict:
    """Um arquivo como bloco da mensagem. `preparado`: o vídeo já está pequeno (vai como está)."""
    arq = Path(arq)
    if not arq.is_file():
        raise SystemExit(f'Arquivo não encontrado: {arq}')
    ext = arq.suffix.lower()
    if ext in EXT_IMAGEM:
        if arq.stat().st_size <= MAX_IMAGEM:
            return {'type': 'image_url', 'image_url': {'url': _data_url(arq, EXT_IMAGEM[ext])}}
        menor = tmp / f'{arq.stem}.jpg'
        ffmpeg('-i', str(arq), '-vf', "scale='if(gt(iw,ih),min(1600,iw),-2)':'if(gt(iw,ih),-2,min(1600,ih))'", '-q:v', '4', str(menor))
        return {'type': 'image_url', 'image_url': {'url': _data_url(menor, 'image/jpeg')}}
    if ext not in EXT_VIDEO:
        raise SystemExit(f'Formato não aceito ({ext or "sem extensão"}): use vídeo (MP4, MOV, WebM) ou imagem (JPG, PNG, WebP).')
    if preparado:
        return {'type': 'video_url', 'video_url': {'url': _data_url(arq, 'video/mp4')}}
    info = inspecionar(arq)
    if info['duracao'] < MIN_VIDEO:  # praticamente uma imagem parada: vai o quadro do meio
        quadro = tmp / f'{arq.stem}_meio.jpg'
        ffmpeg('-ss', f'{info["duracao"] / 2:.3f}', '-i', str(arq), '-frames:v', '1', '-vf', 'scale=-2:640', '-q:v', '4', str(quadro))
        return {'type': 'image_url', 'image_url': {'url': _data_url(quadro, 'image/jpeg')}}
    leve = tmp / f'{arq.stem}_640.mp4'  # do 18: direcao._clipe
    audio = ['-c:a', 'aac', '-b:a', '64k'] if info['tem_audio'] else ['-an']
    ffmpeg('-i', str(arq), '-vf', 'scale=-2:640', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-pix_fmt', 'yuv420p', *audio, str(leve))
    return {'type': 'video_url', 'video_url': {'url': _data_url(leve, 'video/mp4')}}


def chamar(mensagens: list[dict], esquema: dict | None = None, max_tokens: int = 4000, timeout: float = TIMEOUT,
           uso: dict | None = None):
    """Uma chamada ao OpenRouter (modelo do .env, raciocínio baixo, temperatura 0, como o 18). Com `esquema` (JSON Schema),
    a resposta vem estruturada e é devolvida já lida (dict); senão, texto. Uma nova tentativa em falha de rede ou 5xx.
    `uso` (um dict), se vier, recebe o `usage` da resposta (tokens)."""
    corpo = {'model': env('OPENROUTER_MODEL'), 'messages': mensagens, 'temperature': 0, 'max_tokens': max_tokens,
             'reasoning': {'effort': 'low'}}
    try:
        corpo['provider'] = {'order': [env('OPENROUTER_PROVIDER')], 'allow_fallbacks': True}
    except SystemExit:
        pass
    if esquema:
        corpo['response_format'] = {'type': 'json_schema', 'json_schema': {'name': esquema.get('title', 'resposta'), 'schema': esquema}}
    pedido = urllib.request.Request(URL, data=json.dumps(corpo).encode(), method='POST', headers={
        'Authorization': f'Bearer {env("OPENROUTER_API_KEY")}', 'Content-Type': 'application/json'})
    for tentativa in (1, 2):
        try:
            with urllib.request.urlopen(pedido, timeout=timeout) as r:
                dados = json.loads(r.read())
            break
        except urllib.error.HTTPError as e:
            texto = e.read().decode(errors='replace')[:400]
            if e.code == 402 or 'credit' in texto.lower():
                raise SystemExit('Sem crédito no OpenRouter. Adicione créditos e tente de novo.')
            if e.code >= 500 and tentativa == 1:
                time.sleep(2)
                continue
            raise SystemExit(f'O OpenRouter recusou o pedido (HTTP {e.code}): {texto}')
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            if tentativa == 1:
                time.sleep(2)
                continue
            raise SystemExit(f'Sem resposta do OpenRouter ({getattr(e, "reason", e)}); tente de novo.')
    if dados.get('error'):
        msg = str(dados['error'].get('message') if isinstance(dados['error'], dict) else dados['error'])[:400]
        if 'credit' in msg.lower() or '402' in msg:
            raise SystemExit('Sem crédito no OpenRouter. Adicione créditos e tente de novo.')
        raise SystemExit(f'O modelo devolveu um erro: {msg}')
    if uso is not None:
        uso.update(dados.get('usage') or {})
    conteudo = (dados.get('choices') or [{}])[0].get('message', {}).get('content') or ''
    if isinstance(conteudo, list):
        conteudo = ''.join(c.get('text', '') for c in conteudo if isinstance(c, dict))
    if esquema:
        try:
            return json.loads(conteudo.strip().removeprefix('```json').removesuffix('```'))
        except ValueError:
            raise SystemExit(f'Resposta fora do formato pedido: {conteudo[:300]}')
    return conteudo.strip()


def perguntar(arquivos: list, pergunta: str, sistema: str | None = None, esquema: dict | None = None,
              preparados: bool = False, max_tokens: int = 4000):
    """Manda os arquivos e a pergunta; devolve o texto (ou o dict, com `esquema`)."""
    with tempfile.TemporaryDirectory() as tmp:
        conteudo = [{'type': 'text', 'text': pergunta}] + [bloco(Path(a), Path(tmp), preparados) for a in arquivos]
        mensagens = ([{'role': 'system', 'content': sistema}] if sistema else []) + [{'role': 'user', 'content': conteudo}]
        return chamar(mensagens, esquema, max_tokens)


if __name__ == '__main__':
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    print(perguntar(sys.argv[1:-1], sys.argv[-1]))
