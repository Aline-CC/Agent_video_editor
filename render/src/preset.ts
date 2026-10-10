/** `/render/preset.html?preset=<id>&tela=<original|dividida|vertical|atras>&n=<mídias>&prop=<proporções>`: um preset
 *  simulado no quadro 9:16 inteiro (o "Simular" da página Presets do 18: presets/Simulacao.tsx), pelas mesmas contas da
 *  exportação — a divisão da tela pela proporção das mídias, o card na proporção da mídia, o ator na posição da divisão
 *  (enquadrado pelo rosto), o fundo — com vídeos de verdade: o ator é o proxy do projeto mais recente e as mídias são
 *  vídeos do banco na proporção pedida (`/api/presets/amostras`). Toca em loop no relógio do vídeo do ator (ou num
 *  relógio de fora: `__sim.tocar({ relogio })`, para andar junto da referência), com os sons dos momentos do preset.
 *  Parada, mostra o repouso (depois da última entrada; `t=` escolhe outro instante) com as miniaturas das mídias.
 *  - `tela`: `original` é a do preset (tela cheia ou dividida), com as mídias na proporção dos cards da referência;
 *  - `n`: o número de mídias (sem ele, o da referência); `prop`: com 1 mídia, `pe` (9:16) · `1:1` · `4:3` · `16:9`; com
 *    várias, `pe` (todas 9:16) · `mista` (9:16 + horizontais) · `deitada` (só horizontais);
 *  - `dur`: a duração do insert (sem ela, a do trecho da referência; simulando, ao menos 2,5 s ou 1,8 s por mídia);
 *  - `som=1`: toca os sons; `tocar=1`: já começa tocando.
 *  `window.__sim`: `pronto`, `tocar({relogio?, som?, audio?})`, `parar()`, `som(ligado)`, `ir(t)` (desenha o instante,
 *  parado), `info` e `log` (cada som que começou a soar: {som, t, relogio, ganho, audio}: `audio` é o estado do contexto). Também por postMessage
 *  ({sim: 'tocar' | 'parar' | 'som', ligado}). Gerado: `preset.js` (o comando está em preset.html). */
import type { ItemBanco, PedidoInsert } from './tipos'
import { janela, nMidias, noFormato, noTempo, paraMidias, type Preset, type Receita } from './presets'
import { divisaoDe, receitaParaInsert } from './divisao'
import { ajustesEfetivos, comAjustes } from './ajustes'
import { geometriaDoAtor, type Geometria, type Rosto } from './ator'
import { eventosDaReceita, INTENSIDADES, type Catalogo, type EventoSom, type SomCatalogo } from './sons'
import { desenhar, fundo, insertNoLugar, type V } from './desenho'
import type { PedidoNoTempo } from './inserts'

type Tela = 'dividida' | 'vertical' | 'atras'
type Amostras = {
  ator: { video: string; t0: number; rosto: Rosto | null; deitado: boolean; x: number; pessoa: string | null; poster?: string } | null
  midias: { id: string; video: string; imagem: string; aspecto: number; duracao: number }[]
}
type Opcoes = { relogio?: (() => number) | null; som?: boolean; audio?: AudioContext }
type Log = { som: string; t: number; relogio: number; ganho: number; audio: AudioContextState }
declare global {
  interface Window {
    __preset?: Preset
    __sim?: {
      pronto: Promise<void>
      tocar: (op?: Opcoes) => void
      parar: () => void
      som: (ligado: boolean) => void
      ir: (t: number) => Promise<void>
      info: Record<string, unknown>
      log: Log[]
    }
  }
}

const q = new URLSearchParams(location.search)
const PAUSA = 0.4 // entre uma volta e outra (no relógio próprio): o ator sozinho, como no corte de volta
const ASPECTO: Record<string, number> = { pe: 9 / 16, '1:1': 1, '4:3': 4 / 3, '16:9': 16 / 9 }
const json = <T>(url: string): Promise<T> => fetch(url).then((r) => (r.ok ? (r.json() as Promise<T>) : Promise.reject(new Error(`${url}: ${r.status}`))))
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** As proporções das mídias numa situação simulada (as do 18: `aspectosSim`). */
function aspectosDe(prop: string, n: number): number[] {
  return Array.from({ length: n }, (_, k) =>
    n === 1 ? (ASPECTO[prop] ?? 16 / 9) : prop === 'pe' ? 9 / 16 : prop === 'deitada' ? (k % 2 ? 4 / 3 : 16 / 9) : k % 2 ? 16 / 9 : 9 / 16,
  )
}

/** Na tela original, cada mídia na proporção do card dela na referência (largura ÷ altura, com a área do formato: a tela
 *  toda 9:16 ou a metade de cima 9:8): a recriação fica como lá. */
function aspectosDaReferencia(r: Receita, n: number): number[] {
  const area = r.formato === 'vertical' ? 9 / 16 : 9 / 8
  const cards = paraMidias(r, n).cards
  return Array.from({ length: n }, (_, k) => {
    const c = cards.find((x, j) => (x.midia ?? j) === k) ?? cards[0]
    return Math.min(Math.max(((c.repouso.w / Math.max(c.repouso.h, 1)) * area), 0.4), 2.4)
  })
}

/** O vídeo do banco de cada mídia: um da mesma família de proporção (em pé, ~4:3, ~16:9), girando entre os que há (a
 *  partir de um ponto que depende do preset, para os cards não mostrarem todos o mesmo). */
function escolherMidias(am: Amostras['midias'], aspectos: number[], semente: string) {
  const familia = (a: number) => (a < 0.8 ? 0 : a < 1.5 ? 1 : 2)
  let s = 0
  for (const ch of semente) s = (s * 31 + ch.charCodeAt(0)) >>> 0
  return aspectos.map((a, k) => {
    const f = familia(a)
    const l = am.filter((m) => familia(m.aspecto) === f)
    const outras = l.length ? l : am.filter((m) => familia(m.aspecto) === (f === 1 ? 2 : f === 2 ? 1 : 0)) // ~1:1 e 16:9 se substituem
    const lista = outras.length ? outras : am
    return lista.length ? lista[(s + k) % lista.length] : null
  })
}

/** O quadro do ator na geometria (do 18: `estiloDoQuadro` em ator/ator.ts): o vídeo inteiro escalado e deslocado; na
 *  janela, só a parte de baixo, com os cantos redondos; no canto, cantos redondos. */
function estiloDoQuadro(g: Geometria | null): Record<string, string> {
  if (!g) return {}
  const base = { transform: `translate(${g.tx * 100}%, ${g.ty * 100}%) scale(${g.s})`, transformOrigin: '0 0' }
  const cantos = `round ${(g.raio ?? 0) * 100}% / ${((g.raio ?? 0) * 100 * 9) / 16}%`
  if (g.modo === 'metade' || g.modo === 'recortado') return base
  if (g.modo === 'canto') return { ...base, clipPath: `inset(0 ${cantos})` }
  return { ...base, clipPath: `inset(${(g.topo ?? 0) * 100}% 0 0 0 ${cantos})` }
}

/** A pessoa recortada (sem o cenário) por cima do insert, na janela: a cabeça e os ombros saindo por cima dela. */
function estiloDaPessoa(g: Geometria | null): Record<string, string> | null {
  if (g?.modo !== 'janela') return null
  return { transform: `translate(${g.tx * 100}%, ${g.ty * 100}%) scale(${g.s})`, transformOrigin: '0 0', clipPath: `inset(0 0 ${(1 - (g.topo ?? 0)) * 100}% 0)` }
}

// ---------------------------------------------------------------- os sons (do 18: editor/sons.ts, a parte que toca)

const buffers = new Map<string, Promise<AudioBuffer | null>>()
let audio: AudioContext | null = null
const soando = new Set<AudioBufferSourceNode>()
function buffer(id: string, c: BaseAudioContext) {
  if (!buffers.has(id))
    buffers.set(
      id,
      fetch(`/biblioteca/sons/${encodeURIComponent(id)}.m4a`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
        .then((b) => c.decodeAudioData(b))
        .catch(() => null),
    )
  return buffers.get(id)!
}
/** Toca o evento agora, `atrasado` s depois do instante dele (o relógio já passou do golpe). */
async function tocarEvento(e: EventoSom, atrasado: number, relogio: number, log: Log[]) {
  const c = audio
  if (!c) return
  const t0 = performance.now()
  const b = await buffer(e.som, c)
  if (!b || c !== audio) return
  if (c.state === 'suspended') await c.resume().catch(() => {})
  atrasado += (performance.now() - t0) / 1000 // baixar e decodificar levam tempo: o som entra adiantado o mesmo tanto
  const vel = e.vel ?? 1
  const desde = e.desde + Math.max(atrasado, 0) * vel
  if (desde >= b.duration || (e.dur != null && atrasado >= e.dur)) return
  const f = c.createBufferSource()
  f.buffer = b
  f.playbackRate.value = vel
  const g = c.createGain()
  g.gain.value = e.ganho
  if (e.dur != null) {
    const fim = c.currentTime + e.dur - atrasado
    g.gain.setValueAtTime(e.ganho, Math.max(fim - Math.min(0.12, e.dur / 2), c.currentTime))
    g.gain.linearRampToValueAtTime(0, fim)
  }
  f.connect(g).connect(c.destination)
  f.start(c.currentTime, desde, e.dur != null ? (e.dur - atrasado) * vel : undefined)
  soando.add(f)
  f.onended = () => soando.delete(f)
  log.push({ som: e.som, t: +e.t.toFixed(3), relogio: +relogio.toFixed(3), ganho: e.ganho, audio: c.state })
}
function calarSons() {
  for (const f of soando)
    try {
      f.stop()
    } catch {
      // já tinha parado
    }
  soando.clear()
}

// ---------------------------------------------------------------- a página

async function iniciar() {
  document.documentElement.style.zoom = String(window.innerWidth / 540) // desenhada a 540 px, como a de render
  window.addEventListener('resize', () => (document.documentElement.style.zoom = String(window.innerWidth / 540)))
  const raiz = document.getElementById('quadro')!
  const id = q.get('preset') ?? ''
  const [preset, am, sons] = await Promise.all([
    window.__preset ? Promise.resolve(window.__preset) : json<Preset>(`/biblioteca/presets/${encodeURIComponent(id)}.json`),
    json<Amostras>('/api/presets/amostras').catch((): Amostras => ({ ator: null, midias: [] })),
    json<SomCatalogo[]>('/biblioteca/sons/catalogo.json').catch(() => [] as SomCatalogo[]),
  ])
  const catalogo: Catalogo = { sons, intensidades: INTENSIDADES }

  // a situação
  const original = !q.get('tela') || q.get('tela') === 'original'
  const tela: Tela = original ? (preset.formato === 'vertical' ? 'vertical' : 'dividida') : (q.get('tela') as Tela)
  const formato = tela === 'vertical' ? 'vertical' : 'dividida'
  const nRef = preset.receita.repete ? Math.max(preset.receita.cards.length, 2) : nMidias(preset.receita)
  const n = Math.max(1, Number(q.get('n')) || nRef)
  const aspectos = original && !q.get('prop') ? aspectosDaReferencia(preset.receita, n) : aspectosDe(q.get('prop') ?? (n === 1 ? '16:9' : 'deitada'), n)
  const fonte = preset.fontes?.[0]
  const durRef = fonte ? fonte.fim - fonte.inicio : preset.receita.duracao_ref
  const dur = Number(q.get('dur')) || (original ? durRef : Math.max(durRef, n > 1 ? 1.8 * n : 2.5))

  // o insert, pelas contas da exportação (`inserts.receitaDoInsert`, sem exigir que o preset sirva à situação: simular é
  // justamente ver como fica)
  const escolhidas = escolherMidias(am.midias, aspectos, preset.id)
  const item = (k: number, vivo: boolean): ItemBanco => {
    const m = escolhidas[k]
    return { id: `sim${k}`, tipo: vivo && m ? 'video' : 'imagem', largura: Math.round(aspectos[k] * 1000), altura: 1000, duracao: m?.duracao ?? 3, arquivo: '', url: (vivo ? m?.video : m?.imagem) ?? '' }
  }
  const bancoDe = (vivo: boolean) => new Map(aspectos.map((_, k) => [`sim${k}`, item(k, vivo)]))
  const pedido = {
    id: 'sim',
    plano: 'sim',
    tipo: formato === 'vertical' ? 'insert_tela_cheia' : 'tela_dividida_insert',
    formato,
    descricao: '',
    texto: null,
    fala: '',
    inicio: 0,
    duracao: dur,
    midias: aspectos.map((_, k) => ({ id: `sim${k}`, banco: `sim${k}` })),
    enriquecimento: { preset: preset.id, divisao: tela === 'atras' ? 'atras' : undefined },
    t: { inicio: 0, fim: dur },
  } as unknown as PedidoNoTempo & PedidoInsert
  const banco0 = bancoDe(false)
  const ajEf = ajustesEfetivos(preset, undefined, aspectos)
  const divisao = divisaoDe(pedido as Parameters<typeof divisaoDe>[0], banco0, [preset])
  const base = noFormato(preset, formato, n).receita
  const receita = comAjustes(receitaParaInsert(comAjustes(base, ajEf, 'antes'), divisao, aspectos, formato), ajEf, 'depois')
  const noT = noTempo(receita, dur)
  const geometria = geometriaDoAtor(divisao, null, am.ator?.rosto ?? null)
  const eventos = eventosDaReceita(receita, dur, catalogo)
  const entradas = noT.cards.map((c) => janela(c, dur).ini + (c.entrada?.duracao ?? 0))
  const tParado = Number(q.get('t')) || Math.min(Math.max(...entradas) + 0.1, dur - 0.05)
  const t0 = am.ator?.t0 ?? 0
  for (const e of eventos) void buffer(e.som, new OfflineAudioContext(1, 1, 48000)) // já baixados quando tocar

  let atorVideo: HTMLVideoElement | null = null
  const estiloPessoa = tela === 'atras' && am.ator?.pessoa ? estiloDaPessoa(geometria) : null
  // sempre no lugar (escondida fora da janela): tirar um vídeo da página o pausa
  const pessoa = (mostrar: boolean): V | null =>
    estiloPessoa && {
      chave: 'pessoa',
      tag: 'video',
      classe: 'absolute inset-0 size-full object-cover pointer-events-none',
      estilo: { ...estiloPessoa, zIndex: 6, display: mostrar ? undefined : 'none' },
      criar: (el) => {
        const v = el as HTMLVideoElement
        v.muted = v.playsInline = true
        v.preload = 'auto' // só existe no "ator embaixo" (o modal): um vídeo só
        v.src = am.ator!.pessoa!
      },
      depois: (el) => {
        const v = el as HTMLVideoElement
        const a = atorVideo
        if (!a) return
        // parado sem o vídeo do ator, o quadro do pôster dele (1 s depois de t0)
        const alvo = a.preload === 'none' ? t0 + 1 : a.currentTime
        if (Math.abs(v.currentTime - alvo) > 0.08) v.currentTime = alvo
        if (a.paused !== v.paused) void (a.paused ? v.pause() : v.play().catch(() => {}))
      },
    }
  const ator = (g: Geometria | null, atras: boolean): V => ({
    chave: 'ator',
    classe: 'absolute inset-0 pointer-events-none',
    estilo: { ...estiloDoQuadro(g), zIndex: atras ? 5 : undefined },
    filhos: [
      am.ator && {
        chave: 'video',
        tag: 'video',
        classe: 'size-full object-cover',
        estilo: am.ator.deitado ? { objectPosition: `${am.ator.x * 100}% 50%` } : {},
        criar: (el) => {
          const v = (atorVideo = el as HTMLVideoElement)
          v.muted = v.playsInline = true
          // parado, só o quadro do ator (o pôster): o vídeo só carrega ao tocar (a página Presets tem uma por card)
          v.preload = 'none'
          if (am.ator!.poster) v.poster = am.ator!.poster
          v.src = am.ator!.video
        },
      },
    ],
  })

  /** As mídias da cena acompanham o tempo tocando (sem pular a cada quadro como na exportação: só se desviarem). `k`: o
   *  card em que estão (a chave `c<k>` da cena), para saber desde quando a mídia está na tela. */
  const aoVivo = (v: V, t: number, k = -1): V => {
    const kk = /^c\d+$/.test(v.chave) ? Number(v.chave.slice(1)) : k
    if (v.tag === 'video' && v.chave.startsWith('m:') && kk >= 0) {
      const rel = Math.max(t - janela(noT.cards[kk], dur).ini, 0)
      return {
        ...v,
        depois: (el) => {
          const m = el as HTMLVideoElement
          const fim = Number.isFinite(m.duration) ? m.duration - 0.05 : Infinity
          const alvo = Math.min(rel, fim)
          if (Math.abs(m.currentTime - alvo) > 0.25) m.currentTime = alvo
          if (rel >= fim) m.pause()
          else if (m.paused && tocando) void m.play().catch(() => {})
        },
      }
    }
    return v.filhos ? { ...v, filhos: v.filhos.map((f) => f && aoVivo(f, t, kk)) } : v
  }

  /** O quadro no instante `t` (s desde o começo do insert); depois do fim (a pausa entre as voltas), o ator sozinho. */
  const quadro = (t: number, vivo: boolean) => {
    const dentro = t >= 0 && t <= dur
    const banco = vivo ? bancoDe(true) : banco0
    const camada = (caixa: [number, number] | null) => {
      const ins = dentro ? insertNoLugar({ pedido, banco, tempo: t, fundo: 'gradiente', receita, divisao, caixa }) : []
      return [fundo('gradiente', 'fundo0'), ator(dentro ? geometria : null, dentro && tela === 'atras'), pessoa(dentro), ...(vivo ? ins.map((v) => aoVivo(v, t)) : ins)]
    }
    desenhar(raiz, camada(null))
    if (dentro && receita.cards.some((c) => c.quadros?.length)) {
      const cena = raiz.querySelector<HTMLElement>('[data-k="cena"]')
      if (cena) desenhar(raiz, camada([cena.clientWidth, cena.clientHeight]))
    }
  }

  // ---- tocar
  let tocando = false
  let externo: (() => number) | null = null
  let comSom = q.get('som') === '1'
  let anterior = -1
  let inicioPerf = 0
  let raf = 0
  const log: Log[] = []
  const relogio = () => {
    if (externo) return externo()
    const a = atorVideo
    if (a && !a.error && a.readyState >= 1) return a.currentTime - t0
    return (performance.now() - inicioPerf) / 1000
  }
  const recomecar = () => {
    if (atorVideo) atorVideo.currentTime = t0
    inicioPerf = performance.now()
    anterior = -1
    calarSons()
  }
  const passo = () => {
    if (!tocando) return
    let t = relogio()
    if (!externo && t > dur + PAUSA) {
      recomecar()
      t = 0
    }
    if (t < anterior - 0.1) {
      anterior = -1 // o relógio de fora deu a volta
      calarSons()
    }
    const a = atorVideo
    if (a && externo) {
      // seguindo outro relógio: o ator acompanha (só corrige se desviar)
      if (Math.abs(a.currentTime - (t0 + t)) > 0.3) a.currentTime = t0 + Math.max(t, 0)
      if (a.paused) void a.play().catch(() => {})
    }
    quadro(t, true)
    if (comSom && audio) for (const e of eventos) if (e.t > anterior && e.t <= t) void tocarEvento(e, t - e.t, t, log)
    anterior = Math.max(anterior, t)
    raf = requestAnimationFrame(passo)
  }
  const tocar = (op: Opcoes = {}) => {
    cancelAnimationFrame(raf)
    tocando = true
    externo = op.relogio ?? null
    if (op.som != null) comSom = op.som
    if (op.audio) audio = op.audio
    if (comSom) {
      audio ??= new AudioContext()
      if (audio.state === 'suspended') void audio.resume().catch(() => {})
    }
    if (atorVideo) atorVideo.preload = 'auto'
    recomecar()
    if (atorVideo) void atorVideo.play().catch(() => {})
    raf = requestAnimationFrame(passo)
  }
  const pararDe = (t: number) => {
    cancelAnimationFrame(raf)
    tocando = false
    externo = null
    calarSons()
    for (const v of document.querySelectorAll('video')) v.pause()
    if (atorVideo && atorVideo.preload !== 'none') atorVideo.currentTime = t0 + Math.min(Math.max(t, 0), dur)
    quadro(t, false)
  }

  const prontoVideos = async () => {
    const limite = Date.now() + 8000
    const ok = () => [...document.querySelectorAll('video')].every((v) => v.error || v.preload === 'none' || (v.readyState >= 2 && !v.seeking))
    while (!ok() && Date.now() < limite) await esperar(20)
    await Promise.all([...document.images].map((i) => (i.complete ? null : i.decode().catch(() => {}))))
  }
  pararDe(tParado)
  Object.assign(window.__sim!, {
    tocar,
    parar: () => pararDe(tParado),
    som: (ligado: boolean) => {
      comSom = ligado
      if (!ligado) calarSons()
      else if (tocando) {
        audio ??= new AudioContext()
        void audio.resume().catch(() => {})
      }
    },
    ir: async (t: number) => {
      pararDe(t)
      await prontoVideos()
    },
    log,
    info: { preset: preset.id, tela, formato, n, aspectos, dur, tParado, divisao, geometria, eventos, midias: escolhidas.map((m) => m?.id ?? null), ator: am.ator },
  })
  window.addEventListener('message', (e) => {
    const d = e.data as { sim?: string; ligado?: boolean }
    if (d?.sim === 'tocar') tocar({ som: d.ligado })
    else if (d?.sim === 'parar') pararDe(tParado)
    else if (d?.sim === 'som') window.__sim!.som(!!d.ligado)
  })
  await prontoVideos()
  if (q.get('tocar') === '1') tocar()
}

let pronto!: () => void
let falhou!: (e: unknown) => void
window.__sim = {
  pronto: new Promise<void>((ok, erro) => ((pronto = ok), (falhou = erro))),
  tocar: () => {},
  parar: () => {},
  som: () => {},
  ir: async () => {},
  info: {},
  log: [],
}
void window.__sim.pronto.catch(() => {})
iniciar().then(
  () => pronto(),
  (e) => {
    console.error(e)
    document.title = `erro: ${(e as Error).message}`
    document.getElementById('quadro')!.innerHTML = `<p style="padding:24px;color:#faf7ee;font:14px Manrope,sans-serif">${String((e as Error).message)}</p>`
    falhou(e)
  },
)
