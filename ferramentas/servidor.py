"""Servidor local: serve a raiz do repositório (app de revisão, página de render, projetos e biblioteca) com Range
(o player e o Chromium precisam pular no vídeo) e grava as revisões que o app manda.

    uv run ferramentas/servidor.py [porta]      → http://localhost:8719/app/
Também importado pelo render (`servir(0)` sobe numa porta livre, numa thread).
"""
import json
import os
import re
import sys
import threading
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, str(Path(__file__).parent))
from base import PROJETOS, RAIZ, gravar_json  # noqa: E402

PORTA = 8719
PUBLICOS = ('app', 'render', 'projetos', 'biblioteca')
REVISAO = re.compile(r'^/api/revisao/([\w-]+)/v(\d+)$')


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(RAIZ), **k)

    def log_message(self, format, *args):  # noqa: A002 — silencioso: o render faz milhares de pedidos
        pass

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Accept-Ranges', 'bytes')
        super().end_headers()

    def _json(self, dados, status=200):
        corpo = json.dumps(dados, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(corpo)))
        self.end_headers()
        self.wfile.write(corpo)

    def do_GET(self):
        url = urlparse(self.path)
        if url.path == '/':
            self.send_response(HTTPStatus.FOUND)
            self.send_header('Location', '/app/')
            self.end_headers()
            return
        if url.path == '/api/lista':  # nomes de arquivos de uma pasta pública: ?pasta=biblioteca/presets
            alvo = (RAIZ / parse_qs(url.query).get('pasta', [''])[0]).resolve()
            if not alvo.is_dir() or not str(alvo).startswith(str(RAIZ)) or alvo.relative_to(RAIZ).parts[:1] not in [(p,) for p in PUBLICOS]:
                return self._json({'erro': 'pasta inválida'}, 400)
            return self._json(sorted(p.name + ('/' if p.is_dir() else '') for p in alvo.iterdir() if not p.name.startswith('.')))
        partes = Path(url.path).parts
        if len(partes) < 2 or partes[1] not in PUBLICOS:
            return self.send_error(404)
        if 'Range' in self.headers:
            return self._range()
        super().do_GET()

    def _range(self):
        caminho = Path(self.translate_path(self.path))
        if not caminho.is_file():
            return self.send_error(404)
        tamanho = caminho.stat().st_size
        m = re.match(r'bytes=(\d*)-(\d*)', self.headers['Range'])
        ini = int(m.group(1)) if m and m.group(1) else 0
        fim = int(m.group(2)) if m and m.group(2) else tamanho - 1
        if m and not m.group(1) and m.group(2):  # bytes=-N: os últimos N
            ini, fim = max(tamanho - int(m.group(2)), 0), tamanho - 1
        fim = min(fim, tamanho - 1)
        if ini > fim:
            self.send_response(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
            self.send_header('Content-Range', f'bytes */{tamanho}')
            return self.end_headers()
        self.send_response(HTTPStatus.PARTIAL_CONTENT)
        self.send_header('Content-Type', self.guess_type(str(caminho)))
        self.send_header('Content-Range', f'bytes {ini}-{fim}/{tamanho}')
        self.send_header('Content-Length', str(fim - ini + 1))
        self.end_headers()
        with open(caminho, 'rb') as f:
            f.seek(ini)
            resta = fim - ini + 1
            try:
                while resta > 0:
                    bloco = f.read(min(1 << 20, resta))
                    if not bloco:
                        break
                    self.wfile.write(bloco)
                    resta -= len(bloco)
            except (BrokenPipeError, ConnectionResetError):
                pass

    def do_PUT(self):
        m = REVISAO.match(urlparse(self.path).path)  # PUT /api/revisao/<slug>/v<N>: o app grava a revisão inteira
        if not m or not (PROJETOS / m.group(1)).is_dir():
            return self._json({'erro': 'rota inválida'}, 404)
        dados = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))) or b'{}')
        gravar_json(PROJETOS / m.group(1) / 'revisoes' / f'v{m.group(2)}.json', dados)
        self._json({'ok': True})


Handler.extensions_map |= {'.mjs': 'text/javascript', '.webm': 'video/webm', '.m4a': 'audio/mp4', '.cube': 'text/plain'}


def servir(porta: int = 0) -> ThreadingHTTPServer:
    """Sobe o servidor numa thread (porta 0 = livre) e devolve-o; a porta fica em `.server_address[1]`."""
    srv = ThreadingHTTPServer(('127.0.0.1', porta), Handler)
    srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


if __name__ == '__main__':
    porta = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get('PORTA', PORTA))
    print(f'Editor: http://localhost:{porta}/app/')
    ThreadingHTTPServer(('127.0.0.1', porta), Handler).serve_forever()
