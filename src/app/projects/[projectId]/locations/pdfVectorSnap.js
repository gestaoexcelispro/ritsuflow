const IDENTITY=[1,0,0,1,0,0]
const CURVE_STEPS=8
const MAX_SEGMENTS=50000
const MIN_SEGMENT_LENGTH=.15
const MAX_INTERSECTION_SEGMENTS=6000

function multiply(a,b){return [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]]}
function transformPoint(p,m){return{x:m[0]*p.x+m[2]*p.y+m[4],y:m[1]*p.x+m[3]*p.y+m[5]}}
function distance(a,b){return Math.hypot(b.x-a.x,b.y-a.y)}
function bezier(p0,p1,p2,p3,t){const u=1-t,u2=u*u,t2=t*t;return{x:u2*u*p0.x+3*u2*t*p1.x+3*u*t2*p2.x+t2*t*p3.x,y:u2*u*p0.y+3*u2*t*p1.y+3*u*t2*p2.y+t2*t*p3.y}}
function pointKey(p){return `${Math.round(p.x*1000)},${Math.round(p.y*1000)}`}
function segmentKey(a,b){const ka=pointKey(a),kb=pointKey(b);return ka<kb?`${ka}|${kb}`:`${kb}|${ka}`}
function normalize(p,size){return{x:p.x/size.width,y:p.y/size.height}}
function segmentIntersection(s1,s2){const x1=s1.a.x,y1=s1.a.y,x2=s1.b.x,y2=s1.b.y,x3=s2.a.x,y3=s2.a.y,x4=s2.b.x,y4=s2.b.y,den=(x1-x2)*(y3-y4)-(y1-y2)*(x3-x4);if(Math.abs(den)<1e-10)return null;const t=((x1-x3)*(y3-y4)-(y1-y3)*(x3-x4))/den,u=-((x1-x2)*(y1-y3)-(y1-y2)*(x1-x3))/den;if(t<=1e-6||t>=.999999||u<=1e-6||u>=.999999)return null;return{x:x1+t*(x2-x1),y:y1+t*(y2-y1)}}
function buildIntersections(segments,width,height){if(!segments.length||segments.length>MAX_INTERSECTION_SEGMENTS)return[];const cells=new Map(),result=new Map(),grid=64,cellKey=(x,y)=>`${x}:${y}`;for(let i=0;i<segments.length;i++){const s=segments[i],minX=Math.max(0,Math.floor(Math.min(s.a.x,s.b.x)/width*grid)),maxX=Math.min(grid-1,Math.floor(Math.max(s.a.x,s.b.x)/width*grid)),minY=Math.max(0,Math.floor(Math.min(s.a.y,s.b.y)/height*grid)),maxY=Math.min(grid-1,Math.floor(Math.max(s.a.y,s.b.y)/height*grid));for(let x=minX;x<=maxX;x++)for(let y=minY;y<=maxY;y++){const key=cellKey(x,y),bucket=cells.get(key)||[];bucket.push(i);cells.set(key,bucket)}}const checked=new Set();for(const bucket of cells.values())for(let a=0;a<bucket.length;a++)for(let b=a+1;b<bucket.length;b++){const i=bucket[a],j=bucket[b],pair=i<j?`${i}:${j}`:`${j}:${i}`;if(checked.has(pair))continue;checked.add(pair);const p=segmentIntersection(segments[i],segments[j]);if(p&&p.x>=0&&p.x<=width&&p.y>=0&&p.y<=height)result.set(pointKey(p),p)}return[...result.values()]}

export async function extractPdfVectorSnap(page,viewport,pdfjs){
  const operatorList=await page.getOperatorList(),OPS=pdfjs.OPS,segments=[],segmentKeys=new Set(),stack=[]
  let ctm=[...IDENTITY],currentSegments=[],current=null,start=null,hasRasterImage=false,truncated=false
  const toViewport=(x,y)=>{const transformed=transformPoint({x,y},ctm),[vx,vy]=viewport.convertToViewportPoint(transformed.x,transformed.y);return{x:vx,y:vy}}
  const add=(a,b)=>{if(!a||!b||distance(a,b)<MIN_SEGMENT_LENGTH)return;currentSegments.push({a:{...a},b:{...b}})}
  const addCurve=(p0,p1,p2,p3)=>{let previous=p0;for(let step=1;step<=CURVE_STEPS;step++){const p=bezier(p0,p1,p2,p3,step/CURVE_STEPS);add(previous,p);previous=p}}
  const commit=()=>{for(const segment of currentSegments){if(segments.length>=MAX_SEGMENTS){truncated=true;break}const key=segmentKey(segment.a,segment.b);if(segmentKeys.has(key))continue;segmentKeys.add(key);segments.push(segment)}currentSegments=[];current=null;start=null}
  const discard=()=>{currentSegments=[];current=null;start=null}
  const parsePath=args=>{const rawOps=args?.[0],rawCoords=args?.[1];if(rawOps==null||!rawCoords)return;const ops=ArrayBuffer.isView(rawOps)||Array.isArray(rawOps)?Array.from(rawOps):[rawOps],coords=Array.from(rawCoords);let ci=0;for(const op of ops){if(op===OPS.moveTo){current=toViewport(coords[ci],coords[ci+1]);ci+=2;start=current}else if(op===OPS.lineTo){const p=toViewport(coords[ci],coords[ci+1]);ci+=2;if(current)add(current,p);current=p}else if(op===OPS.curveTo){const c1=toViewport(coords[ci],coords[ci+1]),c2=toViewport(coords[ci+2],coords[ci+3]),p=toViewport(coords[ci+4],coords[ci+5]);ci+=6;if(current)addCurve(current,c1,c2,p);current=p}else if(op===OPS.curveTo2){const c2=toViewport(coords[ci],coords[ci+1]),p=toViewport(coords[ci+2],coords[ci+3]);ci+=4;if(current)addCurve(current,current,c2,p);current=p}else if(op===OPS.curveTo3){const c1=toViewport(coords[ci],coords[ci+1]),p=toViewport(coords[ci+2],coords[ci+3]);ci+=4;if(current)addCurve(current,c1,p,p);current=p}else if(op===OPS.closePath){if(current&&start)add(current,start);current=start}else if(op===OPS.rectangle){const x=coords[ci],y=coords[ci+1],w=coords[ci+2],h=coords[ci+3];ci+=4;const p1=toViewport(x,y),p2=toViewport(x+w,y),p3=toViewport(x+w,y+h),p4=toViewport(x,y+h);add(p1,p2);add(p2,p3);add(p3,p4);add(p4,p1);current=p1;start=p1}}}
  for(let i=0;i<operatorList.fnArray.length;i++){const op=operatorList.fnArray[i],args=operatorList.argsArray[i];if(op===OPS.save){stack.push([...ctm]);continue}if(op===OPS.restore){ctm=stack.pop()||[...IDENTITY];continue}if(op===OPS.transform){const values=ArrayBuffer.isView(args)||Array.isArray(args)?Array.from(args):[];if(values.length>=6)ctm=multiply(ctm,values);continue}if(op===OPS.constructPath){parsePath(args);continue}if(op===OPS.stroke||op===OPS.closeStroke||op===OPS.fillStroke||op===OPS.eoFillStroke||op===OPS.closeFillStroke||op===OPS.closeEOFillStroke){commit();if(truncated)break;continue}if(op===OPS.fill||op===OPS.eoFill||op===OPS.endPath||op===OPS.clip||op===OPS.eoClip){discard();continue}if(op===OPS.paintImageXObject||op===OPS.paintInlineImageXObject||op===OPS.paintImageMaskXObject||op===OPS.paintSolidColorImageMask)hasRasterImage=true}
  if(currentSegments.length)discard()
  const endpointMap=new Map();for(const s of segments){endpointMap.set(pointKey(s.a),s.a);endpointMap.set(pointKey(s.b),s.b)}
  const intersections=buildIntersections(segments,viewport.width,viewport.height)
  return{coordinateSpace:'pdf-viewport',width:viewport.width,height:viewport.height,endpoints:[...endpointMap.values()],intersections,segments,segmentCount:segments.length,endpointCount:endpointMap.size,intersectionCount:intersections.length,hasRasterImage,truncated,status:segments.length?'vector':hasRasterImage?'raster':'empty'}
}

// Acquire object snaps in the same PDF viewport coordinate space used while
// extracting vector paths. Only after a candidate wins do we normalize it for
// Location Map persistence. This keeps acquisition independent of zoom/pan.
export function nearestVectorSnap(rawNormalized,geometry,screenSize,radiusPx,options={}){
  if(!geometry||!geometry.width||!geometry.height||!screenSize?.width||!screenSize?.height)return null
  const modes={corner:true,intersection:true,perpendicular:true,...(options.modes||{})},cursor={x:rawNormalized.x*geometry.width,y:rawNormalized.y*geometry.height},scaleX=screenSize.width/geometry.width,scaleY=screenSize.height/geometry.height
  const screenDistance=(a,b)=>Math.hypot((a.x-b.x)*scaleX,(a.y-b.y)*scaleY),finish=(point,type,distancePx)=>({point:normalize(point,geometry),nativePoint:point,type,distancePx})
  const nearestPoint=(points,type)=>{let best=null,bestDistance=radiusPx+1;for(const p of points||[]){const d=screenDistance(cursor,p);if(d<bestDistance){bestDistance=d;best=finish(p,type,d)}}return best}
  if(modes.corner){const corner=nearestPoint(geometry.endpoints,'corner');if(corner)return corner}
  if(modes.intersection){const intersection=nearestPoint(geometry.intersections,'intersection');if(intersection)return intersection}
  if(modes.perpendicular&&options.fromPoint){const origin={x:options.fromPoint.x*geometry.width,y:options.fromPoint.y*geometry.height};let best=null,bestDistance=radiusPx+1;for(const segment of geometry.segments||[]){const a=segment.a,b=segment.b,dx=b.x-a.x,dy=b.y-a.y,len2=dx*dx+dy*dy;if(len2<1e-9)continue;const t=((origin.x-a.x)*dx+(origin.y-a.y)*dy)/len2;if(t<0||t>1)continue;const q={x:a.x+t*dx,y:a.y+t*dy},d=screenDistance(cursor,q);if(d<bestDistance){bestDistance=d;best=finish(q,'perpendicular',d)}}if(best)return best}
  if(options.allowEdge===false)return null
  let best=null,bestDistance=radiusPx+1;for(const segment of geometry.segments||[]){const a=segment.a,b=segment.b,dx=b.x-a.x,dy=b.y-a.y,len2=dx*dx+dy*dy;if(len2<1e-9)continue;const t=Math.max(0,Math.min(1,((cursor.x-a.x)*dx+(cursor.y-a.y)*dy)/len2)),q={x:a.x+t*dx,y:a.y+t*dy},d=screenDistance(cursor,q);if(d<bestDistance){bestDistance=d;best=finish(q,'edge',d)}}return best
}
