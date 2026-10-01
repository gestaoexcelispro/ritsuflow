const copy = {
  'en-US': {
    title: 'Lookahead Planning',
    projectsInformation: 'Projects / Information', materials: 'Materials', labor: 'Labor', equipment: 'Equipment', space: 'Space', predecessor: 'Predecessor', externalConditions: 'External Conditions',
    unassignedLocation: 'Unassigned Location', projectsLoadError: 'Projects could not be loaded.',
    clear: 'Clear', constrained: 'Constrained', notApplicable: 'Not Applicable', notAssessed: 'Not Assessed',
    showWeekends: 'Show Weekends', hideWeekends: 'Hide Weekends', insertPackage: 'Insert Package', saveLookahead: 'Save Lookahead',
    project: 'Project', plan: 'Plan', horizon: 'Horizon', weeks: 'weeks', windowStart: 'Window Start', description: 'Description', workPackage: 'Work Package', location: 'Location',
    koskelaReadiness: 'Koskela Readiness', loading: 'Loading...', noRows: 'No Lookahead work packages are available for this window.'
  },
  'pt-BR': {
    title: 'Planejamento Lookahead',
    projectsInformation: 'Projetos / Informações', materials: 'Materiais', labor: 'Mão de Obra', equipment: 'Equipamentos', space: 'Espaço', predecessor: 'Predecessor', externalConditions: 'Condições Externas',
    unassignedLocation: 'Localização Não Atribuída', projectsLoadError: 'Não foi possível carregar os projetos.',
    clear: 'Liberado', constrained: 'Com Restrição', notApplicable: 'Não Aplicável', notAssessed: 'Não Avaliado',
    showWeekends: 'Mostrar Fins de Semana', hideWeekends: 'Ocultar Fins de Semana', insertPackage: 'Inserir Pacote', saveLookahead: 'Salvar Lookahead',
    project: 'Projeto', plan: 'Plano', horizon: 'Horizonte', weeks: 'semanas', windowStart: 'Início da Janela', description: 'Descrição', workPackage: 'Pacote de Trabalho', location: 'Localização',
    koskelaReadiness: 'Prontidão Koskela', loading: 'Carregando...', noRows: 'Nenhum pacote de trabalho do Lookahead está disponível para esta janela.'
  },
  es: {
    title: 'Planificación Lookahead',
    projectsInformation: 'Proyectos / Información', materials: 'Materiales', labor: 'Mano de Obra', equipment: 'Equipos', space: 'Espacio', predecessor: 'Predecesor', externalConditions: 'Condiciones Externas',
    unassignedLocation: 'Ubicación No Asignada', projectsLoadError: 'No se pudieron cargar los proyectos.',
    clear: 'Liberado', constrained: 'Con Restricción', notApplicable: 'No Aplicable', notAssessed: 'No Evaluado',
    showWeekends: 'Mostrar Fines de Semana', hideWeekends: 'Ocultar Fines de Semana', insertPackage: 'Insertar Paquete', saveLookahead: 'Guardar Lookahead',
    project: 'Proyecto', plan: 'Plan', horizon: 'Horizonte', weeks: 'semanas', windowStart: 'Inicio de la Ventana', description: 'Descripción', workPackage: 'Paquete de Trabajo', location: 'Ubicación',
    koskelaReadiness: 'Preparación Koskela', loading: 'Cargando...', noRows: 'No hay paquetes de trabajo de Lookahead disponibles para esta ventana.'
  }
}

export function getLookaheadCopy(locale = 'en-US') {
  return copy[locale] || copy['en-US']
}

export function getKoskelaColumns(locale = 'en-US') {
  const t = getLookaheadCopy(locale)
  return [
    { key: 'projects_information', label: t.projectsInformation },
    { key: 'materials', label: t.materials },
    { key: 'labor', label: t.labor },
    { key: 'equipment', label: t.equipment },
    { key: 'space', label: t.space },
    { key: 'predecessor', label: t.predecessor },
    { key: 'external_conditions', label: t.externalConditions },
  ]
}
