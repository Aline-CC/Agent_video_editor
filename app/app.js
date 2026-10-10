// O app de revisão: roteamento pelo endereço e o início (os projetos). As páginas: #/ (projetos), #/p/<slug>[/vN] (a
// revisão de uma versão), #/calibragem[/<id>], #/referencias, #/heuristica e as da biblioteca (#/presets, #/transicoes
// [/<de>><para>], #/banco, #/motions, #/trilhas).
import { $, $$, esc, json, mmss } from './comum.js'
import { abrirRevisao } from './revisao.js'
import { abrirBiblioteca, PAGINAS_BIBLIOTECA } from './biblioteca.js'
import { abrirCalibragem, abrirRevisaoReferencia } from './calibragem.js'
import { abrirHeuristica, abrirReferencias } from './referencias.js'

const ESTADOS = {
  em_revisao: ['Em revisão', 'selo-coral'],
  enviada: ['Revisão enviada', 'selo-amarelo'],
  aprovado: ['Aprovado', 'selo-menta'],
}

async function inicio(tela) {
  tela.className = 'pagina pagina-inicio'
  const projetos = await json('/api/projetos', [])
  const cards = projetos.map((p) => {
    const [estado, cor] = ESTADOS[p.estado] || ESTADOS.em_revisao
    const proxy = `/projetos/${encodeURIComponent(p.slug)}/versoes/v${p.ultima}/proxy.mp4`
    const n = p.versoes.length
    return `<a class="card-projeto" href="#/p/${encodeURIComponent(p.slug)}">
      <div class="mini mini-916"><video muted playsinline preload="metadata" src="${proxy}#t=1.5"></video>
        <span class="selo ${cor}">${estado}</span>${p.duracao ? `<span class="duracao">${mmss(p.duracao)}</span>` : ''}</div>
      <h3>${esc(p.nome)}</h3>
      <p class="sub">${esc(p.slug)} · v${p.ultima} · ${n} ${n === 1 ? 'versão' : 'versões'}${p.comentarios ? ` · ${p.comentarios} ${p.comentarios === 1 ? 'comentário' : 'comentários'}` : ''}</p>
    </a>`
  })
  tela.innerHTML = `<div class="cabeca-secao"><span class="eyebrow">Projetos · ${String(projetos.length).padStart(2, '0')}</span>
      <span class="dica">Cada versão que o Claude entrega aparece aqui. Abra, comente e copie a revisão para o chat.</span></div>
    ${projetos.length ? `<div class="grade grade-projetos">${cards.join('')}</div>` : '<p class="vazio">Nenhum projeto com versão ainda. Mande um vídeo bruto ao Claude Code: quando ele entregar a v1, ela aparece aqui.</p>'}`
  // o vídeo toca mudo com o mouse em cima
  for (const card of $$('.card-projeto', tela)) {
    const v = $('video', card)
    card.addEventListener('mouseenter', () => v.play().catch(() => {}))
    card.addEventListener('mouseleave', () => {
      v.pause()
      v.currentTime = 1.5
    })
  }
}

let sair = null
let vez = 0
async function rotear() {
  const minha = ++vez
  sair?.()
  sair = null
  let partes = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)
  if (partes[0] === 'biblioteca') partes = partes.slice(1).length ? partes.slice(1) : ['banco'] // endereços antigos
  const velha = $('#tela')
  const tela = velha.cloneNode(false) // uma tela nova a cada página: nenhum ouvinte da anterior fica para trás
  tela.className = ''
  velha.replaceWith(tela)
  $('#barra-extra').innerHTML = ''
  const aba = partes[0] === 'p' || !partes[0] ? 'projetos' : partes[0]
  for (const a of $$('.abas a')) a.classList.toggle('ativa', a.dataset.aba === aba)
  document.body.classList.toggle('em-revisao', (partes[0] === 'p' || partes[0] === 'calibragem') && !!partes[1])
  let s
  if (partes[0] === 'p' && partes[1]) s = await abrirRevisao(tela, partes[1], partes[2] ? parseInt(partes[2].replace(/^v/, ''), 10) : null)
  else if (partes[0] === 'calibragem') s = await (partes[1] ? abrirRevisaoReferencia(tela, partes[1]) : abrirCalibragem(tela))
  else if (partes[0] === 'referencias') s = await abrirReferencias(tela)
  else if (partes[0] === 'heuristica') s = await abrirHeuristica(tela)
  else if (PAGINAS_BIBLIOTECA.includes(partes[0])) s = await abrirBiblioteca(tela, partes[0], partes.slice(1))
  else s = await inicio(tela)
  if (minha !== vez) s?.() // já mudou de tela enquanto carregava
  else sair = s
}

window.addEventListener('hashchange', rotear)
rotear()
