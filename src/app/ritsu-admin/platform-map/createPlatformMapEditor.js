import { ClassicPreset, NodeEditor } from 'rete'
import { AreaExtensions, AreaPlugin } from 'rete-area-plugin'
import { ReactPlugin, Presets } from 'rete-react-plugin'
import { createRoot } from 'react-dom/client'
import { platformMapNodes, platformMapEdges } from './platformMapData'

function detailNodes(focus) {
  const groups = [['inputs','Inputs',focus.inputs],['process','Process',focus.process],['outputs','Outputs',focus.outputs],['pages','Pages',focus.pages],['data','Data',focus.data]]
  return groups.filter(([, , items]) => items?.length).map(([suffix,label,items]) => ({ id:`${focus.id}-${suffix}`, label, subtitle:items.join(' • '), type:'detail', detailType:suffix, parent:focus.id, items }))
}

function getVisibleGraph(focusId) {
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

function workspaceModulePosition(index,count) {
  const centerX=560, firstY=390, xGap=260, yGap=235
  if(count<=3) return {x:centerX+(index-(count-1)/2)*xGap,y:firstY}
  const topCount=Math.ceil(count/2), bottomCount=count-topCount
  if(index<topCount) return {x:centerX+(index-(topCount-1)/2)*xGap,y:firstY}
  const bottomIndex=index-topCount
  return {x:centerX+(bottomIndex-(bottomCount-1)/2)*xGap,y:firstY+yGap}
}

function moduleDetailPosition(item) {
  const positions = {
    inputs:{x:190,y:420},
    process:{x:560,y:420},
    outputs:{x:930,y:420},
    pages:{x:560,y:180},
    data:{x:560,y:660},
  }
  return positions[item.detailType] || {x:560,y:420}
}

function getPosition(item,focusId,nodes) {
  const focus=platformMapNodes.find((node)=>node.id===focusId)
  if(!focus||focusId==='ritsuflow') {
    if(item.id==='ritsuflow') return {x:520,y:70}
    return {x:{projects:160,precon:520,fieldop:880}[item.id]||520,y:390}
  }
  if(focus.type==='workspace') {
    if(item.id==='ritsuflow') return {x:70,y:75}
    if(item.id===focusId) return {x:560,y:75}
    const modules=nodes.filter((node)=>node.type==='module')
    return workspaceModulePosition(modules.findIndex((node)=>node.id===item.id),modules.length)
  }
  if(focus.type==='module') {
    if(item.id==='ritsuflow') return {x:60,y:60}
    if(item.id===focus.workspace) return {x:330,y:60}
    if(item.id===focus.id) return {x:600,y:60}
    if(item.type==='detail') return moduleDetailPosition(item)
  }
  return {x:500,y:400}
}

export async function createPlatformMapEditor(container,{onSelect,focusId='ritsuflow'}={}) {
  const editor=new NodeEditor()
  const area=new AreaPlugin(container)
  const render=new ReactPlugin({createRoot})
  render.addPreset(Presets.classic.setup())
  area.use(render)
  editor.use(area)
  const graph=getVisibleGraph(focusId)
  const socket=new ClassicPreset.Socket('architecture')
  const nodeMap=new Map()
  for(const item of graph.nodes){
    const node=new ClassicPreset.Node(item.label)
    node.meta=item
    node.addInput('in',new ClassicPreset.Input(socket,''))
    node.addOutput('out',new ClassicPreset.Output(socket,''))
    await editor.addNode(node)
    nodeMap.set(item.id,node)
  }
  for(const edge of graph.edges){
    const source=nodeMap.get(edge.source),target=nodeMap.get(edge.target)
    if(source&&target) await editor.addConnection(new ClassicPreset.Connection(source,'out',target,'in'))
  }
  for(const item of graph.nodes){const node=nodeMap.get(item.id);if(node) await area.translate(node.id,getPosition(item,focusId,graph.nodes))}
  AreaExtensions.selectableNodes(area,AreaExtensions.selector(),{accumulating:AreaExtensions.accumulateOnCtrl()})
  AreaExtensions.simpleNodesOrder(area)
  area.addPipe((context)=>{if(context.type==='nodepicked'){const node=editor.getNode(context.data.id);if(node?.meta) onSelect?.(node.meta)}return context})
  await AreaExtensions.zoomAt(area,editor.getNodes())
  return ()=>area.destroy()
}
