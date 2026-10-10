// do 18: frontend/src/transicoes/transicoes.ts (sem a loja, os hooks e as rotas que gravam)
import { eventoNoTempo, type Catalogo, type EventoSom, type Intensidade } from './sons'

/** As transições entre planos (SPEC §8.8; docs/transicoes.md): a biblioteca, os pares, as escolhas do projeto e o corte
 *  de cada uma no tempo do vídeo final (o efeito é desenhado pelo ffmpeg depois da montagem). */
type Efeito = { tipo: 'seco' | 'luz' | 'brilho' | 'zoom'; antes: number; depois: number; forca: number }
export type Transicao = {
  id: string
  nome: string
  descricao: string
  efeito: Efeito
  som: { som: string; intensidade: Intensidade; atraso: number } | null
  fontes: { ref: string; t: number }[]
  aprovado: boolean
}
export type Par = { n: number; classes: Record<string, number>; sons: Record<string, number>; cortes: { ref: string; t: number; classe: string; sons: string[] }[] }
export type Biblioteca = { transicoes: Transicao[]; pares: Record<string, Par>; ordem: Record<string, { ids: string[]; favoritas: number }> }

/** O grupo de uma categoria de plano, a unidade das favoritas (igual a `transicoes.py`): ator (Full ator, com lettering,
 *  com zoom), dividida (tela dividida com insert ou motion, comentário + insert + ator) e cheia (insert ou motion). */
export const familia = (c: string) => (c.startsWith('full_ator') ? 'ator' : c.startsWith('tela_dividida') || c === 'comentario_insert_ator' ? 'dividida' : 'cheia')
export const chavePar = (de: string, para: string) => `${de}>${para}`
/** A ordem que vale para um par: a do grupo (de onde sai → para onde vai); sem ela, a do par exato (antiga). */
export const ordemDoPar = (b: Biblioteca, de: string, para: string) => b.ordem[`familia:${familia(de)}>${familia(para)}`] ?? b.ordem[chavePar(de, para)]
/** A transição que um corte recebe sozinho: a 1ª favorita do par (ou da família); sem nada, o corte seco. */
function padraoDoPar(b: Biblioteca, de: string, para: string): string {
  const o = ordemDoPar(b, de, para)
  const id = o && o.favoritas > 0 ? o.ids[0] : null
  return id && b.transicoes.some((t) => t.id === id) ? id : 'corte-seco'
}

/** Uma transição trocada à mão: a transição e o par do corte quando ela foi escolhida. Os ids dos planos são de posição
 *  (`p5`): com outra direção, `p5` pode ser outro corte, e a escolha só vale se o par ainda bater (as antigas, sem par,
 *  valem sempre). */
type Escolha = { id: string; par?: string }
export type Escolhas = Record<string, Escolha>

/** Um corte entre planos do vídeo, com a transição que vale nele. */
export type CorteDoVideo = { t: number; plano: string; de: string; para: string; transicao: Transicao | null; manual: boolean }

/** Os cortes entre planos do vídeo final (os planos da direção já no tempo da saída) e a transição de cada um. */
export function cortesDoVideo(planos: { id: string; tipo: string; inicio: number; fim: number }[], b: Biblioteca | null, escolhas: Escolhas): CorteDoVideo[] {
  if (!b) return []
  const ps = [...planos].sort((x, y) => x.inicio - y.inicio)
  const out: CorteDoVideo[] = []
  for (let k = 1; k < ps.length; k++) {
    const a = ps[k - 1]
    const p = ps[k]
    // a escolha à mão vale se foi feita neste par (a direção pode ter mudado e posto outro corte com este id)
    const e = escolhas[p.id]
    const manual = !!e && (!e.par || e.par === chavePar(a.tipo, p.tipo))
    const id = manual ? e.id : padraoDoPar(b, a.tipo, p.tipo)
    out.push({ t: p.inicio, plano: p.id, de: a.tipo, para: p.tipo, transicao: b.transicoes.find((x) => x.id === id) ?? null, manual })
  }
  return out
}

/** Os sons das transições do vídeo (o golpe no corte + atraso), para tocar e para a exportação (grupo "transicoes"). */
export function sonsDasTransicoes(cortes: CorteDoVideo[], cat: Catalogo | null): (EventoSom & { grupo: 'transicoes' })[] {
  if (!cat) return []
  return cortes.flatMap((c) => {
    const s = c.transicao?.som
    const e = s ? eventoNoTempo(s, c.t, cat) : null
    return e ? [{ ...e, grupo: 'transicoes' as const }] : []
  })
}
