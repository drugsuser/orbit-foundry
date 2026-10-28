/* Local material removal / reduced-order collision model, not SPH.
   Geometry is the same sphere-minus-cuts field used by the contact solver.
   Intact cores keep their identity, original spatial envelope and density.
   Removed mass is transferred to ballistic material clouds, never invented chunks. */
(function(root){'use strict';
const AU=149597870700,MS=1.98847e30,V=AU/31557600,G=6.67430e-11;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function rotate(p,q,inverse=false){if(!q)return {...p};const x=q[0]*(inverse?-1:1),y=q[1]*(inverse?-1:1),z=q[2]*(inverse?-1:1),w=q[3],tx=2*(y*p.z-z*p.y),ty=2*(z*p.x-x*p.z),tz=2*(x*p.y-y*p.x);return{x:p.x+w*tx+y*tz-z*ty,y:p.y+w*ty+z*tx-x*tz,z:p.z+w*tz+x*ty-y*tx};}
function local(b,p){return rotate({x:(p.x-b.x)/b.r,y:(p.y-b.y)/b.r,z:(p.z-b.z)/b.r},b.solidQuaternion,true)}
function world(b,p){const v=rotate(p,b.solidQuaternion);return{x:b.x+v.x*b.r,y:b.y+v.y*b.r,z:b.z+v.z*b.r}}
function field(p,cuts=[]){let d=Math.hypot(p.x,p.y,p.z)-1;for(const c of cuts)d=Math.max(d,c.r-Math.hypot(p.x-c.x,p.y-c.y,p.z-c.z));return d;}
function contains(b,p){return field(local(b,p),b.solid?.cuts)<-1e-7;}
const clouds=new WeakMap();
function state(b){if(!b.solid)b.solid={mass0:b.mass,cuts:[],extraLoss:0,revision:0};return b.solid;}
function samples(b){let c=clouds.get(b);if(c)return c;const s=state(b),pts=[],N=36;for(let x=0;x<N;x++)for(let y=0;y<N;y++)for(let z=0;z<N;z++){const p={x:(x+.5)/N*2-1,y:(y+.5)/N*2-1,z:(z+.5)/N*2-1};if(p.x*p.x+p.y*p.y+p.z*p.z<1)pts.push(p.x,p.y,p.z)}const alive=new Uint8Array(pts.length/3);alive.fill(1);c={pts:new Float32Array(pts),alive,total:alive.length,left:alive.length};for(const cut of s.cuts)apply(c,cut);clouds.set(b,c);return c;}
function apply(c,cut){const p=c.pts,r2=cut.r*cut.r;let removed=0;for(let i=0;i<c.alive.length;i++){if(!c.alive[i])continue;const k=i*3,x=p[k]-cut.x,y=p[k+1]-cut.y,z=p[k+2]-cut.z;if(x*x+y*y+z*z<r2){c.alive[i]=0;removed++}}c.left-=removed;return removed;}
function cut(b,cutter,analyticLoss=0){const s=state(b);if(s.cuts.length>=256)return{removed:0,limited:true};if(s.cuts.some(c=>Math.hypot(c.x-cutter.x,c.y-cutter.y,c.z-cutter.z)+cutter.r<=c.r+1e-6))return{removed:0};const c=samples(b),before=b.mass;const lostCells=apply(c,cutter);s.cuts=s.cuts.filter(p=>Math.hypot(p.x-cutter.x,p.y-cutter.y,p.z-cutter.z)+p.r>cutter.r);s.cuts.push(cutter);s.revision++;
 // Subgrid craters retain a physical, analytic volume, not a zero-cell fake hit.
 const discrete=s.mass0*lostCells/c.total;if(analyticLoss>discrete)s.extraLoss+=(analyticLoss-discrete);
 b.mass=Math.max(0,s.mass0*c.left/c.total-(s.extraLoss||0));return{removed:Math.max(0,before-b.mass),remaining:b.mass,changed:true};}
function overlap(a,b){const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,d=Math.hypot(dx,dy,dz),sum=a.r+b.r;if(d>=sum)return null;const n=d>1e-30?{x:dx/d,y:dy/d,z:dz/d}:{x:1,y:0,z:0};const along=clamp((d*d+a.r*a.r-b.r*b.r)/(2*Math.max(d,1e-30)),-a.r,a.r),rr=Math.sqrt(Math.max(0,a.r*a.r-along*along));const center={x:a.x+n.x*along,y:a.y+n.y*along,z:a.z+n.z*along};let u=Math.abs(n.z)<.8?{x:-n.y,y:n.x,z:0}:{x:n.z,y:0,z:-n.x},L=Math.hypot(u.x,u.y,u.z);for(const k of ['x','y','z'])u[k]/=L;const v={x:n.y*u.z-n.z*u.y,y:n.z*u.x-n.x*u.z,z:n.x*u.y-n.y*u.x};
 const probes=[center,{x:(a.x+b.x)*.5,y:(a.y+b.y)*.5,z:(a.z+b.z)*.5}];for(const rad of [.28,.62,.9])for(let i=0;i<12;i++){const t=i*Math.PI/6,off=rr*rad;probes.push({x:center.x+off*(u.x*Math.cos(t)+v.x*Math.sin(t)),y:center.y+off*(u.y*Math.cos(t)+v.y*Math.sin(t)),z:center.z+off*(u.z*Math.cos(t)+v.z*Math.sin(t))})}
 const p=probes.find(p=>contains(a,p)&&contains(b,p));return p?{point:p,normal:n,depth:sum-d}:null;
}
function crater(target,projectile,analysis){const angle=clamp(analysis.craterAngle,1e-7,.56),opening=Math.sin(angle),depth=Math.min(.22,Math.max(angle*.10,angle*.20*(.55+.45*analysis.incidence))),z=Math.sqrt(1-opening*opening),h=z-1+depth,C=(opening*opening+h*h)/(2*Math.max(1e-10,h)),n=rotate(analysis.normal,target.solidQuaternion,true),center=C+1-depth;
 const cutSphere={x:n.x*center,y:n.y*center,z:n.z*center,r:C,crater:true,angle,depth};
 const volume=Math.PI*depth*(3*opening*opening+depth*depth)/6,loss=target.mass*volume/(4/3*Math.PI);return{...cut(target,cutSphere,loss),angle,depth,normal:n,worldNormal:analysis.normal,craterRadius:Math.sin(angle)*target.r*AU/1000,craterDepth:depth*target.r*AU/1000};}
function shave(a,b,contact){const aLocal=local(a,b),bLocal=local(b,a),v=Math.hypot(a.vx-b.vx,a.vy-b.vy,a.vz-b.vz)*V,pa=a.mass,pb=b.mass;
 const density=(a.mass+b.mass)*MS/(4/3*Math.PI*((a.r*AU)**3+(b.r*AU)**3)),pressure=density*v*v;
 if(pressure<8e6)return{a:0,b:0,changed:false,pressure};
 const ca=cut(a,{...aLocal,r:b.r/a.r}),cb=cut(b,{...bLocal,r:a.r/b.r});
 // Only intersected material couples the surviving cores. No global normal bounce.
 const coupled=Math.min(pa+pb,(ca.removed||0)+(cb.removed||0))*.20;
 const impulse=Math.min(coupled,pa*pb/Math.max(pa+pb,1e-40)*.12),dv={x:b.vx-a.vx,y:b.vy-a.vy,z:b.vz-a.vz};
 if(a.mass>0&&b.mass>0){for(const k of ['x','y','z']){a['v'+k]+=dv[k]*impulse/a.mass;b['v'+k]-=dv[k]*impulse/b.mass;}}
 return{a:ca.removed||0,b:cb.removed||0,changed:ca.changed||cb.changed,limited:ca.limited||cb.limited,pressure};}
function valid(s){if(!s||!Array.isArray(s.cuts))return null;const cuts=s.cuts.slice(0,256).filter(c=>['x','y','z','r'].every(k=>Number.isFinite(c[k]))&&c.r>0&&c.r<1e6&&Math.hypot(c.x,c.y,c.z)<1e6).map(c=>({x:c.x,y:c.y,z:c.z,r:c.r,...(c.crater?{crater:true,angle:clamp(c.angle||.1,1e-7,.6),depth:clamp(c.depth||.02,1e-9,.3)}:{})}));return Number.isFinite(s.mass0)&&s.mass0>0?{mass0:s.mass0,cuts,extraLoss:Number.isFinite(s.extraLoss)?Math.max(0,s.extraLoss):0,revision:cuts.length}:null;}
// Sweep-and-prune over swept AABBs. Exact swept/contact tests remain narrow phase.
function candidates(bodies,tides=false){const entries=[];for(let i=0;i<bodies.length;i++){const b=bodies[i];if(b.phase==='dust')continue;const p=b.previous||b,r=b.r;entries.push({b,i,minX:Math.min(b.x,p.x)-r,maxX:Math.max(b.x,p.x)+r,minY:Math.min(b.y,p.y)-r,maxY:Math.max(b.y,p.y)+r,minZ:Math.min(b.z,p.z)-r,maxZ:Math.max(b.z,p.z)+r});}entries.sort((a,b)=>a.minX-b.minX);const pairs=[],seen=new Set();const add=(a,b)=>{let i=a.i,j=b.i;if(i>j)[i,j]=[j,i];const key=i+','+j;if(!seen.has(key)){seen.add(key);pairs.push([i,j]);}};
for(let i=0;i<entries.length;i++){const a=entries[i];for(let j=i+1;j<entries.length;j++){const b=entries[j];if(b.minX>a.maxX)break;if(a.minY<=b.maxY&&b.minY<=a.maxY&&a.minZ<=b.maxZ&&b.minZ<=a.maxZ)add(a,b);}}
// Tidal interactions extend beyond the horizon; keep these pairs conservative.
if(tides)for(const a of entries)if(a.b.kind==='bh')for(const b of entries)if(a!==b)add(a,b);
pairs.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);candidates.last={bodies:entries.length,possible:entries.length*(entries.length-1)/2,candidates:pairs.length};return pairs.map(([i,j])=>[bodies[i],bodies[j]]);}
const api={rotate,local,world,field,contains,state,cut,overlap,crater,shave,valid,candidates};root.SolidPhysics=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
