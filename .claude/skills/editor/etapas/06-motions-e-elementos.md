# 06 · Motions e elementos

> **Antes de começar, leia `../aprendizados/motions.md` e `../aprendizados/elementos.md`**: o que o criador já corrigiu em vídeos anteriores. Não repita esses erros.

## Motions

Um plano de **Motion tela cheia** ou **Tela dividida · motion** recebe uma animação em HTML + GSAP (palco 1080×1920 na
tela cheia, 1080×960 na dividida, fundo transparente; o fundo escolhido é desenhado atrás). Regra do criador: motions
**simples**, de poucos elementos e poucos segundos; a cena **nunca para** (depois da entrada, algo segue andando devagar
até o corte); curvas suaves, nunca lineares.

### Os presets (`biblioteca/motions/presets/<id>.html`)

| id | nome | campos | fundo sugerido |
|---|---|---|---|
| `claude-code` | Janela do Claude Code | `prompt` (o que é digitado) | `verde_claro` |
| `lettering` | Lettering com destaque | `texto`, `destaque` (a última palavra, em destaque) | `chuva` |
| `prompt` | Caixa de prompt | `prompt` | `verde_claro` |
| `site` | Barra de busca | `url` | `nevoa` |

```bash
uv run ferramentas/inserts.py motion <slug> <plano> <preset> --valores '{"prompt": "…"}' [--fundo verde_claro]
uv run ferramentas/inserts.py motion <slug> <plano> --video <banco_id>     # um vídeo do banco no lugar do motion
```
Preencha os campos com o que a fala diz (o texto digitado é o da fala quando ela cita o prompt/o link: a digitação
acompanha as palavras faladas).

### Motion novo

Se nenhum preset serve e a ideia é simples (um número que cresce, dois logos lado a lado, uma lista que se monta, um
gráfico de barras), escreva um preset novo — num **subagente em segundo plano** (`model: opus`), com este pedido. Antes,
leia os recusados (`biblioteca/motions/presets/_recusados/*.html`: o JSON do topo tem o `motivo` do criador) e não
sugira de novo o mesmo tipo de coisa.

```text
Escreva um preset de motion novo em biblioteca/motions/presets/<id>.html para o editor de Reels em <raiz>.
Leia antes .claude/skills/editor/aprendizados/motions.md (o que o criador já corrigiu), os motions recusados
em biblioteca/motions/presets/_recusados/ (e os motivos) e 2 presets existentes (prompt.html e lettering.html) e biblioteca/motions/runtime.js: copie a estrutura
(o JSON <script id="preset"> com nome, descricao, fundo, duracao, sons; o <script id="campos">; o <style>; a timeline do
GSAP pausada entregue com motion.pronto(tl); motion.som/motion.digitar/motion.curva/motion.aCada).
Pedido: <o que a direção pede> · formato <vertical|dividida> · duração <s> · fala: "<fala>".
Regras: poucos elementos; entrada curta e suave, chegada longa (curva perto de (0.25, 0.1, 0.1, 1) em 0,8–1 s); a cena
nunca para até o corte; fontes Inter, Instrument Serif ou SF Pro; cores do contexto; sons só da biblioteca
(biblioteca/sons/catalogo.json). Teste abrindo render/motion.html?preset=<id>&formato=<…>&duracao=<…>&tocar=1 com o
servidor (uv run ferramentas/servidor.py <porta livre>) e fotografe 4 instantes com Playwright; olhe as imagens e corrija.
Marque no JSON do preset "a_revisar": true. Responda com o id e os campos.
```
Depois ligue com `inserts.py motion`. Animação mais elaborada que isso: troque o plano (insert real ou Full ator) e
registre a ideia como nota para o criador.

## Elementos

Ficam por cima do plano, presos às palavras (a direção os cria; ver `03-direcao.md`). O estilo de cada um, medido nas
referências do criador, está em `render/src/elementos.ts`:

| Elemento | Como aparece |
|---|---|
| Full ator com lettering · lettering sobre o ator | texto branco grande (SF Pro Display Bold, sombra), logo abaixo do queixo |
| lettering sobre insert | branco Bold no meio da área do insert, com o insert desfocado e escurecido atrás |
| palavra ManyChat | barra branca de comentário, a palavra digitada e o botão de enviar (com som de digitação) |
| caixinha de perguntas | sticker de pergunta do Instagram (cabeçalho em degradê), acima dos olhos sobre o ator |
| print sobreposto | com `banco` (id de uma mídia): a mídia num card no peito/costura; sem: uma etiqueta mono com o `texto` |

Todos entram com um "pop" de 0,18 s e saem secos. A legenda desvia deles.

O que você faz: o **print sobreposto** precisa de mídia para ficar bom (o logo da ferramenta, o recorte das estrelas do
GitHub): peça ao subagente do insert vizinho, ou busque você (`banco.py buscar`, `captura.py`, imagem oficial), e ponha
o id em `direcao.itens[i].banco` do elemento (direto no `edicao.json`; reaplicar a direção mantém a mídia de um print
com o mesmo texto). Confira no proxy se os textos estão certos e legíveis; para mudar, edite `direcao.itens[i].texto`.
