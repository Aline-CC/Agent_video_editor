# 13 · Preset novo a partir de uma referência

Quando o criador manda um trecho ("faz um preset desse movimento", ref + tempo) ou uma referência mostra um movimento de
insert que a biblioteca não tem. O preset é uma receita (formato do 18, SPEC §8.4) que o motor do 19
(`render/src/presets.ts`, `divisao.ts`, `ajustes.ts`) desenha sem código novo. Entra `aprovado: false`; quem aprova é o
criador, na página Presets.

## 1. Escolher o trecho e ver se já existe

- Os planos com insert estão em `biblioteca/referencias/<ref>/direcao.json` (tipos `insert_tela_cheia`,
  `tela_dividida_insert`, `comentario_insert_ator`); os favoritos em `_favoritos.json`.
- Compare com as `fontes` e a `descricao` dos presets em `biblioteca/presets/*.json`. Muitos trechos são o mesmo
  movimento de um preset que já existe.
- Leia os recusados (`biblioteca/presets/_recusados/*.json`: `nome`, `descricao` e o `motivo` do criador) e não sugira de
  novo o mesmo tipo de coisa.
- Separe o que é do preset (o card: onde fica, como entra, se mexe e sai) do que é da **mídia** (gravação de tela que
  rola ou dá zoom sozinha, destaque desenhado no print) e dos **elementos** (riscos, setas, lettering, card de comentário).

## 2. Medir quadro a quadro

```bash
uv run ferramentas/preset_tira.py quadros <ref> <ini> <fim> 0.0417 tira.jpg   # 1 quadro a 24 fps, grade a cada 10 %
```

Leia a imagem e anote as bordas do card em cada quadro (% da tela). Na tela dividida, converta para % da **área** (a parte
de cima: % da tela ÷ altura da área). O 1º quadro do plano às vezes já está no meio do movimento.
- Giro: o ângulo das linhas longas do print (Hough no OpenCV) quadro a quadro. Card em perspectiva: os 4 cantos →
  `preset_tira.py pose '[[x,y]×4]' '[cx,cy,w,h,rot,rx,ry]'`.
- Curva de cada propriedade: progresso p = (v − v₀)/(v₁ − v₀) contra t/duração →
  `preset_tira.py curva '{"t": [...], "p": [...]}'`. Nunca linear.

## 3. Montar a receita (o que o motor faz com ela)

- Todo card (menos os de `quadros`) é **reajustado à proporção da mídia** dentro da caixa do preset (até 96 % da área;
  mídia em pé fica centrada e cresce até 84 %). Um card que passa da tela só com `quadros` (ou o caso "desliza").
  Na dividida com mais de um card, a área fica em 56 %.
- `dx` e `dy` usam a mesma curva (`pos`); desfoque e opacidade têm curva, `atraso` e `dur` próprios.
- Insert mais curto: entrada e saída mantêm a duração; se não couberem na vida do card, encolhem juntas. Mantenha
  entrada + saída ≤ a vida do card.
- `repete`: o último card é o molde; a mídia k entra em k/n. Numa sequência (`fim_frac` < 1), a saída do anterior começa
  quando o próximo entra; para o próximo chegar depois, use `atraso` na entrada do molde (o Carrossel lateral).
- Duas cópias da mesma mídia (`midia`) somam efeitos: uma desfocada de vez (`repouso.desfoque`) embaixo e a nítida por
  cima saindo com fade = a mídia "fica desfocada" atrás de um destaque (o Destaque por cima).
- `quadros` (4 cantos em % da área, `f` = fração da vida do card): giro e escala livres, passando das bordas. Estica
  com a duração do insert e os ajustes rápidos não mexem nele.
- Não dá sem código: rolar o conteúdo dentro de uma janela parada, animar a divisão da tela, escurecer um card parado,
  borrão de movimento numa direção só, curvas diferentes para x e y.
- Sons (`biblioteca/sons/catalogo.json`, intensidade `baixo`): pop na entrada, clique na troca, whoosh na saída, riser no
  mergulho. O momento `entrada` toca para todo card que aparece (até o seco); sons iguais a menos de 0,04 s tocam uma vez.

## 4. Gravar

`biblioteca/presets/<id>.json`, id = `secrets.token_hex(5)`, com os campos dos outros: `nome`, `descricao` (o movimento
em palavras, com tempos), `formato`, `receita`, `fontes` (`ref`, `inicio`, `fim`), `aprovado: false`, `criado_em`,
`recortes` (onde está a mídia de cada card num quadro: `t` desde o início do trecho, 4 cantos em px de 720×1280),
`formatos`, `usos` (telas, nº de mídias, proporções), `rapidos`. Não mexa nos presets aprovados nem no `ordem.json`.
Depois: `uv run ferramentas/revisao.py clipes` (o clipe da referência que a página Presets toca).

## 5. Conferir com a referência

```bash
uv run ferramentas/preset_tira.py comparar teste.json comparar.jpg [largura]
```

`teste.json`: `{"ref", "inicio", "fim", "preset": "<caminho do .json>", "formato", "midias": [[x0,y0,x1,y1,t], ...],
"tempos": [...]}`; cada mídia é recortada da própria referência (px de 720×1280, num quadro em que ela está parada).
Em cima a referência, embaixo o motor do 19 (compilado de `render/src` na hora) nos mesmos instantes. Leia a imagem,
compare posição e tempo em 4–10 instantes e ajuste até bater. Uma mídia que na referência já está ampliada: passe-a
reduzida (`{"arquivo": img}`), senão a recriação amplia duas vezes.

Depois simule nas outras telas, num servidor seu (a 8719 é do criador):
`uv run ferramentas/servidor.py 8733` e `/render/preset.html?preset=<id>&tela=dividida|vertical|atras&n=<mídias>&prop=pe|mista|deitada`
(`window.__sim.ir(t)` para cada instante). Confira 1, 2 e 3 mídias e as proporções marcadas no `usos`.

Por fim, diga ao criador quais presets entraram "a revisar", de qual referência e onde valem.

## Efeito copiado de um reel (tipo `efeito`)

Quando o criador pede para copiar um efeito de um reel (lettering, antes e depois, órbita, capa de revista…), que não é
movimento de insert: meça quadro a quadro (pausa com `v.onplay=()=>v.pause()`, pixels pelo canvas do vídeo), recrie num
script sobre um trecho da gravação dele, compare lado a lado com a referência e só então grave. Fica em
`biblioteca/presets/<id>.json` com `tipo: "efeito"`, `nome`, `descricao` (as medidas), `fontes` (`url`, `inicio`, `fim`),
`previa` e `gif` (em `presets/efeitos/`), `script` (em `presets/efeitos/scripts/`, com o `comum.py`), `aprovado: false`.
A página Presets mostra a prévia e o link do reel; `presets.py` não os lista (o render ainda não os aplica: ligar um
efeito ao render é trabalho à parte, com o ok do criador).
