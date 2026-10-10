# 03 · Direção visual

Você escreve o **roteiro dirigido** do vídeo já cortado: o que aparece na tela em cada momento da fala, do jeito que o
criador dirige. Não mexe em mídia: só a "partitura visual". Inserts, motions, transições e legenda partem dela.

## Antes de escrever: aprenda o estilo

1. Leia `exemplos/regras.md` inteiro. As **Regras do criador** são obrigatórias; as sugeridas são guia.
2. Leia **todos** os roteiros de `exemplos/roteiros/` como um editor novo lê os roteiros anotados do chefe: entenda, pela
   fala, por que cada coisa aparece onde aparece. O que está sendo dito manda.

## Rodar

```bash
uv run ferramentas/direcao.py fala <slug>               # a fala do vídeo cortado, texto corrido + duração
# você escreve projetos/<slug>/roteiro.md
uv run ferramentas/direcao.py aplicar <slug> projetos/<slug>/roteiro.md
```

O `aplicar` alinha a fala às palavras reais (código, sem IA), monta os planos presos às palavras, lê os letterings e
cria os pedidos de insert. Ele imprime a tabela dos planos: confira tempos, tipos e quantas palavras casaram (devem
casar todas; se não, você alterou a fala — corrija o roteiro).

## O formato (o mesmo dos exemplos)

```text
[Comentário + insert + ator «Qual a melhor IA do mundo pra design?»: o card do comentário sobre o print do site da Vesper]
> abre com a pergunta do seguidor: regra do criador para vídeo de dúvida
“Qual a melhor IA do mundo pra design?”

[Tela dividida · insert: o site do GPT Astra abrindo; zoom no título]
> a fala cita a ferramenta: mostrar a ferramenta
“cara, a galera considera o <lettering>GPT Astra</lettering>,”

[Full ator: —]
“só que na minha opinião isso é uma bobagem,”
```

- Uma linha `[plano: marcação + elementos]`, opcionalmente uma linha `> porquê` (curto: por que esse plano aqui), e a
  fala entre aspas. Bloco após bloco, até o fim.
- **Planos** (use estes nomes): Full ator · Full ator com lettering «texto» · Insert tela cheia · Motion tela cheia ·
  Tela dividida · insert · Tela dividida · motion · Comentário + insert + ator «comentário».
- **Elementos** (na marcação, com "+"): + palavra manychat «PALAVRA» · + caixinha de perguntas «pergunta» ·
  + print/imagem sobreposta «o que é».
- **Lettering** (destaque de palavras) vai **na fala**, não na marcação: `<lettering>GPT 3.7</lettering>`, ou
  `<lettering texto="R$ 97">noventa e sete reais</lettering>` quando o texto na tela é diferente do falado. Uma tag por
  trecho, sem aninhar. Sobre o ator em tela cheia, o certo é o plano Full ator com lettering.

| Plano | O que é |
|---|---|
| Full ator | O apresentador ocupa a tela. Zoom no ator continua sendo Full ator (o zoom é do Enriquecimento). |
| Full ator com lettering | O ator em tela cheia com um texto grande de destaque; dura só enquanto o texto está na tela. |
| Insert tela cheia | Material **real** na tela toda, sem o ator: gravação de tela, site, app, print, foto, vídeo de apoio. |
| Motion tela cheia | Peça gráfica **animada**, feita para o vídeo, na tela toda. |
| Tela dividida · insert | Material real em cima, o ator embaixo. |
| Tela dividida · motion | Um motion em cima, o ator embaixo. |
| Comentário + insert + ator | O card do comentário de um seguidor sobre um insert/motion em cima, o ator embaixo respondendo. |

## Regras do formato

- Copie a fala **exatamente** como está, na ordem, sem pular, resumir ou corrigir nada. Você só divide em blocos,
  escreve a marcação e marca os letterings.
- Dirija no ritmo dos exemplos: blocos **curtos** (de meia frase a uma frase, poucos segundos). Um bloco novo a cada
  mudança do que aparece (uma nova tela, ação, ideia, ferramenta citada). Na dúvida, divida. As linhas da fala não são
  blocos.
- A marcação diz o que mostrar e o que acontece, ligado à fala, concreta e acionável, em 1 a 3 frases. Nunca descreva o
  layout que o nome do plano já diz. Num Full ator sem nada especial: "—".
- **Inserts**: a marcação conta o que acontece no insert, em ordem: qual material (o site, a página, a ferramenta,
  concretos — é o que o subagente vai buscar), como entra, zooms (em quê), destaques, trocas. Se a fala cita duas coisas
  ("esses dois sites"), mostre as duas e diga quando troca.
- Não invente fatos que a fala não sustenta; se a fala cita uma ferramenta, mostre a ferramenta.
- Pense já no que é **achável**: um site, um produto, um repositório, um print de anúncio oficial. Ideias abstratas
  ("o conceito de produtividade") pedem motion ou Full ator, não insert.

## Depois de aplicar

- Dúvidas suas sobre a direção (ex.: "não sei se é pergunta retórica ou leitura de comentário") viram notas:
  acrescente em `edicao.notas` `{"palavra_ini", "palavra_fim", "texto"}`.
- Confira as Regras do criador contra o resultado (abertura, máximo de 3–4 s de Full ator seguido etc.). Se violou,
  reescreva o trecho e aplique de novo.

Tempo esperado: ~2 min.
