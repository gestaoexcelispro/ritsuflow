import { platformMapNodes, platformMapEdges } from './platformMapData'

function detailNodes(focus) {
  const groups = [['inputs','Inputs',focus.inputs],['process','Process',focus.process],['outputs','Outputs',focus.outputs],['pages','Pages',focus.pages],['data','Data',focus.data]]
  return groups.filter(([, , items]) => items?.length).map(([suffix,label,items]) => ({ id:`${focus.id}-${suffix}`, label, subtitle:items.join(' • '), type:'detail', detailType:suffix, parent:focus.id, items }))
}

export function getVisibleGraph(focusId) {
  if (!focusId || focusId === 'ritsuflow') {
    const ids = new Set(['ritsuflow','projects','precon','fieldop'])
    return { nodes:platformMapNodes.filter((node)=>ids.has(node.id)), edges:platformMapEdges.filter((edge)=>ids.has(edge.source)&&ids.has(edge.target)) }
  }
  const focus = platformMapNodes.find((node)=>node.id===focusId)
  if (focus?.type === 'workspace') {
    const ids = new Set(['ritsuflow',focus.id,...platformMapNodes.filter((node)=>node.workspace===focus.id).map((node)=>node.id)])
    return { nodes:platformMapNodes.filter((node)=>ids.has(node.id)), edges:platformMapEdges.filter((edge)=>ids.has(edge.source)&&ids.has(edge.target)) }
  }
  if (focus?.type === 'module') {
    const base = platformMapNodes.filter((node)=>['ritsuflow',focus.workspace,focus.id].includes(node.id))
    const details = detailNodes(focus)
    const byType = Object.fromEntries(details.map((node)=>[node.detailType,node]))
    const edges = [
      {id:`root-${focus.workspace}`,source:'ritsuflow',target:focus.workspace},
      {id:`workspace-${focus.id}`,source:focus.workspace,target:focus.id},
    ]
    if (byType.inputs) edges.push({id:`${focus.id}-inputs`,source:focus.id,target:byType.inputs.id})
    if (byType.process) edges.push({id:`${focus.id}-process`,source:byType.inputs?.id||focus.id,target:byType.process.id})
    if (byType.outputs) edges.push({id:`${focus.id}-outputs`,source:byType.process?.id||focus.id,target:byType.outputs.id})
    if (byType.pages) edges.push({id:`${focus.id}-pages`,source:byType.pages.id,target:byType.process?.id||focus.id})
    if (byType.data) edges.push({id:`${focus.id}-data`,source:byType.process?.id||focus.id,target:byType.data.id})
    return { nodes:[...base,...details], edges }
  }
  return getVisibleGraph('ritsuflow')
}
