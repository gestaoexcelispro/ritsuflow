const identity = [1,0,0,1,0,0]

function multiply(a,b){
  return [
    a[0]*b[0]+a[2]*b[1],
    a[1]*b[0]+a[3]*b[1],
    a[0]*b[2]+a[2]*b[3],
    a[1]*b[2]+a[3]*b[3],
    a[0]*b[4]+a[2]*b[5]+a[4],
    a[1]*b[4]+a[3]*b[5]+a[5],
  ]
}

function transformPoint(m,x,y){
  return {x:m[0]*x+m[2]*y+m[4],y:m[1]*x+m[3]*y+m[5]}
}

function normalizePoint(point,viewport){
  const [vx,vy]=viewport.convertToViewportPoint(point.x,point.y)
  return {x:vx/viewport.width,y:vy/viewport.height}
}

function validPoint(p){
  return Number.isFinite(p?.x)&&Number.isFinite(p?.y)&&p.x>=-.05&&p.x<=1.05&&p.y>=-.05&&p.y<=1.05
}

function key(p){return `${Math.round(p.x*100000)},${Math.round(p.y*100000)}`}

export async function extractPdfVectorSnap(page,viewport,pdfjs){
  const list=await page.getOperatorList()
  const OPS=pdfjs.OPS
  let ctm=identity
  const stack=[]
  const endpoints=new Map()
  const segments=[]

  const addPoint=(raw)=>{
    const p=normalizePoint(transformPoint(ctm,raw.x,raw.y),viewport)
    if(validPoint(p))endpoints.set(key(p),p)
    return p
  }
  const addSegment=(a,b)=>{
    if(!a||!b)return
    const pa=addPoint(a),pb=addPoint(b)
    if(validPoint(pa)&&validPoint(pb)&&Math.hypot(pa.x-pb.x,pa.y-pb.y)>1e-7)segments.push({a:pa,b:pb})
  }

  for(let i=0;i<list.fnArray.length;i++){
    const fn=list.fnArray[i],args=list.argsArray[i]||[]
    if(fn===OPS.save){stack.push(ctm.slice());continue}
    if(fn===OPS.restore){ctm=stack.pop()||identity;continue}
    if(fn===OPS.transform){ctm=multiply(ctm,args);continue}
    if(fn!==OPS.constructPath)continue

    const pathOps=args[0]||[]
    const coords=args[1]||[]
    let ci=0,current=null,start=null
    for(const op of pathOps){
      if(op===OPS.moveTo){current={x:coords[ci++],y:coords[ci++]};start=current;addPoint(current);continue}
      if(op===OPS.lineTo){const next={x:coords[ci++],y:coords[ci++]};addSegment(current,next);current=next;continue}
      if(op===OPS.curveTo){ci+=4;const next={x:coords[ci++],y:coords[ci++]};addSegment(current,next);current=next;continue}
      if(op===OPS.curveTo2||op===OPS.curveTo3){ci+=2;const next={x:coords[ci++],y:coords[ci++]};addSegment(current,next);current=next;continue}
      if(op===OPS.rectangle){
        const x=coords[ci++],y=coords[ci++],w=coords[ci++],h=coords[ci++]
        const p1={x,y},p2={x:x+w,y},p3={x:x+w,y:y+h},p4={x,y:y+h}
        addSegment(p1,p2);addSegment(p2,p3);addSegment(p3,p4);addSegment(p4,p1);current=p1;start=p1;continue
      }
      if(op===OPS.closePath){if(current&&start)addSegment(current,start);current=start;continue}
    }
  }

  return {endpoints:[...endpoints.values()],segments}
}

export function nearestVectorSnap(raw,geometry,rect,radiusPx){
  if(!geometry||!rect)return null
  const px=(p)=>({x:p.x*rect.width,y:p.y*rect.height})
  const cursor=px(raw)
  let best=null
  let bestDistance=radiusPx+1

  for(const p of geometry.endpoints||[]){
    const q=px(p),d=Math.hypot(cursor.x-q.x,cursor.y-q.y)
    if(d<bestDistance){bestDistance=d;best={point:p,type:'endpoint'}}
  }
  if(best)return best

  for(const segment of geometry.segments||[]){
    const a=px(segment.a),b=px(segment.b)
    const dx=b.x-a.x,dy=b.y-a.y,len2=dx*dx+dy*dy
    if(len2<1e-9)continue
    const t=Math.max(0,Math.min(1,((cursor.x-a.x)*dx+(cursor.y-a.y)*dy)/len2))
    const q={x:a.x+t*dx,y:a.y+t*dy}
    const d=Math.hypot(cursor.x-q.x,cursor.y-q.y)
    if(d<bestDistance){
      bestDistance=d
      best={point:{x:segment.a.x+t*(segment.b.x-segment.a.x),y:segment.a.y+t*(segment.b.y-segment.a.y)},type:'edge'}
    }
  }
  return best
}
