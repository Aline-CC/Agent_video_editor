// O comum das telas do app: buscar dados, montar HTML, formatar tempos, avisos e o diálogo de confirmação.

export const $ = (sel, raiz = document) => raiz.querySelector(sel)
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)]

/** Um JSON do servidor (sem cache); `padrao` se não existir ou falhar. */
export async function json(url, padrao = null) {
  try {
    const r = await fetch(url, { cache: 'no-store' })
    return r.ok ? await r.json() : padrao
  } catch {
    return padrao
  }
}

/** Os nomes de uma pasta pública (pastas terminam em "/"). */
export const lista = (pasta) => json(`/api/lista?pasta=${encodeURIComponent(pasta)}`, [])

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

export const num = (x, casas = 1) =>
  Number(x || 0).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })

/** O tempo do vídeo como o criador lê: m:ss,d (0:03,2). */
export function tempo(t) {
  const d = Math.floor(Math.max(0, t || 0) * 10 + 1e-6)
  return `${Math.floor(d / 600)}:${String(Math.floor((d % 600) / 10)).padStart(2, '0')},${d % 10}`
}

/** m:ss (durações de vídeo e música). */
export const mmss = (t) => `${Math.floor((t || 0) / 60)}:${String(Math.round((t || 0) % 60)).padStart(2, '0')}`

/** Segundos curtos: "2,7 s". */
export const seg = (t) => `${num(t, t < 10 ? 1 : 0)} s`

/** Agora, no formato dos JSONs do projeto (ISO local, sem fuso nem milissegundos). */
export function agora() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/** "09/10 22:31" a partir do ISO local. */
export const dataHora = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)} ${iso.slice(11, 16)}` : '')

let avisoTimer
/** Um aviso rápido no pé da tela. */
export function aviso(texto, tipo = 'ok') {
  const el = $('#aviso')
  el.textContent = texto
  el.className = `aviso visivel aviso-${tipo}`
  clearTimeout(avisoTimer)
  avisoTimer = setTimeout(() => (el.className = 'aviso'), 3200)
}

/** Copia para a área de transferência (com o jeito antigo de reserva). */
export async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto)
  } catch {
    const t = document.createElement('textarea')
    t.value = texto
    document.body.append(t)
    t.select()
    document.execCommand('copy')
    t.remove()
  }
}

/** Diálogo de confirmação; resolve true/false. Enter confirma, Esc cancela. */
export function confirmar({ titulo, texto = '', ok = 'Confirmar', perigo = false }) {
  return new Promise((resolve) => {
    const fundo = document.createElement('div')
    fundo.className = 'modal-fundo'
    fundo.innerHTML = `<div class="modal" role="dialog" aria-modal="true">
      <h2>${esc(titulo)}</h2>${texto ? `<p>${esc(texto)}</p>` : ''}
      <div class="modal-acoes"><button class="botao" data-r="0">Cancelar</button>
      <button class="botao ${perigo ? 'botao-perigo' : 'botao-coral'}" data-r="1">${esc(ok)}</button></div></div>`
    const fechar = (r) => {
      document.removeEventListener('keydown', tecla, true)
      fundo.remove()
      resolve(r)
    }
    const tecla = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        fechar(e.key === 'Enter')
      }
    }
    fundo.addEventListener('click', (e) => {
      if (e.target === fundo) return fechar(false)
      const b = e.target.closest('[data-r]')
      if (b) fechar(b.dataset.r === '1')
    })
    document.addEventListener('keydown', tecla, true)
    document.body.append(fundo)
    fundo.querySelector('[data-r="1"]').focus()
  })
}

export const modalAberto = () => !!$('.modal-fundo')

/** As categorias de plano (as do 18), com o nome e o curto para blocos estreitos. */
export const PLANOS = {
  full_ator: ['Full ator', 'Ator'],
  full_ator_lettering: ['Full ator + lettering', 'Ator+L'],
  insert_tela_cheia: ['Insert tela cheia', 'Insert'],
  motion_tela_cheia: ['Motion tela cheia', 'Motion'],
  tela_dividida_insert: ['Tela dividida · insert', 'Div. insert'],
  tela_dividida_motion: ['Tela dividida · motion', 'Div. motion'],
  comentario_insert_ator: ['Comentário + insert + ator', 'Comentário'],
}
export const nomePlano = (tipo) => (PLANOS[tipo] || [tipo])[0]

/** Ícones (traço, 24×24). */
const svg = (d, extra = '') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`
export const ICONE = {
  tocar: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 4.5v15l13-7.5z"/></svg>`,
  pausar: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 4h4.5v16H6zM13.5 4H18v16h-4.5z"/></svg>`,
  lapis: svg('<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/>'),
  lixo: svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  voltar: svg('<path d="M15 5l-7 7 7 7"/>'),
  seta: svg('<path d="M7 17L17 7M9 7h8v8"/>'),
  quadroAntes: svg('<path d="M15 6l-6 6 6 6"/>'),
  quadroDepois: svg('<path d="M9 6l6 6-6 6"/>'),
  segAntes: svg('<path d="M12 6l-6 6 6 6M19 6l-6 6 6 6"/>'),
  segDepois: svg('<path d="M5 6l6 6-6 6M12 6l6 6-6 6"/>'),
  balao: svg('<path d="M4 5h16v11H9l-5 4z"/>'),
  mais: svg('<path d="M12 5v14M5 12h14"/>'),
  menos: svg('<path d="M5 12h14"/>'),
  som: svg('<path d="M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
}
