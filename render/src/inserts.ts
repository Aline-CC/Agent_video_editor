// do 18: frontend/src/inserts/InsertNoLugar.tsx (as funções puras: receitaDoInsert, presetDe, chaveParada,
// pedidosNoTempo) e, para um insert sem preset, o estilo do formato de inserts/enriquecimento.ts + entradas.ts reduzido
import type { Estilo, ItemBanco, PedidoInsert } from './tipos'
import { mexendo, noFormato, serve, type Preset, type Receita } from './presets'
import { aspectosDe, divisaoDe, receitaParaInsert } from './divisao'
import { ajustesEfetivos, comAjustes } from './ajustes'
import { bezier, limite01 } from './curvas'

/** O insert desenhado por cima do ator, no tempo do vídeo final. */
export type PedidoNoTempo = PedidoInsert & { t: { inicio: number; fim: number } }

/** A chave do quadro quando o insert está parado no instante `rel` (s desde o começo): sem entrada nem saída andando (e
 *  sem o zoom contínuo). Quadros com a mesma chave são iguais — a exportação reaproveita a foto. Inclui quais mídias estão
 *  na tela. `null` = está mexendo. */
export function chaveParada(x: PedidoNoTempo, rel: number, presets: Preset[] | null): string | null {
  const pr = presetDe(x, presets)
  const dur = Math.max(x.t.fim - x.t.inicio, 0.01)
  if (pr) return mexendo(pr.receita, rel, dur) ? null : `${x.id}:p${pr.receita.cards.map((c) => (rel >= c.inicio_frac * (x.t.fim - x.t.inicio) ? 1 : 0)).join('')}`
  // sem preset: parado depois da entrada da mídia que está na tela
  const { k, ini, durM } = corteSimples(x.midias.length, rel, dur)
  return rel - ini >= Math.min(SURGIR.duracao, durM) ? `${x.id}:${k + 1}` : null
}

/** A receita que o insert toca: a do preset, levada às mídias e ao formato dele, à divisão da tela e às proporções das
 *  mídias, com os ajustes rápidos do insert (null sem preset). A mesma para a prévia, a exportação e os sons. */
export function receitaDoInsert(x: PedidoNoTempo, banco: Map<string, ItemBanco>, presets: Preset[] | null): Receita | null {
  const preset = presetDe(x, presets)
  if (!preset) return null
  const aspectos = aspectosDe(x.midias, banco)
  const aj = ajustesEfetivos(preset, x.enriquecimento?.ajustes, aspectos)
  return comAjustes(receitaParaInsert(comAjustes(preset.receita, aj, 'antes'), divisaoDe(x, banco, presets), aspectos, x.formato), aj, 'depois')
}

/** O preset do insert, se ele tem um e o preset serve (mesmo formato e número de mídias). */
export function presetDe(x: { formato: string; midias: unknown[]; enriquecimento?: { preset?: string } }, presets: Preset[] | null): Preset | null {
  const id = x.enriquecimento?.preset
  const p = id ? presets?.find((y) => y.id === id) : null
  return p && serve(p, x.formato, x.midias.length) ? noFormato(p, x.formato, x.midias.length) : null
}

/** Os pedidos de insert no tempo do vídeo final (o do plano da direção; sem ele, o guardado no pedido), em ordem. */
export const pedidosNoTempo = (pedidos: PedidoInsert[], planos: { id: string; inicio: number; fim: number }[]): PedidoNoTempo[] => {
  const tempos = new Map(planos.map((i) => [i.id, { inicio: i.inicio, fim: i.fim }]))
  return pedidos.map((x) => ({ ...x, t: tempos.get(x.plano) ?? { inicio: x.inicio, fim: x.inicio + x.duracao } })).sort((a, b) => a.t.inicio - b.t.inicio)
}

// ---------------------------------------------------------------- sem preset: o estilo simples do formato

/** O estilo de cada formato (do 18: `ESTILO` em enriquecimento.ts): tela cheia num card sobre o fundo, tela dividida com a
 *  mídia ocupando a área; a entrada "Surgir" e a saída seca. Os outros layouts e entradas do caminho antigo ficaram de
 *  fora (todo insert com mídia usa preset). */
export const ESTILO_SIMPLES = { vertical: { layout: 'card' }, dividida: { layout: 'metade' } } as const
/** A configuração de fábrica do "Surgir" (do 18: backend/app/entradas.py, PADRAO). */
const SURGIR = { curva: [0.16, 1, 0.3, 1] as const, duracao: 0.75, escala: 94 }

/** Qual mídia está na tela (as mídias em sequência, divididas igualmente; com 2, a 2ª entra no meio), quando ela
 *  começou e quanto dura (s). */
export function corteSimples(n: number, rel: number, dur: number) {
  const parte = dur / Math.max(n, 1)
  const k = Math.max(Math.min(Math.floor(rel / parte), n - 1), 0)
  // com 1 ou 3+ mídias, a entrada é só a da 1ª (como no 18); com 2, cada uma entra
  return n === 2 ? { k, ini: k * parte, durM: parte } : { k, ini: 0, durM: dur }
}

/** A entrada "Surgir" de uma mídia `rel` s depois de ela começar (do 18: `estiloEntrada` em entradas.ts). */
export function estiloSimples(rel: number, durM: number): Estilo {
  const d = Math.min(SURGIR.duracao, durM)
  const p = bezier(...SURGIR.curva)(limite01(rel / Math.max(d, 0.01)))
  const s0 = SURGIR.escala / 100
  return { transform: `scale(${s0 + (1 - s0) * p})`, opacity: limite01(p) }
}
