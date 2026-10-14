# 09 · Legenda

Gerada sozinha da fala cortada, no estilo medido nas referências: SF Pro Display Bold, branca, sombra escura difusa,
minúsculas como na fala, centralizada, **uma palavra por vez**, na altura de cada tipo de plano (desviando da costura da
tela dividida e do card do comentário). Entra 0,17 s antes da palavra.

> **Antes de começar, leia `../aprendizados/legenda.md`**: o que o criador já corrigiu em vídeos anteriores. Não repita esses erros.

## O que você faz

Confira a **grafia** das palavras que o transcritor pode ter errado: nomes de ferramentas, marcas, siglas, números
("cloud" → "Claude", "gpt" → "GPT", "dez por cento" falado continua por extenso). Corrija só a grafia, nunca a fala.

Em `edicao.legenda.ajustes`, presos às palavras:
```json
{"w00031": {"texto": "Claude", "fim": "w00031"},
 "w00040": {"texto": "GPT-5", "fim": "w00041"},
 "w00077": {"texto": "", "fim": "w00077"}}
```
- A chave é o id da 1ª palavra do bloco; `fim`, a última (junta palavras num bloco); `texto` corrigido; `""` esconde.
- `modo`: `frase` (padrão: até 3 palavras / 18 letras, como nos Reels da criadora) ou `palavra` (uma por vez).
- `ligada: false` desliga.
- Num insert, `inserts.pedidos[i].enriquecimento.legenda_y` (fração do quadro, 0,15–0,85) põe a legenda numa altura
  escolhida só ali (ex.: 0.72 para descer de cima de um rosto em tela cheia).

Para achar os ids: `uv run ferramentas/cortes.py texto <slug>` (ou o `transcricao.json`).

Tempo esperado: ~1 min.
