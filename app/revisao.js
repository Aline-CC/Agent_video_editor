// A revisão de uma versão: o player do proxy, a linha do tempo (planos, fala, comentários e dúvidas do Claude) e os
// comentários do criador, gravados sozinhos em projetos/<slug>/revisoes/vN.json (o Claude responde no mesmo arquivo).
import { $, $$, ICONE, agora, aviso, confirmar, copiar, dataHora, esc, json, modalAberto, nomePlano, num, PLANOS, tempo } from './comum.js'

const QUADRO = 1 / 24
const VELOCIDADES = [0.5, 1, 1.5, 2]
const r3 = (t) => Math.round(t * 1000) / 1000
const listaDe = (x, chave) => (Array.isArray(x) ? x : x?.[chave] || [])
const limpar = (s) => s.replace(/^[\s,.;:!?…]+|[\s,.;:!?]+$/g, '')
const umaLinha = (s) => s.trim().replace(/\s*\n\s*/g, ' / ')
/** O status que o Claude escreve (revisao.py responder): rótulo e classe. */
const STATUS = {
  aplicado: ['Aplicado', 'aplicado'],
  respondido: ['Respondido', 'respondido'],
  nao_aplicado: ['Não aplicado', 'nao-aplicado'],
  'não aplicado': ['Não aplicado', 'nao-aplicado'],
}
const chaveStatus = (s) => (s === 'não aplicado' ? 'nao_aplicado' : s || 'pendente')
const quando = (c) => (c.fim != null ? `${tempo(c.t)}–${tempo(c.fim)}` : tempo(c.t))

export async function abrirRevisao(tela, slug, vPedida) {
  const projetos = await json('/api/projetos', [])
  const proj = projetos.find((p) => p.slug === slug)
  if (!proj) {
    tela.className = 'pagina'
    tela.innerHTML = `<p class="vazio">O projeto <b>${esc(slug)}</b> não existe ou ainda não tem versão. <a href="#/">Voltar aos projetos</a></p>`
    return null
  }
  const r = new Revisao(tela, proj, proj.versoes.includes(vPedida) ? vPedida : proj.ultima)
  await r.abrir()
  return () => r.fechar()
}

class Revisao {
  constructor(tela, proj, v) {
    Object.assign(this, { tela, proj, v, slug: proj.slug })
    const s = encodeURIComponent(proj.slug)
    this.base = `/projetos/${s}/versoes/v${v}/`
    this.urlRevisao = `/projetos/${s}/revisoes/v${v}.json`
    this.pxs = 1
    this.ajustar = true // a linha do tempo cabe inteira na largura
    this.entrada = null // a marca I (s)
    this.editor = null // {t, fim, responde?, id? (editando), texto?}
    this.sel = null
    this.fila = Promise.resolve()
    this.sujo = false
    this.iPalavra = this.iPlano = -2
  }

  async abrir() {
    const [palavras, planos, notas, info, rev] = await Promise.all([
      json(this.base + 'palavras.json', []),
      json(this.base + 'planos.json', []),
      json(this.base + 'notas.json', []),
      json(this.base + 'info.json', {}),
      json(this.urlRevisao, null),
    ])
    this.palavras = listaDe(palavras, 'palavras').slice().sort((a, b) => a.ini - b.ini)
    this.planos = listaDe(planos, 'planos')
    this.notas = listaDe(notas, 'notas')
    this.info = info || {}
    this.rev = rev || { projeto: this.slug, versao: this.v, geral: '', aprovado: false, enviado_em: null, comentarios: [] }
    this.rev.comentarios ||= []
    this.dur = this.info.duracao || this.palavras.at(-1)?.fim || 60
    this.montar()
    this.ligar()
    this.mostrarSalvo(rev ? 'salvo' : '')
    this.relogio = setInterval(() => this.verDisco(), 4000)
  }

  // ---------- a tela ----------

  montar() {
    const extra = $('#barra-extra')
    extra.innerHTML = `<div class="trilha-projeto"><a href="#/" class="botao-icone" title="Projetos">${ICONE.voltar}</a>
        <span class="nome-projeto" title="${esc(this.slug)}">${esc(this.proj.nome)}</span><div class="versoes" id="versoes"></div></div>
      <span class="salvo" id="salvo"></span>
      <button class="botao" data-acao="aprovar" id="b-aprovar">Aprovar</button>
      <button class="botao botao-coral" data-acao="copiar">Copiar revisão <span class="seta">${ICONE.seta}</span></button>`
    this.tela.className = 'pagina-revisao'
    this.tela.innerHTML = `<div class="revisao">
      <section class="palco">
        <div class="lado lado-esq">
          <div class="bloco"><span class="eyebrow">Plano agora</span><div id="plano-atual" class="plano-atual"></div></div>
          <div class="bloco"><span class="eyebrow">Fala</span><p id="fala-atual" class="fala-atual"></p></div>
        </div>
        <div class="video-caixa"><video id="video" src="${this.base}proxy.mp4" preload="auto" playsinline></video>
          <button class="video-tocar" data-acao="tocar" aria-label="Tocar">${ICONE.tocar}</button></div>
        <div class="lado lado-dir">
          <div class="bloco"><span class="eyebrow">Atalhos</span>
            <dl class="atalhos"><dt><kbd>Espaço</kbd></dt><dd>tocar / pausar</dd><dt><kbd>←</kbd> <kbd>→</kbd></dt><dd>1 quadro</dd>
            <dt><kbd>Shift</kbd> <kbd>←</kbd> <kbd>→</kbd></dt><dd>1 segundo</dd><dt><kbd>C</kbd></dt><dd>comentar este ponto</dd>
            <dt><kbd>I</kbd> <kbd>O</kbd></dt><dd>entrada e saída de um trecho</dd><dt><kbd>Esc</kbd></dt><dd>fechar / cancelar</dd></dl></div>
          ${this.info.resumo ? `<div class="bloco"><span class="eyebrow">O que mudou na v${this.v}</span><p class="resumo-versao">${esc(this.info.resumo)}</p></div>` : ''}
        </div>
      </section>
      <div class="controles">
        <div class="grupo">
          <button class="botao-icone" data-acao="seg-" title="−1 s (Shift+←)">${ICONE.segAntes}</button>
          <button class="botao-icone" data-acao="quadro-" title="−1 quadro (←)">${ICONE.quadroAntes}</button>
          <button class="botao-icone botao-tocar" data-acao="tocar" id="b-tocar" title="Tocar / pausar (Espaço)">${ICONE.tocar}</button>
          <button class="botao-icone" data-acao="quadro+" title="+1 quadro (→)">${ICONE.quadroDepois}</button>
          <button class="botao-icone" data-acao="seg+" title="+1 s (Shift+→)">${ICONE.segDepois}</button>
          <span class="tempo"><b id="t-atual">0:00,0</b> / <span id="t-total">${tempo(this.dur)}</span></span>
        </div>
        <div class="grupo velocidades">${VELOCIDADES.map((x) => `<button class="pilula pequena${x === 1 ? ' ativa' : ''}" data-vel="${x}">${num(x, x % 1 ? 1 : 0)}×</button>`).join('')}</div>
        <div class="grupo">
          <button class="botao" data-acao="comentar">${ICONE.balao} Comentar <kbd>C</kbd></button>
          <button class="botao" data-acao="entrada" id="b-entrada">Entrada <kbd>I</kbd></button>
          <button class="botao" data-acao="saida">Saída <kbd>O</kbd></button>
        </div>
      </div>
      <section class="linha">
        <div class="linha-rotulos"><span class="r-regua"><button class="botao-icone pequeno" data-acao="zoom-" title="Afastar a linha do tempo">${ICONE.menos}</button><button class="botao-icone pequeno" data-acao="zoom+" title="Aproximar (⌘ + rolagem)">${ICONE.mais}</button></span><span>Planos</span><span>Fala</span><span>Você</span><span>Claude</span></div>
        <div class="linha-rolo" id="rolo"><div class="linha-conteudo" id="conteudo">
          <div class="regua" id="regua"></div>
          <div class="faixa faixa-planos" id="f-planos"></div>
          <div class="faixa faixa-palavras" id="f-palavras"></div>
          <div class="faixa faixa-comentarios" id="f-comentarios"></div>
          <div class="faixa faixa-notas" id="f-notas"></div>
          <div id="io"></div>
          <div class="cabeca" id="cabeca"></div>
        </div></div>
      </section>
      <aside class="painel">
        <div class="painel-cabeca"><span class="eyebrow">Comentários · v${this.v}</span><span class="resumo" id="resumo"></span></div>
        <div id="estado"></div>
        <div class="lista" id="lista"></div>
        <div class="geral"><label class="eyebrow" for="geral">Comentário geral</label>
          <textarea id="geral" rows="2" placeholder="Sobre o vídeo todo (ex.: legenda um pouco mais baixa)">${esc(this.rev.geral || '')}</textarea>
          <div id="resposta-geral"></div></div>
      </aside>
    </div>`
    this.video = $('#video')
    this.renderVersoes()
    this.renderEstado()
    this.renderLista()
    this.renderLinha()
  }

  renderVersoes() {
    const s = encodeURIComponent(this.slug)
    $('#versoes').innerHTML = this.proj.versoes
      .map((n) => `<a class="pilula pequena${n === this.v ? ' ativa' : ''}" href="#/p/${s}/v${n}">v${n}</a>`)
      .join('')
    const b = $('#b-aprovar')
    b.innerHTML = this.rev.aprovado ? `${ICONE.check} Aprovado` : 'Aprovar'
    b.classList.toggle('botao-menta', !!this.rev.aprovado)
  }

  renderEstado() {
    const r = this.rev
    const ultima = this.proj.ultima
    const s = encodeURIComponent(this.slug)
    let html = ''
    if (this.v < ultima) html += `<div class="faixa-estado estado-antiga">Esta é a v${this.v}. <a href="#/p/${s}/v${ultima}">Abrir a v${ultima}, a última →</a></div>`
    if (r.aprovado) html += `<div class="faixa-estado estado-aprovado">${ICONE.check} Aprovada. O Claude exporta o final em 4K.</div>`
    else if (r.enviado_em) html += `<div class="faixa-estado estado-enviada">Revisão enviada em ${dataHora(r.enviado_em)}.${this.v < ultima ? '' : ` Esperando a v${this.v + 1}.`}</div>`
    $('#estado').innerHTML = html
    const g = r.resposta_geral
    $('#resposta-geral').innerHTML = g?.resposta || (g?.status && g.status !== 'pendente') ? this.htmlResposta(g) : ''
  }

  renderResumo() {
    const cs = this.rev.comentarios.filter((c) => c.texto)
    const n = (k) => cs.filter((c) => chaveStatus(c.status) === k).length
    const partes = [`${cs.length} ${cs.length === 1 ? 'comentário' : 'comentários'}`]
    for (const [k, um, varios] of [['aplicado', 'aplicado', 'aplicados'], ['respondido', 'respondido', 'respondidos'], ['nao_aplicado', 'não aplicado', 'não aplicados']]) {
      const q = n(k)
      if (q) partes.push(`<b class="t-${STATUS[k][1]}">${q} ${q === 1 ? um : varios}</b>`)
    }
    $('#resumo').innerHTML = partes.join(' · ')
  }

  // ---------- a lista de comentários ----------

  renderLista() {
    const campo0 = $('#editor-texto')
    if (campo0 && this.editor) this.editor.texto = campo0.value // o que já foi digitado sobrevive ao redesenho
    const comentarios = this.rev.comentarios.filter((c) => !c.responde).sort((a, b) => a.t - b.t)
    this.numeros = new Map(comentarios.map((c, k) => [c.id, k + 1]))
    const respostas = new Map(this.rev.comentarios.filter((c) => c.responde).map((c) => [c.responde, c]))
    const itens = [
      ...comentarios.map((c) => ({ t: c.t, html: this.htmlComentario(c) })),
      ...this.notas.map((n) => ({ t: n.ini, html: this.htmlNota(n, respostas.get(n.id)) })),
    ].sort((a, b) => a.t - b.t)
    const ed = this.editor
    let html = ed && !ed.id && !ed.responde ? this.htmlEditor() : ''
    html += itens.map((i) => i.html).join('')
    if (!itens.length && !ed) html = `<p class="vazio-lista">Nenhum comentário ainda.<br>Aperte <kbd>C</kbd> num ponto do vídeo, ou <kbd>I</kbd> e <kbd>O</kbd> para um trecho.</p>`
    $('#lista').innerHTML = html
    this.renderResumo()
    const campo = $('#editor-texto')
    if (campo) {
      campo.focus()
      campo.setSelectionRange(campo.value.length, campo.value.length)
      campo.closest('.editor').scrollIntoView({ block: 'nearest' })
    }
  }

  htmlComentario(c) {
    if (this.editor?.id === c.id) return this.htmlEditor()
    return `<article class="item${this.sel === c.id ? ' item-sel' : ''}" data-id="${c.id}" data-ir="${c.t}">
      <header class="item-cabeca"><span class="num">${this.numeros.get(c.id)}</span>
        <button class="chip-tempo" data-ir="${c.t}">${quando(c)}</button>
        <span class="item-acoes"><button class="botao-icone pequeno" data-editar="${c.id}" title="Editar">${ICONE.lapis}</button>
        <button class="botao-icone pequeno" data-apagar="${c.id}" title="Apagar">${ICONE.lixo}</button></span></header>
      ${c.fala ? `<p class="fala">“${esc(c.fala)}”</p>` : ''}
      <p class="texto">${esc(c.texto)}</p>
      ${this.htmlResposta(c)}
    </article>`
  }

  htmlNota(n, resp) {
    const ed = this.editor
    let pe
    if (ed?.responde === n.id) pe = this.htmlEditor()
    else if (resp)
      pe = `<div class="replica"><header class="item-cabeca"><span class="eyebrow">↳ Sua resposta</span>
          <span class="item-acoes"><button class="botao-icone pequeno" data-editar="${resp.id}" title="Editar">${ICONE.lapis}</button>
          <button class="botao-icone pequeno" data-apagar="${resp.id}" title="Apagar">${ICONE.lixo}</button></span></header>
          <p class="texto">${esc(resp.texto)}</p>${this.htmlResposta(resp)}</div>`
    else pe = `<button class="botao pequeno" data-responder="${n.id}">Responder</button>`
    return `<article class="item item-nota${this.sel === n.id ? ' item-sel' : ''}" data-nota="${n.id}" data-ir="${n.ini}">
      <header class="item-cabeca"><span class="num num-nota">?</span><span class="rotulo-claude">Dúvida do Claude</span>
        <button class="chip-tempo" data-ir="${n.ini}">${quando({ t: n.ini, fim: n.fim })}</button></header>
      ${n.fala ? `<p class="fala">“${esc(n.fala)}”</p>` : ''}
      <p class="texto">${esc(n.texto)}</p>${pe}
    </article>`
  }

  /** O que o Claude respondeu a um comentário (status + texto). */
  htmlResposta(c) {
    const k = chaveStatus(c.status)
    if (k === 'pendente' && !c.resposta) return ''
    const [rotulo, cls] = STATUS[k] || [k, 'respondido']
    return `<div class="resposta resposta-${cls}"><span class="status">${k === 'aplicado' ? ICONE.check : ''}Claude · ${rotulo}</span>
      ${c.resposta ? `<p>${esc(c.resposta)}</p>` : ''}</div>`
  }

  htmlEditor() {
    const ed = this.editor
    const titulo = ed.responde ? 'Sua resposta' : ed.id ? 'Editar comentário' : ed.fim != null ? 'Comentário no trecho' : 'Comentário'
    const fala = ed.responde ? '' : ed.fim != null ? this.falaIntervalo(ed.t, ed.fim) : this.falaPonto(ed.t)
    return `<div class="editor">
      <div class="item-cabeca"><span class="eyebrow">${titulo}</span>${ed.responde ? '' : `<span class="chip-tempo estatico">${quando(ed)}</span>`}</div>
      ${fala ? `<p class="fala">“${esc(fala)}”</p>` : ''}
      <textarea id="editor-texto" rows="3" placeholder="${ed.responde ? 'Responda a dúvida' : 'O que mudar aqui?'}">${esc(ed.texto || '')}</textarea>
      <div class="editor-acoes"><span class="dica">Enter salva · Shift+Enter quebra a linha · Esc cancela</span>
        <button class="botao pequeno" data-acao="cancelar">Cancelar</button>
        <button class="botao pequeno botao-coral" data-acao="salvar-editor">Salvar</button></div>
    </div>`
  }

  // ---------- a linha do tempo ----------

  renderLinha() {
    const rolo = $('#rolo')
    const ajuste = Math.max(rolo.clientWidth - 2, 100) / this.dur
    if (this.ajustar || this.pxs < ajuste) {
      this.pxs = ajuste
      this.ajustar = true
    }
    $('#conteudo').style.width = `${this.dur * this.pxs}px`
    this.renderRegua()
    this.renderPlanos()
    this.renderPalavras()
    this.renderMarcas()
    this.iPalavra = this.iPlano = -2
    this.atualizar()
  }

  renderRegua() {
    const px = this.pxs
    const passo = [0.5, 1, 2, 5, 10, 15, 30, 60].find((s) => s * px >= 56) || 60
    const sub = passo >= 5 ? passo / 5 : passo / 2
    let html = ''
    for (let t = 0; t <= this.dur + 1e-6; t += sub) {
      const k = Math.round(t / sub)
      const grande = k % Math.round(passo / sub) === 0
      if (!grande && sub * px < 6) continue
      const rotulo = grande ? (passo < 1 ? tempo(t) : `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, '0')}`) : ''
      html += `<span class="tique${grande ? ' tique-grande' : ''}" style="left:${(t * px).toFixed(1)}px">${rotulo ? `<i>${rotulo}</i>` : ''}</span>`
    }
    $('#regua').innerHTML = html
  }

  renderPlanos() {
    $('#f-planos').innerHTML = this.planos
      .map((p) => {
        const x = p.ini * this.pxs
        const w = Math.max((p.fim - p.ini) * this.pxs - 1, 1)
        const [nome, curto] = PLANOS[p.tipo] || [p.tipo, p.tipo]
        const rot = w >= 130 ? `<b>${esc(p.id)}</b> ${esc(nome)}` : w >= 70 ? `<b>${esc(p.id)}</b> ${esc(curto)}` : w >= 24 ? `<b>${esc(p.id)}</b>` : ''
        const dica = `${p.id} · ${nome} · ${tempo(p.ini)}–${tempo(p.fim)}${p.descricao ? `\n${p.descricao}` : ''}${p.texto ? `\nTexto: ${p.texto}` : ''}`
        return `<div class="plano tipo-${esc(p.tipo)}" style="left:${x.toFixed(1)}px;width:${w.toFixed(1)}px" title="${esc(dica)}">${rot}</div>`
      })
      .join('')
  }

  renderPalavras() {
    const ctx = (this.medidor ||= document.createElement('canvas').getContext('2d'))
    ctx.font = '400 11px Manrope, sans-serif'
    $('#f-palavras').innerHTML = this.palavras
      .map((w, i) => {
        const x = w.ini * this.pxs
        const larg = Math.max((w.fim - w.ini) * this.pxs - 1, 1)
        const cabe = larg >= ctx.measureText(w.texto).width + 5
        return `<span class="palavra${cabe ? '' : ' sem-texto'}" data-i="${i}" style="left:${x.toFixed(1)}px;width:${larg.toFixed(1)}px" title="${esc(w.texto)} · ${tempo(w.ini)}">${cabe ? esc(w.texto) : ''}</span>`
      })
      .join('')
  }

  renderMarcas() {
    const px = this.pxs
    const marca = (id, t, fim, rotulo, cls, dica) => {
      const sel = this.sel === id ? ' marca-sel' : ''
      if (fim != null && (fim - t) * px >= 10)
        return `<button class="marca marca-intervalo ${cls}${sel}" data-marca="${id}" data-ir="${t}" style="left:${(t * px).toFixed(1)}px;width:${((fim - t) * px).toFixed(1)}px" title="${esc(dica)}">${rotulo}</button>`
      return `<button class="marca marca-ponto ${cls}${sel}" data-marca="${id}" data-ir="${t}" style="left:${(t * px).toFixed(1)}px" title="${esc(dica)}">${rotulo}</button>`
    }
    $('#f-comentarios').innerHTML = this.rev.comentarios
      .filter((c) => !c.responde)
      .map((c) => {
        const k = chaveStatus(c.status)
        return marca(c.id, c.t, c.fim, this.numeros.get(c.id), k === 'pendente' ? '' : `marca-${STATUS[k]?.[1] || 'respondido'}`, `${quando(c)} · ${c.texto}`)
      })
      .join('')
    const respondidas = new Set(this.rev.comentarios.filter((c) => c.responde).map((c) => c.responde))
    $('#f-notas').innerHTML = this.notas
      .map((n) => marca(n.id, n.ini, n.fim, respondidas.has(n.id) ? '✓' : '?', `marca-nota${respondidas.has(n.id) ? ' marca-nota-ok' : ''}`, `Dúvida do Claude · ${n.texto}`))
      .join('')
    // a marca de entrada (I) e o trecho do comentário sendo escrito
    const ed = this.editor
    let io = ''
    if (ed && !ed.responde && ed.fim != null) io = `<div class="io-trecho" style="left:${ed.t * px}px;width:${(ed.fim - ed.t) * px}px"></div>`
    else if (this.entrada != null) io = `<div class="io-entrada" style="left:${this.entrada * px}px"><i>I</i></div>`
    $('#io').innerHTML = io
    $('#b-entrada').classList.toggle('ativo', this.entrada != null)
  }

  // ---------- o tempo ----------

  atualizar() {
    if (this.fechado) return // o vídeo ainda solta eventos depois de sair da tela
    const t = this.video.currentTime
    $('#t-atual').textContent = tempo(t)
    const x = t * this.pxs
    $('#cabeca').style.transform = `translateX(${x}px)`
    const tocando = !this.video.paused
    if (tocando !== this.tocando) {
      this.tocando = tocando
      const ic = tocando ? ICONE.pausar : ICONE.tocar
      $('#b-tocar').innerHTML = ic
      $('.video-tocar').classList.toggle('escondido', tocando)
    }
    if (tocando) {
      const rolo = $('#rolo')
      if (x < rolo.scrollLeft || x > rolo.scrollLeft + rolo.clientWidth - 30) rolo.scrollLeft = x - 40
    }
    // a palavra sob o cursor
    const i = this.palavras.findIndex((w) => t >= w.ini && t < w.fim)
    if (i !== this.iPalavra) {
      $('.palavra.agora')?.classList.remove('agora')
      if (i >= 0) $(`.palavra[data-i="${i}"]`)?.classList.add('agora')
      const k = i >= 0 ? i : this.palavras.indexOf(this.palavraPerto(t))
      this.iPalavra = i
      const de = Math.max(0, k - 5)
      $('#fala-atual').innerHTML = k < 0 ? '<span class="apagado">—</span>'
        : (de > 0 ? '… ' : '') + this.palavras.slice(de, k + 6).map((w, j) => (de + j === i ? `<b>${esc(w.texto)}</b>` : esc(w.texto))).join(' ') + (k + 6 < this.palavras.length ? ' …' : '')
    }
    // o plano sob o cursor
    const p = this.planos.findIndex((q) => t >= q.ini && t < q.fim)
    if (p !== this.iPlano) {
      this.iPlano = p
      const q = this.planos[p]
      $('#plano-atual').innerHTML = q
        ? `<span class="chip-plano tipo-${esc(q.tipo)}"><b>${esc(q.id)}</b> ${esc(nomePlano(q.tipo))}</span>${q.texto ? `<p class="plano-texto">“${esc(q.texto)}”</p>` : ''}${q.descricao ? `<p class="plano-desc">${esc(q.descricao)}</p>` : ''}`
        : '<span class="apagado">—</span>'
    }
  }

  laco() {
    cancelAnimationFrame(this.raf)
    const passo = () => {
      this.atualizar()
      if (!this.video.paused && !this.fechado) this.raf = requestAnimationFrame(passo)
    }
    passo()
  }

  buscar(t) {
    this.video.currentTime = Math.min(Math.max(t, 0), Math.max(this.dur - 0.01, 0))
    this.atualizar()
  }

  passo(d) {
    this.video.pause()
    if (Math.abs(d) < 0.5) this.buscar((Math.round(this.video.currentTime * 24) + Math.sign(d)) / 24 + 0.001)
    else this.buscar(this.video.currentTime + d)
  }

  alternar() {
    if (this.video.paused) this.video.play().catch(() => {})
    else this.video.pause()
  }

  zoom(fator, ancora) {
    const rolo = $('#rolo')
    const a = ancora ?? (this.video.currentTime * this.pxs - rolo.scrollLeft)
    const tAncora = (rolo.scrollLeft + a) / this.pxs
    const ajuste = Math.max(rolo.clientWidth - 2, 100) / this.dur
    this.pxs = Math.min(Math.max(this.pxs * fator, ajuste), 400)
    this.ajustar = this.pxs <= ajuste * 1.0001
    this.renderLinha()
    rolo.scrollLeft = tAncora * this.pxs - a
  }

  // ---------- palavras e fala ----------

  palavraPerto(t) {
    let melhor = null
    let dist = Infinity
    for (const w of this.palavras) {
      const d = t < w.ini ? w.ini - t : t >= w.fim ? t - w.fim : 0
      if (d < dist) [melhor, dist] = [w, d]
      if (d === 0 || w.ini > t + dist) break
    }
    return melhor
  }

  falaPonto(t) {
    const k = this.palavras.indexOf(this.palavraPerto(t))
    return k < 0 ? '' : limpar(this.palavras.slice(Math.max(0, k - 1), k + 2).map((w) => w.texto).join(' '))
  }

  falaIntervalo(a, b) {
    const ws = this.palavras.filter((w) => w.fim > a && w.ini < b).map((w) => w.texto)
    if (!ws.length) return this.falaPonto(a)
    return limpar(ws.length > 10 ? `${ws.slice(0, 4).join(' ')} … ${ws.slice(-4).join(' ')}` : ws.join(' '))
  }

  // ---------- comentar ----------

  abrirEditor(ed) {
    if (this.editor) this.salvarEditor()
    this.video.pause()
    this.editor = ed
    this.renderLista()
    this.renderMarcas()
  }

  fecharEditor() {
    const eraTrecho = this.editor?.fim != null && !this.editor.responde
    this.editor = null
    if (eraTrecho) this.entrada = null
    this.renderLista()
    this.renderMarcas()
  }

  salvarEditor() {
    const ed = this.editor
    if (!ed) return
    const texto = ($('#editor-texto')?.value ?? ed.texto ?? '').trim()
    const cs = this.rev.comentarios
    if (ed.id) {
      const c = cs.find((x) => x.id === ed.id)
      if (c && !texto) cs.splice(cs.indexOf(c), 1)
      else if (c && texto !== c.texto) c.texto = texto
    } else if (texto) {
      const c = this.novoComentario(ed, texto)
      cs.push(c)
      this.sel = ed.responde || c.id
    }
    this.editor = null
    this.entrada = null
    this.renderLista()
    this.renderMarcas()
    this.agendarSalvar()
  }

  novoComentario({ t, fim, responde }, texto) {
    const n = Math.max(0, ...this.rev.comentarios.map((c) => parseInt(String(c.id).replace(/\D/g, ''), 10) || 0)) + 1
    const nota = responde && this.notas.find((x) => x.id === responde)
    const fala = nota ? (nota.fala ? limpar(nota.fala) : this.falaIntervalo(nota.ini, nota.fim ?? nota.ini + 0.5)) : fim != null ? this.falaIntervalo(t, fim) : this.falaPonto(t)
    return {
      id: `c${n}`, t: r3(t), fim: fim == null ? null : r3(fim), palavra: this.palavraPerto(t)?.id ?? null, fala, texto,
      criado_em: agora(), de: 'rodrigo', status: 'pendente', resposta: null, ...(responde ? { responde } : {}),
    }
  }

  comentarPonto() {
    this.abrirEditor({ t: this.video.currentTime, fim: null })
  }

  marcarEntrada() {
    if (this.editor && !this.editor.id) this.salvarEditor()
    this.entrada = this.video.currentTime
    this.renderMarcas()
    aviso(`Entrada em ${tempo(this.entrada)}. Agora O marca a saída.`)
  }

  marcarSaida() {
    if (this.entrada == null) return aviso('Marque a entrada com I antes.', 'erro')
    const t = this.video.currentTime
    const [a, b] = [Math.min(this.entrada, t), Math.max(this.entrada, t)]
    this.abrirEditor({ t: a, fim: b - a < 0.05 ? null : b })
  }

  async apagar(id) {
    const c = this.rev.comentarios.find((x) => x.id === id)
    if (!c) return
    const ok = await confirmar({ titulo: 'Apagar este comentário?', texto: c.texto, ok: 'Apagar', perigo: true })
    if (!ok) return
    this.rev.comentarios.splice(this.rev.comentarios.indexOf(c), 1)
    this.renderLista()
    this.renderMarcas()
    this.agendarSalvar()
  }

  selecionar(id, t) {
    this.sel = id
    if (t != null) this.buscar(t)
    this.renderLista()
    this.renderMarcas()
    $(`.item[data-id="${id}"], .item[data-nota="${id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }

  // ---------- gravar, copiar, aprovar ----------

  mostrarSalvo(estado) {
    const el = $('#salvo')
    if (!el) return
    el.className = `salvo salvo-${estado}`
    el.innerHTML = { salvando: 'Salvando…', salvo: `${ICONE.check} Salvo`, erro: 'Erro ao salvar', '': '' }[estado]
  }

  agendarSalvar() {
    this.sujo = true
    this.mostrarSalvo('salvando')
    clearTimeout(this.timer)
    this.timer = setTimeout(() => this.salvar(), 600)
  }

  salvar(keepalive = false) {
    clearTimeout(this.timer)
    this.sujo = false
    const corpo = JSON.stringify(this.rev)
    const url = `/api/revisao/${encodeURIComponent(this.slug)}/v${this.v}`
    this.fila = this.fila
      .then(() => fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: corpo, keepalive }))
      .then((r) => {
        if (!r.ok) throw new Error(r.status)
        if (!this.sujo) this.mostrarSalvo('salvo')
      })
      .catch(() => this.mostrarSalvo('erro'))
    return this.fila
  }

  /** O texto que o criador cola no chat do Claude Code (o mesmo do `revisao.py ler`). */
  texto() {
    const linhas = [`Revisão · ${this.slug} · v${this.v}`]
    for (const c of this.rev.comentarios.filter((x) => x.texto?.trim()).sort((a, b) => a.t - b.t)) {
      const ancora = c.responde ? `↳ dúvida do Claude ${tempo(c.t)}` : quando(c)
      linhas.push(`[${ancora}] ${c.fala ? `"${c.fala}" — ` : ''}${umaLinha(c.texto)}`)
    }
    if (this.rev.geral?.trim()) linhas.push(`Geral: ${umaLinha(this.rev.geral)}`)
    linhas.push(`(projetos/${this.slug}/revisoes/v${this.v}.json)`)
    return linhas.join('\n')
  }

  async copiarRevisao() {
    if (this.editor) this.salvarEditor()
    if (!this.rev.comentarios.some((c) => c.texto?.trim()) && !this.rev.geral?.trim())
      return aviso('Nada para enviar ainda: comente um ponto (C) ou escreva o comentário geral.', 'erro')
    this.rev.enviado_em = agora()
    await this.salvar()
    await copiar(this.texto())
    this.renderEstado()
    aviso('Copiado — cole no chat do Claude Code')
  }

  async aprovar() {
    if (this.editor) this.salvarEditor()
    const texto = `Aprovado · ${this.slug} · v${this.v}`
    if (!this.rev.aprovado) {
      const ok = await confirmar({ titulo: `Aprovar a v${this.v}?`, texto: 'O Claude exporta o vídeo final em 4K a partir desta versão.', ok: 'Aprovar e copiar' })
      if (!ok) return
      this.rev.aprovado = true
      await this.salvar()
      this.renderVersoes()
      this.renderEstado()
    }
    await copiar(texto)
    aviso('Copiado — cole no chat do Claude Code')
  }

  /** O Claude responde no arquivo e entrega versões novas: a cada 4 s, traz as respostas e as versões. */
  async verDisco() {
    if (this.fechado || this.sujo || document.hidden) return
    const disco = await json(this.urlRevisao, null)
    if (this.fechado || this.sujo) return
    let mudou = false
    for (const d of disco?.comentarios || []) {
      const c = this.rev.comentarios.find((x) => x.id === d.id)
      if (c && (d.status !== c.status || d.resposta !== c.resposta)) {
        c.status = d.status
        c.resposta = d.resposta
        mudou = true
      }
    }
    if (disco && JSON.stringify(disco.resposta_geral ?? null) !== JSON.stringify(this.rev.resposta_geral ?? null)) {
      this.rev.resposta_geral = disco.resposta_geral
      mudou = true
    }
    // uma gravação que se perdeu (o arquivo foi regravado ao mesmo tempo por outro lado): grava de novo
    if (disco && this.rev.comentarios.some((c) => !disco.comentarios?.some((d) => d.id === c.id))) this.agendarSalvar()
    if (mudou) {
      if (!this.editor) this.renderLista()
      this.renderMarcas()
      this.renderEstado()
      aviso('O Claude respondeu a revisão')
    }
    const p = (await json('/api/projetos', null))?.find((x) => x.slug === this.slug)
    if (p && !this.fechado && p.versoes.join() !== this.proj.versoes.join()) {
      const nova = p.versoes.find((x) => !this.proj.versoes.includes(x))
      this.proj = p
      this.renderVersoes()
      this.renderEstado()
      if (nova) aviso(`A v${nova} chegou`)
    }
  }

  // ---------- eventos ----------

  ligar() {
    const v = this.video
    v.addEventListener('loadedmetadata', () => {
      if (isFinite(v.duration) && Math.abs(v.duration - this.dur) > 0.05) {
        this.dur = v.duration
        $('#t-total').textContent = tempo(this.dur)
        this.renderLinha()
      }
    })
    v.addEventListener('play', () => this.laco())
    for (const ev of ['pause', 'seeked', 'timeupdate']) v.addEventListener(ev, () => v.paused && this.atualizar())

    this.cliques = (e) => this.clique(e)
    this.tela.addEventListener('click', this.cliques)
    $('#barra-extra').addEventListener('click', this.cliques)
    this.teclas = (e) => this.tecla(e)
    window.addEventListener('keydown', this.teclas)
    this.redim = () => this.ajustar && this.renderLinha()
    window.addEventListener('resize', this.redim)
    this.saida = () => this.sujo && this.salvar(true)
    window.addEventListener('pagehide', this.saida)

    $('#geral').addEventListener('input', (e) => {
      this.rev.geral = e.target.value
      this.agendarSalvar()
    })

    // clicar/arrastar na linha do tempo busca; ⌘/Ctrl + rolagem aproxima
    const conteudo = $('#conteudo')
    conteudo.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.marca') || e.button !== 0) return
      e.preventDefault()
      const mover = (ev) => this.buscar((ev.clientX - conteudo.getBoundingClientRect().left) / this.pxs)
      mover(e)
      conteudo.setPointerCapture(e.pointerId)
      const soltar = () => {
        conteudo.removeEventListener('pointermove', mover)
        conteudo.removeEventListener('pointerup', soltar)
      }
      conteudo.addEventListener('pointermove', mover)
      conteudo.addEventListener('pointerup', soltar)
    })
    const rolo = $('#rolo')
    rolo.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        this.zoom(e.deltaY < 0 ? 1.25 : 0.8, e.clientX - rolo.getBoundingClientRect().left)
      } else if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && rolo.scrollWidth > rolo.clientWidth) {
        e.preventDefault()
        rolo.scrollLeft += e.deltaY
      }
    }, { passive: false })
  }

  clique(e) {
    if (e.target === this.video) return this.alternar()
    const b = e.target.closest('button, a, [data-ir]')
    const editor = e.target.closest('.editor')
    if (!b || (editor && !editor.contains(b))) return // dentro do campo de comentário, só os botões dele
    if (b.tagName === 'BUTTON') b.blur()
    const d = b.dataset
    if (d.acao) return this.acao(d.acao)
    if (d.vel) {
      this.video.playbackRate = +d.vel
      for (const x of $$('[data-vel]')) x.classList.toggle('ativa', x === b)
      return
    }
    if (d.editar) {
      const c = this.rev.comentarios.find((x) => x.id === d.editar)
      return c && this.abrirEditor({ id: c.id, t: c.t, fim: c.fim, responde: c.responde, texto: c.texto })
    }
    if (d.apagar) return this.apagar(d.apagar)
    if (d.responder) {
      const n = this.notas.find((x) => x.id === d.responder)
      return n && this.abrirEditor({ t: n.ini, fim: n.fim ?? null, responde: n.id })
    }
    if (d.marca) return this.selecionar(d.marca, +d.ir)
    if (d.ir != null) {
      const item = b.closest('.item')
      if (window.getSelection()?.toString()) return // selecionando texto
      return this.selecionar(item?.dataset.id || item?.dataset.nota || null, +d.ir)
    }
  }

  acao(nome) {
    const a = {
      tocar: () => this.alternar(),
      'quadro-': () => this.passo(-QUADRO),
      'quadro+': () => this.passo(QUADRO),
      'seg-': () => this.passo(-1),
      'seg+': () => this.passo(1),
      comentar: () => this.comentarPonto(),
      entrada: () => this.marcarEntrada(),
      saida: () => this.marcarSaida(),
      'zoom-': () => this.zoom(1 / 1.6),
      'zoom+': () => this.zoom(1.6),
      cancelar: () => this.fecharEditor(),
      'salvar-editor': () => this.salvarEditor(),
      aprovar: () => this.aprovar(),
      copiar: () => this.copiarRevisao(),
    }[nome]
    a?.()
  }

  tecla(e) {
    if (modalAberto()) return
    const campo = e.target.closest?.('input, textarea, select, [contenteditable]')
    if (campo) {
      if (campo.id === 'editor-texto' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault()
        this.salvarEditor()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        if (campo.id === 'editor-texto') this.fecharEditor()
        else campo.blur()
      }
      return
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key
    const f = {
      ' ': () => this.alternar(),
      ArrowLeft: () => this.passo(e.shiftKey ? -1 : -QUADRO),
      ArrowRight: () => this.passo(e.shiftKey ? 1 : QUADRO),
      c: () => this.comentarPonto(),
      i: () => this.marcarEntrada(),
      o: () => this.marcarSaida(),
      Escape: () => {
        if (this.editor) this.fecharEditor()
        else if (this.entrada != null) {
          this.entrada = null
          this.renderMarcas()
        } else if (this.sel) this.selecionar(null)
      },
    }[k]
    if (f) {
      e.preventDefault()
      f()
    }
  }

  fechar() {
    this.fechado = true
    if (this.sujo) this.salvar(true)
    clearInterval(this.relogio)
    clearTimeout(this.timer)
    cancelAnimationFrame(this.raf)
    window.removeEventListener('keydown', this.teclas)
    window.removeEventListener('resize', this.redim)
    window.removeEventListener('pagehide', this.saida)
    $('#barra-extra').removeEventListener('click', this.cliques)
    this.video.pause()
    this.video.removeAttribute('src')
    this.video.load()
  }
}
