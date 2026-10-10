# 12 · Vídeo final

O criador aprovou uma versão no app ("Aprovado · <slug> · vN").

```bash
uv run ferramentas/render.py <slug> --final
```

- Usa o `edicao.json` atual. Se ele mudou depois da vN aprovada (confira com `versoes/vN/edicao.json`), avise e pergunte
  antes: o aprovado é a vN.
- Sai em `projetos/<slug>/final/<nome> · <data>.mp4`: 2160×3840 (4K), HEVC, 24 fps, AAC 320 kbps, −14 LUFS.
- Entregue com o caminho e `open -R "<arquivo>"` (abre o Finder no arquivo).

Tempo esperado: ~1 min por minuto de vídeo.
