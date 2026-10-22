# Aprendizados · Enriquecimento (presets, Full ator, fundo)

O que já foi aprendido nesta área, vídeo a vídeo (como gravar: `etapas/14-concluir.md`). Leia antes de trabalhar nela
e não repita estes erros. **[gosto]** = preferência confirmada pelo criador · **[defeito]** = erro técnico.

## Do criador

- **[gosto] Fundo preto ou cinza escuro.** O fundo atrás dos inserts é `preto` ou `cinza`, nunca os da Asimov
  (`chuva`, verdes). _3-coisas-fai · 2026-10-14_
- **[gosto] Tela dividida na metade.** A mídia de cima ocupa a metade de cima, mais baixa, dentro da área visível do
  Instagram (fora da faixa da interface no topo); o ator fica da metade para baixo. _3-coisas-fai · 2026-10-14_
- **[gosto] Zoom em imagem: suave, constante, do centro.** ~3%/s (ajuste "Zoom lento"), a partir do centro da imagem;
  nada de pulo, degrau ou imagem andando. _3-coisas-fai · 2026-10-14_
  Vale também para presets com movimento próprio depois da entrada (ex.: PRE-01 · Sobe desfocado, que por padrão
  continua subindo): ponha `ajustes.camera: "Leve"` (zoom do centro, sem andar). E use o trecho da gravação de site já
  parado, depois da animação de carregamento da página. _black-v8·v11 · 2026-10-22_
- **[gosto] Zoom nunca trava.** O zoom "Leve" do render ainda anda aos degraus e as mídias a 30 q/s tropeçam no
  vídeo a 24 q/s. Para todo insert: uma versão a 24 q/s com o zoom suave do centro já no arquivo (~3%/s, subpixel),
  e `camera: "Parado"` no render; motions e comparativos feitos à mão, gerados direto a 24 q/s. Vale para todos os
  vídeos, sem ela precisar pedir de novo. _3-niveis-7-dias·v1 (pedido repetido dos Black) · 2026-10-22_
- **[gosto]** Full ator com zoom seco: o rosto centralizado na tela (amplia até 1,4× se precisar) — corrigido em `render/src/pagina.ts` e `montagem/exportacao.py`. _gpt-image-glow·v3 c6, v6 c3 · 2026-10-18_

## Técnicos (do editor)

- **[técnica] Zoom pede resolução.** Um preset que aproxima a mídia amplia também os defeitos dela: use-o só com
  mídia que tenha resolução de sobra; senão, escolha um preset sem zoom. _mvi-0717 · 2026-10-12_
- O `presets.py escolher` põe o 1º favorito da situação em quase todos (no 1º teste, 9 de 12 inserts com "Corte seco"):
  alterne entre os favoritos da situação nos inserts vizinhos. _1º teste · 2026-10-10_
## Anúncios (CTAs) — só para anúncio; Reels têm outra lógica

- **[gosto]** A cabeça da criadora nunca é cortada; em todas as telas divididas, o mesmo recorte, com o cabelo saindo pela janela (`recorte.py`). _ficha-personagem-ia·v2, v6.7 · 2026-10-15_
- **[gosto]** A mídia nunca é cortada para preencher a tela (cabeça cortada, vídeo cortado, fluxo recortado): mídia inteira e maior (ex.: `largura` 1.3 no Corte seco). Na gravação de um Space, use o trecho com a câmera afastada, em que o fluxo aparece inteiro, não o passeio ampliado com os nós cortados em cima e embaixo. _ficha-personagem-ia·v3, v4, v6.4; cta-lp-ext·v4 c5; gpt-image-glow·v16 c2, c5 · 2026-10-15_
- **[gosto]** Fundo preto atrás dos cards (reforça o de cima). _ficha-personagem-ia·v4 · 2026-10-15_
- **[gosto]** Fluxo de Space na altura toda da tela: só as laterais saem, nunca em cima e embaixo. _gpt-image-glow·v16 c2, c5; chat · 2026-10-18_
- **[gosto]** Imagem com pessoa e produto: cabeça e produto inteiros; reduza a imagem se precisar. _gpt-image-glow·v29 c1 · 2026-10-18_
