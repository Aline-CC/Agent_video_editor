# Aprendizados · Cortes

O que já foi aprendido nesta área, vídeo a vídeo (como gravar: `etapas/14-concluir.md`). Leia antes de trabalhar nela
e não repita estes erros. **[gosto]** = preferência confirmada pelo criador · **[defeito]** = erro técnico.

## Do criador

- **[gosto] Fala repetida é erro: fica sempre a última.** Confira repetição em todo vídeo, inclusive entre dois cortes
  ("…cursos que eu / que eu ainda vou lançar"). O whisper local escreve a frase repetida uma vez só e cola as palavras
  numa tentativa: confira transcrevendo cada bloco de fala (entre pausas) separado. _black-v6·v7, black-v7·v7 · 2026-10-22_
- **[gosto] Nunca termine um corte com o olho fechado.** Meça o piscar (MediaPipe face landmarker, `eyeBlink`) no
  último quadro de cada corte; se fechado, mova o fim para o quadro aberto mais perto (sem cortar palavra) ou emende o
  corte seguinte quando o vão é curto. _black-v5·v7 c1 · 2026-10-22_
- **[gosto] Corte colado na fala.** Cada trecho começa no primeiro quadro em que o ator começa a falar e termina logo
  depois da última sílaba, com no máximo ~1 quadro de folga (0,04 s). O ar antes e depois da fala mostra o ator se
  preparando para a tomada ou relaxando depois dela (olhar para baixo, ajeitar a postura): no vídeo, parece erro. _mvi-0717 · 2026-10-12_
- **[gosto] Respiro só entre blocos ligados.** Entre duas frases da mesma tomada, que continuam o raciocínio sem erro,
  pode ficar uma pausa natural de até ~0,5 s: é o respiro do ator, e cortá-lo atropela a fala. Pausa maior que ~1 s
  dentro de um trecho sai sempre: o Reels não aguenta silêncio. _mvi-0717 · 2026-10-12; 3-coisas-fai v4 c1 · 2026-10-14_
- **[gosto] Uma frase pode estar em outra gravação.** Se o bruto não tem a fala que o vídeo pede, procure nas gravações
  feitas na mesma hora (mesma pasta, horários vizinhos). _black-ultimo-dia (estava no IMG_2475) · 2026-10-22_

## Técnicos (do editor)

- **[técnica] Cortar olhando a imagem, não só o som.** Depois de aplicar os cortes, olhe os 2–3 quadros de cada lado
  de toda emenda: não pode sobrar um quadro perdido do ator em outra pose nem um quadro da tomada anterior. Se o som
  está certo e a imagem não, ajuste a borda do trecho à mão (no `timeline.V1`, guardando o valor antigo em `auto`). _mvi-0717 · 2026-10-12_
- **[defeito]** Borda "fora de pausa" (fala colada na palavra removida): o fim da palavra no ElevenLabs costuma vir
  ~0,1–0,2 s tarde e o começo da palavra cortada vaza ("o 'm' de 'mas'"). Ajuste a borda à mão no `timeline.V1`
  (guarde o valor da IA em `auto`). Meça o áudio na emenda (o nível a cada 10 ms) para achar o fim real da palavra.
  _melhor-ia-para-design·v1 ✂2 · 2026-10-10 (o criador fez o mesmo ajuste no 18); 3-coisas-fai v5 c1 ("câmera" + "e") · 2026-10-14_
- **[defeito] Corte comendo fala com a transcrição local.** O whisper na fala inteira escorrega os tempos das palavras
  (até ~1 s em 10% delas) e o corte colado confia neles: a criadora reclamou de "muito corte onde deveria ter fala".
  Antes dos cortes: realinhe os tempos transcrevendo em pedaços de até ~25 s cortados nas pausas (os IDs não mudam);
  depois dos cortes, confira cada borda no áudio (RMS a cada 10 ms da voz limpa): o fim vai até a fala apagar (o "s" e o
  ar do fim da palavra, no máximo +0,3 s), o começo recua até o silêncio (no máximo −0,25 s), sem entrar na tomada
  descartada; emenda entre palavras seguidas sem pausa real (silêncio < 0,25 s) não é cortada, e a pausa real fica com
  ~0,15 s de respiro. _3-niveis-7-dias v3 · 2026-10-22_
- O ElevenLabs acerta palavras repetidas ("gastando gastando") que o Whisper fundia; por isso é o motor. _do 18_
- Num vídeo de 2 min, a seleção típica remove ~35–45% do bruto (2:02 → 1:04 no vídeo de teste). _do 18_

## Anúncios (CTAs) — só para anúncio; Reels têm outra lógica

- **[defeito]** Quadro solto na emenda (o 1º quadro com outra pose): olhe os 2–3 quadros de cada lado de toda emenda antes de entregar (reforça o técnico acima). _cta-vsl-ext·v14 c1 · 2026-10-15_
