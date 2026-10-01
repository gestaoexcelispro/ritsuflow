const copy = {
  'en-US': {
    title:'Weekly Planning', projectsInformation:'Projects / Information', materials:'Materials', labor:'Labor', equipment:'Equipment', space:'Space', predecessor:'Predecessor', externalConditions:'External Conditions',
    varianceLabor:'Labor', varianceMaterial:'Material', varianceEquipment:'Equipment', varianceDesignInformation:'Design / Information', variancePredecessor:'Predecessor', varianceWorkspaceAccess:'Workspace / Access', varianceWeather:'Weather', varianceSubcontractor:'Subcontractor', varianceClientOwner:'Client / Owner', variancePlanning:'Planning', varianceQualityRework:'Quality / Rework', varianceSafety:'Safety', varianceOther:'Other',
    draft:'Draft', committed:'Committed', closed:'Closed', cancelled:'Cancelled', yes:'Yes', no:'No', notApplicable:'N/A', notAssessed:'Not Assessed', constraintBlocking:'Constraint Blocking', resolvedAwaitingVerification:'Resolved — Awaiting Verification', activeConstraintInProgress:'Active Constraint — In Progress', activeConstraintWaiting:'Active Constraint — Waiting', activeConstraint:'Active Constraint', unexpectedError:'Unexpected error.', selectProjectFirst:'Select a project first.', noActiveLookahead:'This project does not have an active Lookahead Plan.', weeklyPlanCreated:'Weekly Plan created.', activitiesDraftOnly:'Activities can only be added while the Weekly Plan is Draft.', activityDescriptionRequired:'Activity description is required.', selectWorkPackage:'Select a Work Package.',
    weekName:(week,year)=>`Week ${week} · ${year}`
  },
  'pt-BR': {
    title:'Planejamento Semanal', projectsInformation:'Projetos / Informações', materials:'Materiais', labor:'Mão de Obra', equipment:'Equipamentos', space:'Espaço', predecessor:'Predecessor', externalConditions:'Condições Externas',
    varianceLabor:'Mão de Obra', varianceMaterial:'Material', varianceEquipment:'Equipamento', varianceDesignInformation:'Projeto / Informação', variancePredecessor:'Predecessor', varianceWorkspaceAccess:'Espaço de Trabalho / Acesso', varianceWeather:'Clima', varianceSubcontractor:'Subcontratado', varianceClientOwner:'Cliente / Proprietário', variancePlanning:'Planejamento', varianceQualityRework:'Qualidade / Retrabalho', varianceSafety:'Segurança', varianceOther:'Outro',
    draft:'Rascunho', committed:'Comprometido', closed:'Encerrado', cancelled:'Cancelado', yes:'Sim', no:'Não', notApplicable:'N/A', notAssessed:'Não Avaliado', constraintBlocking:'Restrição Bloqueando', resolvedAwaitingVerification:'Resolvida — Aguardando Verificação', activeConstraintInProgress:'Restrição Ativa — Em Andamento', activeConstraintWaiting:'Restrição Ativa — Aguardando', activeConstraint:'Restrição Ativa', unexpectedError:'Erro inesperado.', selectProjectFirst:'Selecione um projeto primeiro.', noActiveLookahead:'Este projeto não possui um Plano Lookahead ativo.', weeklyPlanCreated:'Plano Semanal criado.', activitiesDraftOnly:'As atividades só podem ser adicionadas enquanto o Plano Semanal estiver em Rascunho.', activityDescriptionRequired:'A descrição da atividade é obrigatória.', selectWorkPackage:'Selecione um Pacote de Trabalho.',
    weekName:(week,year)=>`Semana ${week} · ${year}`
  },
  es: {
    title:'Planificación Semanal', projectsInformation:'Proyectos / Información', materials:'Materiales', labor:'Mano de Obra', equipment:'Equipos', space:'Espacio', predecessor:'Predecesor', externalConditions:'Condiciones Externas',
    varianceLabor:'Mano de Obra', varianceMaterial:'Material', varianceEquipment:'Equipo', varianceDesignInformation:'Diseño / Información', variancePredecessor:'Predecesor', varianceWorkspaceAccess:'Espacio de Trabajo / Acceso', varianceWeather:'Clima', varianceSubcontractor:'Subcontratista', varianceClientOwner:'Cliente / Propietario', variancePlanning:'Planificación', varianceQualityRework:'Calidad / Retrabajo', varianceSafety:'Seguridad', varianceOther:'Otro',
    draft:'Borrador', committed:'Comprometido', closed:'Cerrado', cancelled:'Cancelado', yes:'Sí', no:'No', notApplicable:'N/A', notAssessed:'No Evaluado', constraintBlocking:'Restricción Bloqueante', resolvedAwaitingVerification:'Resuelta — Esperando Verificación', activeConstraintInProgress:'Restricción Activa — En Progreso', activeConstraintWaiting:'Restricción Activa — En Espera', activeConstraint:'Restricción Activa', unexpectedError:'Error inesperado.', selectProjectFirst:'Selecciona un proyecto primero.', noActiveLookahead:'Este proyecto no tiene un Plan Lookahead activo.', weeklyPlanCreated:'Plan Semanal creado.', activitiesDraftOnly:'Las actividades solo pueden agregarse mientras el Plan Semanal esté en Borrador.', activityDescriptionRequired:'La descripción de la actividad es obligatoria.', selectWorkPackage:'Selecciona un Paquete de Trabajo.',
    weekName:(week,year)=>`Semana ${week} · ${year}`
  }
}

export function getWeeklyPlanningCopy(locale='en-US') { return copy[locale] || copy['en-US'] }

export function getWeeklyVarianceReasons(locale='en-US') {
  const t=getWeeklyPlanningCopy(locale)
  return [
    {value:'labor',label:t.varianceLabor},{value:'material',label:t.varianceMaterial},{value:'equipment',label:t.varianceEquipment},{value:'design_information',label:t.varianceDesignInformation},{value:'predecessor',label:t.variancePredecessor},{value:'workspace_access',label:t.varianceWorkspaceAccess},{value:'weather',label:t.varianceWeather},{value:'subcontractor',label:t.varianceSubcontractor},{value:'client_owner',label:t.varianceClientOwner},{value:'planning',label:t.variancePlanning},{value:'quality_rework',label:t.varianceQualityRework},{value:'safety',label:t.varianceSafety},{value:'other',label:t.varianceOther}
  ]
}

export function getWeeklyMakeReadyCategories(locale='en-US') {
  const t=getWeeklyPlanningCopy(locale)
  return [
    {key:'projects_information_status',sourceKey:'projects_information_source',category:'projects_information',label:t.projectsInformation},
    {key:'materials_status',sourceKey:'materials_source',category:'materials',label:t.materials},
    {key:'labor_status',sourceKey:'labor_source',category:'labor',label:t.labor},
    {key:'equipment_status',sourceKey:'equipment_source',category:'equipment',label:t.equipment},
    {key:'space_status',sourceKey:'space_source',category:'space',label:t.space},
    {key:'predecessor_status',sourceKey:'predecessor_source',category:'predecessor',label:t.predecessor},
    {key:'external_conditions_status',sourceKey:'external_conditions_source',category:'external_conditions',label:t.externalConditions}
  ]
}
