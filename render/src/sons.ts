// do 18: frontend/src/editor/sons.ts (só a parte pura: os eventos; tocar é do app de revisão)
import { bezier } from './curvas'
import type { Curva } from './tipos'
import { janela, noTempo, type Receita } from './presets'

/** Sons de apoio (SPEC §8.6): a biblioteca do time (cliques, pops, whooshes, risers, digitação), cortada e no mesmo
 *  volume (biblioteca/sons/). Um preset tem **momentos de som** (`receita.sons`): em cada um, qual som e com que
 *  intensidade. Daqui saem os eventos (o instante de cada som no insert) que a prévia toca e a exportação mistura. */
export type Momento = 'entrada' | 'troca' | 'saida' | 'mergulho' | 'zoom'
export type Intensidade = 'baixo' | 'medio'
/** `atraso`: onde o golpe do som cai em relação ao momento (s; negativo: antes). */
export type SomMomento = { momento: Momento; som: string | null; intensidade: Intensidade; atraso: number }
export type SomCatalogo = { id: string; nome: string; familia: string; duracao: number; ataque: number }
export type Catalogo = { sons: SomCatalogo[]; intensidades: Record<Intensidade, number> }
/** Um som no tempo: começa em `t` (s, no relógio de quem toca), tocando o arquivo a partir de `desde` (s do arquivo), com
 *  `ganho`; opcional, por no máximo `dur` s (com um fade curto) e na velocidade `vel` (o som esticado ou encolhido para
 *  abranger um movimento; como numa fita, o tom acompanha). */
export type EventoSom = { t: number; som: string; ganho: number; desde: number; dur?: number; vel?: number; grupo?: 'transicoes' }

/** O ganho de cada intensidade (do 18: backend/app/sons.py, INTENSIDADES); a lista vem de biblioteca/sons/catalogo.json. */
export const INTENSIDADES: Record<Intensidade, number> = { baixo: 0.25, medio: 0.5 }

/** O som de um momento já no relógio: começa de modo que o golpe (`ataque`) caia em `quando + atraso`; se isso ficaria
 *  antes do zero, toca o arquivo já adiantado. Com `dur` (um som que acompanha algo, como a digitação), começa no
 *  momento e dura isso. */
export function eventoNoTempo(s: { som: string | null; intensidade: Intensidade; atraso: number }, quando: number, cat: Catalogo, dur?: number, abrange?: number): EventoSom | null {
  const info = s.som ? cat.sons.find((x) => x.id === s.som) : null
  if (!info) return null
  const ganho = cat.intensidades[s.intensidade] ?? 0.3
  if (abrange && abrange > 0.05) {
    // o som abrange um movimento (o mergulho): o golpe cai no fim (`quando`) e o começo do som, no começo do movimento —
    // o som acelera ou desacelera (0,65× a 1,6×) para caber; se o movimento é curto demais, começa já adiantado no arquivo
    const golpe = quando + s.atraso
    const vel = Math.min(Math.max(info.ataque / abrange, VEL[0]), VEL[1])
    let t = golpe - Math.min(info.ataque / vel, abrange)
    let desde = Math.max(info.ataque - abrange * vel, 0)
    if (t < 0) {
      desde -= t * vel
      t = 0
    }
    // depois do golpe, o rabo do som some com o movimento: um rabo longo é cortado em `RABO` s (com o fade do fim); um
    // curto termina sozinho (cortá-lo poria o fade em cima do golpe)
    const rabo = (info.duracao - info.ataque) / vel
    const corte = rabo > RABO ? { dur: +(golpe - t + RABO).toFixed(4) } : {}
    return { t, som: info.id, ganho, desde, ...corte, ...(Math.abs(vel - 1) > 0.01 ? { vel: +vel.toFixed(4) } : {}) }
  }
  const t = quando + s.atraso - (dur ? 0 : info.ataque)
  return { t: Math.max(t, 0), som: info.id, ganho, desde: Math.max(-t, 0), ...(dur ? { dur } : {}) }
}
/** Quanto do som toca depois do golpe, num som que abrange um movimento (s): o movimento acabou, o som acaba junto. */
const RABO = 0.15
/** Quanto um som pode desacelerar ou acelerar para abranger um movimento (além disso, o tom mudaria demais). */
const VEL: [number, number] = [0.65, 1.6]

/** Quando (fração da duração) um movimento com a curva `curva` parece parado: chegou a 95% do caminho. Uma curva que
 *  freia no fim leva o último pedaço quase sem se mexer (no Mergulho, 22% do tempo para os últimos 5%), e o golpe do
 *  som que acompanha o movimento tem de cair quando ele para aos olhos — senão o som segue crescendo com o zoom parado. */
function paradoAos(curva: Curva | undefined, alvo = 0.95): number {
  if (!curva) return 1
  const f = bezier(...curva)
  for (let k = 1; k <= 100; k++) if (f(k / 100) >= alvo) return k / 100
  return 1
}

/** Os sons de uma receita num insert de `dur` s (a receita já com as mídias, o formato e os ajustes): o instante de cada
 *  momento, card a card. Sons iguais no mesmo instante (cards que entram juntos) tocam uma vez só. */
export function eventosDaReceita(receita: Receita, dur: number, cat: Catalogo | null): EventoSom[] {
  if (!cat || !receita.sons?.length) return []
  const r = noTempo(receita, dur)
  const cards = r.cards.map((c) => ({ c, ...janela(c, dur) })).sort((a, b) => a.ini - b.ini)
  // o instante de cada momento e, nos que acompanham um movimento (o mergulho, o zoom na mídia), a duração dele
  const quando: Record<Momento, [number, number?][]> = { entrada: [], troca: [], saida: [], mergulho: [], zoom: [] }
  // uma saída que só desliza e, na tela toda, amplia junto para não descobrir o fundo (`divisao.saidaCobrindo`) continua
  // com o som de saída: o preset não tem o momento do mergulho
  const temMergulho = (r.sons ?? []).some((s) => s.momento === 'mergulho')
  cards.forEach(({ c, ini, fim }, k) => {
    quando.entrada.push([ini + (c.entrada?.atraso?.pos ?? 0)])
    if (k > 0 && ini > cards[0].ini + 0.02) quando.troca.push([ini])
    // a saída: quando começa; o mergulho (zoom de saída): o som abrange o zoom de verdade — a janela da escala dentro da
    // saída (`atraso.escala` e `dur.escala`; o resto da saída o card fica parado) —, com o golpe no fim do zoom
    if (c.saida) {
      if (c.saida.para.escala > 1.05 && temMergulho) {
        const atraso = c.saida.atraso?.escala ?? 0
        const d = c.saida.dur?.escala ?? c.saida.duracao - atraso
        // o golpe quando o zoom para aos olhos (a curva freia no fim), não no fim da conta
        const visto = d * paradoAos(c.saida.curvas.escala ?? c.saida.curvas.pos)
        quando.mergulho.push([fim - c.saida.duracao + atraso + visto, visto])
      } else quando.saida.push([fim - c.saida.duracao])
    }
    if (c.zoom) {
      const visto = c.zoom.duracao * paradoAos(c.zoom.curva)
      quando.zoom.push([ini + c.zoom.inicio + visto, visto])
    }
  })
  const out: EventoSom[] = []
  for (const s of r.sons ?? [])
    for (const [q, abrange] of quando[s.momento] ?? []) {
      const e = eventoNoTempo(s, q, cat, undefined, abrange)
      if (e && e.t < dur && !out.some((o) => o.som === e.som && Math.abs(o.t - e.t) < 0.04)) out.push(e)
    }
  return out.sort((a, b) => a.t - b.t)
}
