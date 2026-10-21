# Contexto · campanha Black Friday 2026

Leia antes de mexer em qualquer projeto `black-*` (junto com o `regras.md` desta pasta). Atualize o **Estado** ao entregar
uma versão: é o que a próxima sessão lê.

## A campanha

- **Oferta:** acesso vitalício (plano "acesso total") a todos os cursos, os lançados e os que ainda vão sair, com bônus
  exclusivos de Black Friday. A condição só é revelada na **live de 10/11 (10 de novembro), às 19h**.
- **CTA:** cadastro na página `alinefreitas.cc/black-friday` (formulário "não leva nem 10 segundos"); depois do cadastro,
  o ingresso da live (`/black-friday/ingresso`, "Sua inscrição está confirmada").
- **Os 6 cursos** (coleção "Black 26", caixas 3D): Formação Artista IA, Retoque de Pele (High End), Color Grading,
  Retoque de Produto, Pós de CGI, Photoshop Starter.
- **Números:** a bio do Instagram diz **+4.000 alunos**; nos vídeos a fala diz "mais de três mil" (black-v4) e "quatro
  mil" (black-cadastro). Não troque o número na tela sem a criadora decidir.
- **Prova de mercado:** +20 anos com publicidade (Netflix, Samsung, Coca-Cola, Honda, Boticário/make B, Iguatemi).
  Portfólio: `alinefreitascc.myportfolio.com` (`/videos`, vídeos em no máximo 720p; `/fusoes`, imagens).

## Mídias no banco (as de sempre)

`banco.py buscar black` e `buscar portfólio`. As principais:
- Página e ingresso: `1ac3f4cbd9` (cadastro, em pé), `c3ac0b7ffa` (cadastro, metade de cima), `3f40467c14` (ingresso).
- Cursos: `b1bb1216c3` (as 6 caixas juntas), uma caixa por curso (`3a8727e6ac`, `efb762c814`, `cad0138213`, `3c2cf07a99`,
  `9982e9a676`, `fb4df5570c`), os 6 deslizando (`35a7a02e74`, `504d100031`, `af9eff0ced`).
- Peças da campanha: stories `a907688534` e `54a86e53ea`, contagem `3e42e8e667`, posts `175007481d` e `2e98b701dc`,
  estático `eb6c2a396e`.
- Portfólio: Honda HR-V `fcd137791d` e `30ccb36461`, make B `860cbb32fb`, fusões em pé (`f6a13619ac`, `54afb7b5b6`,
  `9d217c0521`, `18c2bc3ad7`, `3f55274762`).
- Instagram com "+4.000 alunos" marcado em rosa: `50156a4f79` (gravado em 2026-10-20 no Chrome dela).

## O visual da campanha

- **Fundo e vinheta do PRE-39** em todo plano em que ela aparece em tela cheia: o fundo escurecido, ela com o brilho
  dela, a vinheta no quadro todo (pedido no black-v4, v9).
- **Texto gigante atrás dela** (recortada) + texto menor na frente, branco, entrando desfocado. Ex.: "10/11" atrás e "às
  19h" na frente; "pra" atrás e "sempre" na frente; "+20 anos". O de trás tem que ser lido inteiro: o topo a ~5% da tela
  (no black-v2 v11 ela pediu para subir), o cabelo passando só na base dele.
- A legenda das palavras que viram texto fica muda (`legenda.ajustes` com `texto: ""`).
- Inserts com movimento: zoom lento do centro (`camera: "Leve"` no Corte seco), como nos CTAs, **nunca deslizando rápido
  para o lado**.
- Fechamento: assinatura alinefreitas.cc (fundo preto, fade).

### Esses efeitos não estão no render

O render (`render.py`) ainda não faz o texto atrás dela nem o fundo do PRE-39: eles são aplicados **sobre o proxy, depois
de cada render**, na ordem abaixo, rodando da raiz do repositório. Se você renderizar e não reaplicar, eles somem da
versão.

```bash
W="--with mediapipe --with numpy --with opencv-python-headless --with pillow"
X=biblioteca/presets/efeitos/scripts
V=projetos/<slug>/versoes/vN          # o script lê palavras.json e planos.json da mesma pasta: o vídeo tem que ser proxy.mp4
cp $V/proxy.mp4 /tmp/limpo.mp4        # guarde o limpo para poder refazer
uv run -q $=W python $X/pre39_fundo.py $V/proxy.mp4 /tmp/a.mp4 && mv /tmp/a.mp4 $V/proxy.mp4          # só o black-v4 por enquanto
Y_A=0.05 ESCURO=1.0 uv run -q $=W python $X/texto_atras.py $V/proxy.mp4 /tmp/b.mp4 <w_atrás> <w_frente> "<atrás>" "<frente>" [y_frente] [tam_atrás=272] [tam_frente=150] && mv /tmp/b.mp4 $V/proxy.mp4
cp $V/proxy.mp4 projetos/<slug>/previa.mp4
```

`ESCURO=1.0` quando o PRE-39 já escureceu o fundo; sem ele, o texto escurece o fundo do plano para 0,82. Os textos de
cada vídeo:
- **black-v2:** `w00161 w00163 "10/11" "às 19h"` e `w00184 w00185 "pra" "sempre" 0.79`, com `Y_A=0.05`, tamanho de trás 300.
- **black-v3:** "chegou" atrás e "a hora" na frente (plano "chegou a hora").
- **black-v4:** `w00358 w00361 "+20" "anos"` (antes `w00357 w00360 "" "+20 anos"`).

## Estado (2026-10-21)

| Projeto | O que é | Última | Situação |
|---|---|---|---|
| black-v2 | "já é aluno" (22 s) | v12 | pendente: TRA-01 Brilho branco |
| black-v3 | "esperando desconto" (17 s) | v12 | **aprovada**, mas com 2 pedidos (tela dividida igual ao p1, TRA-01): confirme com ela antes de mexer |
| black-v4 | "20 anos" (41 s) | v12 | pendente: fala fora de sincronia no vídeo todo |
| black-v1-laptop | laptop, sem fala (10 s) | v3 | pendente: tirar o som de teclado e pôr música |
| black-cadastro | página de cadastro, **16:9** (1:59) | v3 | 26 comentários pendentes (ordem dos textos, fundo quase preto, fonte bold, sem aba do navegador, tirá-la da frente em vários trechos, trocar inserts) |

**Uma sessão por vez nos vídeos Black.** Em 2026-10-20 duas sessões mexeram nos mesmos projetos e as versões se
cruzaram (v10/v11 de uma, v12 da outra). Antes de começar, veja a última versão e a data dela
(`ls -t projetos/black-*/versoes`); se alguém mexeu há pouco, pergunte à criadora.
