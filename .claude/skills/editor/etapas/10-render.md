# 10 · Render e autorrevisão

## Render do proxy

```bash
uv run ferramentas/render.py <slug>
```

Gera `projetos/<slug>/versoes/vN/` (N = a próxima): `proxy.mp4` (720p, 24 fps, tudo queimado), uma cópia do
`edicao.json`, `palavras.json` e `planos.json` (no tempo do vídeo final, para o app), `notas.json` (suas dúvidas e as
dos cortes) e `info.json` (tempos e avisos). Leia os avisos impressos (ex.: voz limpa ausente).

Como funciona: a página `render/?projeto=<slug>` desenha a camada dos inserts, motions e elementos; Chromes escondidos a
fotografam quadro a quadro; uma passada só do ffmpeg junta o ator (cortes, 9:16, look, zoom do Full ator, posição na
tela dividida), a camada, as transições, a legenda (ASS) e o áudio (voz limpa, sons, trilha com ducking, −14 LUFS).

## Autorrevisão (1 rodada, antes de entregar)

1. `uv run ferramentas/folha.py projetos/<slug>/versoes/vN/proxy.mp4 --cada 1` e **olhe** a folha: inserts no lugar e
   com a mídia certa, nada vazio ou preto, legenda legível e fora do conteúdo importante, elementos com texto certo,
   abertura forte (gancho visual).
2. `uv run ferramentas/gemini.py projetos/<slug>/versoes/vN/proxy.mp4 "<pergunta>"` com:
   ```text
   Você revisa um Reels editado antes de ir para o criador. Aponte só problemas concretos, com o tempo (m:ss):
   corte brusco ou palavra cortada no meio; insert que não combina com o que está sendo dito; tela preta ou vazia;
   legenda sobre texto importante ou ilegível; som alto demais, estalo ou música cobrindo a voz; repetição de fala.
   Se estiver tudo bem num item, não comente. Máximo 10 itens.
   ```
3. Corrija o que for real (pode ser um corte, um insert, um ajuste de legenda) e renderize de novo **uma vez** —
   apague a versão descartada (`versoes/vN/`) para a entregue ser a v1. Não faça uma segunda rodada.

## Entregar

```bash
uv run ferramentas/servidor.py      # se não estiver no ar (em segundo plano) → http://localhost:8719/app/
```
Diga ao criador, em poucas linhas: o link do app, a duração final, quanto tempo levou, as dúvidas que deixou como nota
e o que não conseguiu (ex.: "o insert do p7 ficou com um print estático: o site exige login").

Tempo esperado: 2,5 a 3 min de render para 1 min de vídeo com metade em insert (fotos ~70 s, montagem ~65 s; na 1ª vez
de cada mídia do banco, +~5 s por vídeo para a cópia de exportação) + ~30 s de autorrevisão (o Gemini responde em ~16 s).

## Aprendizados (1º vídeo de teste, out/2026)

- O Gemini acerta problemas de **corte** (o "m" de uma palavra removida escapando) e de **legenda sobre conteúdo**, e
  erra cor de legenda (diz "preta" para a branca com sombra): confira na folha antes de mexer.
- Corte com a borda "fora de pausa" (fala colada na palavra removida): o tempo do fim da palavra no ElevenLabs costuma vir
  ~0,1–0,2 s tarde. Ajuste a borda à mão no `timeline.V1` (guarde o valor da IA em `auto`) e renderize de novo.
- A legenda na altura medida cai sobre o conteúdo de inserts em tela cheia com muito texto (limitação já conhecida do 18).
