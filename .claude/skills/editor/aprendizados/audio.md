# Aprendizados · Áudio

O que já foi aprendido nesta área, vídeo a vídeo (como gravar: `etapas/14-concluir.md`). Leia antes de trabalhar nela
e não repita estes erros. **[gosto]** = preferência confirmada pelo criador · **[defeito]** = erro técnico.

## Do criador

- **[gosto] Trilha só instrumental.** Qualquer voz na música (fala, sussurro, vocal sampleado) compete com a fala do
  ator. Antes de usar uma trilha, confirme que ela não tem voz em nenhum trecho (ouça, ou pergunte ao `gemini.py`). _mvi-0717 · 2026-10-12_

## Técnicos (do editor)

- **[técnica] Som junto da ação.** Som de apoio (tecla, clique) começa quando a ação aparece na tela, nunca antes: a
  digitação soa só enquanto as letras aparecem. _mvi-0717 · 2026-10-12_
- **[técnica]** Eco de sala na voz: o isolador de voz da ElevenLabs tira (a limpeza DeepFilterNet não). A chave do `.env` precisa da permissão Audio Isolation, e o recurso tem custo: pergunte antes. _cta-vsl-ext · chat · 2026-10-18_

## Anúncios (CTAs) — só para anúncio; Reels têm outra lógica

- **[gosto]** O áudio de outra gravação (o CTA) soa igual ao da gravação principal: equalize uma pela outra (espectro médio da voz). _ficha-personagem-ia·v6.2 · 2026-10-15_
- **[defeito]** Com a fala acelerada, o áudio dessincronizava — corrigido em `ferramentas/montagem/audio.py` e `exportacao.py` (cada trecho com a duração exata). _ficha-personagem-ia·v4 · 2026-10-15_
