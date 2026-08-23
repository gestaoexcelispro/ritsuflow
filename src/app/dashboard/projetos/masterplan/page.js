'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { supabase } from '../../../../lib/supabase';

// Cores e Labels com suporte a 2 idiomas
const DEFAULT_SERVICOS_CORES = {
  '': { labelPt: '', labelEn: '', color: 'transparent', text: '#000' },
  'FUN': { labelPt: 'Fundação', labelEn: 'Foundation', color: '#ff00ff', text: '#fff' },
  'PNS': { labelPt: 'Painelização LSF', labelEn: 'LSF Paneling', color: '#8a2be2', text: '#fff' },
  'VTS': { labelPt: 'Verticalização LSF', labelEn: 'LSF Verticalization', color: '#0000ff', text: '#fff' },
  'VEX': { labelPt: 'Vedações Externas', labelEn: 'Exterior Enclosures', color: '#00ffff', text: '#000' },
  'LMI': { labelPt: 'Lã Mineral', labelEn: 'Mineral Wool', color: '#00ff00', text: '#000' },
  'VIN': { labelPt: 'Vedações Internas', labelEn: 'Interior Enclosures', color: '#ff9900', text: '#fff' },
  'PIS': { labelPt: 'Pisos', labelEn: 'Flooring', color: '#8b0000', text: '#fff' },
  'FOR': { labelPt: 'Forros', labelEn: 'Ceilings', color: '#556b2f', text: '#fff' },
  'COB': { labelPt: 'Calhas, Rufos e Cobertura', labelEn: 'Gutters, Flashings & Roof', color: '#b05070', text: '#fff' },
  'INS': { labelPt: 'Instalações', labelEn: 'Installations', color: '#4682b4', text: '#fff' },
  'BUF': { labelPt: 'Buffer', labelEn: 'Buffer', color: '#000000', text: '#fff' },
  'PIN': { labelPt: 'Pintura', labelEn: 'Painting', color: '#daa520', text: '#fff' },
  'ESQ': { labelPt: 'Esquadrias', labelEn: 'Frames / Windows', color: '#f0e68c', text: '#000' },
  'REV': { labelPt: 'Outros Revestimentos', labelEn: 'Other Coatings', color: '#d2691e', text: '#fff' },
  'SUP': { labelPt: 'Ação para Suprimentos', labelEn: 'Supply Action', color: '#ff0000', text: '#fff' },
  'OFF': { labelPt: 'Fim de Semana', labelEn: 'Weekend', color: '#a0aec0', text: '#fff' },
  'FER': { labelPt: 'Feriado', labelEn: 'Holiday', color: '#e53e3e', text: '#fff' },
};

// Função auxiliar para calcular contraste de cor de texto (branco ou preto) dependendo da cor de fundo
const getContrastYIQ = (hexcolor) => {
  const hex = hexcolor.replace("#", "");
  const r = parseInt(hex.substr(0,2),16);
  const g = parseInt(hex.substr(2,2),16);
  const b = parseInt(hex.substr(4,2),16);
  const yiq = ((r*299)+(g*587)+(b*114))/1000;
  return (yiq >= 128) ? '#000000' : '#ffffff';
};


// Master Plan visual package codes must always be 1-3 characters.
// Project service IDs/codes such as SERVICE_xxx are internal identifiers and
// must never expand the Line of Balance date columns.
const normalizeText = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();

const buildServiceAcronym = (service, index, usedCodes) => {
  const rawCode = normalizeText(service?.service_code || '').replace(/[^A-Z0-9]/g, '');
  const serviceName = String(service?.service_name || '').trim();
  const normalizedName = normalizeText(serviceName);

  // Reuse the established RitsuFlow Master Plan codes whenever the service
  // name matches one of the existing standard activities.
  const standardMatch = Object.entries(DEFAULT_SERVICOS_CORES).find(([key, info]) => {
    if (!key) return false;
    return normalizeText(info.labelEn) === normalizedName || normalizeText(info.labelPt) === normalizedName;
  });

  let baseCode = standardMatch?.[0] || '';

  // Only accept a database service code when it is already a valid visual
  // package code (maximum 3 characters).
  if (!baseCode && rawCode.length >= 1 && rawCode.length <= 3) {
    baseCode = rawCode;
  }

  // Otherwise build a compact acronym from the service name.
  if (!baseCode) {
    const words = normalizedName
      .replace(/[^A-Z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);

    if (words.length >= 2) {
      baseCode = words.slice(0, 3).map((word) => word[0]).join('');
    } else if (words.length === 1) {
      baseCode = words[0].slice(0, 3);
    } else {
      baseCode = `S${index + 1}`.slice(0, 3);
    }
  }

  baseCode = baseCode.slice(0, 3) || 'SRV';

  // Keep codes unique while respecting the three-character limit.
  if (!usedCodes.has(baseCode)) {
    usedCodes.add(baseCode);
    return baseCode;
  }

  for (let n = 1; n <= 99; n += 1) {
    const suffix = String(n);
    const candidate = `${baseCode.slice(0, Math.max(1, 3 - suffix.length))}${suffix}`.slice(0, 3);
    if (!usedCodes.has(candidate)) {
      usedCodes.add(candidate);
      return candidate;
    }
  }

  const fallback = `S${index + 1}`.slice(-3);
  usedCodes.add(fallback);
  return fallback;
};

export default function MasterPlanPage() {
  const { lang } = useLanguage();
  const isEn = lang === 'en-US';

  // Dicionário Completo de Tradução Dinâmica
  const t = {
    title: isEn ? 'PHYSICAL SCHEDULE - LINE OF BALANCE' : 'CRONOGRAMA FÍSICO - LINHA DE BALANÇO',
    selectProject: isEn ? '-- Select a Project --' : '-- Selecione uma Obra --',
    scenarioLabel: isEn ? 'Scenario / Version (Last Planner)' : 'Cenário / Versão (Last Planner)',
    unsavedEdit: isEn ? '* Unsaved edit...' : '* Edição não salva...',
    newBlank: isEn ? 'New Blank Scenario' : 'Novo Cenário em Branco',
    
    // AÇÕES DE CENÁRIO
    saveScenario: isEn ? '💾 Save' : '💾 Salvar',
    updateScenario: isEn ? '💾 Update' : '💾 Atualizar',
    duplicateScenario: isEn ? '📑 Duplicate' : '📑 Duplicar',
    promptDuplicate: isEn ? 'Enter a name for the copied Scenario:' : 'Digite um nome para a cópia do Cenário:',
    scenarioUpdated: isEn ? 'Scenario updated successfully!' : 'Cenário atualizado com sucesso!',
    scenarioSaveError: isEn ? 'The scenario could not be saved.' : 'Não foi possível salvar o cenário.',
    scenarioLoadError: isEn ? 'The Master Plan could not be loaded.' : 'Não foi possível carregar o Master Plan.',
    
    freezeBase: isEn ? '🔒 Freeze Baseline' : '🔒 Congelar Linha de Base',
    editBase: isEn ? '🔓 Edit Baseline' : '🔓 Editar Base',
    planning: isEn ? '📋 Planning' : '📋 Planejamento',
    control: isEn ? '⚙️ Control (Actual)' : '⚙️ Controle (Realizado)',
    insertPackage: isEn ? '⚡ Insert Package' : '⚡ Inserir Pacote',
    undoBtn: isEn ? 'Undo' : 'Desfazer', // Novo botão de desfazer
    showWeekends: isEn ? 'Show Weekends' : 'Mostrar Finais de Semana',
    hideWeekends: isEn ? 'Hide Weekends' : 'Ocultar Finais de Semana',
    holidaysBtn: isEn ? '📅 Holidays' : '📅 Feriados',
    exportPdf: isEn ? '📊 Export PDF' : '📊 Exportar PDF',
    startPrev: isEn ? 'Expected Start' : 'Início Previsto',
    endPrev: isEn ? 'Expected Finish' : 'Término Previsto',
    noProject: isEn ? 'No Project Selected' : 'Nenhuma Obra Selecionada',
    noProjectDesc: isEn ? 'Select a project from the menu above to create or view the Master Plan.' : 'Selecione um projeto no menu acima para criar ou visualizar o Master Plan.',
    descHeader: isEn ? 'DESCRIPTION' : 'DESCRIÇÃO',
    plannedBadge: isEn ? 'PLANNED' : 'PREVISTO',
    actualBadge: isEn ? 'ACTUAL' : 'REALIZADO',
    addRow: isEn ? '+ Add Row' : '+ Adicionar Linha',
    addSection: isEn ? '+ Add New Schedule Section' : '+ Adicionar Nova Seção de Cronograma',
    newSecTitle: isEn ? 'NEW WORK SECTION' : 'NOVA SEÇÃO DE SERVIÇOS',
    intWork: isEn ? 'INTERIOR WORK PACKAGES' : 'SERVIÇOS INTERNOS',
    extWork: isEn ? 'EXTERIOR WORK PACKAGES' : 'SERVIÇOS EXTERNOS',
    legend: isEn ? 'LEGEND:' : 'LEGENDA:',
    selectOrType: isEn ? 'Select or type the step...' : 'Selecione ou digite a etapa...',
    
    // Alertas e Confirmações
    confirmFreeze: isEn ? 'Are you sure you want to freeze the current schedule? This will create the official project Baseline.' : 'Tem certeza que deseja congelar o planejamento atual? Isso criará a Linha de Base oficial do projeto.',
    confirmUnfreeze: isEn ? 'WARNING: Unfreezing the baseline will allow changes to the Planned schedule. Do you want to continue?' : 'ATENÇÃO: Descongelar a linha de base permitirá alterações no Previsto. Deseja continuar?',
    promptScenario: isEn ? 'Enter a name for this Scenario/Version:' : 'Digite um nome para este Cenário/Versão:',
    scenarioSaved: isEn ? 'Scenario saved successfully! You can switch between scenarios in the top menu.' : 'Cenário salvo com sucesso! Você pode alternar entre os cenários no menu superior.',
    confirmClear: isEn ? 'Do you want to clear the current schedule to create a blank scenario?' : 'Deseja limpar o planejamento atual para criar um cenário em branco?',
    confirmLoad: isEn ? 'This will load the selected scenario and replace the current grid. Do you want to continue?' : 'Isso carregará o cenário selecionado e substituirá a grade atual. Deseja continuar?',
    errHolidayExists: isEn ? 'A holiday is already registered for this date!' : 'Já existe um feriado cadastrado para esta data!',
    confirmDelSection: isEn ? 'Do you want to delete this section?' : 'Deseja excluir a seção?',
    errFillFields: isEn ? 'Fill in Activity, Location, and Duration.' : 'Preencha Atividade, Linha e Duração.',
    errSelectDate: isEn ? 'Select the start date.' : 'Selecione a data de início.',
    errSelectPred: isEn ? 'Select a predecessor package.' : 'Selecione um pacote predecessor.',
    errOutOfRange: isEn ? 'The chosen date is outside the schedule range.' : 'A data escolhida está fora do intervalo do cronograma.',
    warnEndEarly: (dias, dur) => isEn ? `Warning: The schedule ended before all days were allocated. ${dias} of ${dur} working days were allocated.` : `Atenção: O cronograma acabou antes de alocar todos os dias. Foram alocados ${dias} de ${dur} dias úteis.`,
    
    // Textos do Modal de Pacote
    mPkgTitle: isEn ? 'Insert Work Package' : 'Inserir Pacote de Trabalho',
    mPkgService: isEn ? 'Service / Activity' : 'Serviço / Atividade',
    mPkgSelect: isEn ? '-- Select --' : '-- Selecione --',
    mPkgZone: isEn ? 'Location / Zone' : 'Localização / Zona',
    mPkgRadioDate: isEn ? '📅 Start on Specific Date' : '📅 Iniciar em Data Específica',
    mPkgRadioPred: isEn ? '🔗 Start after Predecessor' : '🔗 Iniciar após Predecessora',
    mPkgStartDate: isEn ? 'Start Date' : 'Data de Início',
    mPkgLinkPred: isEn ? 'Link to Finish of:' : 'Vincular ao Término de:',
    mPkgSelectPred: isEn ? '-- Select Completed Package --' : '-- Selecione o Pacote Concluído --',
    mPkgNoPred: isEn ? 'No package added yet. Use Specific Date first.' : 'Nenhum pacote lançado ainda. Use a Data Específica primeiro.',
    mPkgDuration: isEn ? 'Duration (Working Days)' : 'Duração (Dias Úteis)',
    mPkgCancel: isEn ? 'Cancel' : 'Cancelar',
    mPkgAddGrid: isEn ? 'Add to Grid' : 'Lançar na Grade',
    
    // Textos do Modal de Nova Atividade
    newActBtn: isEn ? '+ New Service' : '+ Novo Serviço',
    newActTitle: isEn ? 'Register Custom Activity' : 'Cadastrar Nova Atividade',
    newActAcronym: isEn ? 'Acronym (max 3 letters)' : 'Sigla (máx 3 letras)',
    newActName: isEn ? 'Activity Name' : 'Nome da Atividade',
    newActColor: isEn ? 'Fill Color' : 'Cor de Preenchimento',

    mHolTitle: isEn ? 'Register Holidays (Local/State/Federal)' : 'Cadastrar Feriados (Mun/Est/Fed)',
    mHolDescPlace: isEn ? 'Description (e.g., National Holiday)' : 'Descrição (ex: Padroeira)',
    mHolAdd: isEn ? 'Add' : 'Adicionar',
    mHolDateCol: isEn ? 'Date' : 'Data',
    mHolDescCol: isEn ? 'Description' : 'Descrição',
    mHolActionCol: isEn ? 'Action' : 'Ação',
    mHolEmpty: isEn ? 'No holidays registered.' : 'Nenhum feriado cadastrado.',
    mHolDel: isEn ? 'Delete' : 'Excluir',
    mHolDone: isEn ? 'Done' : 'Concluir',
    
    mPdfTitle: isEn ? 'Print Configuration (PDF)' : 'Configuração de Impressão (PDF)',
    mPdfSugest: isEn ? 'System Suggestion:' : 'Sugestão do Sistema:',
    mPdfSugestText: (len) => isEn ? `Based on your current schedule width (${len} columns), we recommend using paper size` : `Com base na largura atual do seu cronograma (${len} colunas), recomendamos utilizar o papel`,
    mPdfSize: isEn ? 'Paper Size' : 'Tamanho da Folha',
    mPdf_a4: isEn ? 'A4 (Standard)' : 'A4 (Padrão)',
    mPdf_a3: isEn ? 'A3 (Recommended)' : 'A3 (Recomendado)',
    mPdf_a2: isEn ? 'A2 (Large)' : 'A2 (Grande)',
    mPdf_a1: isEn ? 'A1 (Giant)' : 'A1 (Gigante)',
    mPdf_a0: isEn ? 'A0 (Extreme)' : 'A0 (Extremo)',
    mPdf_unica: isEn ? 'Perfect Fit (Single Continuous Page)' : 'Ajuste Perfeito (Página Única Contínua)',
    mPdfOrient: isEn ? 'Orientation' : 'Orientação',
    mPdfLand: isEn ? 'Landscape (Horizontal)' : 'Paisagem (Horizontal)',
    mPdfPort: isEn ? 'Portrait (Vertical)' : 'Retrato (Vertical)',
    mPdfConfirm: isEn ? 'Confirm and Download PDF' : 'Confirmar e Baixar PDF',
  };

  const [projetosLista, setProjetosLista] = useState([]);
  const [projectCoverUrls, setProjectCoverUrls] = useState({});
  const [projectProgressMap, setProjectProgressMap] = useState({});
  const [projetoSelecionado, setProjetoSelecionado] = useState('');

  const [linhaDeBaseCongelada, setLinhaDeBaseCongelada] = useState(false);
  const [modoControle, setModoControle] = useState(false);

  const [dataInicio, setDataInicio] = useState('2026-08-03');
  const [dataFim, setDataFim] = useState('2026-10-31');
  const [ocultarFinaisDeSemana, setOcultarFinaisDeSemana] = useState(false);

  // ESTADO PARA SERVIÇOS CUSTOMIZADOS (Cores e Atividades Dinâmicas)
  const [servicosProjeto, setServicosProjeto] = useState({});
  const [servicosCustomizados, setServicosCustomizados] = useState({});
  const servicosCores = {
    ...DEFAULT_SERVICOS_CORES,
    ...servicosProjeto,
    ...servicosCustomizados
  };

  // MODAL DE NOVA ATIVIDADE
  const [showNovaAtivModal, setShowNovaAtivModal] = useState(false);
  const [novaAtivSigla, setNovaAtivSigla] = useState('');
  const [novaAtivNome, setNovaAtivNome] = useState('');
  const [novaAtivCor, setNovaAtivCor] = useState('#3182ce');

  const [showFeriadosModal, setShowFeriadosModal] = useState(false);
  const [feriados, setFeriados] = useState([]);
  const [novoFeriadoData, setNovoFeriadoData] = useState('');
  const [novoFeriadoDesc, setNovoFeriadoDesc] = useState('');

  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfConfig, setPdfConfig] = useState({ formato: 'a3', orientacao: 'landscape' });

  // SISTEMA DE VERSÕES (LAST PLANNER)
  const [versoes, setVersoes] = useState([]);
  const [versaoAtivaId, setVersaoAtivaId] = useState(null);

  // MOTOR DE AGENDAMENTO (SCHEDULING ENGINE)
  const [pacotesLancados, setPacotesLancados] = useState([]); 
  const [showPacoteModal, setShowPacoteModal] = useState(false);
  const [tipoInicio, setTipoInicio] = useState('data'); 
  const [pacotePredecessora, setPacotePredecessora] = useState('');
  const [pacoteAtividade, setPacoteAtividade] = useState('');
  const [pacoteLinhaId, setPacoteLinhaId] = useState('');
  const [pacoteDataInicio, setPacoteDataInicio] = useState('');
  const [pacoteDuracao, setPacoteDuracao] = useState(1);

  const [datasPlanilha, setDatasPlanilha] = useState([]);
  const [dadosCelulas, setDadosCelulas] = useState({});
  const [dadosRealizado, setDadosRealizado] = useState({});
  const [zonasColeta, setZonasColeta] = useState([]);

  const [secoes, setSecoes] = useState([
    {
      id: 'sec_1',
      titulo: 'SERVIÇOS INTERNOS',
      linhas: [
        { id: 'i1', descricao: 'PV2 ZONA 3' },
        { id: 'i2', descricao: 'PV2 ZONA 2' },
        { id: 'i3', descricao: 'PV2 ZONA 1' },
        { id: 'i4', descricao: 'PV1 ZONA 3' },
        { id: 'i5', descricao: 'PV1 ZONA 2' },
        { id: 'i6', descricao: 'PV1 ZONA 1' },
      ]
    },
    {
      id: 'sec_2',
      titulo: 'SERVIÇOS EXTERNOS',
      linhas: [
        { id: 'e1', descricao: 'ESQUADRIAS' },
        { id: 'e2', descricao: 'VEDAÇÕES EXTERNAS PV 2' },
        { id: 'e3', descricao: 'VEDAÇÕES EXTERNAS PV 1' },
        { id: 'e4', descricao: 'COBERTURA' },
        { id: 'e5', descricao: 'ESTRUTURA PV2' },
        { id: 'e6', descricao: 'ESTRUTURA PV1' },
        { id: 'e7', descricao: 'PAINELIZAÇÃO LSF' },
        { id: 'e8', descricao: 'FUNDAÇÃO' },
        { id: 'e9', descricao: 'LIMPEZA FINAL E OUTROS' },
      ]
    }
  ]);

  // ----------------------------------------------------
  // SISTEMA GLOBAL DE DESFAZER AÇÕES (HISTORY STACK)
  // ----------------------------------------------------
  const [historico, setHistorico] = useState([]);
  const isUndoRef = useRef(false);

  const salvarHistorico = () => {
    setHistorico(prev => [...prev, {
      pacotes: JSON.stringify(pacotesLancados),
      celulas: JSON.stringify(dadosCelulas),
      realizado: JSON.stringify(dadosRealizado),
      feriados: JSON.stringify(feriados),
      secoes: JSON.stringify(secoes)
    }]);
  };

  const handleDesfazer = () => {
    if (historico.length === 0) return;
    
    // Trava o recálculo automático para preservar o snapshot exatamente como ele era
    isUndoRef.current = true;
    
    const novoHistorico = [...historico];
    const snapshot = novoHistorico.pop();
    setHistorico(novoHistorico);

    setPacotesLancados(JSON.parse(snapshot.pacotes));
    setDadosCelulas(JSON.parse(snapshot.celulas));
    setDadosRealizado(JSON.parse(snapshot.realizado));
    setFeriados(JSON.parse(snapshot.feriados));
    setSecoes(JSON.parse(snapshot.secoes));
    setVersaoAtivaId(null);
  };
  // ----------------------------------------------------

  const formatarDataVersao = (valor) => {
    if (!valor) return '';
    return new Date(valor).toLocaleDateString(
      isEn ? 'en-US' : 'pt-BR',
      {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }
    );
  };

  const mapearRegistroVersao = (registro) => ({
    id: registro.id,
    nome: registro.name,
    data: formatarDataVersao(registro.updated_at || registro.created_at),
    status: registro.status,
    isBaseline: Boolean(registro.is_baseline),
    plannedStartDate: registro.planned_start_date,
    plannedFinishDate: registro.planned_finish_date,
    planData: registro.plan_data || {}
  });

  const aplicarPlanoSalvo = (versao) => {
    const plano = versao?.planData || {};

    setPacotesLancados(Array.isArray(plano.packages) ? plano.packages : []);
    setFeriados(Array.isArray(plano.holidays) ? plano.holidays : []);
    setServicosCustomizados(
      plano.customServices && typeof plano.customServices === 'object'
        ? plano.customServices
        : {}
    );

    if (Array.isArray(plano.sections) && plano.sections.length > 0) {
      setSecoes(plano.sections);
    }

    setDadosCelulas(
      plano.plannedCells && typeof plano.plannedCells === 'object'
        ? plano.plannedCells
        : {}
    );

    setDadosRealizado(
      plano.actualCells && typeof plano.actualCells === 'object'
        ? plano.actualCells
        : {}
    );

    setOcultarFinaisDeSemana(Boolean(plano.hideWeekends));

    if (versao?.plannedStartDate) setDataInicio(versao.plannedStartDate);
    if (versao?.plannedFinishDate) setDataFim(versao.plannedFinishDate);

    setLinhaDeBaseCongelada(Boolean(versao?.isBaseline));
    setModoControle(Boolean(versao?.isBaseline));
    setVersaoAtivaId(versao?.id || null);
    setHistorico([]);
  };

  const montarPlanData = () => ({
    sections: secoes,
    packages: pacotesLancados,
    plannedCells: dadosCelulas,
    actualCells: dadosRealizado,
    holidays: feriados,
    customServices: servicosCustomizados,
    hideWeekends: ocultarFinaisDeSemana
  });

  useEffect(() => {
    const fetchProjetos = async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          id,
          code,
          name,
          client_name,
          status,
          city,
          state_region,
          country_code,
          cover_image_path,
          created_at
        `)
        .neq('status', 'archived')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Master Plan - projects:', error);
        return;
      }

      const projects = data || [];
      setProjetosLista(projects);

      // If the user opened a project card, restore that project directly
      // from the URL while keeping the sidebar route unchanged.
      const projectIdFromUrl = new URLSearchParams(window.location.search).get('projectId');
      if (projectIdFromUrl && projects.some((project) => project.id === projectIdFromUrl)) {
        setProjetoSelecionado(projectIdFromUrl);
      }

      // Project covers use the same private Storage bucket already used by
      // Project Setup and Daily Reports project cards.
      const [coverEntries, progressResult] = await Promise.all([
        Promise.all(
          projects.map(async (project) => {
            if (!project.cover_image_path) return [project.id, ''];

            const { data: signedData, error: signedError } = await supabase.storage
              .from('project-covers')
              .createSignedUrl(project.cover_image_path, 60 * 60);

            if (signedError) {
              console.warn('Master Plan - project cover:', signedError);
              return [project.id, ''];
            }

            return [project.id, signedData?.signedUrl || ''];
          })
        ),

        supabase
          .from('production_control_project_portfolio')
          .select(`
            project_id,
            scope_item_count,
            not_started_count,
            in_progress_count,
            completed_count,
            overall_progress_percentage,
            last_production_date,
            has_production_scope
          `)
      ]);

      setProjectCoverUrls(Object.fromEntries(coverEntries));

      if (progressResult.error) {
        console.warn(
          'Master Plan - production control portfolio:',
          progressResult.error
        );
        setProjectProgressMap({});
      } else {
        const progressMap = Object.fromEntries(
          (progressResult.data || []).map((item) => [
            item.project_id,
            item
          ])
        );

        setProjectProgressMap(progressMap);
      }
    };

    fetchProjetos();
  }, []);

  useEffect(() => {
    const carregarMasterPlanProjeto = async () => {
      if (!projetoSelecionado) {
        setZonasColeta([]);
        setServicosProjeto({});
        setServicosCustomizados({});
        setVersoes([]);
        setVersaoAtivaId(null);
        setLinhaDeBaseCongelada(false);
        setModoControle(false);
        setHistorico([]);
        return;
      }

      const [locationsResult, servicesResult, scenariosResult] = await Promise.all([
        supabase
          .from('locations')
          .select(`
            id,
            project_id,
            parent_id,
            name,
            location_type,
            environment_type,
            sequence_number
          `)
          .eq('project_id', projetoSelecionado)
          .order('sequence_number', { ascending: true })
          .order('name', { ascending: true }),

        supabase
          .from('project_services')
          .select(`
            id,
            project_id,
            service_code,
            service_name,
            unit,
            sequence_number,
            is_active
          `)
          .eq('project_id', projetoSelecionado)
          .eq('is_active', true)
          .order('sequence_number', { ascending: true })
          .order('service_name', { ascending: true }),

        supabase
          .from('master_plan_scenarios')
          .select(`
            id,
            project_id,
            name,
            status,
            planned_start_date,
            planned_finish_date,
            is_baseline,
            plan_data,
            created_at,
            updated_at
          `)
          .eq('project_id', projetoSelecionado)
          .order('is_baseline', { ascending: false })
          .order('updated_at', { ascending: false })
      ]);

      const loadError =
        locationsResult.error ||
        servicesResult.error ||
        scenariosResult.error;

      if (loadError) {
        console.error('Master Plan - load:', loadError);
        alert(`${t.scenarioLoadError}\n${loadError.message}`);
        return;
      }

      const locations = locationsResult.data || [];
      const locationMap = new Map(locations.map((location) => [location.id, location]));
      const pathCache = new Map();

      const buildLocationPath = (location) => {
        if (!location) return '';
        if (pathCache.has(location.id)) return pathCache.get(location.id);

        const parts = [];
        const visited = new Set();
        let current = location;

        while (current && !visited.has(current.id)) {
          visited.add(current.id);
          if (current.name) parts.unshift(current.name);
          current = current.parent_id ? locationMap.get(current.parent_id) : null;
        }

        const path = parts.join(' / ');
        pathCache.set(location.id, path);
        return path;
      };

      setZonasColeta(
        [...new Set(locations.map(buildLocationPath).filter(Boolean))]
      );

      const palette = [
        '#2b6cb0',
        '#805ad5',
        '#319795',
        '#d69e2e',
        '#c05621',
        '#2f855a',
        '#4a5568',
        '#b83280'
      ];

      const projectServiceMap = {};
      const usedServiceCodes = new Set(
        Object.keys(DEFAULT_SERVICOS_CORES).filter(Boolean)
      );

      (servicesResult.data || []).forEach((service, index) => {
        const code = buildServiceAcronym(service, index, usedServiceCodes);

        const existing = DEFAULT_SERVICOS_CORES[code];
        const color = existing?.color || palette[index % palette.length];

        projectServiceMap[code] = {
          labelPt: service.service_name || code,
          labelEn: service.service_name || code,
          color,
          text: existing?.text || getContrastYIQ(color),
          projectServiceId: service.id,
          sourceServiceCode: service.service_code || null,
          unit: service.unit || ''
        };
      });

      setServicosProjeto(projectServiceMap);

      const mappedVersions = (scenariosResult.data || []).map(mapearRegistroVersao);
      setVersoes(mappedVersions);

      const initialVersion =
        mappedVersions.find((item) => item.isBaseline) ||
        mappedVersions[0] ||
        null;

      if (initialVersion) {
        aplicarPlanoSalvo(initialVersion);
      } else {
        setVersaoAtivaId(null);
        setLinhaDeBaseCongelada(false);
        setModoControle(false);
        setServicosCustomizados({});
        setPacotesLancados([]);
        setFeriados([]);
        setDadosCelulas({});
        setDadosRealizado({});
        setHistorico([]);
      }
    };

    carregarMasterPlanProjeto();
  }, [projetoSelecionado, isEn]);

  // GERAÇÃO DO CALENDÁRIO COM DATAS INTERNACIONAIS
  useEffect(() => {
    const gerarDatas = () => {
      if (!dataInicio || !dataFim || !projetoSelecionado) return;

      const parseDataSemFuso = (dataStr) => {
        const [ano, mes, dia] = dataStr.split('-');
        return new Date(ano, mes - 1, dia);
      };

      const inicio = parseDataSemFuso(dataInicio);
      const fim = parseDataSemFuso(dataFim);

      if (fim < inicio) { setDatasPlanilha([]); return; }

      const datas = [];
      let dataAtual = new Date(inicio);
      
      const diasSemanaPt = ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.'];
      const diasSemanaEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const diasSemana = isEn ? diasSemanaEn : diasSemanaPt;

      while (dataAtual <= fim) {
        const dataClonada = new Date(dataAtual);
        const dia = String(dataClonada.getDate()).padStart(2, '0');
        const mes = String(dataClonada.getMonth() + 1).padStart(2, '0');
        const ano = dataClonada.getFullYear();
        const diaSemanaIndex = dataClonada.getDay();
        
        const dataIso = `${ano}-${mes}-${dia}`;
        const isFeriado = feriados.some(f => f.data === dataIso);

        datas.push({
          dataCompleta: dataClonada,
          labelData: isEn ? `${mes}/${dia}` : `${dia}/${mes}`, // MM/DD ou DD/MM para Visualização
          labelSemana: diasSemana[diaSemanaIndex],
          isFimDeSemana: diaSemanaIndex === 0 || diaSemanaIndex === 6,
          isFeriado: isFeriado,
          dataIso: dataIso // CHAVE INVARIANTE USADA NO BANCO DE DADOS/MEMÓRIA
        });
        
        dataAtual.setDate(dataAtual.getDate() + 1);
      }
      setDatasPlanilha(datas);
    };
    gerarDatas();
  }, [dataInicio, dataFim, feriados, projetoSelecionado, isEn]);

  const datasVisiveis = datasPlanilha.filter(d => ocultarFinaisDeSemana ? !d.isFimDeSemana : true);

  // MOTOR DE RECÁLCULO AUTOMÁTICO
  useEffect(() => {
    if (datasPlanilha.length === 0) return;

    // Se é um retorno de histórico (Desfazer), não rola o recálculo para não sobrescrever a tela resgatada
    if (isUndoRef.current) {
      isUndoRef.current = false;
      return;
    }

    let novaGrade = {};
    let trackerFimPacote = {}; 

    pacotesLancados.forEach(pacote => {
      let startIndex = -1;

      if (pacote.tipoInicio === 'data') {
        startIndex = datasPlanilha.findIndex(d => d.dataIso === pacote.dataInicio);
      } else if (pacote.tipoInicio === 'predecessora') {
        const indexFimPredecessora = trackerFimPacote[pacote.predecessoraId];
        if (indexFimPredecessora !== undefined) {
          startIndex = indexFimPredecessora + 1; 
        }
      }

      if (startIndex !== -1) {
        let diasAlocados = 0;
        let lastIndex = startIndex;

        for (let i = startIndex; i < datasPlanilha.length && diasAlocados < pacote.duracao; i++) {
          const dia = datasPlanilha[i];
          if (!dia.isFimDeSemana && !dia.isFeriado) {
            const cellKey = `${pacote.linhaId}___${dia.dataIso}`;
            novaGrade[cellKey] = pacote.atividade;
            diasAlocados++;
            lastIndex = i;
          }
        }
        trackerFimPacote[pacote.id] = lastIndex; 
      }
    });

    setDadosCelulas(novaGrade);
  }, [pacotesLancados, datasPlanilha]);

  const calcularPapelSugerido = () => {
    const colunasDeData = datasVisiveis.length;
    const larguraEstimadaPx = 320 + (colunasDeData * 45);

    if (larguraEstimadaPx <= 1047) return 'a4';
    if (larguraEstimadaPx <= 1512) return 'a3';
    if (larguraEstimadaPx <= 2170) return 'a2';
    if (larguraEstimadaPx <= 3103) return 'a1';
    if (larguraEstimadaPx <= 4418) return 'a0';
    return 'unica';
  };
  
  const formatoIdealCode = calcularPapelSugerido();

  const handleCellChange = (linhaId, dataIso, valor) => {
    salvarHistorico();
    setDadosCelulas(prev => ({ ...prev, [`${linhaId}___${dataIso}`]: valor }));
  };

  const handleCellRealizadoChange = (linhaId, dataIso, valor) => {
    salvarHistorico();
    setDadosRealizado(prev => ({ ...prev, [`${linhaId}___${dataIso}`]: valor }));
  };

  const handleCongelarLinhaDeBase = async () => {
    if (!window.confirm(t.confirmFreeze)) return;
    if (!projetoSelecionado) return;

    let targetScenarioId = versaoAtivaId;

    if (!targetScenarioId) {
      const nomeCenario = prompt(t.promptScenario);
      if (!nomeCenario?.trim()) return;

      const { data: createdScenario, error: createError } = await supabase
        .from('master_plan_scenarios')
        .insert({
          project_id: projetoSelecionado,
          name: nomeCenario.trim(),
          status: 'draft',
          planned_start_date: dataInicio || null,
          planned_finish_date: dataFim || null,
          plan_data: montarPlanData()
        })
        .select(`
          id,
          project_id,
          name,
          status,
          planned_start_date,
          planned_finish_date,
          is_baseline,
          plan_data,
          created_at,
          updated_at
        `)
        .single();

      if (createError) {
        console.error('Master Plan - create baseline scenario:', createError);
        alert(`${t.scenarioSaveError}\n${createError.message}`);
        return;
      }

      const createdVersion = mapearRegistroVersao(createdScenario);
      setVersoes((prev) => [createdVersion, ...prev]);

      targetScenarioId = createdScenario.id;
      setVersaoAtivaId(targetScenarioId);
    }

    const previousBaselines = versoes.filter(
      (item) => item.isBaseline && item.id !== targetScenarioId
    );

    for (const baseline of previousBaselines) {
      const { error: clearError } = await supabase
        .from('master_plan_scenarios')
        .update({
          is_baseline: false,
          status: 'active'
        })
        .eq('id', baseline.id)
        .eq('project_id', projetoSelecionado);

      if (clearError) {
        console.error('Master Plan - clear previous baseline:', clearError);
        alert(`${t.scenarioSaveError}\n${clearError.message}`);
        return;
      }
    }

    const { data, error } = await supabase
      .from('master_plan_scenarios')
      .update({
        is_baseline: true,
        status: 'baseline',
        planned_start_date: dataInicio || null,
        planned_finish_date: dataFim || null,
        plan_data: montarPlanData()
      })
      .eq('id', targetScenarioId)
      .eq('project_id', projetoSelecionado)
      .select(`
        id,
        project_id,
        name,
        status,
        planned_start_date,
        planned_finish_date,
        is_baseline,
        plan_data,
        created_at,
        updated_at
      `)
      .single();

    if (error) {
      console.error('Master Plan - freeze baseline:', error);
      alert(`${t.scenarioSaveError}\n${error.message}`);
      return;
    }

    const frozenVersion = mapearRegistroVersao(data);

    setVersoes((prev) =>
      prev.map((item) => {
        if (item.id === frozenVersion.id) return frozenVersion;

        if (item.isBaseline) {
          return {
            ...item,
            isBaseline: false,
            status: item.status === 'baseline' ? 'active' : item.status
          };
        }

        return item;
      })
    );

    setVersaoAtivaId(frozenVersion.id);
    setLinhaDeBaseCongelada(true);
    setModoControle(true);
  };

  const handleDescongelar = async () => {
    if (!window.confirm(t.confirmUnfreeze)) return;

    if (versaoAtivaId) {
      const { data, error } = await supabase
        .from('master_plan_scenarios')
        .update({
          is_baseline: false,
          status: 'active',
          plan_data: montarPlanData(),
          planned_start_date: dataInicio || null,
          planned_finish_date: dataFim || null
        })
        .eq('id', versaoAtivaId)
        .eq('project_id', projetoSelecionado)
        .select(`
          id,
          project_id,
          name,
          status,
          planned_start_date,
          planned_finish_date,
          is_baseline,
          plan_data,
          created_at,
          updated_at
        `)
        .single();

      if (error) {
        console.error('Master Plan - unfreeze baseline:', error);
        alert(`${t.scenarioSaveError}\n${error.message}`);
        return;
      }

      const updatedVersion = mapearRegistroVersao(data);

      setVersoes((prev) =>
        prev.map((item) =>
          item.id === updatedVersion.id ? updatedVersion : item
        )
      );
    }

    setLinhaDeBaseCongelada(false);
    setModoControle(false);
  };

  // ----------------------------------------------------
  // NOVA ATIVIDADE CUSTOMIZADA
  // A atividade fica dentro do Scenario / Version salvo.
  // ----------------------------------------------------
  const handleSalvarNovaAtividade = (e) => {
    e.preventDefault();

    const siglaUpper = novaAtivSigla
      .toUpperCase()
      .trim()
      .substring(0, 3);

    if (!siglaUpper || !novaAtivNome) return;

    const textColor = getContrastYIQ(novaAtivCor);

    const novoServico = {
      labelPt: novaAtivNome,
      labelEn: novaAtivNome,
      color: novaAtivCor,
      text: textColor
    };

    setServicosCustomizados((prev) => ({
      ...prev,
      [siglaUpper]: novoServico
    }));

    setNovaAtivSigla('');
    setNovaAtivNome('');
    setNovaAtivCor('#3182ce');
    setShowNovaAtivModal(false);
  };

  // ----------------------------------------------------
  // SISTEMA DE VERSÕES: SUPABASE
  // ----------------------------------------------------
  const handleSalvarVersao = async () => {
    if (!projetoSelecionado) return;

    const nomeCenario = prompt(t.promptScenario);
    if (!nomeCenario?.trim()) return;

    const { data, error } = await supabase
      .from('master_plan_scenarios')
      .insert({
        project_id: projetoSelecionado,
        name: nomeCenario.trim(),
        status: 'draft',
        planned_start_date: dataInicio || null,
        planned_finish_date: dataFim || null,
        plan_data: montarPlanData()
      })
      .select(`
        id,
        project_id,
        name,
        status,
        planned_start_date,
        planned_finish_date,
        is_baseline,
        plan_data,
        created_at,
        updated_at
      `)
      .single();

    if (error) {
      console.error('Master Plan - save scenario:', error);
      alert(`${t.scenarioSaveError}\n${error.message}`);
      return;
    }

    const novaVersao = mapearRegistroVersao(data);

    setVersoes((prev) => [
      novaVersao,
      ...prev.filter((item) => item.id !== novaVersao.id)
    ]);

    setVersaoAtivaId(novaVersao.id);
    alert(t.scenarioSaved);
  };

  const handleAtualizarVersao = async () => {
    if (!versaoAtivaId) return;

    const { data, error } = await supabase
      .from('master_plan_scenarios')
      .update({
        planned_start_date: dataInicio || null,
        planned_finish_date: dataFim || null,
        plan_data: montarPlanData()
      })
      .eq('id', versaoAtivaId)
      .eq('project_id', projetoSelecionado)
      .select(`
        id,
        project_id,
        name,
        status,
        planned_start_date,
        planned_finish_date,
        is_baseline,
        plan_data,
        created_at,
        updated_at
      `)
      .single();

    if (error) {
      console.error('Master Plan - update scenario:', error);
      alert(`${t.scenarioSaveError}\n${error.message}`);
      return;
    }

    const versaoAtualizada = mapearRegistroVersao(data);

    setVersoes((prev) =>
      prev.map((item) =>
        item.id === versaoAtualizada.id ? versaoAtualizada : item
      )
    );

    alert(t.scenarioUpdated);
  };

  const handleDuplicarVersao = async () => {
    if (!projetoSelecionado) return;

    const nomeCopia = prompt(t.promptDuplicate);
    if (!nomeCopia?.trim()) return;

    const { data, error } = await supabase
      .from('master_plan_scenarios')
      .insert({
        project_id: projetoSelecionado,
        name: nomeCopia.trim(),
        status: 'draft',
        planned_start_date: dataInicio || null,
        planned_finish_date: dataFim || null,
        is_baseline: false,
        plan_data: montarPlanData()
      })
      .select(`
        id,
        project_id,
        name,
        status,
        planned_start_date,
        planned_finish_date,
        is_baseline,
        plan_data,
        created_at,
        updated_at
      `)
      .single();

    if (error) {
      console.error('Master Plan - duplicate scenario:', error);
      alert(`${t.scenarioSaveError}\n${error.message}`);
      return;
    }

    const novaVersao = mapearRegistroVersao(data);

    setVersoes((prev) => [novaVersao, ...prev]);
    setVersaoAtivaId(novaVersao.id);
    setLinhaDeBaseCongelada(false);
    setModoControle(false);

    alert(t.scenarioSaved);
  };

  const handleCarregarVersao = (versaoId) => {
    if (!versaoId) {
      if (window.confirm(t.confirmClear)) {
        salvarHistorico();
        setPacotesLancados([]);
        setFeriados([]);
        setDadosCelulas({});
        setDadosRealizado({});
        setServicosCustomizados({});
        setVersaoAtivaId(null);
        setLinhaDeBaseCongelada(false);
        setModoControle(false);
      }
      return;
    }

    if (!window.confirm(t.confirmLoad)) return;

    salvarHistorico();

    const versao = versoes.find((item) => item.id === versaoId);

    if (versao) aplicarPlanoSalvo(versao);
  };
  // ----------------------------------------------------

  const handleAdicionarFeriado = (e) => {
    e.preventDefault();
    if (novoFeriadoData && novoFeriadoDesc) {
      if (feriados.find(f => f.data === novoFeriadoData)) return alert(t.errHolidayExists);
      salvarHistorico();
      setFeriados([...feriados, { data: novoFeriadoData, descricao: novoFeriadoDesc }]);
      setNovoFeriadoData(''); 
      setNovoFeriadoDesc('');
    }
  };
  
  const handleRemoverFeriado = (data) => {
    salvarHistorico();
    setFeriados(feriados.filter(f => f.data !== data));
  };

  const handleAdicionarSecao = () => {
    salvarHistorico();
    setSecoes([...secoes, { id: `sec_${Date.now()}`, titulo: t.newSecTitle, linhas: [] }]);
  };
  
  const handleAtualizarTituloSecao = (secId, novoTitulo) => setSecoes(secoes.map(s => s.id === secId ? { ...s, titulo: novoTitulo } : s));
  
  const handleRemoverSecao = (secId) => { 
    if(window.confirm(t.confirmDelSection)) {
      salvarHistorico();
      setSecoes(secoes.filter(s => s.id !== secId)); 
    }
  };
  
  const handleAdicionarLinha = (secId) => {
    salvarHistorico();
    setSecoes(secoes.map(s => s.id === secId ? { ...s, linhas: [...s.linhas, { id: `l_${Date.now()}`, descricao: '' }] } : s));
  };

  const handleAtualizarLinha = (secId, linhaId, valor) => setSecoes(secoes.map(s => s.id === secId ? { ...s, linhas: s.linhas.map(l => l.id === linhaId ? { ...l, descricao: valor } : l) } : s));
  
  const handleRemoverLinha = (secId, linhaId) => {
    salvarHistorico();
    setSecoes(secoes.map(s => s.id === secId ? { ...s, linhas: s.linhas.filter(l => l.id !== linhaId) } : s));
  };

  const pacotesExistentes = pacotesLancados.map(p => {
    let desc = p.linhaId;
    secoes.forEach(sec => sec.linhas.forEach(l => { if(l.id === p.linhaId) desc = l.descricao; }));
    const sName = isEn ? (servicosCores[p.atividade]?.labelEn || p.atividade) : (servicosCores[p.atividade]?.labelPt || p.atividade);
    return {
      id: p.id,
      label: `${desc} - ${sName}`
    };
  });

  const handleInserirPacoteAutomacao = (e) => {
    e.preventDefault();
    if (!pacoteAtividade || !pacoteLinhaId || pacoteDuracao < 1) {
      alert(t.errFillFields);
      return;
    }

    if (tipoInicio === 'data' && !pacoteDataInicio) return alert(t.errSelectDate);
    if (tipoInicio === 'predecessora' && !pacotePredecessora) return alert(t.errSelectPred);

    salvarHistorico();

    const novoPacote = {
      id: `pct_${Date.now()}`,
      atividade: pacoteAtividade,
      linhaId: pacoteLinhaId,
      tipoInicio: tipoInicio,
      dataInicio: pacoteDataInicio,
      predecessoraId: pacotePredecessora,
      duracao: pacoteDuracao
    };

    setPacotesLancados([...pacotesLancados, novoPacote]);

    setShowPacoteModal(false);
    setPacoteDataInicio('');
    setPacotePredecessora('');
    setPacoteDuracao(1);
    
    // Desconecta da versão ativa se um novo pacote for inserido, ativando estado de rascunho
    setVersaoAtivaId(null); 
  };

  const gerarPDF = () => {
    import('html2pdf.js').then((html2pdf) => {
      const elemento = document.getElementById('conteudo-masterplan-pdf');
      let configuracaoPdf = { unit: 'mm', format: pdfConfig.formato, orientation: pdfConfig.orientacao };
      if (pdfConfig.formato === 'unica') {
        const rect = elemento.getBoundingClientRect();
        configuracaoPdf = { unit: 'px', format: [rect.height + 40, rect.width + 40], orientation: 'landscape' };
      }
      const opcoes = { margin: 10, filename: `master-plan-${projetoSelecionado}-${Date.now()}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: configuracaoPdf };
      html2pdf.default().from(elemento).set(opcoes).save();
      setShowPdfModal(false);
    });
  };

  let globalIdCounter = 1;

  const btnAdicionarStyle = {
    backgroundColor: '#ebf8ff', color: '#2b6cb0', border: '1px dashed #3182ce',
    padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold',
    fontSize: '0.75rem', display: 'inline-block', marginTop: '5px'
  };

  // ----------------------------------------------------
  // MASTER PLAN PROJECT SELECTOR
  // ----------------------------------------------------
  // The sidebar opens this portfolio view first. Selecting a project keeps
  // the existing Master Plan workspace on the same route using ?projectId=.
  if (!projetoSelecionado) {
    return (
      <main style={{ minHeight: 'calc(100vh - 80px)', padding: '24px 22px 50px', background: 'radial-gradient(circle at top right, rgba(8, 170, 150, 0.06), transparent 28%), #f8fafc', fontFamily: 'sans-serif' }}>
        <section style={{ marginBottom: '30px' }}>
          <p style={{ margin: '0 0 10px', color: '#009f8e', fontSize: '0.78rem', fontWeight: 900, letterSpacing: '0.13em', textTransform: 'uppercase' }}>
            PLANNING &amp; PRODUCTION CONTROL
          </p>
          <h1 style={{ margin: 0, color: '#061b2f', fontSize: '3.35rem', lineHeight: 1, fontWeight: 900, letterSpacing: '-0.04em' }}>
            Master Plan
          </h1>
          <p style={{ margin: '18px 0 0', color: '#536a86', fontSize: '0.95rem' }}>
            Select a project to access its Master Plan.
          </p>
        </section>

        {projetosLista.length === 0 ? (
          <div style={{ maxWidth: '620px', padding: '28px', border: '1px dashed #cbd5e1', borderRadius: '14px', background: '#fff', color: '#64748b' }}>
            No projects are available for Master Plan.
          </div>
        ) : (
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 365px))', gap: '22px', alignItems: 'start' }}>
            {projetosLista.map((project) => {
              const locationText = [project.city, project.state_region].filter(Boolean).join(', ');
              const coverUrl = projectCoverUrls[project.id];
              const progressRecord = projectProgressMap[project.id] || null;
              const hasProductionScope = Boolean(progressRecord?.has_production_scope);
              const rawProgress = Number(progressRecord?.overall_progress_percentage);
              const progress = hasProductionScope && Number.isFinite(rawProgress)
                ? Math.max(0, Math.min(100, rawProgress))
                : null;
              const progressLabel = progress === null
                ? '—'
                : `${Math.round(progress)}%`;
              const progressHelper = !hasProductionScope
                ? 'Production Control data not available yet.'
                : progressRecord.completed_count > 0
                  ? `${progressRecord.completed_count} of ${progressRecord.scope_item_count} scope items completed.`
                  : progressRecord.in_progress_count > 0
                    ? `${progressRecord.in_progress_count} scope item${progressRecord.in_progress_count === 1 ? '' : 's'} in progress.`
                    : 'Production scope available. Field production has not started yet.';

              return (
                <article key={project.id} style={{ overflow: 'hidden', border: '1px solid #d9e2ec', borderRadius: '15px', background: '#fff', boxShadow: '0 14px 30px rgba(15, 23, 42, 0.055)' }}>
                  <div style={{ position: 'relative', height: '215px', overflow: 'hidden', background: 'linear-gradient(135deg, #173b5f, #2f6e78)' }}>
                    {coverUrl ? (
                      <img src={coverUrl} alt={`${project.name} project`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.72)', fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.08em' }}>
                        PROJECT COVER
                      </div>
                    )}
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(4, 24, 43, 0.86) 0%, rgba(4, 24, 43, 0.2) 55%, rgba(4, 24, 43, 0.05) 100%)' }} />
                    <div style={{ position: 'absolute', left: '18px', right: '18px', bottom: '17px', color: '#fff' }}>
                      <div style={{ marginBottom: '6px', fontSize: '0.68rem', fontWeight: 900, letterSpacing: '0.12em' }}>
                        {project.code || 'UNASSIGNED'}
                      </div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 900, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                        {project.name}
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: '18px 19px 16px' }}>
                    <p style={{ margin: '0 0 7px', color: '#00a18f', fontSize: '0.63rem', fontWeight: 900, letterSpacing: '0.13em' }}>PROJECT</p>
                    <h2 style={{ margin: '0 0 7px', color: '#061b2f', fontSize: '1.05rem', fontWeight: 900 }}>{project.name}</h2>
                    <p style={{ margin: '0 0 5px', color: '#536a86', fontSize: '0.78rem' }}>{project.client_name || 'Client not assigned'}</p>
                    <p style={{ margin: 0, color: '#7890a8', fontSize: '0.74rem' }}>{locationText || project.country_code || 'Location not assigned'}</p>

                    <div style={{ height: '1px', margin: '19px 0 17px', background: '#e6edf3' }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '11px' }}>
                      <span style={{ color: '#36516d', fontSize: '0.68rem', fontWeight: 900 }}>Overall Progress</span>
                      <span style={{ color: progress === null ? '#91a3b5' : '#00a18f', fontSize: '0.72rem', fontWeight: 900 }}>
                        {progressLabel}
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '7px', overflow: 'hidden', borderRadius: '999px', background: '#e5ebf0' }}>
                      <div
                        style={{
                          width: progress === null ? '0%' : `${progress}%`,
                          height: '100%',
                          borderRadius: '999px',
                          background: '#00aa96',
                          transition: 'width 180ms ease'
                        }}
                      />
                    </div>
                    <p style={{ margin: '9px 0 0', color: '#91a3b5', fontSize: '0.66rem' }}>
                      {progressHelper}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      window.location.href = `/dashboard/projetos/masterplan?projectId=${project.id}`;
                    }}
                    style={{ width: '100%', minHeight: '48px', padding: '0 19px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: 0, borderTop: '1px solid #e6edf3', background: '#fff', color: '#071c31', cursor: 'pointer', fontSize: '0.73rem', fontWeight: 900, textAlign: 'left' }}
                  >
                    <span>Open Project</span>
                    <span style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: '#e8faf6', color: '#008f80', fontSize: '1rem' }}>→</span>
                  </button>
                </article>
              );
            })}
          </section>
        )}
      </main>
    );
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
      
      <datalist id="lista-zonas-coleta">
        {zonasColeta.map((zona, idx) => <option key={idx} value={zona} />)}
      </datalist>

      {/* CABEÇALHO SUPERIOR */}
      <div style={{ marginBottom: '20px', borderBottom: '2px solid #e2e8f0', paddingBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h1 style={{ color: '#2A4365', margin: 0, fontStyle: 'italic', fontSize: '1.5rem', marginBottom: '10px' }}>
            {t.title}
          </h1>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <select
                value={projetoSelecionado}
                onChange={(e) => { const projectId = e.target.value; setProjetoSelecionado(projectId); if (projectId) window.history.replaceState({}, '', `/dashboard/projetos/masterplan?projectId=${projectId}`); }}
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e0', minWidth: '300px', fontSize: '0.9rem', outline: 'none' }}
              >
                <option value="">{t.selectProject}</option>
                {projetosLista.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.code ? `${p.code} - ` : ''}{p.name}
                  </option>
                ))}
              </select>
            </div>

            {projetoSelecionado && (
              <>
                {/* BLOCO DE GERENCIAMENTO DE VERSÕES (CENÁRIOS) */}
                {!linhaDeBaseCongelada && (
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', borderLeft: '2px solid #e2e8f0', paddingLeft: '15px', borderRight: '2px solid #e2e8f0', paddingRight: '15px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#718096', marginBottom: '2px', textTransform: 'uppercase' }}>{t.scenarioLabel}</label>
                      <select
                        value={versaoAtivaId || ''}
                        onChange={(e) => handleCarregarVersao(e.target.value)}
                        style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e0', fontSize: '0.85rem', outline: 'none', minWidth: '200px', backgroundColor: versaoAtivaId ? '#ebf8ff' : '#fff' }}
                      >
                        <option value="">{versaoAtivaId === null && pacotesLancados.length > 0 ? t.unsavedEdit : t.newBlank}</option>
                        {versoes.map(v => <option key={v.id} value={v.id}>{v.nome} ({v.data})</option>)}
                      </select>
                    </div>

                    {/* BOTÕES DE SALVAMENTO DINÂMICOS */}
                    {versaoAtivaId === null ? (
                      <button 
                        onClick={handleSalvarVersao} 
                        disabled={pacotesLancados.length === 0}
                        style={{ backgroundColor: '#4a5568', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: pacotesLancados.length === 0 ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '0.8rem', opacity: pacotesLancados.length === 0 ? 0.5 : 1, marginTop: '14px' }}
                      >
                        {t.saveScenario}
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: '5px', marginTop: '14px' }}>
                        <button 
                          onClick={handleAtualizarVersao} 
                          style={{ backgroundColor: '#2f855a', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}
                          title={isEn ? "Update current scenario" : "Atualizar cenário atual"}
                        >
                          {t.updateScenario}
                        </button>
                        <button 
                          onClick={handleDuplicarVersao} 
                          style={{ backgroundColor: '#3182ce', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}
                          title={isEn ? "Create a copy of this scenario" : "Criar uma cópia deste cenário"}
                        >
                          {t.duplicateScenario}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  {!linhaDeBaseCongelada ? (
                    <button onClick={handleCongelarLinhaDeBase} style={{ backgroundColor: '#1a365d', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', marginTop: '14px' }}>
                      {t.freezeBase}
                    </button>
                  ) : (
                    <>
                      <button onClick={handleDescongelar} style={{ backgroundColor: '#e2e8f0', color: '#4a5568', border: '1px solid #cbd5e0', padding: '8px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}>
                        {t.editBase}
                      </button>
                      <div style={{ display: 'flex', backgroundColor: '#edf2f7', borderRadius: '6px', border: '1px solid #cbd5e0', overflow: 'hidden' }}>
                        <button 
                          onClick={() => setModoControle(false)} 
                          style={{ backgroundColor: !modoControle ? '#3182ce' : 'transparent', color: !modoControle ? 'white' : '#4a5568', border: 'none', padding: '8px 15px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
                        >
                          {t.planning}
                        </button>
                        <button 
                          onClick={() => setModoControle(true)} 
                          style={{ backgroundColor: modoControle ? '#dd6b20' : 'transparent', color: modoControle ? 'white' : '#4a5568', border: 'none', padding: '8px 15px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
                        >
                          {t.control}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {projetoSelecionado && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => setShowPacoteModal(true)} disabled={linhaDeBaseCongelada} style={{ backgroundColor: '#3182ce', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '6px', cursor: linhaDeBaseCongelada ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '0.85rem', opacity: linhaDeBaseCongelada ? 0.6 : 1 }}>
              {t.insertPackage}
            </button>

            {/* BOTÃO DESFAZER */}
            <button 
              onClick={handleDesfazer} 
              disabled={historico.length === 0 || linhaDeBaseCongelada} 
              style={{ backgroundColor: historico.length === 0 ? '#e2e8f0' : '#e53e3e', color: historico.length === 0 ? '#a0aec0' : 'white', border: 'none', padding: '8px 15px', borderRadius: '6px', cursor: historico.length === 0 || linhaDeBaseCongelada ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
            >
              ↩ {t.undoBtn}
            </button>

            <button onClick={() => setOcultarFinaisDeSemana(!ocultarFinaisDeSemana)} style={{ backgroundColor: ocultarFinaisDeSemana ? '#2a4365' : '#edf2f7', color: ocultarFinaisDeSemana ? 'white' : '#4a5568', border: '1px solid #cbd5e0', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>
              {ocultarFinaisDeSemana ? t.showWeekends : t.hideWeekends}
            </button>
            <button onClick={() => setShowFeriadosModal(true)} style={{ backgroundColor: '#dd6b20', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>
              {t.holidaysBtn}
            </button>
            <button onClick={() => { setPdfConfig(prev => ({ ...prev, formato: formatoIdealCode })); setShowPdfModal(true); }} style={{ backgroundColor: '#2f855a', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>
              {t.exportPdf}
            </button>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', backgroundColor: '#f7fafc', padding: '8px 15px', borderRadius: '8px', border: '1px solid #cbd5e0' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#4a5568', marginBottom: '2px' }}>{t.startPrev}</label>
                <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} disabled={linhaDeBaseCongelada} style={{ padding: '4px 6px', borderRadius: '4px', border: '1px solid #cbd5e0', outline: 'none', color: '#2d3748', cursor: linhaDeBaseCongelada ? 'not-allowed' : 'pointer', fontSize: '0.85rem', opacity: linhaDeBaseCongelada ? 0.7 : 1 }} />
              </div>
              <span style={{ color: '#a0aec0', fontWeight: 'bold', marginTop: '12px' }}>➞</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#4a5568', marginBottom: '2px' }}>{t.endPrev}</label>
                <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} disabled={linhaDeBaseCongelada} style={{ padding: '4px 6px', borderRadius: '4px', border: '1px solid #cbd5e0', outline: 'none', color: '#2d3748', cursor: linhaDeBaseCongelada ? 'not-allowed' : 'pointer', fontSize: '0.85rem', opacity: linhaDeBaseCongelada ? 0.7 : 1 }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {!projetoSelecionado && (
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f7fafc', borderRadius: '8px', border: '2px dashed #cbd5e0' }}>
          <div style={{ textAlign: 'center', color: '#718096' }}>
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '10px' }}>🏗️</span>
            <h2>{t.noProject}</h2>
            <p>{t.noProjectDesc}</p>
          </div>
        </div>
      )}

      {/* MODAL: NOVA ATIVIDADE CUSTOMIZADA */}
      {showNovaAtivModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3001 }}>
          <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '10px', width: '400px', fontFamily: 'sans-serif' }}>
            <h2 style={{ color: '#1a365d', marginBottom: '20px' }}>{t.newActTitle}</h2>
            <form onSubmit={handleSalvarNovaAtividade} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '5px', color: '#4a5568' }}>{t.newActAcronym}</label>
                <input type="text" maxLength="3" required value={novaAtivSigla} onChange={(e) => setNovaAtivSigla(e.target.value.toUpperCase())} placeholder="Ex: DRY" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e0', outline: 'none', textTransform: 'uppercase' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '5px', color: '#4a5568' }}>{t.newActName}</label>
                <input type="text" required value={novaAtivNome} onChange={(e) => setNovaAtivNome(e.target.value)} placeholder="Ex: Parede Drywall" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e0', outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '5px', color: '#4a5568' }}>{t.newActColor}</label>
                <input type="color" value={novaAtivCor} onChange={(e) => setNovaAtivCor(e.target.value)} style={{ width: '100%', height: '40px', padding: '2px', borderRadius: '6px', border: '1px solid #cbd5e0', cursor: 'pointer' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowNovaAtivModal(false)} style={{ backgroundColor: '#cbd5e0', border: 'none', padding: '10px 15px', borderRadius: '6px', cursor: 'pointer', color: '#4a5568', fontWeight: 'bold' }}>{t.mPkgCancel}</button>
                <button type="submit" style={{ backgroundColor: '#3182ce', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>{t.saveScenario}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: INSERIR PACOTE DE TRABALHO */}
      {showPacoteModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000 }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '10px', width: '550px', fontFamily: 'sans-serif' }}>
            <h2 style={{ color: '#1a365d', marginBottom: '20px' }}>{t.mPkgTitle}</h2>
            
            <form onSubmit={handleInserirPacoteAutomacao} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              
              <div style={{ display: 'flex', gap: '15px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '5px', color: '#4a5568' }}>{t.mPkgService}</label>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <select required value={pacoteAtividade} onChange={(e) => setPacoteAtividade(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e0', outline: 'none' }}>
                      <option value="">{t.mPkgSelect}</option>
                      {Object.entries(servicosCores)
                        .filter(([sigla]) => sigla !== '' && sigla !== 'OFF' && sigla !== 'FER')
                        .map(([sigla, info]) => (
                          <option key={sigla} value={sigla}>{isEn ? info.labelEn : info.labelPt} ({sigla})</option>
                      ))}
                    </select>
                    <button type="button" onClick={() => setShowNovaAtivModal(true)} style={{ backgroundColor: '#edf2f7', border: '1px solid #cbd5e0', borderRadius: '6px', padding: '0 10px', cursor: 'pointer', fontWeight: 'bold', color: '#2b6cb0', fontSize: '0.75rem' }} title="Criar nova atividade">
                      {t.newActBtn}
                    </button>
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '5px', color: '#4a5568' }}>{t.mPkgZone}</label>
                  <select required value={pacoteLinhaId} onChange={(e) => setPacoteLinhaId(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e0', outline: 'none' }}>
                    <option value="">{t.mPkgSelect}</option>
                    {secoes.map(sec => (
                      <optgroup key={sec.id} label={sec.titulo === 'SERVIÇOS INTERNOS' && isEn ? t.intWork : (sec.titulo === 'SERVIÇOS EXTERNOS' && isEn ? t.extWork : sec.titulo)}>
                        {sec.linhas.map(linha => (
                          <option key={linha.id} value={linha.id}>{linha.descricao || `Linha ID: ${linha.id}`}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ backgroundColor: '#f7fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', gap: '20px', marginBottom: '15px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.9rem', color: '#2d3748', cursor: 'pointer', fontWeight: 'bold' }}>
                    <input type="radio" name="tipoInicio" value="data" checked={tipoInicio === 'data'} onChange={() => setTipoInicio('data')} />
                    {t.mPkgRadioDate}
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.9rem', color: '#2d3748', cursor: 'pointer', fontWeight: 'bold' }}>
                    <input type="radio" name="tipoInicio" value="predecessora" checked={tipoInicio === 'predecessora'} onChange={() => setTipoInicio('predecessora')} />
                    {t.mPkgRadioPred}
                  </label>
                </div>

                {tipoInicio === 'data' ? (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '5px', color: '#4a5568' }}>{t.mPkgStartDate}</label>
                    <input type="date" required={tipoInicio === 'data'} value={pacoteDataInicio} onChange={(e) => setPacoteDataInicio(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e0', outline: 'none' }} />
                  </div>
                ) : (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '5px', color: '#4a5568' }}>{t.mPkgLinkPred}</label>
                    <select required={tipoInicio === 'predecessora'} value={pacotePredecessora} onChange={(e) => setPacotePredecessora(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e0', outline: 'none' }}>
                      <option value="">{t.mPkgSelectPred}</option>
                      {pacotesExistentes.map(p => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                      ))}
                    </select>
                    {pacotesExistentes.length === 0 && (
                      <p style={{ fontSize: '0.75rem', color: '#e53e3e', marginTop: '5px' }}>{t.mPkgNoPred}</p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '5px', color: '#4a5568' }}>{t.mPkgDuration}</label>
                <input type="number" required min="1" value={pacoteDuracao} onChange={(e) => setPacoteDuracao(Number(e.target.value))} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e0', outline: 'none' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '15px' }}>
                <button type="button" onClick={() => setShowPacoteModal(false)} style={{ backgroundColor: '#cbd5e0', border: 'none', padding: '10px 15px', borderRadius: '6px', cursor: 'pointer', color: '#4a5568', fontWeight: 'bold' }}>{t.mPkgCancel}</button>
                <button type="submit" style={{ backgroundColor: '#3182ce', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>{t.mPkgAddGrid}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: FERIADOS */}
      {showFeriadosModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000 }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '10px', width: '500px', fontFamily: 'sans-serif' }}>
            <h2 style={{ color: '#1a365d', marginBottom: '20px' }}>{t.mHolTitle}</h2>
            
            <form onSubmit={handleAdicionarFeriado} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <input type="date" required value={novoFeriadoData} onChange={(e) => setNovoFeriadoData(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e0', outline: 'none' }} />
              <input type="text" required placeholder={t.mHolDescPlace} value={novoFeriadoDesc} onChange={(e) => setNovoFeriadoDesc(e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e0', outline: 'none' }} />
              <button type="submit" style={{ backgroundColor: '#3182ce', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>{t.mHolAdd}</button>
            </form>

            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px', marginBottom: '20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f7fafc' }}>
                  <tr>
                    <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>{t.mHolDateCol}</th>
                    <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>{t.mHolDescCol}</th>
                    <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>{t.mHolActionCol}</th>
                  </tr>
                </thead>
                <tbody>
                  {feriados.length === 0 ? (
                    <tr><td colSpan={3} style={{ padding: '15px', textAlign: 'center', color: '#a0aec0' }}>{t.mHolEmpty}</td></tr>
                  ) : (
                    feriados.sort((a, b) => new Date(a.data) - new Date(b.data)).map((f, i) => {
                      const parts = f.data.split('-');
                      const displayDate = isEn ? `${parts[1]}/${parts[2]}/${parts[0]}` : `${parts[2]}/${parts[1]}/${parts[0]}`;
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #edf2f7' }}>
                          <td style={{ padding: '8px' }}>{displayDate}</td>
                          <td style={{ padding: '8px', fontWeight: 'bold', color: '#2d3748' }}>{f.descricao}</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <button onClick={() => handleRemoverFeriado(f.data)} style={{ border: 'none', background: 'transparent', color: '#e53e3e', cursor: 'pointer', fontWeight: 'bold' }}>{t.mHolDel}</button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowFeriadosModal(false)} style={{ backgroundColor: '#2f855a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>{t.mHolDone}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PDF */}
      {showPdfModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000 }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '10px', width: '480px', fontFamily: 'sans-serif' }}>
            <h2 style={{ color: '#1a365d', marginBottom: '20px' }}>{t.mPdfTitle}</h2>
            
            <div style={{ backgroundColor: '#ebf8ff', padding: '12px', borderRadius: '6px', border: '1px solid #90cdf4', marginBottom: '20px' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#2b6cb0', lineHeight: '1.4' }}>
                💡 <strong>{t.mPdfSugest}</strong> {t.mPdfSugestText(datasVisiveis.length)} <strong>{formatoIdealCode.toUpperCase()}</strong>.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '25px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '5px', color: '#4a5568' }}>{t.mPdfSize}</label>
                <select value={pdfConfig.formato} onChange={(e) => setPdfConfig({...pdfConfig, formato: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e0', outline: 'none' }}>
                  <option value="a4">{t.mPdf_a4}</option>
                  <option value="a3">{t.mPdf_a3}</option>
                  <option value="a2">{t.mPdf_a2}</option>
                  <option value="a1">{t.mPdf_a1}</option>
                  <option value="a0">{t.mPdf_a0}</option>
                  <option value="unica">{t.mPdf_unica}</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '5px', color: '#4a5568' }}>{t.mPdfOrient}</label>
                <select value={pdfConfig.orientacao} onChange={(e) => setPdfConfig({...pdfConfig, orientacao: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e0', outline: 'none' }} disabled={pdfConfig.formato === 'unica'}>
                  <option value="landscape">{t.mPdfLand}</option>
                  <option value="portrait">{t.mPdfPort}</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setShowPdfModal(false)} style={{ backgroundColor: '#cbd5e0', border: 'none', padding: '10px 15px', borderRadius: '6px', cursor: 'pointer' }}>{t.mPkgCancel}</button>
              <button onClick={gerarPDF} style={{ backgroundColor: '#2f855a', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>{t.mPdfConfirm}</button>
            </div>
          </div>
        </div>
      )}

      {/* TABELA GRÁFICA DA LINHA DE BALANÇO */}
      {projetoSelecionado && (
        <>
          <div style={{ flex: 1, overflow: 'auto', backgroundColor: 'white', border: '1px solid #cbd5e0', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <div id="conteudo-masterplan-pdf" style={{ minWidth: 'max-content', paddingBottom: '20px' }}>
              
              <table style={{ borderCollapse: 'collapse', whiteSpace: 'nowrap', width: '100%' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#1a365d' }}>
                  <tr>
                    <th rowSpan={2} style={{ position: 'sticky', left: 0, zIndex: 11, backgroundColor: '#1a365d', color: 'white', padding: '8px', borderRight: '1px solid #2a4365', width: '40px' }}>ID</th>
                    <th rowSpan={2} style={{ position: 'sticky', left: '40px', zIndex: 11, backgroundColor: '#1a365d', color: 'white', padding: '8px 15px', borderRight: '1px solid #2a4365', textAlign: 'left', minWidth: '320px' }}>{t.descHeader}</th>
                    {datasVisiveis.map((d, i) => (
                      <th key={`data-${i}`} style={{ backgroundColor: '#1a365d', borderRight: '1px solid #2a4365', borderBottom: '1px solid #2a4365', padding: '4px 2px', fontSize: '0.8rem', color: 'white', textAlign: 'center' }}>
                        {d.labelData}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {datasVisiveis.map((d, i) => (
                      <th key={`sem-${i}`} style={{ backgroundColor: d.isFeriado ? '#c53030' : (d.isFimDeSemana ? '#718096' : '#edf2f7'), borderRight: '1px solid #cbd5e0', borderBottom: '1px solid #cbd5e0', padding: '4px 2px', fontSize: '0.75rem', color: (d.isFeriado || d.isFimDeSemana) ? 'white' : '#1a365d', fontWeight: 'bold', textAlign: 'center' }}>
                        {d.labelSemana}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {secoes.map((secao) => {
                    const displayTitle = secao.titulo === 'SERVIÇOS INTERNOS' && isEn ? t.intWork : (secao.titulo === 'SERVIÇOS EXTERNOS' && isEn ? t.extWork : secao.titulo);
                    return (
                    <React.Fragment key={secao.id}>
                      <tr style={{ backgroundColor: '#edf2f7' }}>
                        <td colSpan={2} style={{ position: 'sticky', left: 0, zIndex: 5, backgroundColor: '#edf2f7', padding: '6px 15px', borderBottom: '2px solid #2a4365', borderTop: '2px solid #2a4365' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <input 
                              type="text"
                              value={displayTitle}
                              onChange={(e) => handleAtualizarTituloSecao(secao.id, e.target.value)}
                              disabled={linhaDeBaseCongelada}
                              style={{ fontWeight: 'bold', fontStyle: 'italic', color: '#2a4365', background: 'transparent', border: 'none', outline: 'none', width: '85%', fontSize: '0.9rem' }}
                            />
                            {!linhaDeBaseCongelada && (
                              <button onClick={() => handleRemoverSecao(secao.id)} style={{ border: 'none', background: 'transparent', color: '#e53e3e', cursor: 'pointer', fontWeight: 'bold' }}>✖</button>
                            )}
                          </div>
                        </td>
                        {datasVisiveis.map((d, i) => (
                          <td key={`g-${secao.id}-${i}`} style={{ borderBottom: '2px solid #2a4365', borderTop: '2px solid #2a4365', backgroundColor: d.isFeriado ? '#fed7d7' : (d.isFimDeSemana ? '#e2e8f0' : '#edf2f7'), minWidth: '45px' }}></td>
                        ))}
                      </tr>

                      {secao.linhas.map((linha) => {
                        const currentId = globalIdCounter++;
                        
                        const renderizarCelulas = (isRealizado) => {
                          return datasVisiveis.map((d) => {
                            const cellKey = `${linha.id}___${d.dataIso}`;
                            const baseDados = isRealizado ? dadosRealizado : dadosCelulas;
                            const valorSalvo = baseDados[cellKey];
                            
                            let defaultValor = '';
                            if (d.isFeriado) defaultValor = 'FER';
                            else if (d.isFimDeSemana) defaultValor = 'OFF';

                            const valorEfetivo = valorSalvo !== undefined ? valorSalvo : (isRealizado ? '' : defaultValor);
                            const configCor = servicosCores[valorEfetivo] || servicosCores[''];

                            let bgColor = 'transparent';
                            if (configCor.color !== 'transparent') bgColor = configCor.color;
                            else if (!isRealizado && d.isFeriado) bgColor = '#fed7d7';
                            else if (!isRealizado && d.isFimDeSemana) bgColor = '#e2e8f0';

                            const inputBloqueado = isRealizado ? false : linhaDeBaseCongelada;

                            return (
                              <td key={cellKey} style={{ borderRight: '1px dotted #cbd5e0', padding: '1px', backgroundColor: bgColor, textAlign: 'center', width: '45px', minWidth: '45px', maxWidth: '45px', height: '26px', overflow: 'hidden' }}>
                                <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <select
                                    value={valorEfetivo}
                                    onChange={(e) => isRealizado ? handleCellRealizadoChange(linha.id, d.dataIso, e.target.value) : handleCellChange(linha.id, d.dataIso, e.target.value)}
                                    disabled={inputBloqueado}
                                    style={{ width: '43px', minWidth: 0, maxWidth: '43px', height: '100%', backgroundColor: configCor.color, color: configCor.text, border: 'none', outline: 'none', fontSize: '0.7rem', fontWeight: 'bold', textAlign: 'center', textAlignLast: 'center', appearance: 'none', cursor: inputBloqueado ? 'default' : 'pointer', borderRadius: '2px', opacity: (modoControle && !isRealizado && valorEfetivo) ? 0.6 : 1, padding: '0 4px', overflow: 'hidden' }}
                                  >
                                    <option value=""></option>
                                    {Object.keys(servicosCores).filter(k => k !== '').map(sigla => (
                                      <option key={sigla} value={sigla}>{sigla}</option>
                                    ))}
                                  </select>
                                  {!inputBloqueado && (
                                    <div style={{ position: 'absolute', right: '2px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: '0.45rem', color: configCor.text === '#fff' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)' }}>▼</div>
                                  )}
                                </div>
                              </td>
                            );
                          });
                        };

                        return (
                          <React.Fragment key={linha.id}>
                            <tr style={{ borderBottom: modoControle ? 'none' : '1px dotted #cbd5e0', backgroundColor: modoControle ? '#f7fafc' : 'white' }}>
                              <td style={{ position: 'sticky', left: 0, zIndex: 5, backgroundColor: modoControle ? '#f7fafc' : 'white', padding: '4px', textAlign: 'center', color: '#4a5568', borderRight: '1px solid #e2e8f0', fontWeight: '500' }}>
                                {currentId}
                              </td>
                              <td style={{ position: 'sticky', left: '40px', zIndex: 5, backgroundColor: modoControle ? '#f7fafc' : 'white', padding: '4px 10px', borderRight: '2px solid #cbd5e0', minWidth: '320px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '90%' }}>
                                    <input 
                                      type="text" 
                                      value={linha.descricao} 
                                      onChange={(e) => handleAtualizarLinha(secao.id, linha.id, e.target.value)} 
                                      disabled={linhaDeBaseCongelada}
                                      list="lista-zonas-coleta"
                                      placeholder={t.selectOrType}
                                      style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: '#2d3748', fontSize: '0.85rem' }}
                                    />
                                    {modoControle && <span style={{ fontSize: '0.65rem', backgroundColor: '#cbd5e0', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', color: '#4a5568' }}>{t.plannedBadge}</span>}
                                  </div>
                                  {!linhaDeBaseCongelada && (
                                    <button onClick={() => handleRemoverLinha(secao.id, linha.id)} style={{ border: 'none', background: 'transparent', color: '#e53e3e', cursor: 'pointer', fontWeight: 'bold' }}>✖</button>
                                  )}
                                </div>
                              </td>
                              {renderizarCelulas(false)}
                            </tr>

                            {modoControle && (
                              <tr style={{ borderBottom: '1px dotted #cbd5e0', backgroundColor: 'white' }}>
                                <td style={{ position: 'sticky', left: 0, zIndex: 5, backgroundColor: 'white', padding: '4px', borderRight: '1px solid #e2e8f0', color: 'transparent' }}>
                                  {currentId}
                                </td>
                                <td style={{ position: 'sticky', left: '40px', zIndex: 5, backgroundColor: 'white', padding: '4px 10px', borderRight: '2px solid #cbd5e0', minWidth: '320px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '90%' }}>
                                      <span style={{ flex: 1, color: '#a0aec0', fontSize: '0.85rem', paddingLeft: '2px' }}>↳ {linha.descricao}</span>
                                      <span style={{ fontSize: '0.65rem', backgroundColor: '#3182ce', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', color: 'white' }}>{t.actualBadge}</span>
                                    </div>
                                  </div>
                                </td>
                                {renderizarCelulas(true)}
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                      
                      {!linhaDeBaseCongelada && (
                        <tr>
                          <td colSpan={2} style={{ position: 'sticky', left: 0, zIndex: 5, backgroundColor: 'white', padding: '5px 15px', borderBottom: '1px solid #cbd5e0' }}>
                            <button onClick={() => handleAdicionarLinha(secao.id)} style={btnAdicionarStyle}>{t.addRow}</button>
                          </td>
                          {datasVisiveis.map((d, i) => (
                            <td key={`add-${secao.id}-${i}`} style={{ borderBottom: '1px solid #cbd5e0', backgroundColor: d.isFeriado ? '#fed7d7' : (d.isFimDeSemana ? '#e2e8f0' : 'white') }}></td>
                          ))}
                        </tr>
                      )}
                    </React.Fragment>
                    )
                  })}

                  {!linhaDeBaseCongelada && (
                    <tr>
                      <td colSpan={2 + datasVisiveis.length} style={{ padding: '20px', backgroundColor: '#f4f7f6', textAlign: 'left' }}>
                        <button onClick={handleAdicionarSecao} style={{ backgroundColor: '#2a4365', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>
                          {t.addSection}
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
          <div style={{ marginTop: '15px', padding: '10px', backgroundColor: 'white', borderRadius: '6px', border: '1px solid #cbd5e0', display: 'flex', gap: '15px', flexWrap: 'wrap', fontSize: '0.75rem' }}>
            <span style={{ fontWeight: 'bold', color: '#1a365d' }}>{t.legend}</span>
            {Object.entries(servicosCores).filter(([sigla]) => sigla !== '').map(([sigla, info]) => (
              <div key={sigla} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '12px', height: '12px', backgroundColor: info.color, borderRadius: '2px', border: '1px solid #cbd5e0' }}></div>
                <span><b>{sigla}</b> - {isEn ? info.labelEn : info.labelPt}</span>
              </div>
            ))}
          </div>
        </>
      )}

    </div>
  );
}
