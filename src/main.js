// Roteador e Controlador Dinâmico do Dev Shell

const PATH_PREFIX = '/stitch_smart_home_finance_pro/stitch_smart_home_finance_pro';

// Mapeamento das rotas para os arquivos HTML correspondentes
const ROUTES = {
  dashboard: {
    title: 'Dashboard Principal',
    desktop: `${PATH_PREFIX}/dashboard_principal/code.html`,
    mobile: `${PATH_PREFIX}/dashboard_principal_mobile/code.html`
  },
  accounts: {
    title: 'Contas & Cartões',
    desktop: `${PATH_PREFIX}/contas_e_cart_es/code.html`,
    mobile: `${PATH_PREFIX}/contas_e_cart_es_mobile_2/code.html`, // Inglês como padrão
    mobile_pt: `${PATH_PREFIX}/contas_e_cart_es_mobile_1/code.html` // Português como opção
  },
  investments: {
    title: 'Investimentos',
    desktop: `${PATH_PREFIX}/gest_o_avan_ada_de_investimentos/code.html`, // Gestão Avançada
    desktop_alt: `${PATH_PREFIX}/investimentos_e_relat_rios/code.html`, // Alternativo
    mobile: `${PATH_PREFIX}/investimentos_mobile/code.html`
  },
  planning: {
    title: 'Planejamento Orçamentário',
    desktop: `${PATH_PREFIX}/planejamento_or_ament_rio/code.html`,
    mobile: `${PATH_PREFIX}/planejamento_or_ament_rio_mobile/code.html`
  },
  goals: {
    title: 'Metas Financeiras',
    desktop: `${PATH_PREFIX}/metas_financeiras/code.html`,
    mobile: `${PATH_PREFIX}/metas_financeiras_mobile/code.html`
  },
  reports: {
    title: 'Central de Relatórios',
    desktop: `${PATH_PREFIX}/central_de_relat_rios/code.html`,
    mobile: `${PATH_PREFIX}/central_de_relat_rios_mobile/code.html`
  },
  transactions: {
    title: 'Transações',
    desktop: `${PATH_PREFIX}/transfer_ncia_entre_contas/code.html`, // Transferências
    desktop_alt: `${PATH_PREFIX}/concilia_o_banc_ria/code.html`, // Conciliação
    mobile: `${PATH_PREFIX}/novo_lan_amento_mobile/code.html` // Novo Lançamento
  }
};

// Estados do Dev Shell
let currentRoute = 'dashboard';
let currentViewMode = 'auto'; // 'auto' | 'desktop' | 'mobile'
let accountsLang = 'en'; // 'en' | 'pt'
let investmentsVer = 'adv'; // 'adv' | 'alt'
let transactionsVer = 'transfer'; // 'transfer' | 'concil'

// Referências dos Elementos do DOM
const iframeElement = document.getElementById('viewportFrame');
const selectPageElement = document.getElementById('selectPage');
const viewAutoBtn = document.getElementById('viewAuto');
const viewDesktopBtn = document.getElementById('viewDesktop');
const viewMobileBtn = document.getElementById('viewMobile');
const canvasElement = document.getElementById('displayCanvas');
const emulatorContainer = document.getElementById('emulatorContainer');
const mobileFrameElement = document.getElementById('mobileViewportFrame');
const langSelectorGroup = document.getElementById('langSelectorGroup');
const langSelectElement = document.getElementById('langSelect');
const subOptionsGroup = document.getElementById('subOptionsGroup');
const subOptionsSelect = document.getElementById('subOptionsSelect');
const loadingOverlay = document.getElementById('loadingOverlay');

// Função de Notificação Toast
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.querySelector('.toast-msg').innerText = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Determinar se o dispositivo físico atual é mobile
function isPhysicalMobile() {
  return window.innerWidth < 1024;
}

// Obter a URL correta com base na rota, viewport e opções selecionadas
function getTargetUrl(routeKey, viewMode) {
  const route = ROUTES[routeKey];
  if (!route) return '';

  // Determinar se vamos usar layout de desktop ou mobile
  let useMobile = false;

  if (viewMode === 'mobile') {
    useMobile = true;
  } else if (viewMode === 'desktop') {
    useMobile = false;
  } else {
    // Modo Auto: depende da largura da tela física
    useMobile = isPhysicalMobile();
  }

  if (useMobile) {
    if (routeKey === 'accounts') {
      return accountsLang === 'pt' ? route.mobile_pt : route.mobile;
    }
    return route.mobile || route.desktop;
  } else {
    // Lógica para variações de desktop
    if (routeKey === 'investments') {
      return investmentsVer === 'alt' ? route.desktop_alt : route.desktop;
    }
    if (routeKey === 'transactions') {
      return transactionsVer === 'concil' ? route.desktop_alt : route.desktop;
    }
    return route.desktop;
  }
}

// Atualizar a interface do Dev Shell com base na rota e modo de visualização ativos
function updateUI() {
  // Ajustar botões do Viewport
  [viewAutoBtn, viewDesktopBtn, viewMobileBtn].forEach(btn => btn.classList.remove('active'));
  if (currentViewMode === 'auto') viewAutoBtn.classList.add('active');
  if (currentViewMode === 'desktop') viewDesktopBtn.classList.add('active');
  if (currentViewMode === 'mobile') viewMobileBtn.classList.add('active');

  // Ajustar seletores adicionais de idioma e versão
  langSelectorGroup.classList.remove('visible');
  subOptionsGroup.style.display = 'none';

  if (currentRoute === 'accounts' && (currentViewMode === 'mobile' || (currentViewMode === 'auto' && isPhysicalMobile()))) {
    langSelectorGroup.classList.add('visible');
  }

  if (currentRoute === 'investments' && (currentViewMode === 'desktop' || (currentViewMode === 'auto' && !isPhysicalMobile()))) {
    subOptionsGroup.style.display = 'block';
    subOptionsSelect.innerHTML = `
      <option value="adv" ${investmentsVer === 'adv' ? 'selected' : ''}>Gestão Avançada</option>
      <option value="alt" ${investmentsVer === 'alt' ? 'selected' : ''}>Relatório Simplificado</option>
    `;
  } else if (currentRoute === 'transactions' && (currentViewMode === 'desktop' || (currentViewMode === 'auto' && !isPhysicalMobile()))) {
    subOptionsGroup.style.display = 'block';
    subOptionsSelect.innerHTML = `
      <option value="transfer" ${transactionsVer === 'transfer' ? 'selected' : ''}>Transferência entre Contas</option>
      <option value="concil" ${transactionsVer === 'concil' ? 'selected' : ''}>Conciliação Bancária</option>
    `;
  }

  // Atualizar dropdown de páginas no topo
  selectPageElement.value = currentRoute;

  // Carregar conteúdo
  loadRoute();
}

// Carregar a rota atual nos iframes correspondentes
function loadRoute() {
  loadingOverlay.classList.add('active');
  
  const showMobileEmulator = currentViewMode === 'mobile' && !isPhysicalMobile();
  const url = getTargetUrl(currentRoute, currentViewMode);

  if (showMobileEmulator) {
    // Ocultar iframe desktop, exibir emulador
    iframeElement.style.display = 'none';
    emulatorContainer.style.display = 'flex';
    mobileFrameElement.src = url;
  } else {
    // Exibir iframe desktop/responsivo completo, ocultar emulador
    emulatorContainer.style.display = 'none';
    iframeElement.style.display = 'block';
    iframeElement.src = url;
  }
}

// Configurar escutas de eventos e cliques nos menus do Stitch carregado
function setupIframeInteractivity(iframe) {
  try {
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    if (!doc) return;

    // Monitorar cliques em botões e links para fazer roteamento (em fase de captura)
    doc.addEventListener('click', (e) => {
      // Subir na árvore do DOM para encontrar elementos de clique utilizáveis
      let el = e.target;
      while (el && el !== doc.body) {
        const text = (el.textContent || el.innerText || '').trim().toLowerCase();
        
        // Interceptar botões de navegação lateral (Desktop)
        if (el.tagName === 'A' || el.tagName === 'BUTTON') {
          // Identificar para qual rota navegar com base no texto
          let matchedRoute = null;
          
          if (text.includes('dashboard') || text.includes('visão geral') || text.includes('overview') || text.includes('principal')) {
            matchedRoute = 'dashboard';
          } else if (text.includes('transactions') || text.includes('transações') || text.includes('transferência') || text.includes('transferir') || text.includes('transfer') || text.includes('lançamento')) {
            // Se for mobile e clicar em transação, leva para a tela de transações
            matchedRoute = 'transactions';
          } else if (text.includes('accounts') || text.includes('contas') || text.includes('cartões') || text.includes('cards') || text.includes('cartão')) {
            matchedRoute = 'accounts';
          } else if (text.includes('invest') || text.includes('investimentos') || text.includes('investir')) {
            matchedRoute = 'investments';
          } else if (text.includes('goals') || text.includes('metas')) {
            matchedRoute = 'goals';
          } else if (text.includes('planning') || text.includes('planejamento') || text.includes('orçamento')) {
            matchedRoute = 'planning';
          } else if (text.includes('reports') || text.includes('relatórios') || text.includes('central de relatórios')) {
            matchedRoute = 'reports';
          }

          // Se encontrar uma rota correspondente, navega no Dev Shell
          if (matchedRoute) {
            e.preventDefault();
            e.stopPropagation();
            window.location.hash = `#/${matchedRoute}`;
            showToast(`Navegando para: ${ROUTES[matchedRoute].title}`);
            break;
          }
        }
        el = el.parentNode;
      }
    }, true);

    // Ajustar a cor da barra de status do celular emulador dependendo do header da página
    const phoneStatusBar = document.getElementById('phoneStatusBar');
    if (phoneStatusBar) {
      // Se a página tiver dark mode ou header escuro, podemos adaptar
      const header = doc.querySelector('header');
      if (header) {
        const bg = window.getComputedStyle(header).backgroundColor;
        // Se o background for escuro, texto branco
        if (bg.includes('rgba(0, 0, 0') || bg.includes('rgb(3, 22') || bg.includes('rgb(26, 43')) {
          phoneStatusBar.style.color = '#ffffff';
        } else {
          phoneStatusBar.style.color = '#000000';
        }
      }
    }
  } catch (err) {
    console.warn('Erro ao configurar interatividade no iframe (pode ser restrição de origem ou carregamento parcial):', err);
  }
}

// Gerenciador de Rota por URL Hash
function handleHashChange() {
  const hash = window.location.hash || '#/dashboard';
  const routeKey = hash.replace('#/', '');
  if (ROUTES[routeKey]) {
    currentRoute = routeKey;
    updateUI();
  }
}

// Inicializar Ouvintes de Evento do Dev Shell
function initListeners() {
  // Alteração de página pelo seletor do topo
  selectPageElement.addEventListener('change', (e) => {
    window.location.hash = `#/${e.target.value}`;
  });

  // Alteração de viewport
  viewAutoBtn.addEventListener('click', () => {
    currentViewMode = 'auto';
    updateUI();
    showToast('Modo de Visualização: Auto (Responsivo)');
  });

  viewDesktopBtn.addEventListener('click', () => {
    currentViewMode = 'desktop';
    updateUI();
    showToast('Modo de Visualização: Desktop');
  });

  viewMobileBtn.addEventListener('click', () => {
    currentViewMode = 'mobile';
    updateUI();
    showToast('Modo de Visualização: Emulador Mobile');
  });

  // Seletor de idioma de Contas (Mobile)
  langSelectElement.addEventListener('change', (e) => {
    accountsLang = e.target.value;
    updateUI();
    showToast(`Carregando versão em ${accountsLang === 'pt' ? 'Português' : 'Inglês'}`);
  });

  // Seletores de versão (Investimento / Transações)
  subOptionsSelect.addEventListener('change', (e) => {
    if (currentRoute === 'investments') {
      investmentsVer = e.target.value;
    } else if (currentRoute === 'transactions') {
      transactionsVer = e.target.value;
    }
    updateUI();
  });

  // Quando os iframes terminam de carregar
  const onIframeLoad = (e) => {
    loadingOverlay.classList.remove('active');
    setupIframeInteractivity(e.target);
  };

  iframeElement.addEventListener('load', onIframeLoad);
  mobileFrameElement.addEventListener('load', onIframeLoad);

  // Responsividade dinâmica no modo Auto
  window.addEventListener('resize', () => {
    if (currentViewMode === 'auto') {
      // Recarrega apenas se cruzar a borda de responsividade
      const targetUrl = getTargetUrl(currentRoute, currentViewMode);
      const activeFrame = (currentViewMode === 'mobile' && !isPhysicalMobile()) ? mobileFrameElement : iframeElement;
      if (!activeFrame.src.includes(targetUrl)) {
        updateUI();
      }
    }
  });

  // Escutar alteração de Hash
  window.addEventListener('hashchange', handleHashChange);
}

// Inicializar aplicação
function init() {
  initListeners();
  
  // Tratar hash inicial
  if (!window.location.hash) {
    window.location.hash = '#/dashboard';
  } else {
    handleHashChange();
  }
}

document.addEventListener('DOMContentLoaded', init);
