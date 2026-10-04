export type SnapKind='endpoint'|'intersection'|'midpoint'|'nearest'
export type SnapPoint={x:number;y:number;kind:SnapKind}
export type VectorSegment={a:{x:number;y:number};b:{x:number;y:number}}
export type SnapModes=Record<SnapKind,boolean>

type P={x:number;y:number}
type Matrix=[number,number,number,number,number,number]
const I:Matrix=[1,0,0,1,0,0]
const mul=(a:Matrix,b:Matrix):Matrix=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]]
const pt=(m:Matrix,x:number,y:number):P=>({x:m[0]*x+m[2]*y+m[4],y:m[1]*x+m[3]*y+m[5]})
const finite=(p:P)=>Number.isFinite(p.x)&&Number.isFinite(p.y)
const matrixFrom=(v:any):Matrix|null=>{const a=Array.from(v||[]).map(Number);return a.length>=6&&a.slice(0,6).every(Number.isFinite)?a.slice(0,6) as Matrix:null}

// pdf.js 5.x changed constructPath. Instead of [pathOps, coords], the operator
// now arrives as [paintOp, [packedPath], minMax]. packedPath uses DrawOPS:
// 0 moveTo(x,y), 1 lineTo(x,y), 2 cubicBezier(6 coords), 3 closePath.
// Keep the legacy decoder too so older operator-list shapes remain supported.
export async function extractPdfSegments(page:any,pdfjs:any,viewportMatrix?:number[]):Promise<VectorSegment[]>{
 const list=await page.getOperatorList(),OPS=pdfjs.OPS,out:VectorSegment[]=[]
 const base=(viewportMatrix?.length===6?Array.from(viewportMatrix):I) as Matrix
 let ctm:Matrix=[...base],stack:Matrix[]=[],constructCount=0,packedCount=0,legacyCount=0
 const add=(a:P|null,b:P|null)=>{if(a&&b&&finite(a)&&finite(b)&&Math.hypot(b.x-a.x,b.y-a.y)>.01)out.push({a:{...a},b:{...b}})}
 const curve=(p0:P,p1:P,p2:P,p3:P)=>{let prev=p0;for(let i=1;i<=12;i++){const t=i/12,u=1-t,n={x:u*u*u*p0.x+3*u*u*t*p1.x+3*u*t*t*p2.x+t*t*t*p3.x,y:u*u*u*p0.y+3*u*u*t*p1.y+3*u*t*t*p2.y+t*t*t*p3.y};add(prev,n);prev=n}return p3}
 const decodePacked=(packed:any)=>{
  const path=Array.from(packed||[]).map(Number);if(!path.length)return
  let i=0,current:P|null=null,start:P|null=null
  while(i<path.length){const op=path[i++]
   if(op===0){if(i+1>=path.length)break;current=pt(ctm,path[i++],path[i++]);start=current;continue}
   if(op===1){if(i+1>=path.length)break;const n=pt(ctm,path[i++],path[i++]);add(current,n);current=n;continue}
   if(op===2){if(i+5>=path.length)break;const c1=pt(ctm,path[i++],path[i++]),c2=pt(ctm,path[i++],path[i++]),end=pt(ctm,path[i++],path[i++]);if(current)current=curve(current,c1,c2,end);else current=end;continue}
   if(op===3){add(current,start);current=start;continue}
   // Unknown packed opcode: abort this path rather than desynchronising coords.
   break
  }
 }
 const decodeLegacy=(pathOps:any,coordsRaw:any)=>{
  const ops=Array.from(pathOps||[]) as number[],coords=Array.from(coordsRaw||[]).map(Number);let k=0,current:P|null=null,start:P|null=null
  for(const op of ops){
   if(op===OPS.moveTo){current=pt(ctm,coords[k++],coords[k++]);start=current;continue}
   if(op===OPS.lineTo){const n=pt(ctm,coords[k++],coords[k++]);add(current,n);current=n;continue}
   if(op===OPS.rectangle){const x=coords[k++],y=coords[k++],w=coords[k++],h=coords[k++],a=pt(ctm,x,y),b=pt(ctm,x+w,y),c=pt(ctm,x+w,y+h),d=pt(ctm,x,y+h);add(a,b);add(b,c);add(c,d);add(d,a);current=a;start=a;continue}
   if(op===OPS.closePath){add(current,start);current=start;continue}
   if(op===OPS.curveTo){const c1=pt(ctm,coords[k++],coords[k++]),c2=pt(ctm,coords[k++],coords[k++]),end=pt(ctm,coords[k++],coords[k++]);if(current)current=curve(current,c1,c2,end);else current=end;continue}
   if(op===OPS.curveTo2){const c1=current||pt(ctm,coords[k],coords[k+1]),c2=pt(ctm,coords[k++],coords[k++]),end=pt(ctm,coords[k++],coords[k++]);if(current)current=curve(current,c1,c2,end);else current=end;continue}
   if(op===OPS.curveTo3){const c1=pt(ctm,coords[k++],coords[k++]),end=pt(ctm,coords[k++],coords[k++]);if(current)current=curve(current,c1,end,end);else current=end;continue}
  }
 }
 for(let i=0;i<list.fnArray.length;i++){
  const fn=list.fnArray[i],args=list.argsArray[i]
  if(fn===OPS.save){stack.push([...ctm]);continue}
  if(fn===OPS.restore){ctm=stack.pop()||[...base];continue}
  if(fn===OPS.transform){const m=matrixFrom(args);if(m)ctm=mul(ctm,m);continue}
  // Form XObjects have their own graphics-state transform and are common in CAD exports.
  if(fn===OPS.paintFormXObjectBegin){stack.push([...ctm]);const m=matrixFrom(args?.[0]);if(m)ctm=mul(ctm,m);continue}
  if(fn===OPS.paintFormXObjectEnd){ctm=stack.pop()||[...base];continue}
  if(fn===OPS.beginGroup){stack.push([...ctm]);const m=matrixFrom(args?.[0]?.matrix);if(m)ctm=mul(ctm,m);continue}
  if(fn===OPS.endGroup){ctm=stack.pop()||[...base];continue}
  if(fn!==OPS.constructPath||!args)continue
  constructCount++
  // pdf.js >= 5: args[0] is the paint operation; args[1] is [Float32Array packedPath].
  const data=args[1],packed=Array.isArray(data)?data[0]:null
  if(typeof args[0]==='number'&&packed&&typeof packed.length==='number'){
   packedCount++;decodePacked(packed);continue
  }
  // Legacy pdf.js shape.
  legacyCount++;decodeLegacy(args[0],args[1])
 }
 const seen=new Set<string>(),segments:VectorSegment[]=[]
 for(const s of out){const a=`${s.a.x.toFixed(2)},${s.a.y.toFixed(2)}`,b=`${s.b.x.toFixed(2)},${s.b.y.toFixed(2)}`,key=a<b?`${a}|${b}`:`${b}|${a}`;if(!seen.has(key)){seen.add(key);segments.push(s)}}
 console.info(`[RitsuField Snap] operators=${list.fnArray.length}, constructPath=${constructCount}, packed=${packedCount}, legacy=${legacyCount}, vectorSegments=${segments.length}`)
 return segments
}

export function findSnap(raw:{x:number;y:number},segments:VectorSegment[],zoom:number,tolerancePx=10,modes:SnapModes={endpoint:true,intersection:true,midpoint:true,nearest:true}):SnapPoint|null{
 const tol=tolerancePx/Math.max(zoom,.01),candidates:SnapPoint[]=[]
 const near=segments.filter(s=>raw.x>=Math.min(s.a.x,s.b.x)-tol&&raw.x<=Math.max(s.a.x,s.b.x)+tol&&raw.y>=Math.min(s.a.y,s.b.y)-tol&&raw.y<=Math.max(s.a.y,s.b.y)+tol)
 for(const s of near){if(modes.endpoint)candidates.push({...s.a,kind:'endpoint'},{...s.b,kind:'endpoint'});if(modes.midpoint)candidates.push({x:(s.a.x+s.b.x)/2,y:(s.a.y+s.b.y)/2,kind:'midpoint'})}
 if(modes.intersection)for(let i=0;i<near.length;i++)for(let j=i+1;j<near.length;j++){const p=intersection(near[i],near[j]);if(p)candidates.push({...p,kind:'intersection'})}
 let best:SnapPoint|null=null,dist=tol
 const priority={intersection:0,endpoint:1,midpoint:2,nearest:3} as const
 for(const c of candidates){const d=Math.hypot(c.x-raw.x,c.y-raw.y);if(d<dist-.001||(Math.abs(d-dist)<.001&&best&&priority[c.kind]<priority[best.kind])){dist=d;best=c}}
 if(best)return best
 if(modes.nearest)for(const s of near){const n=nearest(raw,s),d=Math.hypot(n.x-raw.x,n.y-raw.y);if(d<=dist){dist=d;best={...n,kind:'nearest'}}}
 return best
}
function nearest(p:P,s:VectorSegment){const dx=s.b.x-s.a.x,dy=s.b.y-s.a.y,l=dx*dx+dy*dy;if(!l)return s.a;const t=Math.max(0,Math.min(1,((p.x-s.a.x)*dx+(p.y-s.a.y)*dy)/l));return{x:s.a.x+t*dx,y:s.a.y+t*dy}}
function intersection(s1:VectorSegment,s2:VectorSegment){const x1=s1.a.x,y1=s1.a.y,x2=s1.b.x,y2=s1.b.y,x3=s2.a.x,y3=s2.a.y,x4=s2.b.x,y4=s2.b.y,d=(x1-x2)*(y3-y4)-(y1-y2)*(x3-x4);if(Math.abs(d)<1e-9)return null;const t=((x1-x3)*(y3-y4)-(y1-y3)*(x3-x4))/d,u=-((x1-x2)*(y1-y3)-(y1-y2)*(x1-x3))/d;if(t<0||t>1||u<0||u>1)return null;return{x:x1+t*(x2-x1),y:y1+t*(y2-y1)}}
