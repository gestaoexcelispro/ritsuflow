const copy = {
  'en-US': {
    fieldManagement: 'Field Management', title: 'Attendance Audit Trail',
    description: 'Review original attendance events, supervisor corrections, exception reviews, and final resolution decisions in one immutable timeline.',
    unknownWorker: 'Unknown worker', unnamedWorker: 'Unnamed worker', unknownProject: 'Unknown project', unnamedProject: 'Unnamed project', unknownUser: 'Unknown user', unknown: 'Unknown',
    project: 'Project', workDate: 'Work Date', event: 'Event', allEvents: 'All Events', refresh: 'Refresh', refreshing: 'Refreshing...', noProjects: 'No projects available',
    checkIns: 'Check-Ins', checkOuts: 'Check-Outs', corrections: 'Corrections', exceptionActions: 'Exception Actions', auditEvents: 'Audit Events',
    checkIn: 'Check-In', checkOut: 'Check-Out', manualAdjustment: 'Manual Adjustment', sessionCancelled: 'Session Cancelled', exceptionReviewed: 'Exception Reviewed', exceptionResolved: 'Exception Resolved',
    accepted: 'Accepted', rejected: 'Rejected', dismissed: 'Dismissed',
    worker: 'Worker', fieldId: 'Field ID', actor: 'Actor', time: 'Time', method: 'Method', source: 'Source', notes: 'Notes', details: 'Details',
    before: 'Before', after: 'After', metadata: 'Metadata', geofence: 'Geofence', gpsAccuracy: 'GPS Accuracy', distance: 'Distance', latitude: 'Latitude', longitude: 'Longitude',
    yes: 'Yes', no: 'No', loading: 'Loading Attendance Audit Trail...', noEvents: 'No audit events found for the selected project, date, and event filter.',
    unableLoad: 'Unable to load attendance audit trail.', unableInitialize: 'Unable to initialize Attendance Audit Trail.', immutable: 'Immutable audit record', recordedBy: 'Recorded By', createdAt: 'Created At', resolutionAction: 'Resolution Action',
  },
  'pt-BR': {
    fieldManagement: 'Gestão de Campo', title: 'Trilha de Auditoria de Presença',
    description: 'Revise eventos originais de presença, correções da supervisão, revisões de exceções e decisões finais de resolução em uma única linha do tempo imutável.',
    unknownWorker: 'Trabalhador desconhecido', unnamedWorker: 'Trabalhador sem nome', unknownProject: 'Projeto desconhecido', unnamedProject: 'Projeto sem nome', unknownUser: 'Usuário desconhecido', unknown: 'Desconhecido',
    project: 'Projeto', workDate: 'Data de Trabalho', event: 'Evento', allEvents: 'Todos os Eventos', refresh: 'Atualizar', refreshing: 'Atualizando...', noProjects: 'Nenhum projeto disponível',
    checkIns: 'Entradas', checkOuts: 'Saídas', corrections: 'Correções', exceptionActions: 'Ações de Exceção', auditEvents: 'Eventos de Auditoria',
    checkIn: 'Entrada', checkOut: 'Saída', manualAdjustment: 'Ajuste Manual', sessionCancelled: 'Sessão Cancelada', exceptionReviewed: 'Exceção Revisada', exceptionResolved: 'Exceção Resolvida',
    accepted: 'Aceita', rejected: 'Rejeitada', dismissed: 'Descartada',
    worker: 'Trabalhador', fieldId: 'ID de Campo', actor: 'Responsável', time: 'Horário', method: 'Método', source: 'Origem', notes: 'Notas', details: 'Detalhes',
    before: 'Antes', after: 'Depois', metadata: 'Metadados', geofence: 'Geofence', gpsAccuracy: 'Precisão GPS', distance: 'Distância', latitude: 'Latitude', longitude: 'Longitude',
    yes: 'Sim', no: 'Não', loading: 'Carregando Trilha de Auditoria de Presença...', noEvents: 'Nenhum evento de auditoria encontrado para o projeto, data e filtro de evento selecionados.',
    unableLoad: 'Não foi possível carregar a trilha de auditoria de presença.', unableInitialize: 'Não foi possível inicializar a Trilha de Auditoria de Presença.', immutable: 'Registro de auditoria imutável', recordedBy: 'Registrado Por', createdAt: 'Criado Em', resolutionAction: 'Ação de Resolução',
  },
  es: {
    fieldManagement: 'Gestión de Campo', title: 'Registro de Auditoría de Asistencia',
    description: 'Revisa eventos originales de asistencia, correcciones de supervisión, revisiones de excepciones y decisiones finales de resolución en una única línea de tiempo inmutable.',
    unknownWorker: 'Trabajador desconocido', unnamedWorker: 'Trabajador sin nombre', unknownProject: 'Proyecto desconocido', unnamedProject: 'Proyecto sin nombre', unknownUser: 'Usuario desconocido', unknown: 'Desconocido',
    project: 'Proyecto', workDate: 'Fecha de Trabajo', event: 'Evento', allEvents: 'Todos los Eventos', refresh: 'Actualizar', refreshing: 'Actualizando...', noProjects: 'No hay proyectos disponibles',
    checkIns: 'Entradas', checkOuts: 'Salidas', corrections: 'Correcciones', exceptionActions: 'Acciones de Excepción', auditEvents: 'Eventos de Auditoría',
    checkIn: 'Entrada', checkOut: 'Salida', manualAdjustment: 'Ajuste Manual', sessionCancelled: 'Sesión Cancelada', exceptionReviewed: 'Excepción Revisada', exceptionResolved: 'Excepción Resuelta',
    accepted: 'Aceptada', rejected: 'Rechazada', dismissed: 'Descartada',
    worker: 'Trabajador', fieldId: 'ID de Campo', actor: 'Responsable', time: 'Hora', method: 'Método', source: 'Origen', notes: 'Notas', details: 'Detalles',
    before: 'Antes', after: 'Después', metadata: 'Metadatos', geofence: 'Geocerca', gpsAccuracy: 'Precisión GPS', distance: 'Distancia', latitude: 'Latitud', longitude: 'Longitud',
    yes: 'Sí', no: 'No', loading: 'Cargando Registro de Auditoría de Asistencia...', noEvents: 'No se encontraron eventos de auditoría para el proyecto, la fecha y el filtro de evento seleccionados.',
    unableLoad: 'No se pudo cargar el registro de auditoría de asistencia.', unableInitialize: 'No se pudo inicializar el Registro de Auditoría de Asistencia.', immutable: 'Registro de auditoría inmutable', recordedBy: 'Registrado Por', createdAt: 'Creado En', resolutionAction: 'Acción de Resolución',
  },
}

export function getAttendanceAuditCopy(locale = 'en-US') {
  return copy[locale] || copy['en-US']
}

export function getAttendanceAuditResolutionLabel(value, locale = 'en-US') {
  const t = getAttendanceAuditCopy(locale)
  const labels = { accepted: t.accepted, rejected: t.rejected, dismissed: t.dismissed }
  return labels[value] || humanizeAuditValue(value)
}

export function getAttendanceAuditEventLabel(event, locale = 'en-US') {
  const t = getAttendanceAuditCopy(locale)
  const auditAction = event?.metadata?.audit_action || null
  if (auditAction === 'exception_reviewed') return t.exceptionReviewed
  if (auditAction === 'exception_resolved') {
    const action = getAttendanceAuditResolutionLabel(event?.metadata?.resolution_action, locale)
    return action ? `${t.exceptionResolved} · ${action}` : t.exceptionResolved
  }
  const labels = { check_in: t.checkIn, check_out: t.checkOut, manual_adjustment: t.manualAdjustment, session_cancelled: t.sessionCancelled }
  return labels[event?.event_type] || humanizeAuditValue(event?.event_type) || t.unknown
}

export function humanizeAuditValue(value) {
  if (!value) return ''
  return String(value).split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

export function formatAttendanceAuditDateTime(value, locale = 'en-US') {
  if (!value) return '—'
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function formatAttendanceAuditMetadataValue(value, locale = 'en-US') {
  const t = getAttendanceAuditCopy(locale)
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? t.yes : t.no
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string' && value.includes('T') && !Number.isNaN(new Date(value).getTime())) return formatAttendanceAuditDateTime(value, locale)
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}
