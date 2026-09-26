const IDENTITY=[1,0,0,1,0,0]
const CURVE_STEPS=8
const MAX_SEGMENTS=50000
const MIN_SEGMENT_LENGTH=.15

function multiply(a,b){return [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]]}
function transformPoint(p,m){return{x:m[0]*p.x+m[2]*p.y+m[4],y:m[1]*p.x+m[3]*p.y+m[5]}}
function distance(a,b){return Math.hypot(b.x-a.x,b.y-a.y)}
function bezier(p0,p1,p2,p3,t){const u=1-t,u2=u*u,t2=t*t;return{x:u2*u*p0.x+3*u2*t*p1.x+3*u*t2*p2.x+t2*t*p3.x,y:u2*u*p0.y+3*u2*t*p1.y+3*u*t2*p2.y+t2*t*p3.y}}
function segmentKey(a,b){const k=p=>`${Math.round(p.x*100)},${Math.round(p.y*100)}`,ka=k(a),kb=k(b);return ka<kb?`${ka}|${kb}`:`${kb}|${ka}`}
function normalize(p,viewport){return{x:p.x/viewport.width,y:p.y/viewport.height}}

export async function extractPdfVectorSnap(page,viewport,pdfjs){
  const operatorList=await page.getOperatorList(),OPS=pdfjs.OPS
  const segments=[],segmentKeys=new Set(),stack=[]
  let ctm=[...IDENTITY],currentSegments=[],current=null,start=null,hasRasterImage=false,truncated=false

  const toViewport=(x,y)=>{const transformed=transformPoint({x,y},ctm),[vx,vy]=viewport.convertToViewportPoint(transformed.x,transformed.y);return{x:vx,y:vy}}
  const add=(a,b)=>{if(!a||!b||distance(a,b)<MIN_SEGMENT_LENGTH)return;currentSegments.push({point1:{...a},point2:{...b}})}
  const addCurve=(p0,p1,p2,p3)=>{let previous=p0;for(let step=1;step<=CURVE_STEPS;step++){const p=bezier(p0,p1,p2,p3,step/CURVE_STEPS);add(previous,p);previous=p}}
  const commit=()=>{for(const segment of currentSegments){if(segments.length>=MAX_SEGMENTS){truncated=true;break}const key=segmentKey(segment.point1,segment.point2);if(segmentKeys.has(key))continue;segmentKeys.add(key);segments.push(segment)}currentSegments=[];current=null;start=null}
  const discard=()=>{currentSegments=[];current=null;start=null}
  const parsePath=args=>{
    const rawOps=args?.[0],rawCoords=args?.[1];if(rawOps==null||!rawCoords)return
    const ops=ArrayBuffer.isView(rawOps)||Array.isArray(rawOps)?Array.from(rawOps):[rawOps],coords=Array.from(rawCoords);let ci=0
    for(const op of ops){
      if(op===OPS.moveTo){current=toViewport(coords[ci],coords[ci+1]);ci+=2;start=current}
      else if(op===OPS.lineTo){const p=toViewport(coords[ci],coords[ci+1]);ci+=2;if(current)add(current,p);current=p}
      else if(op===OPS.curveTo){const c1=toViewport(coords[ci],coords[ci+1]),c2=toViewport(coords[ci+2],coords[ci+3]),p=toViewport(coords[ci+4],coords[ci+5]);ci+=6;if(current)addCurve(current,c1,c2,p);current=p}
      else if(op===OPS.curveTo2){const c2=toViewport(coords[ci],coords[ci+1]),p=toViewport(coords[ci+2],coords[ci+3]);ci+=4;if(current)addCurve(current,current,c2,p);current=p}
      else if(op===OPS.curveTo3){const c1=toViewport(coords[ci],coords[ci+1]),p=toViewport(coords[ci+2],coords[ci+3]);ci+=4;if(current)addCurve(current,c1,p,p);current=p}
      else if(op===OPS.closePath){if(current&&start)add(current,start);current=start}
      else if(op===OPS.rectangle){const x=coords[ci],y=coords[ci+1],w=coords[ci+2],h=coords[ci+3];ci+=4;const p1=toViewport(x,y),p2=toViewport(x+w,y),p3=toViewport(x+w,y+h),p4=toViewport(x,y+h);add(p1,p2);add(p2,p3);add(p3,p4);add(p4,p1);current=p1;start=p1}
    }
  }

  for(let i=0;i<operatorList.fnArray.length;i++){
    const op=operatorList.fnArray[i],args=operatorList.argsArray[i]
    if(op===OPS.save){stack.push([...ctm]);continue}
    if(op===OPS.restore){ctm=stack.pop()||[...IDENTITY];continue}
    if(op===OPS.transform){const values=ArrayBuffer.isView(args)||Array.isArray(args)?Array.from(args):[];if(values.length>=6)ctm=multiply(ctm,values);continue}
    if(op===OPS.constructPath){parsePath(args);continue}
    if(op===OPS.stroke||op===OPS.closeStroke||op===OPS.fillStroke||op===OPS.eoFillStroke||op===OPS.closeFillStroke||op===OPS.closeEOFillStroke){commit();if(truncated)break;continue}
    if(op===OPS.fill||op===OPS.eoFill||op===OPS.endPath||op===OPS.clip||op===OPS.eoClip){discard();continue}
    if(op===OPS.paintImageXObject||op===OPS.paintInlineImageXObject||op===OPS.paintImageMaskXObject||op===OPS.paintSolidColorImageMask)hasRasterImage=true
  }
  if(currentSegments.length)discard()

  const endpointMap=new Map(),normalizedSegments=[]
  const endpointKey=p=>`${Math.round(p.x*100000)},${Math.round(p.y*100000)}`
  for(const segment of segments){const a=normalize(segment.point1,viewport),b=normalize(segment.point2,viewport);if(!Number.isFinite(a.x+a.y+b.x+b.y))continue;normalizedSegments.push({a,b});endpointMap.set(endpointKey(a),a);endpointMap.set(endpointKey(b),b)}
  return{endpoints:[...endpointMap.values()],segments:normalizedSegments,segmentCount:normalizedSegments.length,hasRasterImage,truncated,status:normalizedSegments.length?'vector':hasRasterImage?'raster':'empty'}
}

// raw and all geometry are normalized drawing coordinates. screenSize is used only
// to express the snap tolerance in CSS pixels, independent of pan/zoom DOM transforms.
export function nearestVectorSnap(raw,geometry,screenSize,radiusPx){
  if(!geometry||!screenSize?.width||!screenSize?.height)return null
  const px=p=>({x:p.x*screenSize.width,y:p.y*screenSize.height}),cursor=px(raw)
  let best=null,bestDistance=radiusPx+1
  for(const p of geometry.endpoints||[]){const q=px(p),d=Math.hypot(cursor.x-q.x,cursor.y-q.y);if(d<bestDistance){bestDistance=d;best={point:p,type:'endpoint',distancePx:d}}}
  if(best)return best
  for(const segment of geometry.segments||[]){const a=px(segment.a),b=px(segment.b),dx=b.x-a.x,dy=b.y-a.y,len2=dx*dx+dy*dy;if(len2<1e-9)continue;const t=Math.max(0,Math.min(1,((cursor.x-a.x)*dx+(cursor.y-a.y)*dy)/len2)),q={x:a.x+t*dx,y:a.y+t*dy},d=Math.hypot(cursor.x-q.x,cursor.y-q.y);if(d<bestDistance){bestDistance=d;best={point:{x:segment.a.x+t*(segment.b.x-segment.a.x),y:segment.a.y+t*(segment.b.y-segment.a.y)},type:'edge',distancePx:d}}}
  return best
}
