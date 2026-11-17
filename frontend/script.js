// Concurseiros Conecta — frontend (N2)
// Navegação entre telas + integração com a API REST e o chat via Socket.IO.

const App = (() => {

  // Se a página foi aberta pelo próprio servidor (http://localhost:3000) usa a mesma origem;
  // se foi aberta como arquivo, aponta para o backend local.
  // Usa a mesma origem só quando a página vem do próprio backend (porta 3000).
  // Aberta pelo Live Server (ex.: 127.0.0.1:5500) ou como arquivo, aponta para o backend local.
  const API = (location.protocol.startsWith('http') && location.port === '3000') ? location.origin : 'http://localhost:3000';

  const historico = [];
  let usuario = null;        // usuário logado (GET /api/me)
  let socket = null;         // conexão Socket.IO
  let chatAtual = null;      // { id_conexao, outro }
  let concursosCache = [];

  const TELAS = {
    login: 'tela_login',
    cadastro: 'tela_cadastro',
    recuperar_senha: 'tela_senha',
    confirmacao: 'tela_confirmacao',
    home: 'tela_home',
    nova_viagem: 'tela_nova_viagem',
    cadastrar_concurso: 'tela_cadastrar_concurso',
    concursos: 'tela_concursos',
    editar_concurso: 'tela_editar_concurso',
    concurseiros: 'tela_concurseiros',
    conexoes: 'tela_conexoes',
    chat: 'tela_chat',
    configuracoes: 'tela_configuracoes',
    perfil: 'tela_perfil',
  };

  const NAV_CONFIG = {
    home: 'nav-home',
    nova_viagem: 'nav-home',
    cadastrar_concurso: 'nav-concursos',
    concursos: 'nav-concursos',
    editar_concurso: 'nav-concursos',
    concurseiros: 'nav-concurseiros',
    conexoes: 'nav-conexoes',
    chat: 'nav-conexoes',
    configuracoes: 'nav-configuracoes',
    perfil: 'nav-configuracoes',
  };

  const TELAS_PUBLICAS = ['login', 'cadastro', 'recuperar_senha', 'confirmacao'];

  // Ao abrir certas telas, carrega os dados da API.
  const AO_ABRIR = {
    home: () => { atualizarSaudacao(); carregarHome(); },
    nova_viagem: () => prepararNovaViagem(),
    cadastrar_concurso: () => carregarBancas(),
    concursos: () => verTodosConcursos(),
    concurseiros: () => carregarConcurseiros(),
    conexoes: () => carregarConexoes(),
    configuracoes: () => preencherConfiguracoes(),
    perfil: () => carregarPerfil(),
  };

  // ── Utilidades ──────────────────────────────────────────────

  const $ = (id) => document.getElementById(id);

  // Escapa texto digitado por usuários antes de colocar no HTML.
  const esc = (valor) => String(valor ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  const dataBR = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—');
  const horaBR = (iso) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const isoDia = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');

  const storage = {
    get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* sem storage */ } },
    del: (k) => { try { sessionStorage.removeItem(k); } catch { /* sem storage */ } },
  };
  let tokenMemoria = null;
  const getToken = () => tokenMemoria || storage.get('cc_token');
  const setToken = (t) => { tokenMemoria = t; if (t) storage.set('cc_token', t); else storage.del('cc_token'); };

  function mostrarMsg(id, texto, tipo = 'erro') {
    const el = $(id);
    if (!el) return;
    el.textContent = texto || '';
    el.className = `msg ${texto ? tipo : ''}`;
  }

  // Chamada à API com token e tratamento de erro padronizado.
  async function api(caminho, { method = 'GET', body } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    let resposta;
    try {
      resposta = await fetch(API + caminho, { method, headers, body: body ? JSON.stringify(body) : undefined });
    } catch {
      throw Object.assign(new Error('Não foi possível falar com o servidor. Ele está rodando?'), { status: 0 });
    }
    const dados = await resposta.json().catch(() => null);
    if (dados === null) {
      throw Object.assign(new Error(`O servidor respondeu ${resposta.status} sem dados. Abra o app em ${API}`), { status: resposta.status });
    }
    if (resposta.status === 401 && !TELAS_PUBLICAS.includes(historico[historico.length - 1])) {
      sairSemConfirmar('Sua sessão expirou. Entre novamente.');
    }
    if (!resposta.ok) {
      throw Object.assign(new Error(dados.error || 'Erro inesperado.'), { status: resposta.status, dados });
    }
    return dados;
  }

  function maskCPF(input) {
    const d = input.value.replace(/\D/g, '').slice(0, 11);
    input.value = d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }

  // ── Navegação ───────────────────────────────────────────────

  function ir(nomeTela) {
    const idAlvo = TELAS[nomeTela];
    if (!idAlvo) { console.warn(`[App] Tela desconhecida: "${nomeTela}"`); return; }
    if (!TELAS_PUBLICAS.includes(nomeTela) && !getToken()) { nomeTela = 'login'; }

    document.querySelectorAll('.tela').forEach((el) => el.classList.remove('ativa'));
    $(TELAS[nomeTela]).classList.add('ativa');

    const nav = $('bottom-nav');
    if (NAV_CONFIG[nomeTela]) {
      nav.classList.add('visivel');
      nav.querySelectorAll('button').forEach((b) => b.classList.remove('nav-ativo'));
      let ativo = $(NAV_CONFIG[nomeTela]);
      // No celular o item "Concursos" fica escondido: destaca "Config." no lugar.
      if (ativo && !ativo.offsetParent) ativo = $('nav-configuracoes');
      if (ativo) ativo.classList.add('nav-ativo');
    } else {
      nav.classList.remove('visivel');
    }

    if (nomeTela !== 'chat') chatAtual = null;
    if (historico[historico.length - 1] !== nomeTela) historico.push(nomeTela);
    const vp = $('app-viewport');
    if (vp) vp.scrollTop = 0;

    if (AO_ABRIR[nomeTela]) AO_ABRIR[nomeTela]();
  }

  function voltar() {
    historico.pop();
    const anterior = historico.pop() || (getToken() ? 'home' : 'login');
    ir(anterior);
  }

  // ── Autenticação (US01) ─────────────────────────────────────

  async function entrar(e) {
    e.preventDefault();
    mostrarMsg('msg-login', '');
    const email = $('login-email').value.trim();
    const senha = $('login-senha').value;
    if (!email || !senha) { mostrarMsg('msg-login', 'Informe e-mail e senha.'); return; }
    try {
      const { token, usuario: u } = await api('/api/auth/login', { method: 'POST', body: { email, senha } });
      setToken(token);
      usuario = u;
      atualizarNavUsuario();
      $('form-login').reset();
      conectarChat();
      historico.length = 0;
      ir('home');
    } catch (err) {
      mostrarMsg('msg-login', err.message);
    }
  }

  async function cadastrar(e) {
    e.preventDefault();
    mostrarMsg('msg-cadastro', '');
    const corpo = {
      nome: $('cad-nome').value.trim(),
      email: $('cad-email').value.trim(),
      cpf: $('cad-cpf').value,
      senha: $('cad-senha').value,
      confirmarSenha: $('cad-confirmar').value,
    };
    if (corpo.senha !== corpo.confirmarSenha) { mostrarMsg('msg-cadastro', 'As senhas não conferem.'); return; }
    try {
      await api('/api/auth/cadastro', { method: 'POST', body: corpo });
      $('form-cadastro').reset();
      ir('login');
      $('login-email').value = corpo.email;
      mostrarMsg('msg-login', 'Conta criada! Agora é só entrar.', 'ok');
    } catch (err) {
      mostrarMsg('msg-cadastro', err.message);
    }
  }

  async function recuperarSenha(e) {
    e.preventDefault();
    mostrarMsg('msg-senha', '');
    const novaSenha = $('rec-senha').value;
    if (novaSenha !== $('rec-confirmar').value) { mostrarMsg('msg-senha', 'As senhas não conferem.'); return; }
    try {
      await api('/api/auth/recuperar-senha', {
        method: 'POST',
        body: { email: $('rec-email').value.trim(), cpf: $('rec-cpf').value, novaSenha },
      });
      $('form-senha').reset();
      sairSemConfirmar();
      ir('confirmacao');
    } catch (err) {
      mostrarMsg('msg-senha', err.message);
    }
  }

  function sairSemConfirmar(aviso) {
    setToken(null);
    usuario = null;
    if (socket) { socket.disconnect(); socket = null; }
    historico.length = 0;
    ir('login');
    if (aviso) mostrarMsg('msg-login', aviso);
  }

  function logout() {
    if (!confirm('Deseja sair da sua conta?')) return;
    sairSemConfirmar();
  }

  async function carregarUsuario() {
    usuario = await api('/api/me');
    atualizarNavUsuario();
    return usuario;
  }

  // Cartão do usuário no menu lateral (versão desktop).
  function atualizarNavUsuario() {
    const box = $('nav-usuario');
    if (!box || !usuario) return;
    box.innerHTML = `
      <span class="avatar-mini">${usuario.foto_url ? `<img src="${esc(usuario.foto_url)}" alt="">` : esc(usuario.nome.charAt(0))}</span>
      <div class="nav-usuario-info">
        <strong>${esc(usuario.nome)}</strong>
        <span>${esc(usuario.email)}</span>
      </div>
      <button type="button" class="nav-sair" onclick="App.logout()" title="Sair">Sair</button>`;
  }

  function atualizarSaudacao() {
    if (!usuario) return;
    const hora = new Date().getHours();
    const cumprimento = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
    $('home-titulo').textContent = `${cumprimento}, ${usuario.nome.split(' ')[0]}!`;
    $('home-saudacao').textContent = 'Para onde é a próxima prova?';
  }

  // ── Perfil e privacidade (US02 / US03 / US04 / US08) ────────

  async function preencherConfiguracoes() {
    try {
      const u = await carregarUsuario();
      $('config-nome').textContent = u.nome;
      $('config-email').textContent = u.email;
      const avatar = $('config-avatar');
      avatar.innerHTML = u.foto_url
        ? `<img src="${esc(u.foto_url)}" alt="Foto de ${esc(u.nome)}">`
        : esc(u.nome.charAt(0).toUpperCase());
    } catch { /* tratado em api() */ }
  }

  async function carregarPerfil() {
    mostrarMsg('msg-perfil', '');
    try {
      const u = await carregarUsuario();
      $('perfil-nome').value = u.nome || '';
      $('perfil-cidade').value = u.cidade || '';
      $('perfil-estado').value = u.estado || '';
      $('perfil-foto').value = u.foto_url || '';
      $('perfil-bio').value = u.bio || '';
      const p = u.preferencia || {};
      $('pref-publico').checked = p.perfil_publico !== false;
      $('pref-solicitacoes').checked = p.receber_solicitacoes !== false;
      $('pref-mensagens').checked = p.permitir_mensagens !== false;
    } catch (err) {
      mostrarMsg('msg-perfil', err.message);
    }
  }

  async function salvarPerfil(e) {
    e.preventDefault();
    mostrarMsg('msg-perfil', '');
    try {
      await api('/api/me', {
        method: 'PUT',
        body: {
          nome: $('perfil-nome').value,
          cidade: $('perfil-cidade').value,
          estado: $('perfil-estado').value,
          foto_url: $('perfil-foto').value,
          bio: $('perfil-bio').value,
        },
      });
      await api('/api/me/privacidade', {
        method: 'PUT',
        body: {
          perfil_publico: $('pref-publico').checked,
          receber_solicitacoes: $('pref-solicitacoes').checked,
          permitir_mensagens: $('pref-mensagens').checked,
        },
      });
      await carregarUsuario();
      mostrarMsg('msg-perfil', 'Perfil salvo!', 'ok');
    } catch (err) {
      mostrarMsg('msg-perfil', err.message);
    }
  }

  // ── Viagens (US05 / US06) ───────────────────────────────────

  const TRANSPORTE = { onibus: 'Ônibus', carro: 'Carro', carona: 'Carona', aviao: 'Avião', outro: 'Outro' };

  async function carregarViagens() {
    try { renderizarViagens(await api('/api/viagens')); } catch (err) {
      $('viagens-container').innerHTML = `<p class="msg erro">${esc(err.message)}</p>`;
    }
  }

  function renderizarViagens(viagens) {
    const box = $('viagens-container');
    {
      if (!viagens.length) {
        box.innerHTML = '<p class="vazio">Você ainda não planejou nenhuma viagem.</p>';
        return;
      }
      box.innerHTML = viagens.map((v) => `
        <div class="item-lista ${v.status === 'cancelada' ? 'cancelada' : ''}">
          <div class="item-topo">
            <strong>${esc(v.concurso.cargo)}</strong>
            <span class="tag tag-${esc(v.status)}">${esc(v.status)}</span>
          </div>
          <p>${esc(v.cidade_origem)} → ${esc(v.concurso.local || 'local a definir')}</p>
          <p>Ida ${dataBR(v.data_ida)}${v.data_volta ? ` · Volta ${dataBR(v.data_volta)}` : ''} · Prova ${dataBR(v.concurso.data)}</p>
          ${v.transporte ? `<p>Transporte: ${esc(TRANSPORTE[v.transporte] || v.transporte)}</p>` : ''}
          ${v.hospedagem ? `<p>Hospedagem: ${esc(v.hospedagem)}</p>` : ''}
          ${v.conflito_datas ? '<p class="aviso">⚠ Salva com conflito de datas</p>' : ''}
          <div class="card-acoes">
            ${v.status === 'planejada' ? `<button type="button" class="btn-sm" data-acao="confirmar-viagem" data-id="${v.id_viagem}">Confirmar</button>` : ''}
            ${v.status !== 'cancelada' ? `<button type="button" class="btn-sm btn-sec" data-acao="cancelar-viagem" data-id="${v.id_viagem}">Cancelar</button>` : ''}
            <button type="button" class="btn-sm btn-excluir" data-acao="excluir-viagem" data-id="${v.id_viagem}">Excluir</button>
          </div>
        </div>`).join('');
    }
  }

  // ── Painel da Home ──────────────────────────────────────────

  const diasAte = (iso) => {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const alvo = new Date(isoDia(iso) + 'T00:00:00');
    return Math.round((alvo - hoje) / 86400000);
  };

  function stat(icone, valor, rotulo, acao) {
    return `<button type="button" class="stat" ${acao ? `data-acao="${acao}"` : 'disabled'}>
      <span class="stat-icone" aria-hidden="true">${icone}</span>
      <span class="stat-valor">${valor}</span>
      <span class="stat-rotulo">${rotulo}</span>
    </button>`;
  }

  async function carregarHome() {
    try {
      const [viagens, conexoes] = await Promise.all([api('/api/viagens'), api('/api/conexoes')]);
      renderizarViagens(viagens);
      atualizarBadge(conexoes.recebidas.length);

      const ativas = viagens.filter((v) => v.status !== 'cancelada');
      const futuras = ativas
        .filter((v) => v.concurso.data && diasAte(v.concurso.data) >= 0)
        .sort((a, b) => new Date(a.concurso.data) - new Date(b.concurso.data));
      const proxima = futuras[0];
      const dias = proxima ? diasAte(proxima.concurso.data) : null;

      $('home-stats').innerHTML = [
        stat('🧳', ativas.length, ativas.length === 1 ? 'viagem planejada' : 'viagens planejadas', 'ir-nova-viagem'),
        stat('⏳', proxima ? (dias === 0 ? 'Hoje' : dias) : '—', proxima ? (dias === 0 ? 'é o dia da prova!' : `dia${dias === 1 ? '' : 's'} até a próxima prova`) : 'nenhuma prova marcada'),
        stat('🤝', conexoes.aceitas.length, conexoes.aceitas.length === 1 ? 'conexão' : 'conexões', 'ir-conexoes'),
        stat('📩', conexoes.recebidas.length, conexoes.recebidas.length === 1 ? 'convite pendente' : 'convites pendentes', 'ir-conexoes'),
      ].join('');

      const caixa = $('home-proxima');
      if (proxima) {
        caixa.hidden = false;
        caixa.innerHTML = `
          <div class="proxima-info">
            <p class="proxima-rotulo">Próxima prova</p>
            <h2>${esc(proxima.concurso.cargo)}</h2>
            <p>${esc(proxima.concurso.bancaRef?.nome || '')} · ${dataBR(proxima.concurso.data)} · ${esc(proxima.concurso.local || 'local a definir')}</p>
            <p class="sub">Saindo de ${esc(proxima.cidade_origem)} em ${dataBR(proxima.data_ida)}${proxima.transporte ? ` · ${esc(TRANSPORTE[proxima.transporte] || proxima.transporte)}` : ''}${proxima.hospedagem ? ` · ${esc(proxima.hospedagem)}` : ''}</p>
          </div>
          <div class="proxima-contador"><strong>${dias === 0 ? 'Hoje' : dias}</strong><span>${dias === 0 ? '' : dias === 1 ? 'dia' : 'dias'}</span></div>`;
      } else {
        caixa.hidden = false;
        caixa.innerHTML = `
          <div class="proxima-info">
            <p class="proxima-rotulo">Próxima prova</p>
            <h2>Nenhuma prova planejada ainda</h2>
            <p class="sub">Planeje sua viagem para ver a contagem regressiva e quem vai fazer a mesma prova.</p>
          </div>
          <button type="button" class="btn-proxima" data-acao="ir-nova-viagem">+ Planejar viagem</button>`;
      }

      // Conversas recentes
      $('home-conversas').innerHTML = conexoes.aceitas.slice(0, 4).map((c) => `
        <div class="mini-linha">
          <span class="avatar-mini">${c.outro.foto_url ? `<img src="${esc(c.outro.foto_url)}" alt="">` : esc(c.outro.nome.charAt(0))}</span>
          <div class="mini-info"><strong>${esc(c.outro.nome)}</strong><span>${esc([c.outro.cidade, c.outro.estado].filter(Boolean).join(' / '))}</span></div>
          <button type="button" class="btn-sm" data-acao="abrir-chat" data-id="${c.id_conexao}" data-nome="${esc(c.outro.nome)}">Chat</button>
        </div>`).join('') || '<p class="vazio">Conecte-se com alguém para conversar.</p>';

      // Quem vai à mesma prova
      const sug = $('home-sugestoes');
      if (!proxima) {
        sug.innerHTML = '<p class="vazio">Planeje uma viagem para ver quem vai à mesma prova.</p>';
      } else {
        const pessoas = await api(`/api/concurseiros?id_concurso=${proxima.id_concurso}`);
        sug.innerHTML = pessoas.slice(0, 4).map((p) => `
          <div class="mini-linha">
            <span class="avatar-mini">${p.foto_url ? `<img src="${esc(p.foto_url)}" alt="">` : esc(p.nome.charAt(0))}</span>
            <div class="mini-info"><strong>${esc(p.nome)}</strong><span>${esc([p.cidade, p.estado].filter(Boolean).join(' / ') || '—')}</span></div>
            ${BOTAO_CONEXAO[p.situacao](p)}
          </div>`).join('') || '<p class="vazio">Ninguém mais marcou essa prova ainda.</p>';
      }
    } catch (err) {
      $('viagens-container').innerHTML = `<p class="msg erro">${esc(err.message)}</p>`;
    }
  }

  async function carregarConcursosSelect() {
    concursosCache = await api('/api/concursos');
    const sel = $('via-concurso');
    sel.innerHTML = '<option value="">Selecione o concurso</option>' + concursosCache.map((c) => (
      `<option value="${c.id_concurso}">${esc(c.cargo)} — ${dataBR(c.data)}</option>`
    )).join('');
  }

  async function prepararNovaViagem() {
    mostrarMsg('msg-viagem', '');
    try { await carregarConcursosSelect(); } catch (err) { mostrarMsg('msg-viagem', err.message); }
    if (usuario?.cidade && !$('via-origem').value) $('via-origem').value = usuario.cidade;
  }

  async function salvarViagem(e, confirmarConflito = false) {
    if (e) e.preventDefault();
    mostrarMsg('msg-viagem', '');
    const corpo = {
      id_concurso: $('via-concurso').value,
      cidade_origem: $('via-origem').value.trim(),
      data_ida: $('via-ida').value,
      data_volta: $('via-volta').value || null,
      transporte: $('via-transporte').value,
      hospedagem: $('via-hospedagem').value,
      observacoes: $('via-obs').value,
    };
    if (!corpo.id_concurso) { mostrarMsg('msg-viagem', 'Selecione o concurso.'); return; }
    if (confirmarConflito) corpo.confirmar_conflito = true;

    try {
      await api('/api/viagens', { method: 'POST', body: corpo });
      $('form-viagem').reset();
      historico.pop();
      ir('home');
    } catch (err) {
      if (err.dados?.code === 'CONFLITO_DATAS') {
        const lista = err.dados.detalhes.map((d) => `• ${d.concurso} (prova ${dataBR(d.data_prova)})`).join('\n');
        if (confirm(`Conflito de datas!\nVocê já tem viagem para:\n${lista}\n\nDeseja salvar mesmo assim?`)) {
          salvarViagem(null, true);
        } else {
          mostrarMsg('msg-viagem', 'Viagem não salva por conflito de datas.');
        }
        return;
      }
      mostrarMsg('msg-viagem', err.message);
    }
  }

  async function mudarStatusViagem(id, status) {
    try {
      await api(`/api/viagens/${id}`, { method: 'PUT', body: { status, confirmar_conflito: true } });
      carregarHome();
    } catch (err) { alert(err.message); }
  }

  async function excluirViagem(id) {
    if (!confirm('Excluir esta viagem?')) return;
    try {
      await api(`/api/viagens/${id}`, { method: 'DELETE' });
      carregarHome();
    } catch (err) { alert(err.message); }
  }

  // ── Concursos (N1, agora com login para gravar) ─────────────

  async function carregarBancas() {
    try {
      const bancas = await api('/api/bancas');
      document.querySelectorAll('.select-banca').forEach((sel) => {
        const atual = sel.value;
        sel.innerHTML = '<option value="">Selecione a banca</option>'
          + bancas.map((b) => `<option value="${b.id_banca}">${esc(b.nome)}</option>`).join('');
        if (atual) sel.value = atual;
      });
    } catch (err) { console.error(err); }
  }

  async function cadastrarConcurso(e) {
    e.preventDefault();
    const body = {
      cargo: $('cargo').value.trim(),
      id_banca: $('banca').value,
      local: $('local').value.trim(),
      url_edital: $('url_edital').value.trim(),
      data: $('data_prova').value,
    };
    if (!body.cargo || !body.id_banca || !body.local || !body.data || !body.url_edital) {
      alert('Por favor, preencha todos os campos.');
      return;
    }
    try {
      await api('/api/concursos', { method: 'POST', body });
      alert('Concurso cadastrado com sucesso!');
      $('form-concurso').reset();
      voltar();
    } catch (err) { alert(err.message); }
  }

  function renderizarConcursos(concursos) {
    $('concursos-container').innerHTML = concursos.map((c) => `
      <div class="concurso-card">
        <h3>${esc(c.cargo)}</h3>
        <p><strong>ID:</strong> ${c.id_concurso}</p>
        <p><strong>Banca:</strong> ${esc(c.bancaRef ? c.bancaRef.nome : 'N/A')}</p>
        <p><strong>Local:</strong> ${esc(c.local || 'N/A')}</p>
        <p><strong>Data:</strong> ${dataBR(c.data)}</p>
        <p><strong>Edital:</strong> ${c.url_edital ? `<a href="${esc(c.url_edital)}" target="_blank" rel="noopener">Link</a>` : 'N/A'}</p>
        <div class="card-acoes">
          <button type="button" class="btn-editar" data-id="${c.id_concurso}">Editar</button>
          <button type="button" class="btn-excluir" data-id="${c.id_concurso}">Excluir</button>
        </div>
      </div>`).join('') || '<p class="vazio">Nenhum concurso cadastrado.</p>';
  }

  async function verTodosConcursos() {
    try { renderizarConcursos(await api('/api/concursos')); } catch (err) { alert(err.message); }
  }

  async function buscarConcursoPorId() {
    const id = $('input-busca-id').value.trim();
    if (!id) { alert('Informe o ID do concurso.'); return; }
    try { renderizarConcursos([await api(`/api/concursos/${encodeURIComponent(id)}`)]); } catch (err) { alert(err.message); }
  }

  async function excluirConcurso(id) {
    if (!confirm('Deseja realmente excluir este concurso?')) return;
    try {
      await api(`/api/concursos/${id}`, { method: 'DELETE' });
      const card = document.querySelector(`.btn-excluir[data-id="${id}"]`)?.closest('.concurso-card');
      if (card) card.remove();
    } catch (err) { alert(err.message); }
  }

  async function abrirEdicaoConcurso(id) {
    ir('editar_concurso');
    await carregarBancas();
    try {
      const c = await api(`/api/concursos/${id}`);
      $('editar_id_concurso').value = c.id_concurso;
      $('editar_cargo').value = c.cargo || '';
      $('editar_banca').value = c.id_banca;
      $('editar_local').value = c.local || '';
      $('editar_url_edital').value = c.url_edital || '';
      $('editar_data_prova').value = isoDia(c.data);
    } catch (err) { alert(err.message); }
  }

  async function salvarEdicao(e) {
    e.preventDefault();
    const id = $('editar_id_concurso').value;
    try {
      await api(`/api/concursos/${id}`, {
        method: 'PUT',
        body: {
          cargo: $('editar_cargo').value.trim(),
          id_banca: $('editar_banca').value,
          local: $('editar_local').value.trim(),
          url_edital: $('editar_url_edital').value.trim(),
          data: $('editar_data_prova').value,
        },
      });
      alert('Concurso atualizado com sucesso!');
      ir('concursos');
      verTodosConcursos();
    } catch (err) { alert(err.message); }
  }

  // ── Concurseiros (US07 / US09) ──────────────────────────────

  const BOTAO_CONEXAO = {
    nenhuma: (p) => (p.aceita_solicitacoes
      ? `<button type="button" class="btn-sm" data-acao="conectar" data-id="${p.id_usuario}">Conectar</button>`
      : '<span class="tag">Não recebe convites</span>'),
    pendente_enviada: () => '<span class="tag tag-pendente">Solicitação enviada</span>',
    pendente_recebida: () => '<button type="button" class="btn-sm btn-sec" data-acao="ir-conexoes">Responder convite</button>',
    aceita: (p) => `<button type="button" class="btn-sm" data-acao="abrir-chat" data-id="${p.id_conexao}" data-nome="${esc(p.nome)}">Conversar</button>`,
    recusada: (p) => `<button type="button" class="btn-sm btn-sec" data-acao="conectar" data-id="${p.id_usuario}">Tentar de novo</button>`,
  };

  async function carregarChipsCargos(cargoAtual) {
    try {
      if (!concursosCache.length) concursosCache = await api('/api/concursos');
      const cargos = [...new Set(concursosCache.map((c) => c.cargo))];
      $('chips-cargos').innerHTML = [
        `<button type="button" class="chip ${cargoAtual ? '' : 'ativo'}" data-acao="filtro-cargo" data-cargo="">Todos</button>`,
        ...cargos.map((c) => `<button type="button" class="chip ${cargoAtual === c ? 'ativo' : ''}" data-acao="filtro-cargo" data-cargo="${esc(c)}">${esc(c)}</button>`),
      ].join('');
    } catch { /* chips são opcionais */ }
  }

  async function carregarConcurseiros() {
    const box = $('concurseiros-container');
    const cargo = $('filtro-cargo').value.trim();
    box.innerHTML = '<p class="vazio">Carregando...</p>';
    carregarChipsCargos(cargo);
    try {
      const lista = await api(`/api/concurseiros${cargo ? `?cargo=${encodeURIComponent(cargo)}` : ''}`);
      $('concurseiros-total').textContent = `${lista.length} concurseiro${lista.length === 1 ? '' : 's'} encontrado${lista.length === 1 ? '' : 's'}${cargo ? ` para "${cargo}"` : ''}`;
      if (!lista.length) {
        box.innerHTML = `<p class="vazio">Ninguém encontrado${cargo ? ` para "${esc(cargo)}"` : ''}.</p>`;
        return;
      }
      box.innerHTML = lista.map((p) => `
        <div class="card pessoa">
          <div class="pessoa-topo">
            <span class="avatar-mini">${p.foto_url ? `<img src="${esc(p.foto_url)}" alt="">` : esc(p.nome.charAt(0))}</span>
            <div>
              <strong>${esc(p.nome)}</strong>
              <p class="sub">${esc([p.cidade, p.estado].filter(Boolean).join(' / ') || 'Cidade não informada')}</p>
            </div>
          </div>
          ${p.bio ? `<p>${esc(p.bio)}</p>` : ''}
          ${p.concursos.length ? `<p class="sub">Provas: ${p.concursos.map((c) => esc(c.cargo)).join(', ')}</p>` : ''}
          <div class="card-acoes">${BOTAO_CONEXAO[p.situacao](p)}</div>
        </div>`).join('');
    } catch (err) {
      box.innerHTML = `<p class="msg erro">${esc(err.message)}</p>`;
    }
  }

  function buscarConcurseiros(e) {
    e.preventDefault();
    carregarConcurseiros();
  }

  async function conectar(idUsuario) {
    try {
      await api('/api/conexoes', { method: 'POST', body: { id_destinatario: Number(idUsuario) } });
      if (historico[historico.length - 1] === 'home') carregarHome(); else carregarConcurseiros();
    } catch (err) { alert(err.message); }
  }

  // ── Conexões (US10 / RF09) ──────────────────────────────────

  const linhaPessoa = (c, acoes) => `
    <div class="item-lista">
      <div class="item-topo"><strong>${esc(c.outro.nome)}</strong>${c.status !== 'aceita' ? `<span class="tag tag-${esc(c.status)}">${esc(c.status)}</span>` : ''}</div>
      <p class="sub">${esc([c.outro.cidade, c.outro.estado].filter(Boolean).join(' / '))}</p>
      ${acoes ? `<div class="card-acoes">${acoes}</div>` : ''}
    </div>`;

  async function carregarConexoes() {
    try {
      const { recebidas, aceitas, enviadas } = await api('/api/conexoes');
      $('conexoes-recebidas').innerHTML = recebidas.map((c) => linhaPessoa(c, `
          <button type="button" class="btn-sm" data-acao="aceitar" data-id="${c.id_conexao}">Aceitar</button>
          <button type="button" class="btn-sm btn-sec" data-acao="recusar" data-id="${c.id_conexao}">Recusar</button>`)).join('')
        || '<p class="vazio">Nenhuma solicitação nova.</p>';
      $('conexoes-aceitas').innerHTML = aceitas.map((c) => linhaPessoa(c,
        `<button type="button" class="btn-sm" data-acao="abrir-chat" data-id="${c.id_conexao}" data-nome="${esc(c.outro.nome)}">Abrir chat</button>`)).join('')
        || '<p class="vazio">Você ainda não tem conexões.</p>';
      $('conexoes-enviadas').innerHTML = enviadas.map((c) => linhaPessoa(c, '')).join('')
        || '<p class="vazio">Nenhuma solicitação enviada.</p>';
      atualizarBadge(recebidas.length);
    } catch (err) {
      $('conexoes-recebidas').innerHTML = `<p class="msg erro">${esc(err.message)}</p>`;
    }
  }

  async function responderConexao(id, status) {
    try {
      await api(`/api/conexoes/${id}`, { method: 'PATCH', body: { status } });
      carregarConexoes();
    } catch (err) { alert(err.message); }
  }

  async function atualizarBadge(qtd) {
    try {
      const n = qtd ?? (await api('/api/conexoes')).recebidas.length;
      $('badge-conexoes').textContent = n ? String(n) : '';
    } catch { /* ignora */ }
  }

  // ── Chat em tempo real (RF10) ───────────────────────────────

  function carregarSocketIO() {
    return new Promise((resolve, reject) => {
      if (window.io) { resolve(); return; }
      const s = document.createElement('script');
      s.src = `${API}/socket.io/socket.io.js`;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Não foi possível carregar o chat.'));
      document.head.appendChild(s);
    });
  }

  async function conectarChat() {
    if (socket || !getToken()) return;
    try {
      await carregarSocketIO();
      socket = window.io(API, { auth: { token: getToken() } });
      socket.on('connect', () => {
        $('chat-status').textContent = 'online';
        if (chatAtual) socket.emit('entrar_conexao', { id_conexao: chatAtual.id_conexao }, () => {});
      });
      socket.on('disconnect', () => { $('chat-status').textContent = 'reconectando...'; });
      socket.on('connect_error', (err) => { $('chat-status').textContent = err.message; });
      socket.on('receber_mensagem', (m) => {
        if (chatAtual && m.id_conexao === chatAtual.id_conexao) adicionarMensagem(m);
      });
    } catch (err) {
      console.error(err);
    }
  }

  function adicionarMensagem(m) {
    const box = $('chat-mensagens');
    if (box.querySelector(`[data-msg="${m.id_mensagem}"]`)) return;
    const minha = usuario && m.id_remetente === usuario.id_usuario;
    const div = document.createElement('div');
    div.className = `bolha ${minha ? 'minha' : 'dele'}`;
    div.dataset.msg = m.id_mensagem;
    div.innerHTML = `${esc(m.conteudo)}<span class="hora">${horaBR(m.data_envio)}</span>`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  }

  async function abrirChat(idConexao, nome) {
    if (!usuario) await carregarUsuario();
    ir('chat');
    chatAtual = { id_conexao: Number(idConexao) };
    $('chat-nome').textContent = nome || 'Conversa';
    $('chat-mensagens').innerHTML = '';
    mostrarMsg('msg-chat', '');
    await conectarChat();
    $('chat-status').textContent = socket?.connected ? 'online' : 'conectando...';
    if (socket?.connected) socket.emit('entrar_conexao', { id_conexao: chatAtual.id_conexao }, () => {});
    try {
      const historicoMsg = await api(`/api/conexoes/${idConexao}/mensagens`);
      historicoMsg.forEach(adicionarMensagem);
      if (!historicoMsg.length) $('chat-mensagens').innerHTML = '<p class="vazio">Diga oi! 👋</p>';
    } catch (err) {
      mostrarMsg('msg-chat', err.message);
    }
    $('chat-texto').focus();
  }

  function enviarMensagem(e) {
    e.preventDefault();
    const campo = $('chat-texto');
    const conteudo = campo.value.trim();
    if (!conteudo || !chatAtual) return;
    mostrarMsg('msg-chat', '');
    const vazio = $('chat-mensagens').querySelector('.vazio');
    if (vazio) vazio.remove();

    const tratar = (r) => {
      if (r.ok) { campo.value = ''; adicionarMensagem(r.mensagem); } else { mostrarMsg('msg-chat', r.error); }
    };
    if (socket?.connected) {
      socket.emit('enviar_mensagem', { id_conexao: chatAtual.id_conexao, conteudo }, tratar);
    } else {
      // Sem WebSocket, usa a rota REST equivalente (mesmas validações no servidor).
      api(`/api/conexoes/${chatAtual.id_conexao}/mensagens`, { method: 'POST', body: { conteudo } })
        .then((mensagem) => tratar({ ok: true, mensagem }))
        .catch((err) => tratar({ ok: false, error: err.message }));
    }
  }

  // ── Modo de visualização: celular ou desktop ────────────────

  function aplicarModo(modo) {
    const desktop = modo === 'desktop';
    document.body.classList.toggle('modo-desktop', desktop);
    document.querySelectorAll('.modo-toggle button').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.modo === modo));
    });
    try { localStorage.setItem('cc_modo', modo); } catch { /* sem storage */ }
  }

  function modoInicial() {
    const daUrl = new URLSearchParams(location.search).get('modo');
    if (daUrl === 'desktop' || daUrl === 'mobile') return daUrl;
    try { return localStorage.getItem('cc_modo') || 'mobile'; } catch { return 'mobile'; }
  }

  // ── Init ────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', async () => {
    aplicarModo(modoInicial());
    document.querySelectorAll('.modo-toggle button').forEach((b) => {
      b.addEventListener('click', () => aplicarModo(b.dataset.modo));
    });

    $('btn-ver-todos').addEventListener('click', verTodosConcursos);
    $('btn-buscar-id').addEventListener('click', buscarConcursoPorId);

    // Delegação de cliques dos botões gerados dinamicamente.
    document.addEventListener('click', (ev) => {
      const alvo = ev.target.closest('button');
      if (!alvo) return;
      const { acao, id, nome } = alvo.dataset;
      if (alvo.classList.contains('btn-editar')) abrirEdicaoConcurso(id);
      else if (alvo.classList.contains('btn-excluir') && !acao) excluirConcurso(id);
      else if (acao === 'confirmar-viagem') mudarStatusViagem(id, 'confirmada');
      else if (acao === 'cancelar-viagem') mudarStatusViagem(id, 'cancelada');
      else if (acao === 'excluir-viagem') excluirViagem(id);
      else if (acao === 'conectar') conectar(id);
      else if (acao === 'ir-conexoes') ir('conexoes');
      else if (acao === 'aceitar') responderConexao(id, 'aceita');
      else if (acao === 'recusar') responderConexao(id, 'recusada');
      else if (acao === 'abrir-chat') abrirChat(id, nome);
      else if (acao === 'ir-nova-viagem') ir('nova_viagem');
      else if (acao === 'filtro-cargo') { $('filtro-cargo').value = alvo.dataset.cargo; carregarConcurseiros(); }
    });

    if (getToken()) {
      try {
        await carregarUsuario();
        conectarChat();
        ir('home');
        return;
      } catch { setToken(null); }
    }
    ir('login');
    console.log('[App] Concurseiros Conecta iniciado. API:', API);
  });

  return {
    ir, voltar, logout, maskCPF,
    entrar, cadastrar, recuperarSenha,
    salvarPerfil, salvarViagem,
    cadastrarConcurso, salvarEdicao,
    buscarConcurseiros, enviarMensagem,
  };

})();
