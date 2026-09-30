const COPY = {
  'en-US': {
    workspace:'Workspace', overview:'Overview', projects:'Projects', projectSetup:'Project Setup', fieldManagement:'Field Management', operationalDashboard:'Operational Dashboard', dailyReports:'Daily Reports', workforce:'Workforce', projectAssignments:'Project Assignments', attendance:'Attendance', planning:'Planning', prePlanning:'Pre-Planning', masterPlan:'Master Plan', lookaheadPlanning:'Lookahead Planning', weeklyPlanning:'Weekly Planning', constraintLog:'Constraint Log', control:'Control', administration:'Administration', usersAccess:'Users & Access', platform:'Platform', organizations:'Organizations', general:'General', scope:'Scope', locations:'Locations', allocation:'Allocation', productionParameters:'Production Parameters', closeNavigation:'Close navigation', toggleNavigation:'Toggle navigation', ritsuFlowNavigation:'RitsuFlow navigation', ritsuFlowHome:'RitsuFlow home', hide:'Hide {group}', show:'Show {group}', privateDevelopment:'Private development', developmentMessage:'RitsuFlow is currently under active development.', logout:'Logout', changeProject:'Change Project', saveChanges:'Save Changes'
  },
  'pt-BR': {
    workspace:'Workspace', overview:'Visão Geral', projects:'Projetos', projectSetup:'Configuração do Projeto', fieldManagement:'Gestão de Campo', operationalDashboard:'Painel Operacional', dailyReports:'Relatórios Diários', workforce:'Força de Trabalho', projectAssignments:'Alocação aos Projetos', attendance:'Presença', planning:'Planejamento', prePlanning:'Pré-Planejamento', masterPlan:'Plano Mestre', lookaheadPlanning:'Planejamento Lookahead', weeklyPlanning:'Planejamento Semanal', constraintLog:'Registro de Restrições', control:'Controle', administration:'Administração', usersAccess:'Usuários e Acessos', platform:'Plataforma', organizations:'Organizações', general:'Geral', scope:'Escopo', locations:'Localizações', allocation:'Alocação', productionParameters:'Parâmetros de Produção', closeNavigation:'Fechar navegação', toggleNavigation:'Alternar navegação', ritsuFlowNavigation:'Navegação do RitsuFlow', ritsuFlowHome:'Início do RitsuFlow', hide:'Ocultar {group}', show:'Exibir {group}', privateDevelopment:'Desenvolvimento privado', developmentMessage:'O RitsuFlow está atualmente em desenvolvimento ativo.', logout:'Sair', changeProject:'Alterar Projeto', saveChanges:'Salvar Alterações'
  },
  es: {
    workspace:'Workspace', overview:'Vista General', projects:'Proyectos', projectSetup:'Configuración del Proyecto', fieldManagement:'Gestión de Campo', operationalDashboard:'Panel Operativo', dailyReports:'Informes Diarios', workforce:'Fuerza Laboral', projectAssignments:'Asignaciones de Proyecto', attendance:'Asistencia', planning:'Planificación', prePlanning:'Preplanificación', masterPlan:'Plan Maestro', lookaheadPlanning:'Planificación Lookahead', weeklyPlanning:'Planificación Semanal', constraintLog:'Registro de Restricciones', control:'Control', administration:'Administración', usersAccess:'Usuarios y Acceso', platform:'Plataforma', organizations:'Organizaciones', general:'General', scope:'Alcance', locations:'Ubicaciones', allocation:'Asignación', productionParameters:'Parámetros de Producción', closeNavigation:'Cerrar navegación', toggleNavigation:'Alternar navegación', ritsuFlowNavigation:'Navegación de RitsuFlow', ritsuFlowHome:'Inicio de RitsuFlow', hide:'Ocultar {group}', show:'Mostrar {group}', privateDevelopment:'Desarrollo privado', developmentMessage:'RitsuFlow se encuentra actualmente en desarrollo activo.', logout:'Cerrar sesión', changeProject:'Cambiar Proyecto', saveChanges:'Guardar Cambios'
  }
}

export function dashboardShellText(locale, key, vars = {}) {
  let value = COPY[locale]?.[key] ?? COPY['en-US'][key] ?? key
  for (const [name, replacement] of Object.entries(vars)) value = String(value).replaceAll(`{${name}}`, replacement)
  return value
}

export function dashboardShellCopy(locale) {
  const normalized = COPY[locale] ? locale : 'en-US'
  return COPY[normalized]
}

export const dashboardShellNavigation = [
  {
    key: 'workspace',
    items: [
      { key: 'overview', href: '/dashboard', icon: 'overview' },
      { key: 'projects', href: '/dashboard/projects', icon: 'projects' },
      { key: 'projectSetup', href: '/dashboard/projects/setup', icon: 'setup' },
      { label: 'RitsuCAD', href: '/ritsucad', icon: 'cad' },
    ],
  },
  {
    key: 'fieldManagement',
    items: [
      { key: 'operationalDashboard', href: '/dashboard/projects/operations', icon: 'operations' },
      { key: 'dailyReports', href: '/dashboard/projects/daily-reports', icon: 'reports' },
      { key: 'workforce', href: '/dashboard/field-management/workforce', icon: 'workforce' },
      { key: 'projectAssignments', href: '/dashboard/field-management/workforce/assignments', icon: 'assignment' },
      { key: 'attendance', href: '/dashboard/field-management/workforce/attendance', icon: 'attendance' },
    ],
  },
  {
    key: 'planning',
    items: [
      { key: 'prePlanning', href: '/planning/pre-planning', icon: 'preplanning' },
      { key: 'masterPlan', href: '/dashboard/planning/master-plan', icon: 'masterplan' },
      { key: 'lookaheadPlanning', href: '/dashboard/planning/lookahead', icon: 'lookahead' },
      { key: 'weeklyPlanning', href: '/dashboard/planning/weekly-planning', icon: 'weekly' },
      { key: 'constraintLog', href: '/dashboard/projects/constraints', icon: 'constraint' },
    ],
  },
  { key: 'control', items: [] },
  {
    key: 'administration',
    items: [
      { key: 'usersAccess', href: '/dashboard/administration/users', icon: 'users' },
    ],
  },
]

export const dashboardPlatformNavigation = {
  key: 'platform',
  items: [
    { key: 'organizations', href: '/dashboard/platform/organizations', icon: 'organizations' },
  ],
}

export const projectSetupHeaderSectionsI18n = [
  { id: 'general', key: 'general' },
  { id: 'scope', key: 'scope' },
  { id: 'locations', key: 'locations' },
  { id: 'allocation', key: 'allocation' },
  { id: 'production', key: 'productionParameters' },
]

export function localizeDashboardNavigation(locale, includePlatform = false) {
  const groups = includePlatform
    ? [...dashboardShellNavigation, dashboardPlatformNavigation]
    : dashboardShellNavigation

  return groups.map(group => ({
    ...group,
    label: dashboardShellText(locale, group.key),
    items: group.items.map(item => ({
      ...item,
      label: item.label ?? dashboardShellText(locale, item.key),
    })),
  }))
}

export function localizeProjectSetupHeaderSections(locale) {
  return projectSetupHeaderSectionsI18n.map(section => ({
    ...section,
    label: dashboardShellText(locale, section.key),
  }))
}
