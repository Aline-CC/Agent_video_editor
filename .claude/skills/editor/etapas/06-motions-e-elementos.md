# 06 · Motions e elementos

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
gráfico de barras), escreva um preset novo — num **subagente em segundo plano** (`model: opus`), com este pedido:

```text
Escreva um preset de motion novo em biblioteca/motions/presets/<id>.html para o editor de Reels em <raiz>.
Leia antes 2 presets existentes (prompt.html e lettering.html) e biblioteca/motions/runtime.js: copie a estrutura
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

Lettering, Palavra ManyChat (o CTA "comente PALAVRA"), Caixinha de perguntas e Print sobreposto ficam por cima do plano,
presos às palavras (a direção os cria; ver `03-direcao.md`). O estilo de cada um está na página de render
(`render/`), medido nas referências do criador. Você não faz nada aqui além de conferir no proxy se o texto está certo e
legível; para mudar o texto, edite `direcao.itens[i].texto` do elemento.
