'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { supabase } from '../../../../lib/supabase';

// ============================================================
// MASTER PLAN - SHARED WORK PACKAGE CATALOG INTEGRATION
// Work Package Database is authoritative for package identity,
// description, color and selectable planning activities.
// ============================================================

// ============================================================
// SYSTEM CALENDAR MARKERS
// ============================================================
//
// IMPORTANT:
// Work Packages are NOT hard-coded in Master Plan anymore.
//
// All project Work Packages now come from:
// public.project_work_packages
//
// These three entries are system/calendar markers only.
// They are not user Work Packages.
// ============================================================
const SYSTEM_CALENDAR_CODES = {
  '': {
    labelPt: '',
    labelEn: '',
    color: 'transparent',
    text: '#000'
  },

  OFF: {
    labelPt: 'Fim de Semana',
    labelEn: 'Weekend',
    color: '#a0aec0',
    text: '#fff'
  },

  FER: {
    labelPt: 'Feriado',
    labelEn: 'Holiday',
    color: '#e53e3e',
    text: '#fff'
  }
};


// FunÃ§Ã£o auxiliar para calcular contraste de cor de texto (branco ou preto) dependendo da cor de fundo
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

// ----------------------------------------------------
// MASTER PLAN LOCATION STRUCTURE INTEGRATION
// ----------------------------------------------------
// The canonical RitsuFlow Location Structure becomes the default
// planning backbone for NEW / BLANK Master Plan scenarios.
//
// Existing saved scenarios are never overwritten. Their saved sections
// remain exactly as they were when the scenario was created.
//
// Leaf locations become planning rows. Their immediate parent path becomes
// the visual section title. Stable IDs are derived from the canonical
// location UUIDs so saved grid cells remain deterministic.
const buildMasterPlanSectionsFromLocations = (locations = []) => {
  if (!Array.isArray(locations) || locations.length === 0) {
    return [];
  }

  const locationMap = new Map(
    locations.map((location) => [location.id, location])
  );

  const childCount = new Map();

  locations.forEach((location) => {
    if (!location.parent_id) return;

    childCount.set(
      location.parent_id,
      (childCount.get(location.parent_id) || 0) + 1
    );
  });

  const pathCache = new Map();

  const buildPath = (location) => {
    if (!location) return '';
    if (pathCache.has(location.id)) return pathCache.get(location.id);

    const parts = [];
    const visited = new Set();
    let current = location;

    while (current && !visited.has(current.id)) {
      visited.add(current.id);

      if (current.name) {
        parts.unshift(current.name);
      }

      current = current.parent_id
        ? locationMap.get(current.parent_id)
        : null;
    }

    const path = parts.join(' / ');
    pathCache.set(location.id, path);

    return path;
  };

  const planningLocations = locations.filter(
    (location) => !childCount.has(location.id)
  );

  const rowsSource =
    planningLocations.length > 0
      ? planningLocations
      : locations;

  const sectionMap = new Map();

  rowsSource.forEach((location) => {
    const parent = location.parent_id
      ? locationMap.get(location.parent_id)
      : null;

    const sectionKey = parent?.id || 'root';

    const sectionTitle = parent
      ? buildPath(parent)
      : 'PROJECT LOCATIONS';

    if (!sectionMap.has(sectionKey)) {
      sectionMap.set(sectionKey, {
        id: `locsec_${sectionKey}`,
        titulo: sectionTitle || 'PROJECT LOCATIONS',
        source: 'location_structure',
        locationParentId: parent?.id || null,
        linhas: [],
      });
    }

    sectionMap.get(sectionKey).linhas.push({
      id: `loc_${location.id}`,
      descricao: location.name || buildPath(location),
      locationId: location.id,
      locationPath: buildPath(location),
      source: 'location_structure',
      sequenceNumber: Number(location.sequence_number || 0),
    });
  });

  return Array.from(sectionMap.values())
    .map((section) => ({
      ...section,
      linhas: [...section.linhas].sort((a, b) => {
        const bySequence =
          Number(a.sequenceNumber || 0) -
          Number(b.sequenceNumber || 0);

        if (bySequence !== 0) return bySequence;

        return String(a.descricao || '').localeCompare(
          String(b.descricao || '')
        );
      }),
    }))
    .sort((a, b) =>
      String(a.titulo || '').localeCompare(
        String(b.titulo || '')
      )
    );
};

export default function MasterPlanPage() {
  const { lang } = useLanguage();
  const isEn = lang === 'en-US';

  // DicionÃ¡rio Completo de TraduÃ§Ã£o DinÃ¢mica
  const t = {
    title: isEn ? 'PHYSICAL SCHEDULE - LINE OF BALANCE' : 'CRONOGRAMA FÃSICO - LINHA DE BALANÃ‡O',
    selectProject: isEn ? '-- Select a Project --' : '-- Selecione uma Obra --',
    scenarioLabel: isEn ? 'Scenario / Version (Last Planner)' : 'CenÃ¡rio / VersÃ£o (Last Planner)',
    unsavedEdit: isEn ? '* Unsaved edit...' : '* EdiÃ§Ã£o nÃ£o salva...',
    newBlank: isEn ? 'New Blank Scenario' : 'Novo CenÃ¡rio em Branco',
    
    // AÃ‡Ã•ES DE CENÃRIO
    saveScenario: isEn ? 'ðŸ’¾ Save' : 'ðŸ’¾ Salvar',
    updateScenario: isEn ? 'ðŸ’¾ Update' : 'ðŸ’¾ Atualizar',
    duplicateScenario: isEn ? 'ðŸ“‘ Duplicate' : 'ðŸ“‘ Duplicar',
    promptDuplicate: isEn ? 'Enter a name for the copied Scenario:' : 'Digite um nome para a cÃ³pia do CenÃ¡rio:',
    scenarioUpdated: isEn ? 'Scenario updated successfully!' : 'CenÃ¡rio atualizado com sucesso!',
    scenarioSaveError: isEn ? 'The scenario could not be saved.' : 'NÃ£o foi possÃ­vel salvar o cenÃ¡rio.',
    scenarioLoadError: isEn ? 'The Master Plan could not be loaded.' : 'NÃ£o foi possÃ­vel carregar o Master Plan.',
    packageSyncError: isEn ? 'The scenario was saved, but the normalized work packages could not be synchronized.' : 'O cenÃ¡rio foi salvo, mas os pacotes de trabalho normalizados nÃ£o puderam ser sincronizados.',
    
    freezeBase: isEn ? 'ðŸ”’ Freeze Baseline' : 'ðŸ”’ Congelar Linha de Base',
    editBase: isEn ? 'ðŸ”“ Edit Baseline' : 'ðŸ”“ Editar Base',
    planning: isEn ? 'ðŸ“‹ Planning' : 'ðŸ“‹ Planejamento',
    control: isEn ? 'âš™ï¸ Control (Actual)' : 'âš™ï¸ Controle (Realizado)',
    insertPackage: isEn ? 'âš¡ Insert Package' : 'âš¡ Inserir Pacote',
    generateSequence: isEn ? 'âš™ Generate Work Sequence' : 'âš™ Gerar SequÃªncia de Trabalho',
    sequenceGenerator: isEn ? 'Work Sequence Generator' : 'Gerador de SequÃªncia de Trabalho',
    sequenceLocations: isEn ? '1. Location Flow' : '1. Fluxo de Locais',
    sequenceActivities: isEn ? '2. Activity Sequence' : '2. SequÃªncia de Atividades',
    sequenceStart: isEn ? '3. Start Rule' : '3. Regra de InÃ­cio',
    addActivity: isEn ? 'Add Activity' : 'Adicionar Atividade',
    durationDays: isEn ? 'Duration (days)' : 'DuraÃ§Ã£o (dias)',
    continuousFlow: isEn ? 'Continuous Flow' : 'Fluxo ContÃ­nuo',
    continuousFlowHelp: isEn ? 'Each package respects the previous activity in the same location and the same activity in the previous location. The later finish controls the start.' : 'Cada pacote respeita a atividade anterior no mesmo local e a mesma atividade no local anterior. O tÃ©rmino mais tardio controla o inÃ­cio.',
    packagesWillBeCreated: isEn ? 'work packages will be created' : 'pacotes de trabalho serÃ£o criados',
    generatePackages: isEn ? 'Generate Packages' : 'Gerar Pacotes',
    selectAtLeastOneLocation: isEn ? 'Select at least one location.' : 'Selecione pelo menos um local.',
    selectAtLeastOneActivity: isEn ? 'Add at least one activity.' : 'Adicione pelo menos uma atividade.',
    specificStartDate: isEn ? 'Specific start date' : 'Data de inÃ­cio especÃ­fica',
    existingPredecessor: isEn ? 'Existing predecessor' : 'Predecessor existente',
    sequenceSettings: isEn ? 'Sequence Settings' : 'ConfiguraÃ§Ãµes da SequÃªncia',
    regenerateSequence: isEn ? 'Regenerate Sequence' : 'Regenerar SequÃªncia',
    sequenceName: isEn ? 'Sequence Name' : 'Nome da SequÃªncia',
    defaultSequenceName: isEn ? 'Main Work Sequence' : 'SequÃªncia Principal',
    noSequenceConfigured: isEn ? 'No generated sequence is configured yet.' : 'Nenhuma sequÃªncia gerada estÃ¡ configurada ainda.',
    confirmRegenerate: isEn ? 'This sequence may contain manual schedule adjustments. Regenerating will rebuild only the packages created by this sequence. Manual packages created with Insert Package will remain. Continue?' : 'Esta sequÃªncia pode conter ajustes manuais. Regenerar reconstruirÃ¡ apenas os pacotes criados por esta sequÃªncia. Pacotes manuais criados com Inserir Pacote permanecerÃ£o. Continuar?',
    sequenceRegenerated: isEn ? 'Sequence regenerated successfully.' : 'SequÃªncia regenerada com sucesso.',
    editSequenceHelp: isEn ? 'Review locations, activity order, durations, lags, and start rule, then regenerate the sequence.' : 'Revise locais, ordem das atividades, duraÃ§Ãµes, lags e regra de inÃ­cio e depois regenere a sequÃªncia.',
    lagWorkingDays: isEn ? 'Lag (workdays)' : 'Lag (dias Ãºteis)',
    startLag: isEn ? 'Start Lag (workdays)' : 'Lag inicial (dias Ãºteis)',
    dragToReorder: isEn ? 'Drag rows to reorder, or use the arrows.' : 'Arraste as linhas para reordenar ou use as setas.',
    dependencySyncError: isEn ? 'The scenario was saved, but the dependency network could not be synchronized.' : 'O cenÃ¡rio foi salvo, mas a rede de dependÃªncias nÃ£o pÃ´de ser sincronizada.',
    dragPackageHint: isEn ? 'Drag horizontally to reschedule' : 'Arraste horizontalmente para reagendar',
    dragPackageLockedRow: isEn ? 'Work packages stay locked to their Location row.' : 'Os pacotes permanecem bloqueados na linha de LocalizaÃ§Ã£o.',
    undoBtn: isEn ? 'Undo' : 'Desfazer', // Novo botÃ£o de desfazer
    showWeekends: isEn ? 'Show Weekends' : 'Mostrar Finais de Semana',
    hideWeekends: isEn ? 'Hide Weekends' : 'Ocultar Finais de Semana',
    holidaysBtn: isEn ? 'ðŸ“… Holidays' : 'ðŸ“… Feriados',
    exportPdf: isEn ? 'ðŸ“Š Export PDF' : 'ðŸ“Š Exportar PDF',
    startPrev: isEn ? 'Expected Start' : 'InÃ­cio Previsto',
    endPrev: isEn ? 'Expected Finish' : 'TÃ©rmino Previsto',
    noProject: isEn ? 'No Project Selected' : 'Nenhuma Obra Selecionada',
    noProjectDesc: isEn ? 'Select a project from the menu above to create or view the Master Plan.' : 'Selecione um projeto no menu acima para criar ou visualizar o Master Plan.',
    descHeader: isEn ? 'DESCRIPTION' : 'DESCRIÃ‡ÃƒO',
    plannedBadge: isEn ? 'PLANNED' : 'PREVISTO',
    actualBadge: isEn ? 'ACTUAL' : 'REALIZADO',
    addRow: isEn ? '+ Add Row' : '+ Adicionar Linha',
    addSection: isEn ? '+ Add New Schedule Section' : '+ Adicionar Nova SeÃ§Ã£o de Cronograma',
    newSecTitle: isEn ? 'NEW WORK SECTION' : 'NOVA SEÃ‡ÃƒO DE SERVIÃ‡OS',
    intWork: isEn ? 'INTERIOR WORK PACKAGES' : 'SERVIÃ‡OS INTERNOS',
    extWork: isEn ? 'EXTERIOR WORK PACKAGES' : 'SERVIÃ‡OS EXTERNOS',
    legend: isEn ? 'LEGEND:' : 'LEGENDA:',
    selectOrType: isEn ? 'Select or type the step...' : 'Selecione ou digite a etapa...',
    
    // Alertas e ConfirmaÃ§Ãµes
    confirmFreeze: isEn ? 'Are you sure you want to freeze the current schedule? This will create the official project Baseline.' : 'Tem certeza que deseja congelar o planejamento atual? Isso criarÃ¡ a Linha de Base oficial do projeto.',
    confirmUnfreeze: isEn ? 'WARNING: Unfreezing the baseline will allow changes to the Planned schedule. Do you want to continue?' : 'ATENÃ‡ÃƒO: Descongelar a linha de base permitirÃ¡ alteraÃ§Ãµes no Previsto. Deseja continuar?',
    promptScenario: isEn ? 'Enter a name for this Scenario/Version:' : 'Digite um nome para este CenÃ¡rio/VersÃ£o:',
    scenarioSaved: isEn ? 'Scenario saved successfully! You can switch between scenarios in the top menu.' : 'CenÃ¡rio salvo com sucesso! VocÃª pode alternar entre os cenÃ¡rios no menu superior.',
    confirmClear: isEn ? 'Do you want to clear the current schedule to create a blank scenario?' : 'Deseja limpar o planejamento atual para criar um cenÃ¡rio em branco?',
    confirmLoad: isEn ? 'This will load the selected scenario and replace the current grid. Do you want to continue?' : 'Isso carregarÃ¡ o cenÃ¡rio selecionado e substituirÃ¡ a grade atual. Deseja continuar?',
    errHolidayExists: isEn ? 'A holiday is already registered for this date!' : 'JÃ¡ existe um feriado cadastrado para esta data!',
    confirmDelSection: isEn ? 'Do you want to delete this section?' : 'Deseja excluir a seÃ§Ã£o?',
    errFillFields: isEn ? 'Fill in Activity, Location, and Duration.' : 'Preencha Atividade, Linha e DuraÃ§Ã£o.',
    errSelectDate: isEn ? 'Select the start date.' : 'Selecione a data de inÃ­cio.',
    errSelectPred: isEn ? 'Select a predecessor package.' : 'Selecione um pacote predecessor.',
    errOutOfRange: isEn ? 'The chosen date is outside the schedule range.' : 'A data escolhida estÃ¡ fora do intervalo do cronograma.',
    warnEndEarly: (dias, dur) => isEn ? `Warning: The schedule ended before all days were allocated. ${dias} of ${dur} working days were allocated.` : `AtenÃ§Ã£o: O cronograma acabou antes de alocar todos os dias. Foram alocados ${dias} de ${dur} dias Ãºteis.`,
    
    // Textos do Modal de Pacote
    mPkgTitle: isEn ? 'Insert Work Package' : 'Inserir Pacote de Trabalho',
    mPkgService: isEn ? 'Service / Activity' : 'ServiÃ§o / Atividade',
    mPkgSelect: isEn ? '-- Select --' : '-- Selecione --',
    mPkgZone: isEn ? 'Location / Zone' : 'LocalizaÃ§Ã£o / Zona',
    mPkgRadioDate: isEn ? 'ðŸ“… Start on Specific Date' : 'ðŸ“… Iniciar em Data EspecÃ­fica',
    mPkgRadioPred: isEn ? 'ðŸ”— Start after Predecessor' : 'ðŸ”— Iniciar apÃ³s Predecessora',
    mPkgStartDate: isEn ? 'Start Date' : 'Data de InÃ­cio',
    mPkgLinkPred: isEn ? 'Link to Finish of:' : 'Vincular ao TÃ©rmino de:',
    mPkgSelectPred: isEn ? '-- Select Completed Package --' : '-- Selecione o Pacote ConcluÃ­do --',
    mPkgNoPred: isEn ? 'No package added yet. Use Specific Date first.' : 'Nenhum pacote lanÃ§ado ainda. Use a Data EspecÃ­fica primeiro.',
    mPkgDuration: isEn ? 'Duration (Working Days)' : 'DuraÃ§Ã£o (Dias Ãšteis)',
    mPkgCancel: isEn ? 'Cancel' : 'Cancelar',
    mPkgAddGrid: isEn ? 'Add to Grid' : 'LanÃ§ar na Grade',
    

    mHolTitle: isEn ? 'Register Holidays (Local/State/Federal)' : 'Cadastrar Feriados (Mun/Est/Fed)',
    mHolDescPlace: isEn ? 'Description (e.g., National Holiday)' : 'DescriÃ§Ã£o (ex: Padroeira)',
    mHolAdd: isEn ? 'Add' : 'Adicionar',
    mHolDateCol: isEn ? 'Date' : 'Data',
    mHolDescCol: isEn ? 'Description' : 'DescriÃ§Ã£o',
    mHolActionCol: isEn ? 'Action' : 'AÃ§Ã£o',
    mHolEmpty: isEn ? 'No holidays registered.' : 'Nenhum feriado cadastrado.',
    mHolDel: isEn ? 'Delete' : 'Excluir',
    mHolDone: isEn ? 'Done' : 'Concluir',
    
    mPdfTitle: isEn ? 'Print Configuration (PDF)' : 'ConfiguraÃ§Ã£o de ImpressÃ£o (PDF)',
    mPdfSugest: isEn ? 'System Suggestion:' : 'SugestÃ£o do Sistema:',
    mPdfSugestText: (len) => isEn ? `Based on your current schedule width (${len} columns), we recommend using paper size` : `Com base na largura atual do seu cronograma (${len} colunas), recomendamos utilizar o papel`,
    mPdfSize: isEn ? 'Paper Size' : 'Tamanho da Folha',
    mPdf_a4: isEn ? 'A4 (Standard)' : 'A4 (PadrÃ£o)',
    mPdf_a3: isEn ? 'A3 (Recommended)' : 'A3 (Recomendado)',
    mPdf_a2: isEn ? 'A2 (Large)' : 'A2 (Grande)',
    mPdf_a1: isEn ? 'A1 (Giant)' : 'A1 (Gigante)',
    mPdf_a0: isEn ? 'A0 (Extreme)' : 'A0 (Extremo)',
    mPdf_unica: isEn ? 'Perfect Fit (Single Continuous Page)' : 'Ajuste Perfeito (PÃ¡gina Ãšnica ContÃ­nua)',
    mPdfOrient: isEn ? 'Orientation' : 'OrientaÃ§Ã£o',
    mPdfLand: isEn ? 'Landscape (Horizontal)' : 'Paisagem (Horizontal)',
    mPdfPort: isEn ? 'Portrait (Vertical)' : 'Retrato (Vertical)',
    mPdfConfirm: isEn ? 'Confirm and Download PDF' : 'Confirmar e Baixar PDF',
  };

  const [projects, setProjects] = useState([]);
  const [projectCoverUrls, setProjectCoverUrls] = useState({});
  const [projectProgressMap, setProjectProgressMap] = useState({});
  const [selectedProjectId, setSelectedProjectId] = useState('');

  const [isBaselineFrozen, setIsBaselineFrozen] = useState(false);
  const [modoControle, setModoControle] = useState(false);

  const [dataInicio, setDataInicio] = useState('2026-08-03');
  const [dataFim, setDataFim] = useState('2026-10-31');
  const [ocultarFinaisDeSemana, setOcultarFinaisDeSemana] = useState(false);

  // ============================================================
  // SHARED PROJECT WORK PACKAGE CATALOG
  // ============================================================
  //
  // project_work_packages is now the source of truth for Work Package
  // identity, description and color.
  //
  // OFF / FER are calendar markers, not Work Packages, so they remain
  // system-level visual definitions.
  //
  const [servicosProjeto, setServicosProjeto] = useState({});

  const servicosCores = {
    ...servicosProjeto,

    '': SYSTEM_CALENDAR_CODES[''],
    OFF: SYSTEM_CALENDAR_CODES.OFF,
    FER: SYSTEM_CALENDAR_CODES.FER
  };


  const [showHolidaysModal, setShowHolidaysModal] = useState(false);
  const [holidays, setHolidays] = useState([]);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayDescription, setNewHolidayDescription] = useState('');

  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfConfig, setPdfConfig] = useState({ formato: 'a3', orientacao: 'landscape' });

  // SISTEMA DE VERSÃ•ES (LAST PLANNER)
  const [scenarios, setScenarios] = useState([]);
  const [activeScenarioId, setActiveScenarioId] = useState(null);

  // MOTOR DE AGENDAMENTO (SCHEDULING ENGINE)
  const [workPackages, setWorkPackages] = useState([]); 
  const [showWorkPackageModal, setShowWorkPackageModal] = useState(false);
  const [tipoInicio, setTipoInicio] = useState('data'); 
  const [pacotePredecessora, setPacotePredecessora] = useState('');
  const [packageActivity, setPackageActivity] = useState('');
  const [packageRowId, setPackageRowId] = useState('');
  const [packageStartDate, setPackageStartDate] = useState('');
  const [packageDuration, setPackageDuration] = useState(1);

  // WORK SEQUENCE GENERATOR
  const [showSequenceModal, setShowSequenceModal] = useState(false);
  const [sequenceLocations, setSequenceLocations] = useState([]);
  const [sequenceActivities, setSequenceActivities] = useState([]);
  const [sequenceNewActivity, setSequenceNewActivity] = useState('');
  const [sequenceStartType, setSequenceStartType] = useState('data');
  const [sequenceStartDate, setSequenceStartDate] = useState('');
  const [sequencePredecessor, setSequencePredecessor] = useState('');
  const [sequenceStartLag, setSequenceStartLag] = useState(0);
  const [sequenceConfigurations, setSequenceConfigurations] = useState([]);
  const [activeSequenceConfigId, setActiveSequenceConfigId] = useState(null);
  const [sequenceName, setSequenceName] = useState('');
  const [sequenceEditingId, setSequenceEditingId] = useState(null);
  const [sequenceDrag, setSequenceDrag] = useState(null);
  const [sequenceDragOver, setSequenceDragOver] = useState(null);
  const [packageDrag, setPackageDrag] = useState(null);

  const [datasPlanilha, setDatasPlanilha] = useState([]);
  const [dadosCelulas, setDadosCelulas] = useState({});
  const [dadosRealizado, setDadosRealizado] = useState({});
  const [zonasColeta, setZonasColeta] = useState([]);

  // Canonical Location Structure template used by new / blank scenarios.
  // Saved scenarios keep their own persisted section snapshots.
  const [
    locationStructureSections,
    setLocationStructureSections
  ] = useState([]);

  const [secoes, setSecoes] = useState([]);

  // ----------------------------------------------------
  // SISTEMA GLOBAL DE DESFAZER AÃ‡Ã•ES (HISTORY STACK)
  // ----------------------------------------------------
  const [historico, setHistorico] = useState([]);
  const isUndoRef = useRef(false);

  const salvarHistorico = () => {
    setHistorico(prev => [...prev, {
      pacotes: JSON.stringify(workPackages),
      celulas: JSON.stringify(dadosCelulas),
      realizado: JSON.stringify(dadosRealizado),
      holidays: JSON.stringify(holidays),
      secoes: JSON.stringify(secoes)
    }]);
  };

  const handleDesfazer = () => {
    if (historico.length === 0) return;
    
    // Trava o recÃ¡lculo automÃ¡tico para preservar o snapshot exatamente como ele era
    isUndoRef.current = true;
    
    const novoHistorico = [...historico];
    const snapshot = novoHistorico.pop();
    setHistorico(novoHistorico);

    setWorkPackages(JSON.parse(snapshot.pacotes));
    setDadosCelulas(JSON.parse(snapshot.celulas));
    setDadosRealizado(JSON.parse(snapshot.realizado));
    setHolidays(JSON.parse(snapshot.holidays));
    setSecoes(JSON.parse(snapshot.secoes));
    setActiveScenarioId(null);
  };
  // ----------------------------------------------------

  const formatScenarioDate = (valor) => {
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

  const mapScenarioRecord = (registro) => ({
    id: registro.id,
    nome: registro.name,
    data: formatScenarioDate(registro.updated_at || registro.created_at),
    status: registro.status,
    isBaseline: Boolean(registro.is_baseline),
    plannedStartDate: registro.planned_start_date,
    plannedFinishDate: registro.planned_finish_date,
    planData: registro.plan_data || {}
  });

  const applySavedPlan = (versao) => {
    const plano = versao?.planData || {};

    setWorkPackages(Array.isArray(plano.packages) ? plano.packages : []);
    setHolidays(Array.isArray(plano.holidays) ? plano.holidays : []);

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

    const savedSequenceConfigurations =
      Array.isArray(plano.sequenceConfigurations)
        ? plano.sequenceConfigurations
        : [];

    setSequenceConfigurations(savedSequenceConfigurations);
    setActiveSequenceConfigId(savedSequenceConfigurations[0]?.id || null);
    setSequenceEditingId(null);

    if (versao?.plannedStartDate) setDataInicio(versao.plannedStartDate);
    if (versao?.plannedFinishDate) setDataFim(versao.plannedFinishDate);

    setIsBaselineFrozen(Boolean(versao?.isBaseline));
    setModoControle(Boolean(versao?.isBaseline));
    setActiveScenarioId(versao?.id || null);
    setHistorico([]);
  };

  const obterDependenciasPacote = (pacote) => {
    if (
      Array.isArray(
        pacote?.dependencies
      ) &&
      pacote.dependencies.length > 0
    ) {
      return pacote.dependencies
        .filter(
          (dependency) =>
            dependency?.predecessorId
        )
        .map(
          (dependency) => ({
            type:
              dependency.type ||
              'external',
            predecessorId:
              dependency.predecessorId,
            lagWorkingDays:
              Math.max(
                0,
                Number(
                  dependency.lagWorkingDays ||
                  0
                )
              )
          })
        );
    }

    if (
      pacote?.tipoInicio ===
        'predecessora' &&
      pacote?.predecessoraId
    ) {
      return [
        {
          type: 'external',
          predecessorId:
            pacote.predecessoraId,
          lagWorkingDays:
            Math.max(
              0,
              Number(
                pacote.lagWorkingDays ||
                0
              )
            )
        }
      ];
    }

    return [];
  };

  // ----------------------------------------------------
  // OPTIMIZED DEPENDENCY NETWORK RECONSTRUCTION
  // ----------------------------------------------------
  // This is intentionally calculated ONCE with useMemo below.
  // Never call this helper from individual calendar cells.
  const obterConfiguracaoSequenciaPacote = (
    pacote
  ) => {
    if (!pacote) return null;

    if (pacote.sequenceGroupId) {
      const directConfig =
        sequenceConfigurations.find(
          (config) =>
            config.id ===
            pacote.sequenceGroupId
        );

      if (directConfig) {
        return directConfig;
      }
    }

    // Legacy fallback for a generated package created before
    // sequenceGroupId was persisted.
    if (
      pacote.generatedBySequence &&
      sequenceConfigurations.length === 1
    ) {
      return sequenceConfigurations[0];
    }

    return null;
  };

  const isPacoteAncoraSequencia = (
    pacote
  ) => {
    const config =
      obterConfiguracaoSequenciaPacote(
        pacote
      );

    if (!config) return false;

    const firstLocation =
      (
        config.locations ||
        []
      ).find(
        (location) =>
          location.selected !== false
      );

    const firstActivity =
      (
        config.activities ||
        []
      )[0];

    if (
      !firstLocation ||
      !firstActivity
    ) {
      return false;
    }

    return (
      pacote.linhaId ===
        firstLocation.rowId &&
      pacote.atividade ===
        firstActivity.code
    );
  };

  const reconstruirRedeDependencias = (
    packagesSnapshot
  ) => {
    const packages =
      Array.isArray(
        packagesSnapshot
      )
        ? packagesSnapshot
        : [];

    if (
      packages.length === 0
    ) {
      return [];
    }

    // IMPORTANT:
    // Location flow must NOT be inferred from the visual top-to-bottom
    // order of the Line of Balance rows. The user may have reordered
    // locations inside the Work Sequence Generator, and the execution
    // direction may be bottom-to-top.
    //
    // workPackages preserves the original generator order, because
    // the generator creates every activity for Location 1, then every
    // activity for Location 2, and so on.
    //
    // Therefore the first appearance of each linhaId is the safest
    // representation of the actual Location Flow that was saved.
    const orderedRowIds = [];

    packages.forEach(
      (pkg) => {
        if (
          pkg?.linhaId &&
          !orderedRowIds.includes(
            pkg.linhaId
          )
        ) {
          orderedRowIds.push(
            pkg.linhaId
          );
        }
      }
    );

    // Fallback only for rows that currently have no package.
    // They are appended after the saved execution-flow rows and do
    // not alter the dependency order of existing scheduled packages.
    secoes.forEach(
      (section) => {
        (
          section.linhas ||
          []
        ).forEach(
          (row) => {
            if (
              row?.id &&
              !orderedRowIds.includes(
                row.id
              )
            ) {
              orderedRowIds.push(
                row.id
              );
            }
          }
        );
      }
    );

    const rowIndex =
      new Map(
        orderedRowIds.map(
          (
            rowId,
            index
          ) => [
            rowId,
            index
          ]
        )
      );

    // Activity order comes from first appearance in the
    // current package snapshot, which preserves the generator
    // sequence without scanning the calendar.
    const orderedActivities =
      [];

    packages.forEach(
      (pkg) => {
        if (
          pkg?.atividade &&
          !orderedActivities.includes(
            pkg.atividade
          )
        ) {
          orderedActivities.push(
            pkg.atividade
          );
        }
      }
    );

    const activityIndex =
      new Map(
        orderedActivities.map(
          (
            activity,
            index
          ) => [
            activity,
            index
          ]
        )
      );

    const packageAt =
      new Map();

    packages.forEach(
      (pkg) => {
        packageAt.set(
          `${pkg.linhaId}___${pkg.atividade}`,
          pkg
        );
      }
    );

    return packages.map(
      (pkg) => {
        const isSequenceAnchor =
          isPacoteAncoraSequencia(
            pkg
          );

        const existing =
          isSequenceAnchor
            ? []
            : obterDependenciasPacote(
                pkg
              );

        const dependencies =
          [];

        const seen =
          new Set();

        const addDependency = (
          dependency
        ) => {
          if (
            !dependency
              ?.predecessorId ||
            dependency
              .predecessorId ===
              pkg.id
          ) {
            return;
          }

          const key =
            `${dependency.type || 'external'}___${dependency.predecessorId}`;

          if (
            seen.has(
              key
            )
          ) {
            return;
          }

          seen.add(
            key
          );

          dependencies.push({
            type:
              dependency.type ||
              'external',

            predecessorId:
              dependency
                .predecessorId,

            lagWorkingDays:
              Math.max(
                0,
                Number(
                  dependency
                    .lagWorkingDays ||
                  0
                )
              )
          });
        };

        // Keep explicit external anchors.
        existing
          .filter(
            (dependency) =>
              dependency.type ===
              'external'
          )
          .forEach(
            addDependency
          );

        const hasSavedTrade =
          existing.some(
            (dependency) =>
              dependency.type ===
              'trade'
          );

        const hasSavedFlow =
          existing.some(
            (dependency) =>
              dependency.type ===
              'flow'
          );

        const currentRowIndex =
          rowIndex.get(
            pkg.linhaId
          );

        const currentActivityIndex =
          activityIndex.get(
            pkg.atividade
          );

        // TRADE dependency:
        // previous activity in the SAME location.
        if (
          !isSequenceAnchor &&
          !hasSavedTrade &&
          Number.isInteger(
            currentActivityIndex
          ) &&
          currentActivityIndex > 0
        ) {
          const previousActivity =
            orderedActivities[
              currentActivityIndex -
                1
            ];

          const previousTrade =
            packageAt.get(
              `${pkg.linhaId}___${previousActivity}`
            );

          if (
            previousTrade
          ) {
            const existingTrade =
              existing.find(
                (dependency) =>
                  dependency.type ===
                    'trade' &&
                  dependency
                    .predecessorId ===
                    previousTrade.id
              );

            addDependency({
              type: 'trade',

              predecessorId:
                previousTrade.id,

              lagWorkingDays:
                existingTrade
                  ?.lagWorkingDays ??
                (
                  pkg.predecessoraId ===
                  previousTrade.id
                    ? Number(
                        pkg.lagWorkingDays ||
                        0
                      )
                    : 0
                )
            });
          }
        }

        // FLOW dependency:
        // same activity in the immediately previous location
        // where that activity exists.
        if (
          !isSequenceAnchor &&
          !hasSavedFlow &&
          Number.isInteger(
            currentRowIndex
          ) &&
          currentRowIndex > 0
        ) {
          for (
            let previousRowIndex =
              currentRowIndex -
                1;
            previousRowIndex >=
            0;
            previousRowIndex -= 1
          ) {
            const previousRowId =
              orderedRowIds[
                previousRowIndex
              ];

            const previousLocation =
              packageAt.get(
                `${previousRowId}___${pkg.atividade}`
              );

            if (
              !previousLocation
            ) {
              continue;
            }

            const existingFlow =
              existing.find(
                (dependency) =>
                  dependency.type ===
                    'flow' &&
                  dependency
                    .predecessorId ===
                    previousLocation.id
              );

            addDependency({
              type: 'flow',

              predecessorId:
                previousLocation.id,

              lagWorkingDays:
                existingFlow
                  ?.lagWorkingDays ??
                (
                  pkg.predecessoraId ===
                  previousLocation.id
                    ? Number(
                        pkg.lagWorkingDays ||
                        0
                      )
                    : 0
                )
            });

            break;
          }
        }

        // Preserve any other previously stored relationships.
        existing.forEach(
          addDependency
        );

        return {
          ...pkg,
          dependencies
        };
      }
    );
  };

  // One dependency-network rebuild per schedule/section change.
  // This avoids the performance problem from Step 12.5 where
  // the network was reconstructed repeatedly inside cell logic.
  const pacotesComRede =
    React.useMemo(
      () =>
        reconstruirRedeDependencias(
          workPackages
        ),
      [
        workPackages,
        secoes
      ]
    );

  const pacoteComRedePorId =
    React.useMemo(
      () =>
        new Map(
          pacotesComRede.map(
            (pkg) => [
              pkg.id,
              pkg
            ]
          )
        ),
      [
        pacotesComRede
      ]
    );

  const montarPlanData = () => ({
    sections: secoes,
    packages: workPackages,
    plannedCells: dadosCelulas,
    actualCells: dadosRealizado,
    holidays: holidays,
    hideWeekends: ocultarFinaisDeSemana,
    sequenceConfigurations
  });

  const obterDatasPacoteDaGradeVisivel = (
    pacote
  ) => {
    if (
      !pacote?.linhaId ||
      !pacote?.atividade
    ) {
      return {
        scheduledStartDate: null,
        scheduledFinishDate: null
      };
    }

    const matchingDates =
      datasPlanilha
        .filter(
          (day) => {
            if (
              day.isFimDeSemana ||
              day.isFeriado
            ) {
              return false;
            }

            const cellKey =
              `${pacote.linhaId}___${day.dataIso}`;

            return (
              dadosCelulas[
                cellKey
              ] ===
              pacote.atividade
            );
          }
        )
        .map(
          (day) =>
            day.dataIso
        );

    return {
      scheduledStartDate:
        matchingDates[0] ||
        null,

      scheduledFinishDate:
        matchingDates[
          matchingDates.length -
            1
        ] ||
        null
    };
  };

  const criarSnapshotAgendaImutavel = (
    packagesSnapshot
  ) => {
    const rawPackages =
      Array.isArray(
        packagesSnapshot
      )
        ? packagesSnapshot
        : [];

    const packages =
      reconstruirRedeDependencias(
        rawPackages
      );

    const schedules =
      calcularAgendaPacotesCompleta(
        packages
      );

    const snapshot =
      new Map();

    packages.forEach(
      (pkg) => {
        const schedule =
          schedules.get(
            pkg.id
          ) ||
          null;

        snapshot.set(
          pkg.id,
          {
            scheduledStartDate:
              schedule
                ? (
                    datasPlanilha[
                      schedule.startIndex
                    ]?.dataIso ||
                    null
                  )
                : null,

            scheduledFinishDate:
              schedule
                ? (
                    datasPlanilha[
                      schedule.endIndex
                    ]?.dataIso ||
                    null
                  )
                : null,

            sequenceGroupId:
              pkg.sequenceGroupId ||
              obterConfiguracaoSequenciaPacote(
                pkg
              )?.id ||
              null
          }
        );
      }
    );

    return {
      packages,
      snapshot
    };
  };


  const sincronizarPacotesNormalizados = async (
    scenarioId,
    packagesSnapshot = workPackages,
    immutableScheduleSnapshot = null
  ) => {
    if (!scenarioId || !selectedProjectId) {
      return {
        ok: false,
        error: new Error(
          'Scenario or project is missing.'
        )
      };
    }

    const preparedSchedule =
      immutableScheduleSnapshot &&
      immutableScheduleSnapshot.packages &&
      immutableScheduleSnapshot.snapshot
        ? immutableScheduleSnapshot
        : criarSnapshotAgendaImutavel(
            packagesSnapshot
          );

    const packages =
      preparedSchedule.packages;

    const immutableSnapshot =
      preparedSchedule.snapshot;

    // IMPORTANT:
    // The schedule snapshot is built BEFORE the async persistence flow.
    //
    // agendaPacotes is the authoritative schedule already used to draw
    // the Line of Balance. Persisting those exact results guarantees
    // that the database dates match what the user sees on screen.
    //
    // This also avoids timing differences between regeneration, drag,
    // calendar expansion and the save operation.

    // ----------------------------------------------------
    // 1. CLEAR PREVIOUS NORMALIZED NETWORK
    // ----------------------------------------------------
    const {
      error: dependencyDeleteError
    } = await supabase
      .from(
        'master_plan_package_dependencies'
      )
      .delete()
      .eq(
        'scenario_id',
        scenarioId
      )
      .eq(
        'project_id',
        selectedProjectId
      );

    if (dependencyDeleteError) {
      console.error(
        'Master Plan - delete normalized dependencies:',
        dependencyDeleteError
      );

      return {
        ok: false,
        error: dependencyDeleteError
      };
    }

    const {
      error: deleteError
    } = await supabase
      .from(
        'master_plan_packages'
      )
      .delete()
      .eq(
        'scenario_id',
        scenarioId
      )
      .eq(
        'project_id',
        selectedProjectId
      );

    if (deleteError) {
      console.error(
        'Master Plan - delete normalized packages:',
        deleteError
      );

      return {
        ok: false,
        error: deleteError
      };
    }

    if (packages.length === 0) {
      return {
        ok: true,
        insertedCount: 0,
        dependencyCount: 0
      };
    }

    // ----------------------------------------------------
    // 2. LOOKUP MAPS
    // ----------------------------------------------------
    const rowById = new Map();

    secoes.forEach((section) => {
      (section.linhas || []).forEach((row) => {
        rowById.set(
          row.id,
          row
        );
      });
    });

    const packageByUiId =
      new Map(
        packages.map(
          (pkg) => [
            pkg.id,
            pkg
          ]
        )
      );

    const dbIdByUiId =
      new Map();

    const inserted =
      new Set();

    const visiting =
      new Set();

    // ----------------------------------------------------
    // 3. INSERT PACKAGES IN DEPENDENCY ORDER
    //
    // This preserves the existing DB constraint:
    //
    // predecessor start rule
    //     => predecessor_package_id must already exist.
    //
    // We still preserve EVERY logical predecessor separately
    // in master_plan_package_dependencies afterward.
    // ----------------------------------------------------
    const insertPackage = async (
      pkg,
      sequenceNumber
    ) => {
      if (!pkg?.id) {
        throw new Error(
          'Master Plan package is missing its UI identifier.'
        );
      }

      if (
        inserted.has(
          pkg.id
        )
      ) {
        return dbIdByUiId.get(
          pkg.id
        );
      }

      if (
        visiting.has(
          pkg.id
        )
      ) {
        throw new Error(
          `Circular dependency detected for package ${pkg.id}.`
        );
      }

      visiting.add(
        pkg.id
      );

      const dependencies =
        obterDependenciasPacote(
          pkg
        );

      // Compatibility controlling predecessor.
      // The full network is stored later in the dependency table.
      const controllingDependency =
        dependencies.find(
          (dependency) =>
            dependency.predecessorId ===
            pkg.predecessoraId
        ) ||
        dependencies[0] ||
        null;

      let controllingPredecessorDbId =
        null;

      if (
        controllingDependency
          ?.predecessorId
      ) {
        const predecessor =
          packageByUiId.get(
            controllingDependency
              .predecessorId
          );

        if (!predecessor) {
          throw new Error(
            `Predecessor ${controllingDependency.predecessorId} was not found in this scenario.`
          );
        }

        const predecessorIndex =
          packages.findIndex(
            (item) =>
              item.id ===
              predecessor.id
          );

        controllingPredecessorDbId =
          await insertPackage(
            predecessor,
            predecessorIndex >= 0
              ? predecessorIndex
              : 0
          );
      }

      const row =
        rowById.get(
          pkg.linhaId
        ) || null;

      const service =
        servicosCores[
          pkg.atividade
        ] || null;

      const hasPredecessor =
        Boolean(
          controllingPredecessorDbId
        );

      const fallbackStartDate =
        pkg.dataInicio ||
        dataInicio ||
        null;

      const persistedSchedule =
        immutableSnapshot.get(
          pkg.id
        ) ||
        null;

      const scheduledStartDate =
        persistedSchedule
          ?.scheduledStartDate ||
        null;

      const scheduledFinishDate =
        persistedSchedule
          ?.scheduledFinishDate ||
        null;

      if (
        !scheduledStartDate ||
        !scheduledFinishDate
      ) {
        console.warn(
          'Master Plan - immutable schedule snapshot missing dates:',
          {
            packageId:
              pkg.id,
            packageCode:
              pkg.atividade,
            rowId:
              pkg.linhaId
          }
        );
      }

      const persistedSequenceGroupId =
        persistedSchedule
          ?.sequenceGroupId ||
        null;

      const payload = {
        scenario_id:
          scenarioId,

        project_id:
          selectedProjectId,

        location_id:
          pkg.locationId ||
          row?.locationId ||
          null,

        project_service_id:
          pkg.projectServiceId ||
          service?.projectServiceId ||
          null,

        row_key:
          pkg.linhaId ||
          null,

        package_code:
          String(
            pkg.atividade ||
            ''
          )
            .trim()
            .toUpperCase()
            .slice(
              0,
              3
            ) ||
          null,

        location_name:
          row?.descricao ||
          null,

        location_path:
          pkg.locationPath ||
          row?.locationPath ||
          row?.descricao ||
          null,

        service_name:
          service
            ? (
                isEn
                  ? service.labelEn
                  : service.labelPt
              ) ||
              service.labelEn ||
              service.labelPt ||
              pkg.atividade
            : pkg.atividade ||
              null,

        service_code:
          service?.sourceServiceCode ||
          pkg.atividade ||
          null,

        unit:
          service?.unit ||
          null,

        start_rule:
          hasPredecessor
            ? 'predecessor'
            : 'date',

        planned_start_date:
          hasPredecessor
            ? null
            : fallbackStartDate,

        predecessor_package_id:
          controllingPredecessorDbId,

        duration_working_days:
          Math.max(
            1,
            Number(
              pkg.duracao ||
              1
            )
          ),

        lag_working_days:
          Math.max(
            0,
            Number(
              controllingDependency
                ?.lagWorkingDays ||
              pkg.lagWorkingDays ||
              0
            )
          ),

        manual_delay_working_days:
          Math.max(
            0,
            Number(
              pkg.manualDelayWorkingDays ||
              0
            )
          ),

        scheduled_start_date:
          scheduledStartDate,

        scheduled_finish_date:
          scheduledFinishDate,

        sequence_group_id:
          persistedSequenceGroupId,

        sequence_number:
          Math.max(
            0,
            Number(
              sequenceNumber ||
              0
            )
          )
      };

      const {
        data: insertedPackage,
        error: insertError
      } = await supabase
        .from(
          'master_plan_packages'
        )
        .insert(
          payload
        )
        .select(`
          id,
          scheduled_start_date,
          scheduled_finish_date,
          sequence_group_id
        `)
        .single();

      if (insertError) {
        throw insertError;
      }

      if (
        scheduledStartDate &&
        insertedPackage
          ?.scheduled_start_date !==
          scheduledStartDate
      ) {
        throw new Error(
          `Master Plan schedule persistence mismatch for ${pkg.atividade}: expected start ${scheduledStartDate}, stored ${insertedPackage?.scheduled_start_date || 'NULL'}.`
        );
      }

      if (
        scheduledFinishDate &&
        insertedPackage
          ?.scheduled_finish_date !==
          scheduledFinishDate
      ) {
        throw new Error(
          `Master Plan schedule persistence mismatch for ${pkg.atividade}: expected finish ${scheduledFinishDate}, stored ${insertedPackage?.scheduled_finish_date || 'NULL'}.`
        );
      }

      dbIdByUiId.set(
        pkg.id,
        insertedPackage.id
      );

      inserted.add(
        pkg.id
      );

      visiting.delete(
        pkg.id
      );

      return insertedPackage.id;
    };

    try {
      for (
        let index = 0;
        index < packages.length;
        index += 1
      ) {
        await insertPackage(
          packages[index],
          index
        );
      }
    } catch (error) {
      console.error(
        'Master Plan - normalized package insertion:',
        error
      );

      return {
        ok: false,
        error
      };
    }

    // ----------------------------------------------------
    // 4. INSERT FULL MULTI-PREDECESSOR NETWORK
    // ----------------------------------------------------
    const dependencyRows =
      [];

    packages.forEach((pkg) => {
      const packageDbId =
        dbIdByUiId.get(
          pkg.id
        );

      if (!packageDbId) {
        return;
      }

      obterDependenciasPacote(
        pkg
      ).forEach(
        (dependency) => {
          const predecessorDbId =
            dbIdByUiId.get(
              dependency
                .predecessorId
            );

          if (
            !predecessorDbId
          ) {
            return;
          }

          dependencyRows.push({
            scenario_id:
              scenarioId,

            project_id:
              selectedProjectId,

            package_id:
              packageDbId,

            predecessor_package_id:
              predecessorDbId,

            dependency_type:
              dependency.type ||
              'external',

            lag_working_days:
              Math.max(
                0,
                Number(
                  dependency
                    .lagWorkingDays ||
                  0
                )
              )
          });
        }
      );
    });

    if (
      dependencyRows.length > 0
    ) {
      const {
        error:
          dependencyInsertError
      } = await supabase
        .from(
          'master_plan_package_dependencies'
        )
        .insert(
          dependencyRows
        );

      if (
        dependencyInsertError
      ) {
        console.error(
          'Master Plan - insert dependency network:',
          dependencyInsertError
        );

        return {
          ok: false,
          error:
            dependencyInsertError
        };
      }
    }

    return {
      ok: true,
      insertedCount:
        inserted.size,
      dependencyCount:
        dependencyRows.length
    };
  };

  useEffect(() => {
    const fetchProjects = async () => {
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
      setProjects(projects);

      // If the user opened a project card, restore that project directly
      // from the URL while keeping the sidebar route unchanged.
      const projectIdFromUrl = new URLSearchParams(window.location.search).get('projectId');
      if (projectIdFromUrl && projects.some((project) => project.id === projectIdFromUrl)) {
        setSelectedProjectId(projectIdFromUrl);
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

    fetchProjects();
  }, []);

  useEffect(() => {
    const loadProjectMasterPlan = async () => {
      if (!selectedProjectId) {
        setZonasColeta([]);
        setLocationStructureSections([]);
        setSecoes([]);
        setServicosProjeto({});
        setScenarios([]);
        setActiveScenarioId(null);
        setSequenceConfigurations([]);
        setActiveSequenceConfigId(null);
        setSequenceEditingId(null);
        setIsBaselineFrozen(false);
        setModoControle(false);
        setHistorico([]);
        return;
      }

      const [
        locationsResult,
        workPackagesResult,
        servicesResult,
        scenariosResult
      ] = await Promise.all([
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
          .eq('project_id', selectedProjectId)
          .order('sequence_number', { ascending: true })
          .order('name', { ascending: true }),

        // ----------------------------------------------------
        // SHARED WORK PACKAGE DATABASE
        // ----------------------------------------------------
        // This is the authoritative source for selectable Master Plan
        // Work Packages, descriptions and colors.
        supabase.rpc(
          'get_project_work_packages',
          {
            target_project_id:
              selectedProjectId
          }
        ),

        // ----------------------------------------------------
        // LEGACY PROJECT SERVICES
        // ----------------------------------------------------
        // Retained only during the migration stage because
        // master_plan_packages.project_service_id still references
        // public.project_services.
        //
        // We NEVER store a project_work_packages UUID in that old FK.
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
          .eq('project_id', selectedProjectId)
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
          .eq('project_id', selectedProjectId)
          .order('is_baseline', { ascending: false })
          .order('updated_at', { ascending: false })
      ]);

      const loadError =
        locationsResult.error ||
        workPackagesResult.error ||
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

      const canonicalSections =
        buildMasterPlanSectionsFromLocations(
          locations
        );

      setLocationStructureSections(
        canonicalSections
      );

      // Only planning rows (leaf locations) are exposed as selectable
      // Master Plan locations. Full paths stay available for context.
      setZonasColeta(
        [
          ...new Set(
            canonicalSections.flatMap(
              (section) =>
                section.linhas.map(
                  (row) =>
                    row.locationPath ||
                    row.descricao
                )
            )
          ),
        ].filter(Boolean)
      );

      // ======================================================
      // SHARED PROJECT WORK PACKAGE CATALOG
      // ======================================================
      //
      // Work Package code, standard description and color now come
      // from public.project_work_packages.
      //
      // project_services is consulted only to preserve the existing
      // master_plan_packages.project_service_id foreign-key linkage
      // while the normalized schema is migrated in a later step.
      //
      // A catalog Work Package that has no matching legacy
      // project_services row remains perfectly valid in Master Plan;
      // its project_service_id is simply persisted as NULL.
      // ======================================================

      const legacyProjectServices =
        servicesResult.data || [];

      const findLegacyProjectService = (
        workPackage
      ) => {
        const packageCode =
          normalizeText(
            workPackage?.code ||
            ''
          ).replace(
            /[^A-Z0-9]/g,
            ''
          );

        const packageDescription =
          normalizeText(
            workPackage?.description ||
            ''
          );

        return (
          legacyProjectServices.find(
            (service) =>
              normalizeText(
                service?.service_code ||
                ''
              ).replace(
                /[^A-Z0-9]/g,
                ''
              ) === packageCode
          ) ||
          legacyProjectServices.find(
            (service) =>
              normalizeText(
                service?.service_name ||
                ''
              ) === packageDescription
          ) ||
          null
        );
      };

      const projectWorkPackageMap =
        {};

      (
        workPackagesResult.data ||
        []
      ).forEach(
        (workPackage) => {
          const code =
            normalizeText(
              workPackage?.code ||
              ''
            ).replace(
              /[^A-Z]/g,
              ''
            );

          if (
            code.length !== 3
          ) {
            console.warn(
              'Master Plan - ignored invalid Work Package code:',
              workPackage
            );
            return;
          }

          const color =
            String(
              workPackage?.color ||
              '#64748b'
            ).toUpperCase();

          const legacyService =
            findLegacyProjectService(
              workPackage
            );

          projectWorkPackageMap[
            code
          ] = {
            labelPt:
              workPackage.description ||
              code,

            labelEn:
              workPackage.description ||
              code,

            color,

            text:
              getContrastYIQ(
                color
              ),

            // IMPORTANT:
            // This remains the legacy public.project_services UUID
            // when a compatible service exists. It is NOT the
            // project_work_packages UUID.
            projectServiceId:
              legacyService?.id ||
              null,

            // Persistent shared Work Package identity. This stays
            // available inside the Master Plan scenario snapshot and
            // prepares the normalized schema migration.
            projectWorkPackageId:
              workPackage.id,

            sourceServiceCode:
              legacyService?.service_code ||
              code,

            unit:
              legacyService?.unit ||
              '',

            source:
              'project_work_packages'
          };
        }
      );

      setServicosProjeto(
        projectWorkPackageMap
      );

      const mappedVersions = (scenariosResult.data || []).map(mapScenarioRecord);
      setScenarios(mappedVersions);

      const initialVersion =
        mappedVersions.find((item) => item.isBaseline) ||
        mappedVersions[0] ||
        null;

      if (initialVersion) {
        applySavedPlan(initialVersion);
      } else {
        setActiveScenarioId(null);
        setIsBaselineFrozen(false);
        setModoControle(false);
        setSequenceConfigurations([]);
        setActiveSequenceConfigId(null);
        setSequenceEditingId(null);
        setWorkPackages([]);
        setHolidays([]);
        setDadosCelulas({});
        setDadosRealizado({});

        // New Master Plans start from the project's canonical
        // Location Structure instead of the old hard-coded rows.
        setSecoes(canonicalSections);

        setHistorico([]);
      }
    };

    loadProjectMasterPlan();
  }, [selectedProjectId, isEn]);

  // GERAÃ‡ÃƒO DO CALENDÃRIO COM DATAS INTERNACIONAIS
  useEffect(() => {
    const gerarDatas = () => {
      if (!dataInicio || !dataFim || !selectedProjectId) return;

      const parseDataSemFuso = (dataStr) => {
        const [ano, mes, dia] = dataStr.split('-');
        return new Date(ano, mes - 1, dia);
      };

      const inicio = parseDataSemFuso(dataInicio);
      const fim = parseDataSemFuso(dataFim);

      if (fim < inicio) { setDatasPlanilha([]); return; }

      const datas = [];
      let dataAtual = new Date(inicio);
      
      const diasSemanaPt = ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sÃ¡b.'];
      const diasSemanaEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const diasSemana = isEn ? diasSemanaEn : diasSemanaPt;

      while (dataAtual <= fim) {
        const dataClonada = new Date(dataAtual);
        const dia = String(dataClonada.getDate()).padStart(2, '0');
        const mes = String(dataClonada.getMonth() + 1).padStart(2, '0');
        const ano = dataClonada.getFullYear();
        const diaSemanaIndex = dataClonada.getDay();
        
        const dataIso = `${ano}-${mes}-${dia}`;
        const isFeriado = holidays.some(f => f.data === dataIso);

        datas.push({
          dataCompleta: dataClonada,
          labelData: isEn ? `${mes}/${dia}` : `${dia}/${mes}`, // MM/DD ou DD/MM para VisualizaÃ§Ã£o
          labelSemana: diasSemana[diaSemanaIndex],
          isFimDeSemana: diaSemanaIndex === 0 || diaSemanaIndex === 6,
          isFeriado: isFeriado,
          dataIso: dataIso // CHAVE INVARIANTE USADA NO BANCO DE DADOS/MEMÃ“RIA
        });
        
        dataAtual.setDate(dataAtual.getDate() + 1);
      }
      setDatasPlanilha(datas);
    };
    gerarDatas();
  }, [dataInicio, dataFim, holidays, selectedProjectId, isEn]);

  const datasVisiveis = datasPlanilha.filter(d => ocultarFinaisDeSemana ? !d.isFimDeSemana : true);

  // ----------------------------------------------------
  // DYNAMIC FLOW SCHEDULING ENGINE
  // ----------------------------------------------------
  // Calculates the complete package network from every
  // Trade / Flow / External dependency.
  //
  // manualDelayWorkingDays is an ADDITIONAL offset after
  // the earliest legal start. Horizontal dragging changes
  // this offset, never the package's Location or dependency
  // identity.
  const calcularAgendaPacotesCompleta = (
    packagesSnapshot = workPackages
  ) => {
    const packages =
      Array.isArray(packagesSnapshot)
        ? packagesSnapshot
        : [];

    const packageById =
      new Map(
        packages.map(
          (pacote) => [
            pacote.id,
            pacote
          ]
        )
      );

    const scheduleCache =
      new Map();

    const isWorkingDay = (
      index
    ) => {
      const day =
        datasPlanilha[index];

      return Boolean(
        day &&
        !day.isFimDeSemana &&
        !day.isFeriado
      );
    };

    const nextWorkingDayIndex = (
      index
    ) => {
      let current =
        Math.max(
          0,
          Number(
            index ||
            0
          )
        );

      while (
        current <
          datasPlanilha.length &&
        !isWorkingDay(
          current
        )
      ) {
        current += 1;
      }

      return current;
    };

    const advanceWorkingDaysFromStart = (
      startIndex,
      workingDays
    ) => {
      let current =
        nextWorkingDayIndex(
          startIndex
        );

      let remaining =
        Math.max(
          0,
          Number(
            workingDays ||
            0
          )
        );

      while (
        remaining > 0 &&
        current + 1 <
          datasPlanilha.length
      ) {
        current += 1;

        if (
          isWorkingDay(
            current
          )
        ) {
          remaining -= 1;
        }
      }

      return nextWorkingDayIndex(
        current
      );
    };

    const calculate = (
      pacote,
      stack = new Set()
    ) => {
      if (
        !pacote?.id
      ) {
        return null;
      }

      if (
        scheduleCache.has(
          pacote.id
        )
      ) {
        return scheduleCache.get(
          pacote.id
        );
      }

      if (
        stack.has(
          pacote.id
        )
      ) {
        console.error(
          'Master Plan - circular dependency detected:',
          pacote.id
        );

        return null;
      }

      const nextStack =
        new Set(
          stack
        );

      nextStack.add(
        pacote.id
      );

      const dependencies =
        obterDependenciasPacote(
          pacote
        );

      let earliestLegalStart =
        -1;

      if (
        dependencies.length === 0
      ) {
        earliestLegalStart =
          datasPlanilha.findIndex(
            (day) =>
              day.dataIso ===
              pacote.dataInicio
          );

        earliestLegalStart =
          nextWorkingDayIndex(
            earliestLegalStart
          );
      } else {
        dependencies.forEach(
          (dependency) => {
            const predecessor =
              packageById.get(
                dependency
                  .predecessorId
              );

            if (!predecessor) {
              return;
            }

            const predecessorSchedule =
              calculate(
                predecessor,
                nextStack
              );

            if (
              !predecessorSchedule ||
              predecessorSchedule.endIndex <
                0
            ) {
              return;
            }

            // Lag occurs AFTER predecessor finish.
            let readyIndex =
              predecessorSchedule
                .endIndex;

            let remainingLag =
              Math.max(
                0,
                Number(
                  dependency
                    .lagWorkingDays ||
                  0
                )
              );

            while (
              remainingLag > 0 &&
              readyIndex + 1 <
                datasPlanilha.length
            ) {
              readyIndex += 1;

              if (
                isWorkingDay(
                  readyIndex
                )
              ) {
                remainingLag -= 1;
              }
            }

            // Successor begins on the next working day.
            readyIndex =
              nextWorkingDayIndex(
                readyIndex + 1
              );

            earliestLegalStart =
              Math.max(
                earliestLegalStart,
                readyIndex
              );
          }
        );
      }

      if (
        earliestLegalStart < 0 ||
        earliestLegalStart >=
          datasPlanilha.length
      ) {
        return null;
      }

      const startIndex =
        dependencies.length > 0
          ? advanceWorkingDaysFromStart(
              earliestLegalStart,
              Math.max(
                0,
                Number(
                  pacote
                    .manualDelayWorkingDays ||
                  0
                )
              )
            )
          : earliestLegalStart;

      if (
        startIndex < 0 ||
        startIndex >=
          datasPlanilha.length
      ) {
        return null;
      }

      let allocatedDays = 0;
      let endIndex =
        startIndex;

      for (
        let index = startIndex;
        index <
          datasPlanilha.length &&
        allocatedDays <
          Math.max(
            1,
            Number(
              pacote.duracao ||
              1
            )
          );
        index += 1
      ) {
        if (
          isWorkingDay(
            index
          )
        ) {
          allocatedDays += 1;
          endIndex = index;
        }
      }

      const result = {
        startIndex,
        endIndex:
          allocatedDays > 0
            ? endIndex
            : -1,
        earliestLegalStart
      };

      scheduleCache.set(
        pacote.id,
        result
      );

      return result;
    };

    packages.forEach(
      (pacote) => {
        calculate(
          pacote
        );
      }
    );

    return scheduleCache;
  };

  const contarDiasUteisEntreIndices = (
    fromIndex,
    toIndex
  ) => {
    if (
      toIndex <=
      fromIndex
    ) {
      return 0;
    }

    let count = 0;

    for (
      let index =
        fromIndex + 1;
      index <=
        toIndex;
      index += 1
    ) {
      const day =
        datasPlanilha[index];

      if (
        day &&
        !day.isFimDeSemana &&
        !day.isFeriado
      ) {
        count += 1;
      }
    }

    return count;
  };

  const normalizarDestinoDrag = (
    targetIndex,
    direction = 1
  ) => {
    let index =
      Math.max(
        0,
        Math.min(
          Number(
            targetIndex ||
            0
          ),
          Math.max(
            0,
            datasPlanilha.length -
              1
          )
        )
      );

    const step =
      direction < 0
        ? -1
        : 1;

    while (
      index >= 0 &&
      index <
        datasPlanilha.length &&
      (
        datasPlanilha[
          index
        ]?.isFimDeSemana ||
        datasPlanilha[
          index
        ]?.isFeriado
      )
    ) {
      index += step;
    }

    if (
      index < 0
    ) {
      index = 0;

      while (
        index <
          datasPlanilha.length &&
        (
          datasPlanilha[
            index
          ]?.isFimDeSemana ||
          datasPlanilha[
            index
          ]?.isFeriado
        )
      ) {
        index += 1;
      }
    }

    if (
      index >=
      datasPlanilha.length
    ) {
      index =
        datasPlanilha.length -
        1;

      while (
        index >= 0 &&
        (
          datasPlanilha[
            index
          ]?.isFimDeSemana ||
          datasPlanilha[
            index
          ]?.isFeriado
        )
      ) {
        index -= 1;
      }
    }

    return Math.max(
      0,
      index
    );
  };

  const agendaPacotes =
    React.useMemo(
      () =>
        calcularAgendaPacotesCompleta(
          pacotesComRede
        ),
      [
        pacotesComRede,
        datasPlanilha
      ]
    );

  const pacotePorCelula =
    React.useMemo(
      () => {
        const map =
          new Map();

        pacotesComRede.forEach(
          (pacote) => {
            const schedule =
              agendaPacotes.get(
                pacote.id
              );

            if (!schedule) return;

            let allocatedDays = 0;

            for (
              let index =
                schedule.startIndex;
              index <
                datasPlanilha.length &&
              allocatedDays <
                Math.max(
                  1,
                  Number(
                    pacote.duracao ||
                    1
                  )
                );
              index += 1
            ) {
              const day =
                datasPlanilha[index];

              if (
                day &&
                !day.isFimDeSemana &&
                !day.isFeriado
              ) {
                map.set(
                  `${pacote.linhaId}___${day.dataIso}`,
                  pacote
                );

                allocatedDays += 1;
              }
            }
          }
        );

        return map;
      },
      [
        pacotesComRede,
        agendaPacotes,
        datasPlanilha
      ]
    );

  const iniciarDragPacote = (
    event,
    pacote,
    sourceDataIso
  ) => {
    if (
      !pacote ||
      isBaselineFrozen
    ) {
      return;
    }

    const schedule =
      agendaPacotes.get(
        pacote.id
      );

    if (!schedule) return;

    const sourceIndex =
      datasPlanilha.findIndex(
        (day) =>
          day.dataIso ===
          sourceDataIso
      );

    if (
      sourceIndex < 0
    ) {
      return;
    }

    // Preserve the exact point where the user grabbed the
    // multi-day package. If the user grabs day 2 of a 3-day
    // package and drops it five cells earlier, the WHOLE package
    // moves five cells earlier â€” the dropped cell does not become
    // the package start.
    const grabOffset =
      Math.max(
        0,
        sourceIndex -
          schedule.startIndex
      );

    event.dataTransfer.effectAllowed =
      'move';

    event.dataTransfer.setData(
      'text/plain',
      pacote.id
    );

    setPackageDrag({
      packageId:
        pacote.id,
      rowId:
        pacote.linhaId,
      startIndex:
        schedule.startIndex,
      sourceIndex,
      grabOffset,
      targetIndex:
        sourceIndex
    });
  };

  const atualizarDestinoDragPacote = (
    event,
    rowId,
    dataIso
  ) => {
    if (
      !packageDrag ||
      packageDrag.rowId !==
        rowId
    ) {
      return;
    }

    event.preventDefault();

    event.dataTransfer.dropEffect =
      'move';

    const index =
      datasPlanilha.findIndex(
        (day) =>
          day.dataIso ===
          dataIso
      );

    if (index < 0) return;

    setPackageDrag(
      (current) =>
        current
          ? {
              ...current,
              targetIndex:
                index
            }
          : current
    );
  };

  const finalizarDragPacote = (
    event,
    rowId,
    dataIso
  ) => {
    if (!packageDrag) {
      return;
    }

    // RULE: manual drag cannot change Location row.
    if (
      packageDrag.rowId !==
      rowId
    ) {
      setPackageDrag(null);
      return;
    }

    event.preventDefault();

    const rawTargetIndex =
      datasPlanilha.findIndex(
        (day) =>
          day.dataIso ===
          dataIso
      );

    if (
      rawTargetIndex < 0
    ) {
      setPackageDrag(null);
      return;
    }

    const rawProposedStart =
      rawTargetIndex -
      Math.max(
        0,
        Number(
          packageDrag.grabOffset ||
          0
        )
      );

    const dragDirection =
      rawProposedStart <
      packageDrag.startIndex
        ? -1
        : 1;

    const targetIndex =
      normalizarDestinoDrag(
        rawProposedStart,
        dragDirection
      );

    const pacote =
      pacoteComRedePorId.get(
        packageDrag.packageId
      ) || null;

    if (!pacote) {
      setPackageDrag(null);
      return;
    }

    const schedule =
      agendaPacotes.get(
        pacote.id
      );

    if (!schedule) {
      setPackageDrag(null);
      return;
    }

    salvarHistorico();

    const isSequenceAnchor =
      isPacoteAncoraSequencia(
        pacote
      );

    const dependencies =
      isSequenceAnchor
        ? []
        : obterDependenciasPacote(
            pacote
          );

    setWorkPackages(
      (current) =>
        current.map(
          (item) => {
            if (
              item.id !==
              pacote.id
            ) {
              return item;
            }

            // Anchor package:
            // horizontal movement changes only its explicit start date.
            if (
              dependencies.length ===
              0
            ) {
              const legalTarget =
                Math.max(
                  0,
                  targetIndex
                );

              const newStartDate =
                datasPlanilha[
                  legalTarget
                ]?.dataIso ||
                item.dataInicio;

              const sequenceConfig =
                obterConfiguracaoSequenciaPacote(
                  item
                );

              if (
                sequenceConfig
              ) {
                setSequenceConfigurations(
                  (currentConfigs) =>
                    currentConfigs.map(
                      (config) =>
                        config.id ===
                        sequenceConfig.id
                          ? {
                              ...config,
                              startType:
                                'data',
                              startDate:
                                newStartDate,
                              predecessorId:
                                '',
                              startLag:
                                0,
                              updatedAt:
                                new Date().toISOString()
                            }
                          : config
                    )
                );
              }

              return {
                ...item,
                tipoInicio:
                  'data',
                dataInicio:
                  newStartDate,
                predecessoraId:
                  '',
                dependencies: [],
                lagWorkingDays:
                  0,
                manualDelayWorkingDays:
                  0
              };
            }

            // Dependent package:
            // package remains connected to ALL predecessors.
            //
            // Dragging later adds a manual working-day delay after
            // the earliest legal start.
            //
            // Dragging earlier reduces that delay, but never below
            // the dependency-constrained earliest legal start.
            const earliestLegalStart =
              schedule
                .earliestLegalStart;

            const legalTarget =
              Math.max(
                earliestLegalStart,
                targetIndex
              );

            const manualDelay =
              contarDiasUteisEntreIndices(
                earliestLegalStart,
                legalTarget
              );

            const repairedPackage =
              pacoteComRedePorId.get(
                item.id
              );

            return {
              ...item,

              dependencies:
                repairedPackage
                  ?.dependencies ||
                item.dependencies ||
                [],

              manualDelayWorkingDays:
                manualDelay
            };
          }
        )
    );

    setPackageDrag(null);
  };

  // MOTOR DE RECÃLCULO AUTOMÃTICO
  useEffect(() => {
    if (
      datasPlanilha.length === 0
    ) {
      return;
    }

    if (
      isUndoRef.current
    ) {
      isUndoRef.current =
        false;

      return;
    }

    const novaGrade = {};

    pacotesComRede.forEach(
      (pacote) => {
        const schedule =
          agendaPacotes.get(
            pacote.id
          );

        if (!schedule) return;

        let allocatedDays = 0;

        for (
          let index =
            schedule.startIndex;
          index <
            datasPlanilha.length &&
          allocatedDays <
            Math.max(
              1,
              Number(
                pacote.duracao ||
                1
              )
            );
          index += 1
        ) {
          const day =
            datasPlanilha[index];

          if (
            day &&
            !day.isFimDeSemana &&
            !day.isFeriado
          ) {
            novaGrade[
              `${pacote.linhaId}___${day.dataIso}`
            ] =
              pacote.atividade;

            allocatedDays += 1;
          }
        }
      }
    );

    setDadosCelulas(
      novaGrade
    );
  }, [
    pacotesComRede,
    datasPlanilha,
    agendaPacotes
  ]);

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
    if (!selectedProjectId) return;

    let targetScenarioId = activeScenarioId;

    if (!targetScenarioId) {
      const nomeCenario = prompt(t.promptScenario);
      if (!nomeCenario?.trim()) return;

      const { data: createdScenario, error: createError } = await supabase
        .from('master_plan_scenarios')
        .insert({
          project_id: selectedProjectId,
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

      const createdVersion = mapScenarioRecord(createdScenario);
      setScenarios((prev) => [createdVersion, ...prev]);

      targetScenarioId = createdScenario.id;
      setActiveScenarioId(targetScenarioId);
    }

    const previousBaselines = scenarios.filter(
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
        .eq('project_id', selectedProjectId);

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
      .eq('project_id', selectedProjectId)
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

    const frozenVersion = mapScenarioRecord(data);

    setScenarios((prev) =>
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

    setActiveScenarioId(frozenVersion.id);
    setIsBaselineFrozen(true);
    setModoControle(true);

    const immutableScheduleSnapshot =
      criarSnapshotAgendaImutavel(
        workPackages
      );

    const packageSync =
      await sincronizarPacotesNormalizados(
        frozenVersion.id,
        workPackages,
        immutableScheduleSnapshot
      );

    if (!packageSync.ok) {
      alert(
        `${t.packageSyncError}
${
          packageSync.error?.message ||
          ''
        }`
      );
    }
  };

  const handleDescongelar = async () => {
    if (!window.confirm(t.confirmUnfreeze)) return;

    if (activeScenarioId) {
      const { data, error } = await supabase
        .from('master_plan_scenarios')
        .update({
          is_baseline: false,
          status: 'active',
          plan_data: montarPlanData(),
          planned_start_date: dataInicio || null,
          planned_finish_date: dataFim || null
        })
        .eq('id', activeScenarioId)
        .eq('project_id', selectedProjectId)
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

      const updatedVersion = mapScenarioRecord(data);

      setScenarios((prev) =>
        prev.map((item) =>
          item.id === updatedVersion.id ? updatedVersion : item
        )
      );
    }

    setIsBaselineFrozen(false);
    setModoControle(false);
  };

  // SISTEMA DE VERSÃ•ES: SUPABASE
  // ----------------------------------------------------
  const handleSaveScenario = async () => {
    if (!selectedProjectId) return;

    const nomeCenario = prompt(t.promptScenario);
    if (!nomeCenario?.trim()) return;

    const { data, error } = await supabase
      .from('master_plan_scenarios')
      .insert({
        project_id: selectedProjectId,
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

    const novaVersao = mapScenarioRecord(data);

    setScenarios((prev) => [
      novaVersao,
      ...prev.filter((item) => item.id !== novaVersao.id)
    ]);

    setActiveScenarioId(novaVersao.id);

    const immutableScheduleSnapshot =
      criarSnapshotAgendaImutavel(
        workPackages
      );

    const packageSync =
      await sincronizarPacotesNormalizados(
        novaVersao.id,
        workPackages,
        immutableScheduleSnapshot
      );

    if (!packageSync.ok) {
      alert(
        `${t.packageSyncError}
${
          packageSync.error?.message ||
          ''
        }`
      );
      return;
    }

    alert(t.scenarioSaved);
  };

  const handleUpdateScenario = async () => {
    if (!activeScenarioId) return;

    const { data, error } = await supabase
      .from('master_plan_scenarios')
      .update({
        planned_start_date: dataInicio || null,
        planned_finish_date: dataFim || null,
        plan_data: montarPlanData()
      })
      .eq('id', activeScenarioId)
      .eq('project_id', selectedProjectId)
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

    const versaoAtualizada = mapScenarioRecord(data);

    setScenarios((prev) =>
      prev.map((item) =>
        item.id === versaoAtualizada.id ? versaoAtualizada : item
      )
    );

    const immutableScheduleSnapshot =
      criarSnapshotAgendaImutavel(
        workPackages
      );

    const packageSync =
      await sincronizarPacotesNormalizados(
        versaoAtualizada.id,
        workPackages,
        immutableScheduleSnapshot
      );

    if (!packageSync.ok) {
      alert(
        `${t.packageSyncError}
${
          packageSync.error?.message ||
          ''
        }`
      );
      return;
    }

    alert(t.scenarioUpdated);
  };

  const handleDuplicateScenario = async () => {
    if (!selectedProjectId) return;

    const nomeCopia = prompt(t.promptDuplicate);
    if (!nomeCopia?.trim()) return;

    const { data, error } = await supabase
      .from('master_plan_scenarios')
      .insert({
        project_id: selectedProjectId,
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

    const novaVersao = mapScenarioRecord(data);

    setScenarios((prev) => [novaVersao, ...prev]);
    setActiveScenarioId(novaVersao.id);
    setIsBaselineFrozen(false);
    setModoControle(false);

    const immutableScheduleSnapshot =
      criarSnapshotAgendaImutavel(
        workPackages
      );

    const packageSync =
      await sincronizarPacotesNormalizados(
        novaVersao.id,
        workPackages,
        immutableScheduleSnapshot
      );

    if (!packageSync.ok) {
      alert(
        `${t.packageSyncError}
${
          packageSync.error?.message ||
          ''
        }`
      );
      return;
    }

    alert(t.scenarioSaved);
  };

  const handleLoadScenario = (versaoId) => {
    if (!versaoId) {
      if (window.confirm(t.confirmClear)) {
        salvarHistorico();
        setWorkPackages([]);
        setHolidays([]);
        setDadosCelulas({});
        setDadosRealizado({});
        setSequenceConfigurations([]);
        setActiveSequenceConfigId(null);
        setSequenceEditingId(null);

        // Blank Scenario means a fresh plan using the project's
        // current canonical Location Structure.
        if (locationStructureSections.length > 0) {
          setSecoes(
            JSON.parse(
              JSON.stringify(
                locationStructureSections
              )
            )
          );
        }

        setActiveScenarioId(null);
        setIsBaselineFrozen(false);
        setModoControle(false);
      }
      return;
    }

    if (!window.confirm(t.confirmLoad)) return;

    salvarHistorico();

    const versao = scenarios.find((item) => item.id === versaoId);

    if (versao) applySavedPlan(versao);
  };
  // ----------------------------------------------------

  const handleAddHoliday = (e) => {
    e.preventDefault();
    if (newHolidayDate && newHolidayDescription) {
      if (holidays.find(f => f.data === newHolidayDate)) return alert(t.errHolidayExists);
      salvarHistorico();
      setHolidays([...holidays, { data: newHolidayDate, descricao: newHolidayDescription }]);
      setNewHolidayDate(''); 
      setNewHolidayDescription('');
    }
  };
  
  const handleRemoveHoliday = (data) => {
    salvarHistorico();
    setHolidays(holidays.filter(f => f.data !== data));
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

    setSecoes(
      secoes.map((section) =>
        section.id === secId
          ? {
              ...section,
              linhas: [
                ...section.linhas,
                {
                  id: `l_${Date.now()}`,
                  descricao: '',
                  locationId: null,
                  locationPath: '',
                  source: 'manual'
                }
              ]
            }
          : section
      )
    );
  };

  const handleAtualizarLinha = (secId, linhaId, valor) =>
    setSecoes(
      secoes.map((section) =>
        section.id === secId
          ? {
              ...section,
              linhas: section.linhas.map((row) =>
                row.id === linhaId
                  ? {
                      ...row,
                      descricao: valor,
                      // Editing a canonical row turns it into a manual row.
                      // This prevents a renamed label from silently pointing
                      // to the wrong Location Structure record.
                      locationId:
                        row.source === 'location_structure'
                          ? null
                          : row.locationId || null,
                      locationPath:
                        row.source === 'location_structure'
                          ? ''
                          : row.locationPath || '',
                      source:
                        row.source === 'location_structure'
                          ? 'manual'
                          : row.source || 'manual'
                    }
                  : row
              )
            }
          : section
      )
    );
  
  const handleRemoverLinha = (secId, linhaId) => {
    salvarHistorico();
    setSecoes(secoes.map(s => s.id === secId ? { ...s, linhas: s.linhas.filter(l => l.id !== linhaId) } : s));
  };

  const pacotesExistentes = workPackages.map(p => {
    let desc = p.linhaId;
    secoes.forEach(sec => sec.linhas.forEach(l => { if(l.id === p.linhaId) desc = l.descricao; }));
    const sName = isEn ? (servicosCores[p.atividade]?.labelEn || p.atividade) : (servicosCores[p.atividade]?.labelPt || p.atividade);
    return {
      id: p.id,
      label: `${desc} - ${sName}`
    };
  });

  const abrirGeradorSequencia = () => {
    const rows = [];

    secoes.forEach((section) => {
      (section.linhas || []).forEach((row) => {
        if (!row?.id) return;

        rows.push({
          rowId: row.id,
          locationId: row.locationId || null,
          label: row.locationPath || row.descricao || row.id,
          selected: true
        });
      });
    });

    setSequenceLocations(rows);
    setSequenceActivities([]);
    setSequenceNewActivity('');
    setSequenceStartType('data');
    setSequenceStartDate('');
    setSequencePredecessor('');
    setSequenceStartLag(0);
    setSequenceName(t.defaultSequenceName);
    setSequenceEditingId(null);
    setShowSequenceModal(true);
  };

  const abrirConfiguracoesSequencia = () => {
    const config =
      sequenceConfigurations.find(
        (item) => item.id === activeSequenceConfigId
      ) ||
      sequenceConfigurations[0] ||
      null;

    if (!config) {
      alert(t.noSequenceConfigured);
      return;
    }

    const currentRows = new Map();

    secoes.forEach((section) => {
      (section.linhas || []).forEach((row) => {
        currentRows.set(row.id, row);
      });
    });

    const restoredLocations =
      Array.isArray(config.locations)
        ? config.locations.map((saved) => {
            const row = currentRows.get(saved.rowId);

            return {
              rowId: saved.rowId,
              locationId:
                saved.locationId ||
                row?.locationId ||
                null,
              label:
                saved.label ||
                row?.locationPath ||
                row?.descricao ||
                saved.rowId,
              selected: saved.selected !== false
            };
          })
        : [];

    const restoredActivities =
      Array.isArray(config.activities)
        ? config.activities.map((activity, index) => ({
            id:
              activity.id ||
              `seqact_restore_${Date.now()}_${index}`,
            code: activity.code,
            duration: Math.max(1, Number(activity.duration || 1)),
            lag: Math.max(0, Number(activity.lag || 0))
          }))
        : [];

    setSequenceLocations(restoredLocations);
    setSequenceActivities(restoredActivities);
    setSequenceNewActivity('');
    setSequenceStartType(config.startType || 'data');
    setSequenceStartDate(config.startDate || '');
    setSequencePredecessor(config.predecessorId || '');
    setSequenceStartLag(Math.max(0, Number(config.startLag || 0)));
    setSequenceName(config.name || t.defaultSequenceName);
    setSequenceEditingId(config.id);
    setActiveSequenceConfigId(config.id);
    setShowSequenceModal(true);
  };

  const moverSequencia = (setter, index, direction) => {
    setter((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const finalizarDragSequencia = (
    type,
    targetIndex
  ) => {
    if (
      !sequenceDrag ||
      sequenceDrag.type !== type ||
      sequenceDrag.index === targetIndex
    ) {
      setSequenceDrag(null);
      setSequenceDragOver(null);
      return;
    }

    const setter =
      type === 'location'
        ? setSequenceLocations
        : setSequenceActivities;

    setter((current) => {
      const next = [...current];
      const [moved] = next.splice(
        sequenceDrag.index,
        1
      );

      next.splice(
        targetIndex,
        0,
        moved
      );

      return next;
    });

    setSequenceDrag(null);
    setSequenceDragOver(null);
  };

  const adicionarAtividadeSequencia = () => {
    if (!sequenceNewActivity) return;
    setSequenceActivities((current) => [
      ...current,
      {
        id: `seqact_${Date.now()}_${current.length}`,
        code: sequenceNewActivity,
        duration: 1,
        lag: 0
      }
    ]);
    setSequenceNewActivity('');
  };

  const avancarDiasUteisGerador = (
    startIndex,
    workingDays
  ) => {
    let index = startIndex;
    let remaining = Math.max(
      0,
      Number(
        workingDays ||
        0
      )
    );

    while (
      remaining > 0 &&
      index + 1 < datasPlanilha.length
    ) {
      index += 1;

      const day =
        datasPlanilha[index];

      if (
        !day.isFimDeSemana &&
        !day.isFeriado
      ) {
        remaining -= 1;
      }
    }

    return index;
  };

  const calcularFimPacoteGerador = (
    pacote,
    packagePool,
    cache = new Map(),
    stack = new Set()
  ) => {
    if (!pacote?.id) return -1;

    if (cache.has(pacote.id)) {
      return cache.get(pacote.id);
    }

    if (stack.has(pacote.id)) {
      return -1;
    }

    stack.add(pacote.id);

    let startIndex = -1;

    if (pacote.tipoInicio === 'data') {
      startIndex = datasPlanilha.findIndex(
        (day) =>
          day.dataIso ===
          pacote.dataInicio
      );
    } else if (
      pacote.tipoInicio === 'predecessora' &&
      pacote.predecessoraId
    ) {
      const predecessor =
        packagePool.find(
          (item) =>
            item.id ===
            pacote.predecessoraId
        );

      if (predecessor) {
        const predecessorEnd =
          calcularFimPacoteGerador(
            predecessor,
            packagePool,
            cache,
            stack
          );

        if (predecessorEnd >= 0) {
          const lagEndIndex =
            avancarDiasUteisGerador(
              predecessorEnd,
              Math.max(
                0,
                Number(
                  pacote.lagWorkingDays ||
                  0
                )
              )
            );

          startIndex =
            lagEndIndex + 1;
        }
      }
    }

    if (startIndex < 0) {
      stack.delete(pacote.id);
      cache.set(pacote.id, -1);
      return -1;
    }

    let allocatedDays = 0;
    let lastIndex = startIndex;

    for (
      let index = startIndex;
      index < datasPlanilha.length &&
      allocatedDays <
        Math.max(
          1,
          Number(
            pacote.duracao ||
            1
          )
        );
      index += 1
    ) {
      const day =
        datasPlanilha[index];

      if (
        !day.isFimDeSemana &&
        !day.isFeriado
      ) {
        allocatedDays += 1;
        lastIndex = index;
      }
    }

    const endIndex =
      allocatedDays > 0
        ? lastIndex
        : -1;

    stack.delete(pacote.id);
    cache.set(
      pacote.id,
      endIndex
    );

    return endIndex;
  };

  const gerarSequenciaTrabalho = () => {
    const selectedLocations =
      sequenceLocations.filter((item) => item.selected);

    if (selectedLocations.length === 0) {
      alert(t.selectAtLeastOneLocation);
      return;
    }

    if (sequenceActivities.length === 0) {
      alert(t.selectAtLeastOneActivity);
      return;
    }

    if (sequenceStartType === 'data' && !sequenceStartDate) {
      alert(t.errSelectDate);
      return;
    }

    if (
      sequenceStartType === 'predecessora' &&
      !sequencePredecessor
    ) {
      alert(t.errSelectPred);
      return;
    }

    const isRegenerating = Boolean(sequenceEditingId);

    if (
      isRegenerating &&
      !window.confirm(t.confirmRegenerate)
    ) {
      return;
    }

    salvarHistorico();

    if (
      sequenceStartType === 'data' &&
      sequenceStartDate &&
      (
        !dataInicio ||
        sequenceStartDate <
          dataInicio
      )
    ) {
      setDataInicio(
        sequenceStartDate
      );
    }

    const sequenceGroupId =
      sequenceEditingId ||
      `seq_${Date.now()}`;

    const activeConfig =
      sequenceConfigurations.find(
        (config) =>
          config.id ===
          sequenceGroupId
      ) ||
      null;

    const activeLocationIds =
      new Set(
        (
          activeConfig?.locations ||
          sequenceLocations
        )
          .filter(
            (location) =>
              location.selected !== false
          )
          .map(
            (location) =>
              location.rowId
          )
      );

    const activeActivityCodes =
      new Set(
        (
          activeConfig?.activities ||
          sequenceActivities
        ).map(
          (activity) =>
            activity.code
        )
      );

    const belongsToEditedSequence = (
      pkg
    ) => {
      if (
        pkg.sequenceGroupId ===
        sequenceGroupId
      ) {
        return true;
      }

      // Legacy migration fallback:
      // a generated package may predate sequenceGroupId. If there
      // is only one stored sequence configuration, packages marked
      // generatedBySequence that match its Location Ã— Activity
      // footprint belong to that same sequence.
      if (
        !pkg.sequenceGroupId &&
        pkg.generatedBySequence &&
        sequenceConfigurations.length <= 1 &&
        activeLocationIds.has(
          pkg.linhaId
        ) &&
        activeActivityCodes.has(
          pkg.atividade
        )
      ) {
        return true;
      }

      return false;
    };

    const basePackages =
      isRegenerating
        ? workPackages.filter(
            (pkg) =>
              !belongsToEditedSequence(
                pkg
              )
          )
        : workPackages;

    const generated = [];
    const generatedByCell = new Map();
    const stamp = Date.now();

    selectedLocations.forEach((location, locationIndex) => {
      sequenceActivities.forEach((activity, activityIndex) => {
        const service = servicosCores[activity.code] || null;
        const id =
          `pct_seq_${stamp}_${locationIndex}_${activityIndex}`;

        let tipo = 'predecessora';
        let predecessorId = '';
        let startDate = '';
        let relationshipLag = 0;
        let dependencies = [];

        if (locationIndex === 0 && activityIndex === 0) {
          if (sequenceStartType === 'predecessora') {
            predecessorId = sequencePredecessor;
            relationshipLag = Math.max(
              0,
              Number(sequenceStartLag || 0)
            );

            dependencies = [
              {
                type: 'external',
                predecessorId: sequencePredecessor,
                lagWorkingDays: relationshipLag
              }
            ];
          } else {
            tipo = 'data';
            startDate = sequenceStartDate;
            dependencies = [];
          }
        } else {
          const previousTrade =
            activityIndex > 0
              ? generatedByCell.get(
                  `${locationIndex}:${activityIndex - 1}`
                )
              : null;

          const previousLocation =
            locationIndex > 0
              ? generatedByCell.get(
                  `${locationIndex - 1}:${activityIndex}`
                )
              : null;

          const activityLag = Math.max(
            0,
            Number(activity.lag || 0)
          );

          dependencies = [];

          if (previousTrade) {
            dependencies.push({
              type: 'trade',
              predecessorId: previousTrade.id,
              lagWorkingDays: activityLag
            });
          }

          if (previousLocation) {
            dependencies.push({
              type: 'flow',
              predecessorId: previousLocation.id,
              lagWorkingDays: 0
            });
          }

          if (dependencies.length > 0) {
            const pool = [
              ...basePackages,
              ...generated
            ];

            const finishCache = new Map();
            let latestReadyIndex = -1;
            let controlling = dependencies[0];

            dependencies.forEach((dependency) => {
              const predecessor =
                pool.find(
                  (item) =>
                    item.id === dependency.predecessorId
                );

              if (!predecessor) return;

              const finish =
                calcularFimPacoteGerador(
                  predecessor,
                  pool,
                  finishCache
                );

              const ready =
                avancarDiasUteisGerador(
                  finish,
                  dependency.lagWorkingDays
                );

              if (ready > latestReadyIndex) {
                latestReadyIndex = ready;
                controlling = dependency;
              }
            });

            predecessorId = controlling.predecessorId;
            relationshipLag = controlling.lagWorkingDays;
          } else {
            tipo = 'data';
            startDate = sequenceStartDate;
          }
        }

        const isFirstGeneratedPackage =
          locationIndex === 0 &&
          activityIndex === 0;

        const pkg = {
          id,
          atividade: activity.code,
          linhaId: location.rowId,
          locationId: location.locationId || null,
          locationPath: location.label || '',
          projectServiceId: service?.projectServiceId || null,
          projectWorkPackageId: service?.projectWorkPackageId || null,
          tipoInicio:
            isFirstGeneratedPackage &&
            sequenceStartType === 'data'
              ? 'data'
              : tipo,
          dataInicio:
            isFirstGeneratedPackage &&
            sequenceStartType === 'data'
              ? sequenceStartDate
              : startDate,
          predecessoraId:
            isFirstGeneratedPackage &&
            sequenceStartType === 'data'
              ? ''
              : predecessorId,
          lagWorkingDays:
            tipo === 'predecessora'
              ? relationshipLag
              : 0,
          dependencies:
            isFirstGeneratedPackage &&
            sequenceStartType === 'data'
              ? []
              : dependencies,
          manualDelayWorkingDays: 0,
          duracao: Math.max(1, Number(activity.duration || 1)),
          generatedBySequence: true,
          sequenceGroupId
        };

        generated.push(pkg);
        generatedByCell.set(
          `${locationIndex}:${activityIndex}`,
          pkg
        );
      });
    });

    const configuration = {
      id: sequenceGroupId,
      name:
        sequenceName?.trim() ||
        t.defaultSequenceName,
      locations:
        sequenceLocations.map((location) => ({
          rowId: location.rowId,
          locationId: location.locationId || null,
          label: location.label || '',
          selected: location.selected !== false
        })),
      activities:
        sequenceActivities.map((activity) => ({
          id: activity.id,
          code: activity.code,
          duration: Math.max(1, Number(activity.duration || 1)),
          lag: Math.max(0, Number(activity.lag || 0))
        })),
      startType: sequenceStartType,
      startDate:
        sequenceStartType === 'data'
          ? sequenceStartDate
          : '',
      predecessorId:
        sequenceStartType === 'predecessora'
          ? sequencePredecessor
          : '',
      startLag:
        sequenceStartType === 'predecessora'
          ? Math.max(0, Number(sequenceStartLag || 0))
          : 0,
      flowRule: 'continuous',
      updatedAt: new Date().toISOString()
    };

    setWorkPackages([
      ...basePackages,
      ...generated
    ]);

    setSequenceConfigurations((current) => {
      const exists =
        current.some(
          (item) => item.id === sequenceGroupId
        );

      if (exists) {
        return current.map((item) =>
          item.id === sequenceGroupId
            ? configuration
            : item
        );
      }

      return [
        ...current,
        configuration
      ];
    });

    setActiveSequenceConfigId(sequenceGroupId);
    setSequenceEditingId(sequenceGroupId);
    setShowSequenceModal(false);

    alert(
      isRegenerating
        ? t.sequenceRegenerated
        : `${generated.length} ${t.packagesWillBeCreated}.`
    );
  };

  const handleInserirPacoteAutomacao = (e) => {
    e.preventDefault();
    if (!packageActivity || !packageRowId || packageDuration < 1) {
      alert(t.errFillFields);
      return;
    }

    if (tipoInicio === 'data' && !packageStartDate) return alert(t.errSelectDate);
    if (tipoInicio === 'predecessora' && !pacotePredecessora) return alert(t.errSelectPred);

    salvarHistorico();

    let selectedPlanningRow = null;

    secoes.some((section) => {
      const foundRow =
        section.linhas.find(
          (row) =>
            row.id ===
            packageRowId
        );

      if (foundRow) {
        selectedPlanningRow =
          foundRow;

        return true;
      }

      return false;
    });

    const selectedService =
      servicosCores[
        packageActivity
      ] || null;

    const manualDependencies =
      tipoInicio === 'predecessora' &&
      pacotePredecessora
        ? [
            {
              type: 'external',
              predecessorId:
                pacotePredecessora,
              lagWorkingDays: 0
            }
          ]
        : [];

    const novoPacote = {
      id: `pct_${Date.now()}`,
      atividade: packageActivity,
      linhaId: packageRowId,

      // Canonical links are persisted inside the scenario snapshot.
      // They prepare Master Plan -> Lookahead -> Weekly -> Production
      // integration without changing the current scheduling engine.
      locationId:
        selectedPlanningRow?.locationId ||
        null,
      locationPath:
        selectedPlanningRow?.locationPath ||
        selectedPlanningRow?.descricao ||
        '',
      projectServiceId:
        selectedService?.projectServiceId ||
        null,

      projectWorkPackageId:
        selectedService?.projectWorkPackageId ||
        null,

      tipoInicio: tipoInicio,
      dataInicio: packageStartDate,
      predecessoraId: pacotePredecessora,
      lagWorkingDays: 0,
      dependencies:
        manualDependencies,
      manualDelayWorkingDays: 0,
      duracao: packageDuration
    };

    setWorkPackages([...workPackages, novoPacote]);

    setShowWorkPackageModal(false);
    setPackageStartDate('');
    setPacotePredecessora('');
    setPackageDuration(1);
    
    // Desconecta da versÃ£o ativa se um novo pacote for inserido, ativando estado de rascunho
    setActiveScenarioId(null); 
  };

  const gerarPDF = () => {
    import('html2pdf.js').then((html2pdf) => {
      const elemento = document.getElementById('conteudo-masterplan-pdf');
      let configuracaoPdf = { unit: 'mm', format: pdfConfig.formato, orientation: pdfConfig.orientacao };
      if (pdfConfig.formato === 'unica') {
        const rect = elemento.getBoundingClientRect();
        configuracaoPdf = { unit: 'px', format: [rect.height + 40, rect.width + 40], orientation: 'landscape' };
      }
      const opcoes = { margin: 10, filename: `master-plan-${selectedProjectId}-${Date.now()}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: configuracaoPdf };
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
  if (!selectedProjectId) {
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

        {projects.length === 0 ? (
          <div style={{ maxWidth: '620px', padding: '28px', border: '1px dashed #cbd5e1', borderRadius: '14px', background: '#fff', color: '#64748b' }}>
            No projects are available for Master Plan.
          </div>
        ) : (
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 365px))', gap: '22px', alignItems: 'start' }}>
            {projects.map((project) => {
              const locationText = [project.city, project.state_region].filter(Boolean).join(', ');
              const coverUrl = projectCoverUrls[project.id];
              const progressRecord = projectProgressMap[project.id] || null;
              const hasProductionScope = Boolean(progressRecord?.has_production_scope);
              const rawProgress = Number(progressRecord?.overall_progress_percentage);
              const progress = hasProductionScope && Number.isFinite(rawProgress)
                ? Math.max(0, Math.min(100, rawProgress))
                : null;
              const progressLabel = progress === null
                ? 'â€”'
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
                      window.location.href = `/dashboard/planning/master-plan?projectId=${project.id}`;
                    }}
                    style={{ width: '100%', minHeight: '48px', padding: '0 19px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: 0, borderTop: '1px solid #e6edf3', background: '#fff', color: '#071c31', cursor: 'pointer', fontSize: '0.73rem', fontWeight: 900, textAlign: 'left' }}
                  >
                    <span>Open Project</span>
                    <span style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: '#e8faf6', color: '#008f80', fontSize: '1rem' }}>â†’</span>
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

      {/* CABEÃ‡ALHO SUPERIOR */}
      <div style={{ marginBottom: '20px', borderBottom: '2px solid #e2e8f0', paddingBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h1 style={{ color: '#2A4365', margin: 0, fontStyle: 'italic', fontSize: '1.5rem', marginBottom: '10px' }}>
            {t.title}
          </h1>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <select
                value={selectedProjectId}
                onChange={(e) => { const projectId = e.target.value; setSelectedProjectId(projectId); if (projectId) window.history.replaceState({}, '', `/dashboard/planning/master-plan?projectId=${projectId}`); }}
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e0', minWidth: '300px', fontSize: '0.9rem', outline: 'none' }}
              >
                <option value="">{t.selectProject}</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.code ? `${p.code} - ` : ''}{p.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedProjectId && (
              <>
                {/* BLOCO DE GERENCIAMENTO DE VERSÃ•ES (CENÃRIOS) */}
                {!isBaselineFrozen && (
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', borderLeft: '2px solid #e2e8f0', paddingLeft: '15px', borderRight: '2px solid #e2e8f0', paddingRight: '15px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#718096', marginBottom: '2px', textTransform: 'uppercase' }}>{t.scenarioLabel}</label>
                      <select
                        value={activeScenarioId || ''}
                        onChange={(e) => handleLoadScenario(e.target.value)}
                        style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e0', fontSize: '0.85rem', outline: 'none', minWidth: '200px', backgroundColor: activeScenarioId ? '#ebf8ff' : '#fff' }}
                      >
                        <option value="">{activeScenarioId === null && workPackages.length > 0 ? t.unsavedEdit : t.newBlank}</option>
                        {scenarios.map(v => <option key={v.id} value={v.id}>{v.nome} ({v.data})</option>)}
                      </select>
                    </div>

                    {/* BOTÃ•ES DE SALVAMENTO DINÃ‚MICOS */}
                    {activeScenarioId === null ? (
                      <button 
                        onClick={handleSaveScenario} 
                        disabled={workPackages.length === 0}
                        style={{ backgroundColor: '#4a5568', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: workPackages.length === 0 ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '0.8rem', opacity: workPackages.length === 0 ? 0.5 : 1, marginTop: '14px' }}
                      >
                        {t.saveScenario}
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: '5px', marginTop: '14px' }}>
                        <button 
                          onClick={handleUpdateScenario} 
                          style={{ backgroundColor: '#2f855a', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}
                          title={isEn ? "Update current scenario" : "Atualizar cenÃ¡rio atual"}
                        >
                          {t.updateScenario}
                        </button>
                        <button 
                          onClick={handleDuplicateScenario} 
                          style={{ backgroundColor: '#3182ce', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}
                          title={isEn ? "Create a copy of this scenario" : "Criar uma cÃ³pia deste cenÃ¡rio"}
                        >
                          {t.duplicateScenario}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  {!isBaselineFrozen ? (
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

        {selectedProjectId && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={abrirGeradorSequencia} disabled={isBaselineFrozen} style={{ backgroundColor: '#008f8c', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '6px', cursor: isBaselineFrozen ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '0.85rem', opacity: isBaselineFrozen ? 0.6 : 1 }}>
              {t.generateSequence}
            </button>

            <button
              onClick={abrirConfiguracoesSequencia}
              disabled={
                isBaselineFrozen ||
                sequenceConfigurations.length === 0
              }
              title={
                sequenceConfigurations.length === 0
                  ? t.noSequenceConfigured
                  : t.editSequenceHelp
              }
              style={{
                backgroundColor:
                  sequenceConfigurations.length === 0 || isBaselineFrozen
                    ? '#cbd5e1'
                    : '#475569',
                color: 'white',
                border: 'none',
                padding: '8px 15px',
                borderRadius: '6px',
                cursor:
                  sequenceConfigurations.length === 0 || isBaselineFrozen
                    ? 'not-allowed'
                    : 'pointer',
                fontWeight: 'bold',
                fontSize: '0.85rem',
                opacity:
                  sequenceConfigurations.length === 0 || isBaselineFrozen
                    ? 0.65
                    : 1
              }}
            >
              âš™ {t.sequenceSettings}
            </button>

            <button onClick={() => setShowWorkPackageModal(true)} disabled={isBaselineFrozen} style={{ backgroundColor: '#3182ce', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '6px', cursor: isBaselineFrozen ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '0.85rem', opacity: isBaselineFrozen ? 0.6 : 1 }}>
              {t.insertPackage}
            </button>

            {/* BOTÃƒO DESFAZER */}
            <button 
              onClick={handleDesfazer} 
              disabled={historico.length === 0 || isBaselineFrozen} 
              style={{ backgroundColor: historico.length === 0 ? '#e2e8f0' : '#e53e3e', color: historico.length === 0 ? '#a0aec0' : 'white', border: 'none', padding: '8px 15px', borderRadius: '6px', cursor: historico.length === 0 || isBaselineFrozen ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
            >
              â†© {t.undoBtn}
            </button>

            <button onClick={() => setOcultarFinaisDeSemana(!ocultarFinaisDeSemana)} style={{ backgroundColor: ocultarFinaisDeSemana ? '#2a4365' : '#edf2f7', color: ocultarFinaisDeSemana ? 'white' : '#4a5568', border: '1px solid #cbd5e0', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>
              {ocultarFinaisDeSemana ? t.showWeekends : t.hideWeekends}
            </button>
            <button onClick={() => setShowHolidaysModal(true)} style={{ backgroundColor: '#dd6b20', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>
              {t.holidaysBtn}
            </button>
            <button onClick={() => { setPdfConfig(prev => ({ ...prev, formato: formatoIdealCode })); setShowPdfModal(true); }} style={{ backgroundColor: '#2f855a', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>
              {t.exportPdf}
            </button>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', backgroundColor: '#f7fafc', padding: '8px 15px', borderRadius: '8px', border: '1px solid #cbd5e0' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#4a5568', marginBottom: '2px' }}>{t.startPrev}</label>
                <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} disabled={isBaselineFrozen} style={{ padding: '4px 6px', borderRadius: '4px', border: '1px solid #cbd5e0', outline: 'none', color: '#2d3748', cursor: isBaselineFrozen ? 'not-allowed' : 'pointer', fontSize: '0.85rem', opacity: isBaselineFrozen ? 0.7 : 1 }} />
              </div>
              <span style={{ color: '#a0aec0', fontWeight: 'bold', marginTop: '12px' }}>âžž</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#4a5568', marginBottom: '2px' }}>{t.endPrev}</label>
                <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} disabled={isBaselineFrozen} style={{ padding: '4px 6px', borderRadius: '4px', border: '1px solid #cbd5e0', outline: 'none', color: '#2d3748', cursor: isBaselineFrozen ? 'not-allowed' : 'pointer', fontSize: '0.85rem', opacity: isBaselineFrozen ? 0.7 : 1 }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {!selectedProjectId && (
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f7fafc', borderRadius: '8px', border: '2px dashed #cbd5e0' }}>
          <div style={{ textAlign: 'center', color: '#718096' }}>
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '10px' }}>ðŸ—ï¸</span>
            <h2>{t.noProject}</h2>
            <p>{t.noProjectDesc}</p>
          </div>
        </div>
      )}

      {/* MODAL: WORK SEQUENCE GENERATOR */}
      {showSequenceModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3500, padding: '20px' }}>
          <div style={{ backgroundColor: 'white', width: 'min(1050px, 96vw)', maxHeight: '92vh', overflowY: 'auto', borderRadius: '12px', boxShadow: '0 24px 70px rgba(0,0,0,0.28)', fontFamily: 'sans-serif' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 2 }}>
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 900, letterSpacing: '0.08em', color: '#008f8c', marginBottom: '4px' }}>MASTER PLAN</div>
                <h2 style={{ margin: 0, color: '#0b2239' }}>
                  {sequenceEditingId ? t.sequenceSettings : t.sequenceGenerator}
                </h2>
                {sequenceEditingId && (
                  <p style={{ margin: '5px 0 0', color: '#64748b', fontSize: '0.75rem' }}>
                    {t.editSequenceHelp}
                  </p>
                )}
              </div>
              <button type="button" onClick={() => setShowSequenceModal(false)} style={{ border: 'none', background: 'transparent', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>Ã—</button>
            </div>

            <div style={{ padding: '18px 24px 0' }}>
              <label style={{ display: 'block', marginBottom: '5px', color: '#475569', fontSize: '0.72rem', fontWeight: 800 }}>
                {t.sequenceName}
              </label>
              <input
                type="text"
                value={sequenceName}
                onChange={(e) => setSequenceName(e.target.value)}
                style={{ width: '100%', maxWidth: '420px', padding: '9px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a' }}
              />
            </div>

            <div style={{ padding: '18px 24px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <section style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
                <h3 style={{ margin: '0 0 5px', color: '#0b2239' }}>{t.sequenceLocations}</h3>
                <div style={{ marginBottom: '12px', fontSize: '0.72rem', color: '#64748b' }}>{t.dragToReorder}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', maxHeight: '330px', overflowY: 'auto' }}>
                  {sequenceLocations.map((location, index) => (
                    <div
                      key={location.rowId}
                      draggable
                      onDragStart={() => setSequenceDrag({ type: 'location', index })}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setSequenceDragOver({ type: 'location', index });
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        finalizarDragSequencia('location', index);
                      }}
                      onDragEnd={() => {
                        setSequenceDrag(null);
                        setSequenceDragOver(null);
                      }}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '28px 26px 1fr 30px 30px',
                        gap: '7px',
                        alignItems: 'center',
                        padding: '8px',
                        backgroundColor:
                          sequenceDragOver?.type === 'location' &&
                          sequenceDragOver?.index === index
                            ? '#ccfbf1'
                            : location.selected
                              ? '#f0fdfa'
                              : '#f8fafc',
                        border:
                          sequenceDragOver?.type === 'location' &&
                          sequenceDragOver?.index === index
                            ? '2px solid #14b8a6'
                            : '1px solid #e2e8f0',
                        borderRadius: '7px',
                        cursor: 'grab'
                      }}
                    >
                      <input type="checkbox" checked={location.selected} onChange={(e) => setSequenceLocations((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, selected: e.target.checked } : item))} />
                      <span title={t.dragToReorder} style={{ color: '#94a3b8', fontWeight: 900, letterSpacing: '-2px', cursor: 'grab', userSelect: 'none' }}>â‹®â‹®</span>
                      <div title={location.label} style={{ minWidth: 0, fontSize: '0.78rem', fontWeight: 700, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{index + 1}. {location.label}</div>
                      <button type="button" disabled={index === 0} onClick={() => moverSequencia(setSequenceLocations, index, -1)} style={{ height: '28px', border: '1px solid #cbd5e1', borderRadius: '5px', background: 'white' }}>â†‘</button>
                      <button type="button" disabled={index === sequenceLocations.length - 1} onClick={() => moverSequencia(setSequenceLocations, index, 1)} style={{ height: '28px', border: '1px solid #cbd5e1', borderRadius: '5px', background: 'white' }}>â†“</button>
                    </div>
                  ))}
                </div>
              </section>

              <section style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
                <h3 style={{ margin: '0 0 5px', color: '#0b2239' }}>{t.sequenceActivities}</h3>
                <div style={{ marginBottom: '12px', fontSize: '0.72rem', color: '#64748b' }}>{t.dragToReorder}</div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', marginBottom: '12px' }}>
                  <select value={sequenceNewActivity} onChange={(e) => setSequenceNewActivity(e.target.value)} style={{ padding: '9px', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
                    <option value="">{t.mPkgSelectAct}</option>
                    {Object.entries(servicosCores).map(([code, service]) => (
                      <option key={code} value={code}>{code} - {isEn ? service.labelEn : service.labelPt}</option>
                    ))}
                  </select>
                  <button type="button" onClick={adicionarAtividadeSequencia} style={{ padding: '9px 12px', border: 'none', borderRadius: '6px', backgroundColor: '#0b2239', color: 'white', fontWeight: 800, cursor: 'pointer' }}>{t.addActivity}</button>
                </div>

                {sequenceActivities.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: '24px 28px 1fr 78px 78px 30px 30px 30px', gap: '7px', padding: '0 8px 5px', fontSize: '0.64rem', fontWeight: 800, color: '#64748b' }}>
                    <span></span>
                    <span>#</span>
                    <span>ACTIVITY</span>
                    <span>{t.durationDays}</span>
                    <span>{t.lagWorkingDays}</span>
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', maxHeight: '275px', overflowY: 'auto' }}>
                  {sequenceActivities.map((activity, index) => {
                    const service = servicosCores[activity.code];
                    return (
                      <div
                        key={activity.id}
                        draggable
                        onDragStart={() => setSequenceDrag({ type: 'activity', index })}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setSequenceDragOver({ type: 'activity', index });
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          finalizarDragSequencia('activity', index);
                        }}
                        onDragEnd={() => {
                          setSequenceDrag(null);
                          setSequenceDragOver(null);
                        }}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '24px 28px 1fr 78px 78px 30px 30px 30px',
                          gap: '7px',
                          alignItems: 'center',
                          padding: '8px',
                          border:
                            sequenceDragOver?.type === 'activity' &&
                            sequenceDragOver?.index === index
                              ? '2px solid #14b8a6'
                              : '1px solid #e2e8f0',
                          backgroundColor:
                            sequenceDragOver?.type === 'activity' &&
                            sequenceDragOver?.index === index
                              ? '#f0fdfa'
                              : 'white',
                          borderRadius: '7px',
                          cursor: 'grab'
                        }}
                      >
                        <span title={t.dragToReorder} style={{ color: '#94a3b8', fontWeight: 900, letterSpacing: '-2px', cursor: 'grab', userSelect: 'none' }}>â‹®â‹®</span>
                        <strong style={{ color: '#008f8c' }}>{index + 1}</strong>
                        <div style={{ minWidth: 0, fontSize: '0.76rem', fontWeight: 700 }}>{activity.code} Â· {isEn ? service?.labelEn : service?.labelPt}</div>
                        <input type="number" min="1" title={t.durationDays} value={activity.duration} onChange={(e) => setSequenceActivities((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, duration: Math.max(1, Number(e.target.value || 1)) } : item))} style={{ width: '100%', padding: '7px', border: '1px solid #cbd5e1', borderRadius: '5px' }} />
                        <input type="number" min="0" title={t.lagWorkingDays} value={activity.lag ?? 0} onChange={(e) => setSequenceActivities((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, lag: Math.max(0, Number(e.target.value || 0)) } : item))} style={{ width: '100%', padding: '7px', border: '1px solid #cbd5e1', borderRadius: '5px' }} />
                        <button type="button" disabled={index === 0} onClick={() => moverSequencia(setSequenceActivities, index, -1)} style={{ height: '28px', border: '1px solid #cbd5e1', borderRadius: '5px', background: 'white' }}>â†‘</button>
                        <button type="button" disabled={index === sequenceActivities.length - 1} onClick={() => moverSequencia(setSequenceActivities, index, 1)} style={{ height: '28px', border: '1px solid #cbd5e1', borderRadius: '5px', background: 'white' }}>â†“</button>
                        <button type="button" onClick={() => setSequenceActivities((current) => current.filter((_, itemIndex) => itemIndex !== index))} style={{ height: '28px', border: 'none', borderRadius: '5px', background: '#fff1f2', color: '#e11d48', fontWeight: 900, cursor: 'pointer' }}>Ã—</button>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section style={{ gridColumn: '1 / -1', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
                <h3 style={{ margin: '0 0 12px', color: '#0b2239' }}>{t.sequenceStart}</h3>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.8rem', fontWeight: 700 }}>
                    <input type="radio" checked={sequenceStartType === 'data'} onChange={() => setSequenceStartType('data')} />
                    {t.specificStartDate}
                  </label>
                  <input type="date" disabled={sequenceStartType !== 'data'} value={sequenceStartDate} onChange={(e) => setSequenceStartDate(e.target.value)} style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />

                  <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.8rem', fontWeight: 700 }}>
                    <input type="radio" checked={sequenceStartType === 'predecessora'} onChange={() => setSequenceStartType('predecessora')} />
                    {t.existingPredecessor}
                  </label>
                  <select disabled={sequenceStartType !== 'predecessora'} value={sequencePredecessor} onChange={(e) => setSequencePredecessor(e.target.value)} style={{ minWidth: '260px', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
                    <option value="">{t.mPkgSelectPred}</option>
                    {pacotesExistentes.map((pkg) => (
                      <option key={pkg.id} value={pkg.id}>{pkg.label}</option>
                    ))}
                  </select>

                  <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.8rem', fontWeight: 700, opacity: sequenceStartType === 'predecessora' ? 1 : 0.5 }}>
                    {t.startLag}
                    <input
                      type="number"
                      min="0"
                      disabled={sequenceStartType !== 'predecessora'}
                      value={sequenceStartLag}
                      onChange={(e) => setSequenceStartLag(Math.max(0, Number(e.target.value || 0)))}
                      style={{ width: '72px', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                    />
                  </label>
                </div>

                <div style={{ marginTop: '15px', padding: '12px 14px', backgroundColor: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: '8px' }}>
                  <strong style={{ display: 'block', color: '#0f766e', marginBottom: '4px' }}>{t.continuousFlow}</strong>
                  <span style={{ fontSize: '0.78rem', color: '#475569' }}>{t.continuousFlowHelp}</span>
                </div>
              </section>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', position: 'sticky', bottom: 0, backgroundColor: 'white' }}>
              <div style={{ color: '#475569', fontSize: '0.82rem' }}>
                <strong>{sequenceLocations.filter((item) => item.selected).length}</strong> locations Ã— <strong>{sequenceActivities.length}</strong> activities = <strong>{sequenceLocations.filter((item) => item.selected).length * sequenceActivities.length}</strong> {t.packagesWillBeCreated}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={() => setShowSequenceModal(false)} style={{ padding: '10px 16px', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'white', cursor: 'pointer', fontWeight: 700 }}>{t.mPkgCancel}</button>
                <button type="button" onClick={gerarSequenciaTrabalho} style={{ padding: '10px 18px', border: 'none', borderRadius: '6px', background: '#008f8c', color: 'white', cursor: 'pointer', fontWeight: 900 }}>{sequenceEditingId ? t.regenerateSequence : t.generatePackages}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: INSERIR PACOTE DE TRABALHO */}
      {showWorkPackageModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000 }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '10px', width: '550px', fontFamily: 'sans-serif' }}>
            <h2 style={{ color: '#1a365d', marginBottom: '20px' }}>{t.mPkgTitle}</h2>
            
            <form onSubmit={handleInserirPacoteAutomacao} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              
              <div style={{ display: 'flex', gap: '15px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '5px', color: '#4a5568' }}>{t.mPkgService}</label>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <select required value={packageActivity} onChange={(e) => setPackageActivity(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e0', outline: 'none' }}>
                      <option value="">{t.mPkgSelect}</option>
                      {Object.entries(servicosCores)
                        .filter(([sigla]) => sigla !== '' && sigla !== 'OFF' && sigla !== 'FER')
                        .map(([sigla, info]) => (
                          <option key={sigla} value={sigla}>{isEn ? info.labelEn : info.labelPt} ({sigla})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '5px', color: '#4a5568' }}>{t.mPkgZone}</label>
                  <select required value={packageRowId} onChange={(e) => setPackageRowId(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e0', outline: 'none' }}>
                    <option value="">{t.mPkgSelect}</option>
                    {secoes.map(sec => (
                      <optgroup key={sec.id} label={sec.titulo === 'SERVIÃ‡OS INTERNOS' && isEn ? t.intWork : (sec.titulo === 'SERVIÃ‡OS EXTERNOS' && isEn ? t.extWork : sec.titulo)}>
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
                    <input type="date" required={tipoInicio === 'data'} value={packageStartDate} onChange={(e) => setPackageStartDate(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e0', outline: 'none' }} />
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
                <input type="number" required min="1" value={packageDuration} onChange={(e) => setPackageDuration(Number(e.target.value))} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e0', outline: 'none' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '15px' }}>
                <button type="button" onClick={() => setShowWorkPackageModal(false)} style={{ backgroundColor: '#cbd5e0', border: 'none', padding: '10px 15px', borderRadius: '6px', cursor: 'pointer', color: '#4a5568', fontWeight: 'bold' }}>{t.mPkgCancel}</button>
                <button type="submit" style={{ backgroundColor: '#3182ce', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>{t.mPkgAddGrid}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: FERIADOS */}
      {showHolidaysModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000 }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '10px', width: '500px', fontFamily: 'sans-serif' }}>
            <h2 style={{ color: '#1a365d', marginBottom: '20px' }}>{t.mHolTitle}</h2>
            
            <form onSubmit={handleAddHoliday} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <input type="date" required value={newHolidayDate} onChange={(e) => setNewHolidayDate(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e0', outline: 'none' }} />
              <input type="text" required placeholder={t.mHolDescPlace} value={newHolidayDescription} onChange={(e) => setNewHolidayDescription(e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e0', outline: 'none' }} />
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
                  {holidays.length === 0 ? (
                    <tr><td colSpan={3} style={{ padding: '15px', textAlign: 'center', color: '#a0aec0' }}>{t.mHolEmpty}</td></tr>
                  ) : (
                    holidays.sort((a, b) => new Date(a.data) - new Date(b.data)).map((f, i) => {
                      const parts = f.data.split('-');
                      const displayDate = isEn ? `${parts[1]}/${parts[2]}/${parts[0]}` : `${parts[2]}/${parts[1]}/${parts[0]}`;
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #edf2f7' }}>
                          <td style={{ padding: '8px' }}>{displayDate}</td>
                          <td style={{ padding: '8px', fontWeight: 'bold', color: '#2d3748' }}>{f.descricao}</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <button onClick={() => handleRemoveHoliday(f.data)} style={{ border: 'none', background: 'transparent', color: '#e53e3e', cursor: 'pointer', fontWeight: 'bold' }}>{t.mHolDel}</button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowHolidaysModal(false)} style={{ backgroundColor: '#2f855a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>{t.mHolDone}</button>
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
                ðŸ’¡ <strong>{t.mPdfSugest}</strong> {t.mPdfSugestText(datasVisiveis.length)} <strong>{formatoIdealCode.toUpperCase()}</strong>.
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

      {/* TABELA GRÃFICA DA LINHA DE BALANÃ‡O */}
      {selectedProjectId && (
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
                    const displayTitle = secao.titulo === 'SERVIÃ‡OS INTERNOS' && isEn ? t.intWork : (secao.titulo === 'SERVIÃ‡OS EXTERNOS' && isEn ? t.extWork : secao.titulo);
                    return (
                    <React.Fragment key={secao.id}>
                      <tr style={{ backgroundColor: '#edf2f7' }}>
                        <td colSpan={2} style={{ position: 'sticky', left: 0, zIndex: 5, backgroundColor: '#edf2f7', padding: '6px 15px', borderBottom: '2px solid #2a4365', borderTop: '2px solid #2a4365' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '85%' }}>
                              <input 
                                type="text"
                                value={displayTitle}
                                onChange={(e) => handleAtualizarTituloSecao(secao.id, e.target.value)}
                                disabled={isBaselineFrozen}
                                style={{ fontWeight: 'bold', fontStyle: 'italic', color: '#2a4365', background: 'transparent', border: 'none', outline: 'none', flex: 1, minWidth: 0, fontSize: '0.9rem' }}
                              />

                              {secao.source === 'location_structure' && (
                                <span
                                  title="Generated from Project Location Structure"
                                  style={{
                                    flexShrink: 0,
                                    padding: '2px 6px',
                                    borderRadius: '999px',
                                    backgroundColor: '#dff7f2',
                                    color: '#087f73',
                                    fontSize: '0.58rem',
                                    fontWeight: 900,
                                    letterSpacing: '0.05em'
                                  }}
                                >
                                  LOCATION
                                </span>
                              )}
                            </div>
                            {!isBaselineFrozen && (
                              <button onClick={() => handleRemoverSecao(secao.id)} style={{ border: 'none', background: 'transparent', color: '#e53e3e', cursor: 'pointer', fontWeight: 'bold' }}>âœ–</button>
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

                            // Project calendar markers belong to both
                            // Planning and Control. A holiday remains a
                            // holiday regardless of which row is being viewed.
                            //
                            // Actual data can still override FER/OFF if work
                            // was genuinely performed on that non-working day.
                            const valorEfetivo =
                              valorSalvo !== undefined
                                ? valorSalvo
                                : defaultValor;
                            const configCor = servicosCores[valorEfetivo] || servicosCores[''];

                            let bgColor = 'transparent';

                            if (configCor.color !== 'transparent') {
                              bgColor = configCor.color;
                            } else if (d.isFeriado) {
                              bgColor = '#fed7d7';
                            } else if (d.isFimDeSemana) {
                              bgColor = '#e2e8f0';
                            }

                            const inputBloqueado = isRealizado ? false : isBaselineFrozen;

                            const pacoteCelula =
                              !isRealizado
                                ? pacotePorCelula.get(
                                    cellKey
                                  ) || null
                                : null;

                            const currentCellIndex =
                              datasPlanilha.findIndex(
                                (day) =>
                                  day.dataIso ===
                                  d.dataIso
                              );

                            const proposedDragStart =
                              packageDrag
                                ? normalizarDestinoDrag(
                                    (
                                      packageDrag.targetIndex -
                                      Math.max(
                                        0,
                                        Number(
                                          packageDrag.grabOffset ||
                                          0
                                        )
                                      )
                                    ),
                                    (
                                      packageDrag.targetIndex -
                                      Math.max(
                                        0,
                                        Number(
                                          packageDrag.grabOffset ||
                                          0
                                        )
                                      )
                                    ) <
                                    packageDrag.startIndex
                                      ? -1
                                      : 1
                                  )
                                : -1;

                            const isDragTarget =
                              Boolean(
                                packageDrag &&
                                packageDrag.rowId === linha.id &&
                                proposedDragStart ===
                                  currentCellIndex
                              );

                            return (
                              <td
                                key={cellKey}
                                onDragOver={(event) =>
                                  atualizarDestinoDragPacote(
                                    event,
                                    linha.id,
                                    d.dataIso
                                  )
                                }
                                onDrop={(event) =>
                                  finalizarDragPacote(
                                    event,
                                    linha.id,
                                    d.dataIso
                                  )
                                }
                                style={{
                                  borderRight: '1px dotted #cbd5e0',
                                  padding: '1px',
                                  backgroundColor:
                                    isDragTarget
                                      ? '#dff7f2'
                                      : bgColor,
                                  outline:
                                    isDragTarget
                                      ? '2px solid #0d9488'
                                      : 'none',
                                  outlineOffset:
                                    '-2px',
                                  textAlign: 'center',
                                  width: '45px',
                                  minWidth: '45px',
                                  maxWidth: '45px',
                                  height: '26px',
                                  overflow: 'hidden'
                                }}
                              >
                                <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {pacoteCelula ? (
                                    <div
                                      draggable={!inputBloqueado}
                                      onDragStart={(event) =>
                                        iniciarDragPacote(
                                          event,
                                          pacoteCelula,
                                          d.dataIso
                                        )
                                      }
                                      onDragEnd={() =>
                                        setPackageDrag(
                                          null
                                        )
                                      }
                                      title={`${t.dragPackageHint} Â· ${t.dragPackageLockedRow}`}
                                      style={{
                                        width: '43px',
                                        height: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor:
                                          configCor.color,
                                        color:
                                          configCor.text,
                                        borderRadius: '2px',
                                        fontSize: '0.7rem',
                                        fontWeight: 'bold',
                                        cursor:
                                          inputBloqueado
                                            ? 'default'
                                            : 'ew-resize',
                                        userSelect: 'none',
                                        opacity:
                                          modoControle
                                            ? 0.6
                                            : 1
                                      }}
                                    >
                                      {valorEfetivo}
                                    </div>
                                  ) : (
                                    <>
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
                                        <div style={{ position: 'absolute', right: '2px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: '0.45rem', color: configCor.text === '#fff' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)' }}>â–¼</div>
                                      )}
                                    </>
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
                                      disabled={isBaselineFrozen}
                                      list="lista-zonas-coleta"
                                      placeholder={t.selectOrType}
                                      title={
                                        linha.locationPath ||
                                        linha.descricao ||
                                        ''
                                      }
                                      style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: '#2d3748', fontSize: '0.85rem' }}
                                    />
                                    {modoControle && <span style={{ fontSize: '0.65rem', backgroundColor: '#cbd5e0', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', color: '#4a5568' }}>{t.plannedBadge}</span>}
                                  </div>
                                  {!isBaselineFrozen && (
                                    <button onClick={() => handleRemoverLinha(secao.id, linha.id)} style={{ border: 'none', background: 'transparent', color: '#e53e3e', cursor: 'pointer', fontWeight: 'bold' }}>âœ–</button>
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
                                      <span style={{ flex: 1, color: '#a0aec0', fontSize: '0.85rem', paddingLeft: '2px' }}>â†³ {linha.descricao}</span>
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
                      
                      {!isBaselineFrozen && (
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

                  {!isBaselineFrozen && (
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






