# Aprendizados · Render e autorrevisão

O que já foi aprendido nesta área, vídeo a vídeo (como gravar: `etapas/14-concluir.md`). Leia antes de trabalhar nela
e não repita estes erros. **[gosto]** = preferência confirmada pelo criador · **[defeito]** = erro técnico.

## Do criador

_Nenhum ainda._

## Técnicos (do editor)

- **[defeito] Zoom em escadinha e quadros repetidos.** O render posicionava o vídeo na fronteira entre dois quadros e
  repetia quadros; o zoom lento andava em degraus de 1 pixel — corrigido em `render/src/desenho.ts` (+15 ms, o meio do
  quadro); zoom lento de imagem/site/ingresso vai gerado no próprio arquivo (subpixel, supersampling, 24 q/s). _black-v8·v10–v11 · 2026-10-22_
- **[defeito] Material acelerado piscando ou travando.** Gravação a 30 q/s num vídeo a 24 pula quadro; os "antes" de
  camada ligando/desligando viram piscas; mídia mais curta que o plano congela. Gere cada material a 24 q/s, sem os
  piscas, no tamanho exato do plano. _black-v8, revisão geral · 2026-10-22_
- **[técnica] Conferência quadro a quadro antes de entregar:** piscas, travas, olho fechado no fim do corte, repetição
  de fala (cada bloco de fala transcrito separado) e legenda junto com texto em destaque (todos os quadros, 24/s). _toda a Black · 2026-10-22_

- **[técnica] Defeito de render não chega ao criador.** Toda versão passa pelos detectores antes da entrega: quadro
  solto do ator e quadro repetido nas emendas. Se algum acusar, corrija antes de entregar. _mvi-0717 · 2026-10-12_
- **[técnica] Conferir a correção no vídeo inteiro.** Ao corrigir um defeito de render, confira o vídeo todo, não só
  o ponto apontado: o mesmo defeito costuma estar em outras trocas de plano, e a correção pode criar outro. _mvi-0717 · 2026-10-12_
- **[defeito] Quadro repetido na emenda.** O bruto roda a 23,976 quadros/s e o vídeo final a 24: cada trecho precisa
  ocupar exatamente os quadros do vídeo final que lhe cabem — corrigido em `ferramentas/montagem/exportacao.py`. _mvi-0717 · 2026-10-12_
- **[defeito] ProRes no M1.** O M1 comum não tem o codificador de ProRes por hardware — corrigido em
  `ferramentas/montagem/render_quadros.py` (`-allow_sw 1`). _3-coisas-fai · 2026-10-14_
- **[defeito] Zoom em degraus.** Um insert com zoom lento era tratado como quadro parado e o quadro era reaproveitado —
  corrigido em `render/src/inserts.ts`. _3-coisas-fai · 2026-10-14_
- **[defeito] Zoom andando para o lado.** O zoom lento crescia do centro do quadro e a mídia em tela toda ficava presa
  pelo topo — agora cresce do centro da mídia (`render/src/ajustes.ts`, `render/src/divisao.ts`). _3-coisas-fai · 2026-10-14_
- **[defeito] "largura" é fator.** O ajuste `largura` é um fator ("1.3"), não % — corrigido em `etapas/05-enriquecimento.md`. _3-coisas-fai · 2026-10-14_
- **[defeito] Gravação de tela acelerada trava.** As pausas paradas entre os movimentos viram micro-paradas quando
  aceleradas: tire os quadros parados antes de acelerar (`mpdecimate`). _3-coisas-fai · 2026-10-14_
- **[defeito] Máscara do ator recortado.** O render espera `midia/recorte/<fonte>_mascara.mp4`, mas nada no projeto o
  gerava: gerada com o MediaPipe (selfie segmenter); vale virar ferramenta do projeto. _3-coisas-fai · 2026-10-14_
- O Gemini acerta problemas de corte e de legenda sobre conteúdo, e erra cor de legenda (diz "preta" para a branca com
  sombra): confira na folha de contato antes de mexer. _1º teste · 2026-10-10_
- Nunca rode o render (ou algo que use multiprocessing) por `python -` (stdin): os processos-filho entram em laço e a
  máquina trava. Use um arquivo com `if __name__ == '__main__'`. _1º teste_
- **[defeito] Dois renders ao mesmo tempo com as mesmas mídias.** Cada render grava `exportacao.tmp.mp4` na pasta do
  item do banco: dois projetos que usam o mesmo item, renderizados juntos, apagam o arquivo um do outro e o render
  falha no fim ("Error writing trailer"). Renderize em fila. _3-niveis-7-dias · 2026-10-22_
- **[defeito] Zoom seco cortava sempre pela esquerda.** Com o tamanho mudando no meio do vídeo, o crop perdia a posição — corrigido com o zoompan em `montagem/exportacao.py`. _gpt-image-glow · 2026-10-18_

## Anúncios (CTAs) — só para anúncio; Reels têm outra lógica

- **[gosto] Cor.** Parte da gravação, com ajuste leve: pele natural sem magenta, fundo cinza neutro, contraste meio-termo (nem lavado, nem forte). LUTs aprovadas: `lp-ext-ref2`, `vsl-ext-ref-lp`. _ficha-personagem-ia·v6.6, v6.9; cta-lp-ext·v1 c1, v4 c1; chat · 2026-10-15_
- **[técnica] Cor.** Antes de mexer, meça pretos e brancos (o "lavado" era o branco preso em 82%). Para casar com uma referência de outra cena, case só a luz e o balanço pelo fundo cinza, nunca canal por canal (deixa o fundo verde ou rosa). _chat · 2026-10-15_
- **[defeito]** Motion recusado na Biblioteca e ainda usado no projeto deixava o render em 8 s por quadro — corrigido em `render.py` (para logo e diz qual falta). Render lento: olhe primeiro os erros da página (404). _cta-vsl-ext·chat · 2026-10-15_
- **[defeito]** A máscara do recorte saía com quadro-chave a cada 250 quadros (busca lenta) — corrigido em `recorte.py` (a cada 6). _cta-vsl-ext·chat · 2026-10-15_
