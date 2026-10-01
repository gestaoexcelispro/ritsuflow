const copy = {
  'en-US': {
    liveAttendance: 'Live Attendance',
    timecards: 'Timecards',
    exceptions: 'Exceptions',
    auditTrail: 'Audit Trail',
    ariaLabel: 'Attendance navigation',
  },
  'pt-BR': {
    liveAttendance: 'Presença em Tempo Real',
    timecards: 'Cartões de Ponto',
    exceptions: 'Exceções',
    auditTrail: 'Trilha de Auditoria',
    ariaLabel: 'Navegação de presença',
  },
  es: {
    liveAttendance: 'Asistencia en Tiempo Real',
    timecards: 'Tarjetas de Tiempo',
    exceptions: 'Excepciones',
    auditTrail: 'Registro de Auditoría',
    ariaLabel: 'Navegación de asistencia',
  },
}

export function getAttendanceNavigationCopy(locale = 'en-US') {
  return copy[locale] || copy['en-US']
}
