const IDENTITY=[1,0,0,1,0,0]
const CURVE_STEPS=8
const MAX_SEGMENTS=50000
const MIN_SEGMENT_LENGTH=.08
const SNAP_SCREEN_TOLERANCE=12

function multiply(a,b){return [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]]}
function transformPoint(p,m){return{x:m[0]*p.x+m[2]*p.y+m[4],y:m[1]*p.x+m[3]*p.y+m[5]}}
function distance(a,b){return Math.hypot(b.x-a.x,b.y-a.y)}
function bezier(p0,p1,p2,p3,t){const u=1-t,u2=u*u,t2=t*t;return{x:u2*u*p0.x+3*u2*t*p1.x+3*u*t2*p2.x+t2*t*p3.x,y:u2*u*p0.y+3*u2*t*p1.y+3*u*t2*p2.y+t2*t*p3.y}}
function pointKey(p){return `${Math.round(p.x*10000)},${Math.round(p.y*10000)}`}
function segmentKey(a,b){const ka=pointKey(a),kb=pointKey(b);return ka<kb?`${ka}|${kb}`:`${kb}|${ka}`}
function segmentBox(s,pad=0){return{minX:Math.min(s.a.x,s.b.x)-pad,maxX:Math.max(s.a.x,s.b.x)+pad,minY:Math.min(s.a.y,s.b.y)-pad,maxY:Math.max(s.a.y,s.b.y)+pad}}
function pointInBox(p,b){return p.x>=b.minX&&p.x<=b.maxX&&p.y>=b.minY&&p.y<=b.maxY}
function segmentIntersection(s1,s2){const x1=s1.a.x,y1=s1.a.y,x2=s1.b.x,y2=s1.b.y,x3=s2.a.x,y3=s2.a.y,x4=s2.b.x,y4=s2.b.y,den=(x1-x2)*(y3-y4)-(y1-y2)*(x3-x4);if(Math.abs(den)<1e-10)return null;const t=((x1-x3)*(y3-y4)-(y1-y3)*(x3-x4))/den,u=-((x1-x2)*(y1-y3)-(y1-y2)*(x1-x3))/den;if(t<-1e-6||t>1.000001||u<-1e-6||u>1.000001)return null;return{x:x1+t*(x2-x1),y:y1+t*(y2-y1)}}
function nearestOnSegment(p,s){const dx=s.b.x-s.a.x,dy=s.b.y-s.a.y,len2=dx*dx+dy*dy;if(len2<1e-12)return null;const t=Math.max(0,Math.min(1,((p.x-s.a.x)*dx+(p.y-s.a.y)*dy)/len2)),point={x:s.a.x+t*dx,y:s.a.y+t*dy};return{point,distance:distance(p,point),t}}
function perpendicularFrom(origin,s){const dx=s.b.x-s.a.x,dy=s.b.y-s.a.y,len2=dx*dx+dy*dy;if(len2<1e-12)return null;const t=((origin.x-s.a.x)*dx+(origin.y-s.a.y)*dy)/len2;if(t<0||t>1)return null;return{x:s.a.x+t*dx,y:s.a.y+t*dy}}

export async function extractPdfVectorSnap(page,viewport,pdfjs){
  const operatorList=await page.getOperatorList(),OPS=pdfjs.OPS,segments=[],segmentKeys=new Set(),stack=[]
  let ctm=[...IDENTITY],currentSegments=[],current=null,start=null,hasRasterImage=false,truncated=false
  const pageView=Array.isArray(page.view)&&page.view.length>=4?page.view:[0,0,viewport.width,viewport.height]
  const minX=Number(pageView[0])||0,minY=Number(pageView[1])||0,maxX=Number(pageView[2])||viewport.width,maxY=Number(pageView[3])||viewport.height
  const pdfWidth=Math.abs(maxX-minX)||viewport.width,pdfHeight=Math.abs(maxY-minY)||viewport.height
  const toPdf=(x,y)=>transformPoint({x,y},ctm)
  const add=(a,b)=>{if(!a||!b||distance(a,b)<MIN_SEGMENT_LENGTH)return;currentSegments.push({a:{...a},b:{...b}})}
  const addCurve=(p0,p1,p2,p3)=>{let previous=p0;for(let step=1;step<=CURVE_STEPS;step++){const p=bezier(p0,p1,p2,p3,step/CURVE_STEPS);add(previous,p);previous=p}}
  const commit=()=>{for(const segment of currentSegments){if(segments.length>=MAX_SEGMENTS){truncated=true;break}const key=segmentKey(segment.a,segment.b);if(segmentKeys.has(key))continue;segmentKeys.add(key);segments.push(segment)}currentSegments=[];current=null;start=null}
  const discard=()=>{currentSegments=[];current=null;start=null}
  const parsePath=args=>{const rawOps=args?.[0],rawCoords=args?.[1];if(rawOps==null||!rawCoords)return;const ops=ArrayBuffer.isView(rawOps)||Array.isArray(rawOps)?Array.from(rawOps):[rawOps],coords=Array.from(rawCoords);let ci=0;for(const op of ops){if(op===OPS.moveTo){current=toPdf(coords[ci],coords[ci+1]);ci+=2;start=current}else if(op===OPS.lineTo){const p=toPdf(coords[ci],coords[ci+1]);ci+=2;if(current)add(current,p);current=p}else if(op===OPS.curveTo){const c1=toPdf(coords[ci],coords[ci+1]),c2=toPdf(coords[ci+2],coords[ci+3]),p=toPdf(coords[ci+4],coords[ci+5]);ci+=6;if(current)addCurve(current,c1,c2,p);current=p}else if(op===OPS.curveTo2){const c2=toPdf(coords[ci],coords[ci+1]),p=toPdf(coords[ci+2],coords[ci+3]);ci+=4;if(current)addCurve(current,current,c2,p);current=p}else if(op===OPS.curveTo3){const c1=toPdf(coords[ci],coords[ci+1]),p=toPdf(coords[ci+2],coords[ci+3]);ci+=4;if(current)addCurve(current,c1,p,p);current=p}else if(op===OPS.closePath){if(current&&start)add(current,start);current=start}else if(op===OPS.rectangle){const x=coords[ci],y=coords[ci+1],w=coords[ci+2],h=coords[ci+3];ci+=4;const p1=toPdf(x,y),p2=toPdf(x+w,y),p3=toPdf(x+w,y+h),p4=toPdf(x,y+h);add(p1,p2);add(p2,p3);add(p3,p4);add(p4,p1);current=p1;start=p1}}}
  for(let i=0;i<operatorList.fnArray.length;i++){const op=operatorList.fnArray[i],args=operatorList.argsArray[i];if(op===OPS.save){stack.push([...ctm]);continue}if(op===OPS.restore){ctm=stack.pop()||[...IDENTITY];continue}if(op===OPS.transform){const values=ArrayBuffer.isView(args)||Array.isArray(args)?Array.from(args):[];if(values.length>=6)ctm=multiply(ctm,values);continue}if(op===OPS.constructPath){parsePath(args);continue}if(op===OPS.stroke||op===OPS.closeStroke||op===OPS.fill||op===OPS.eoFill||op===OPS.fillStroke||op===OPS.eoFillStroke||op===OPS.closeFillStroke||op===OPS.closeEOFillStroke){commit();if(truncated)break;continue}if(op===OPS.endPath||op===OPS.clip||op===OPS.eoClip){discard();continue}if(op===OPS.paintImageXObject||op===OPS.paintInlineImageXObject||op===OPS.paintImageMaskXObject||op===OPS.paintSolidColorImageMask)hasRasterImage=true}
  if(currentSegments.length)discard()
  const endpointMap=new Map();for(const s of segments){endpointMap.set(pointKey(s.a),s.a);endpointMap.set(pointKey(s.b),s.b)}
  return{coordinateSpace:'pdf-native',pdfWidth,pdfHeight,pageView:[minX,minY,maxX,maxY],viewportTransform:Array.from(viewport.transform||[]),viewportWidth:viewport.width,viewportHeight:viewport.height,endpoints:[...endpointMap.values()],segments,segmentCount:segments.length,endpointCount:endpointMap.size,hasRasterImage,truncated,status:segments.length?'vector':hasRasterImage?'raster':'empty'}
}

export function normalizedToPdf(point,geometry){if(!point||!geometry?.viewportTransform?.length)return null;const vx=point.x*geometry.viewportWidth,vy=point.y*geometry.viewportHeight;const m=geometry.viewportTransform,det=m[0]*m[3]-m[1]*m[2];if(Math.abs(det)<1e-12)return null;const x=(m[3]*(vx-m[4])-m[2]*(vy-m[5]))/det,y=(-m[1]*(vx-m[4])+m[0]*(vy-m[5]))/det;return{x,y}}
export function pdfToNormalized(point,geometry){if(!point||!geometry?.viewportTransform?.length)return null;const m=geometry.viewportTransform,vx=m[0]*point.x+m[2]*point.y+m[4],vy=m[1]*point.x+m[3]*point.y+m[5];return{x:vx/geometry.viewportWidth,y:vy/geometry.viewportHeight}}

export function nearestVectorSnap(rawNormalized,geometry,screenSize,radiusPx,options={}){
  if(!geometry?.viewportWidth||!geometry?.viewportHeight||!screenSize?.width||!screenSize?.height)return null
  const cursor=normalizedToPdf(rawNormalized,geometry);if(!cursor)return null
  const modes={corner:true,intersection:true,perpendicular:true,...(options.modes||{})}
  const sx=screenSize.width/geometry.viewportWidth,sy=screenSize.height/geometry.viewportHeight,viewScale=Math.max(Math.min(sx,sy),.01)
  const basePdfScale=Math.max(Math.hypot(geometry.viewportTransform[0],geometry.viewportTransform[1]),Math.hypot(geometry.viewportTransform[2],geometry.viewportTransform[3]),.0001)
  const effectiveScale=basePdfScale*viewScale
  // Keep acquisition CAD-like and predictable. LocationMapWorkspace historically
  // passed a 20px radius; that made a valid object snap stay selected while the
  // cursor had already moved noticeably away, which looked like a lazy/lagging
  // marker. The engine now owns its acquisition aperture and caps it at 12px.
  const requested=Number.isFinite(radiusPx)&&radiusPx>0?radiusPx:SNAP_SCREEN_TOLERANCE
  const screenTolerance=Math.min(requested,SNAP_SCREEN_TOLERANCE)
  const tolerance=screenTolerance/effectiveScale
  const finish=(point,type)=>({point:pdfToNormalized(point,geometry),nativePoint:point,type,distancePx:distance(cursor,point)*effectiveScale})
  const nearby=(geometry.segments||[]).filter(segment=>pointInBox(cursor,segmentBox(segment,tolerance*1.15)))

  if(modes.corner){let best=null,bestDistance=tolerance;const seen=new Set();for(const segment of nearby){for(const point of [segment.a,segment.b]){const key=pointKey(point);if(seen.has(key))continue;seen.add(key);const d=distance(cursor,point);if(d<=bestDistance){bestDistance=d;best=point}}}if(best)return finish(best,'corner')}
  if(modes.intersection&&nearby.length>1){let best=null,bestDistance=tolerance;const seen=new Set();for(let i=0;i<nearby.length;i++)for(let j=i+1;j<nearby.length;j++){const point=segmentIntersection(nearby[i],nearby[j]);if(!point)continue;const key=pointKey(point);if(seen.has(key))continue;seen.add(key);const d=distance(cursor,point);if(d<=bestDistance){bestDistance=d;best=point}}if(best)return finish(best,'intersection')}
  if(modes.perpendicular&&options.fromPoint){const origin=normalizedToPdf(options.fromPoint,geometry);if(origin){let best=null,bestDistance=tolerance;for(const segment of nearby){const point=perpendicularFrom(origin,segment);if(!point)continue;const d=distance(cursor,point);if(d<=bestDistance){bestDistance=d;best=point}}if(best)return finish(best,'perpendicular')}}
  if(options.allowEdge===false)return null
  let nearest=null,nearestDistance=tolerance;for(const segment of nearby){const candidate=nearestOnSegment(cursor,segment);if(candidate&&candidate.distance<=nearestDistance){nearestDistance=candidate.distance;nearest=candidate.point}}return nearest?finish(nearest,'edge'):null
}
