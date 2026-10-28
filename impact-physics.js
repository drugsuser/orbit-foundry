/* Reduced-mass collision proxy. SI internally; not a calibrated hydrocode.
   Mass/linear momentum are conserved by the resolver. Q* includes strength and
   gravity; velocities use a bounded share of the incoming COM kinetic energy. */
(function(root){'use strict';
const AU=149597870700,MS=1.98847e30,YEAR=31557600,G=6.67430e-11,V=AU/YEAR;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function analyze(a,b){
 const target=a.mass>=b.mass?a:b,projectile=target===a?b:a;
 const M=target.mass*MS,m=projectile.mass*MS,R=target.r*AU,r=projectile.r*AU,total=M+m,mu=M*m/total;
 const dv={x:(projectile.vx-target.vx)*V,y:(projectile.vy-target.vy)*V,z:(projectile.vz-target.vz)*V},speed=Math.hypot(dv.x,dv.y,dv.z);
 const dr={x:projectile.x-target.x,y:projectile.y-target.y,z:projectile.z-target.z},distance=Math.hypot(dr.x,dr.y,dr.z);
 let normal=distance>1e-40?{x:dr.x/distance,y:dr.y/distance,z:dr.z/distance}:speed>0?{x:-dv.x/speed,y:-dv.y/speed,z:-dv.z/speed}:{x:1,y:0,z:0};
 if(target.previous&&projectile.previous){
  const q={x:projectile.previous.x-target.previous.x,y:projectile.previous.y-target.previous.y,z:projectile.previous.z-target.previous.z},d={x:dr.x-q.x,y:dr.y-q.y,z:dr.z-q.z},A=d.x*d.x+d.y*d.y+d.z*d.z,B=2*(q.x*d.x+q.y*d.y+q.z*d.z),C=q.x*q.x+q.y*q.y+q.z*q.z-(target.r+projectile.r)**2,disc=B*B-4*A*C;
  if(A>0&&disc>=0){const u=(-B-Math.sqrt(disc))/(2*A);if(u>=0&&u<=1){const x=q.x+u*d.x,y=q.y+u*d.y,z=q.z+u*d.z,l=Math.hypot(x,y,z)||1;normal={x:x/l,y:y/l,z:z/l};}}
 }
 const incidence=speed>0?clamp(-(dv.x*normal.x+dv.y*normal.y+dv.z*normal.z)/speed,0,1):0;
 const rho=M/(4/3*Math.PI*R**3),rhoP=m/(4/3*Math.PI*r**3),combinedR=Math.cbrt(R**3+r**3);
 const gas=target.kind==='gas'||target.phase==='gas',strength=gas?0:target.kind==='asteroid'?5e5:target.kind==='debris'?2e5:5e6;
 const specificStrength=strength/Math.max(1,rho),critical=2.5*.6*G*total/combinedR+specificStrength;
 const energy=.5*mu*speed**2,coupling=.65*(.2+.8*incidence**2),deposited=energy*coupling,specificEnergy=energy/total,severity=deposited/Math.max(1e-30,total*critical);
 let largestFraction=severity<=1.8?1-.5*severity:.1*(severity/1.8)**-1.5;
 largestFraction=clamp(largestFraction,.015,1);
 const escape=Math.sqrt(2*G*total/Math.max(1,R+r));
 const craterRadius=gas?0:Math.min(R*.42,1.4*r*Math.max(.001,rhoP/Math.max(1,rho))**.26*Math.max(.02,speed/1000)**.44*Math.max(.001,G*M/R**2/9.81)**-.22);
 return {targetId:target.id,projectileId:projectile.id,totalMass:(total/MS),speed:speed/1000,energy,deposited,specificEnergy,critical,severity,largestFraction,escape:escape/1000,normal,incidence,radiusRatio:r/R,massRatio:m/M,craterRadius:craterRadius/1000,craterAngle:Math.atan(craterRadius/R),gas,outcome:severity>=1?'catastrophic':severity>=.02?'erosion':gas?'atmospheric':'crater'};
}
function fragments(a,b,result,slots=12){
 const total=a.mass+b.mass,c={x:(a.x*a.mass+b.x*b.mass)/total,y:(a.y*a.mass+b.y*b.mass)/total,z:(a.z*a.mass+b.z*b.mass)/total,vx:(a.vx*a.mass+b.vx*b.mass)/total,vy:(a.vy*a.mass+b.vy*b.mass)/total,vz:(a.vz*a.mass+b.vz*b.mass)/total};
 const target=a.id===result.targetId?a:b,volume=a.r**3+b.r**3,R=Math.cbrt(volume),fraction=result.largestFraction;
 let ejectMass=total*(1-fraction),count=Math.min(Math.max(1,slots),Math.max(2,Math.min(12,Math.ceil(3+result.severity*5))));
 if(ejectMass<1e-30*count||result.severity<1e-14)return {center:c,R,largestMass:total,parts:[],kinetic:0};
 ejectMass=Math.min(ejectMass,total*count/(count+1));
 const weights=Array.from({length:count},()=>1),wSum=weights.reduce((x,y)=>x+y,0),parts=[];
 let ejectHeight=R*Math.cbrt(1-ejectMass/total);
 const n=result.normal,up=Math.abs(n.z)<.8?{x:0,y:0,z:1}:{x:0,y:1,z:0};let ux=n.y*up.z-n.z*up.y,uy=n.z*up.x-n.x*up.z,uz=n.x*up.y-n.y*up.x,ul=Math.hypot(ux,uy,uz);ux/=ul;uy/=ul;uz/=ul;const w={x:n.y*uz-n.z*uy,y:n.z*ux-n.x*uz,z:n.x*uy-n.y*ux};
 for(let i=0;i<count;i++){
  let zz=result.severity>=1?1-2*(i+.5)/count:.25+.65*(i+.5)/count,aa=i*2.39996323,rad=Math.sqrt(1-zz*zz),d={x:n.x*zz+rad*(ux*Math.cos(aa)+w.x*Math.sin(aa)),y:n.y*zz+rad*(uy*Math.cos(aa)+w.y*Math.sin(aa)),z:n.z*zz+rad*(uz*Math.cos(aa)+w.z*Math.sin(aa))};
  const mass=ejectMass*weights[i]/wSum,rr=R*Math.cbrt(mass/total),reach=R*(2.7+i*.18);
  let ox=d.x*reach,oy=d.y*reach,oz=d.z*reach;
  if(result.severity<1){
   ejectHeight+=rr*2.1;const spread=Math.max(R*result.craterAngle,rr*2),side=Math.sqrt((i+.5)/count)*spread;
   ox=n.x*ejectHeight+(ux*Math.cos(aa)+w.x*Math.sin(aa))*side;
   oy=n.y*ejectHeight+(uy*Math.cos(aa)+w.y*Math.sin(aa))*side;
   oz=n.z*ejectHeight+(uz*Math.cos(aa)+w.z*Math.sin(aa))*side;
  }
  parts.push({mass,r:rr,ox,oy,oz,dx:d.x,dy:d.y,dz:d.z});
 }
 const largestMass=total-parts.reduce((sum,p)=>sum+p.mass,0),all=[{mass:largestMass,r:R*Math.cbrt(largestMass/total),ox:0,oy:0,oz:0,dx:0,dy:0,dz:0},...parts];
 let mean={x:0,y:0,z:0,px:0,py:0,pz:0};for(const p of all){const f=p.mass/total;mean.x+=f*p.dx;mean.y+=f*p.dy;mean.z+=f*p.dz;mean.px+=f*p.ox;mean.py+=f*p.oy;mean.pz+=f*p.oz;}
 let shape=0;for(const p of all){p.dx-=mean.x;p.dy-=mean.y;p.dz-=mean.z;p.ox-=mean.px;p.oy-=mean.py;p.oz-=mean.pz;shape+=p.mass*MS*(p.dx*p.dx+p.dy*p.dy+p.dz*p.dz);}
 // No arbitrary escape-speed kick: outgoing COM kinetic energy cannot exceed budget.
 const budget=Math.max(0,result.deposited*.22),factor=shape>0?Math.sqrt(2*budget/shape)/V:0;
 for(const p of all){p.x=c.x+p.ox;p.y=c.y+p.oy;p.z=c.z+p.oz;p.vx=c.vx+p.dx*factor;p.vy=c.vy+p.dy*factor;p.vz=c.vz+p.dz*factor;}
 return {center:c,R,largestMass,parts:all,kinetic:budget};
}
// Swept sphere test catches high-speed passages; ONLY physical radii are used.
function swept(a,b){
 const radius=a.r+b.r;if(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<=radius)return true;
 if(!a.previous||!b.previous)return false;const x=a.previous.x-b.previous.x,y=a.previous.y-b.previous.y,z=a.previous.z-b.previous.z,dx=a.x-b.x-x,dy=a.y-b.y-y,dz=a.z-b.z-z,A=dx*dx+dy*dy+dz*dz;
 if(!(A>0))return false;const u=clamp(-(x*dx+y*dy+z*dz)/A,0,1);return Math.hypot(x+u*dx,y+u*dy,z+u*dz)<=radius;
}
// Cheap reduced-order material cost (J/kg), not a calibrated equation of state.
// 0.15 GM/R represents partial gravitational lifting, not escape of every grain.
function materialCost(b){
 const mass=b.mass*MS,R=b.r*AU,rho=(b.solid?.mass0||b.mass)*MS/(4/3*Math.PI*R**3);
 const strength=b.kind==='gas'?0:b.kind==='asteroid'?5e5:b.kind==='debris'?2e5:5e6;
 return Math.max(1,strength/Math.max(1,rho)+.15*G*mass/Math.max(1,R));
}
function relativeEnergy(a,b,ma=a.mass,mb=b.mass){
 return .5*(ma*mb/Math.max(ma+mb,1e-40))*MS*((a.vx-b.vx)**2+(a.vy-b.vy)**2+(a.vz-b.vz)**2)*V*V;
}
function contactBudget(a,b,analysis=analyze(a,b)){
 const initial=Math.max(0,Math.min(relativeEnergy(a,b),analysis.deposited));
 return{initial,remaining:initial,fracture:0,ejecta:0,internal:0,contactHeat:0,qA:materialCost(a),qB:materialCost(b)};
}
// No resetting this ledger at each integration step or each mesh revision.
function removalLimits(a,b,budget){
 const available=Math.min(budget.remaining,relativeEnergy(a,b));
 return{maxA:.375*available/(budget.qA*MS),maxB:.375*available/(budget.qB*MS)};
}
function spend(budget,fracture,ejecta,internal=0){
 budget.fracture+=fracture;budget.ejecta+=ejecta;budget.internal+=internal;
 budget.remaining=Math.max(0,budget.remaining-fracture-ejecta);
}
// A cut first carries away the old owner's velocity. Cooling the relative
// motion pays for fracture + ejection; source-local recoil then preserves P.
// Half the ejection allocation is unresolved cloud expansion, half bulk motion.
function shaveEjecta(a,b,lossA,lossB,budget,normal){
 const ma=a.mass+lossA,mb=b.mass+lossB,total=ma+mb,E=relativeEnergy(a,b,ma,mb);
 const work=lossA*MS*budget.qA+lossB*MS*budget.qB;
 const eject=Math.max(0,Math.min(work/3,budget.remaining-work,E-work));
 const factor=E>0?Math.sqrt(Math.max(0,(E-work-eject)/E)):0,com={};
 for(const k of ['x','y','z'])com['v'+k]=(ma*a['v'+k]+mb*b['v'+k])/total;
 const da={},db={};
 for(const k of ['x','y','z']){
  a['v'+k]=com['v'+k]+(a['v'+k]-com['v'+k])*factor;
  b['v'+k]=com['v'+k]+(b['v'+k]-com['v'+k])*factor;
  da['v'+k]=a['v'+k];db['v'+k]=b['v'+k];
 }
 const loss=lossA+lossB;
 function split(core,dust,mass,sign,energy){
  if(!(mass>0))return 0;
  const internal=energy*.5,bulk=core.mass>0?energy*.5:0,mu=core.mass*mass/Math.max(core.mass+mass,1e-40)*MS;
  const relative=mu>0?Math.sqrt(2*bulk/mu)/V:0;
  for(const k of ['x','y','z']){
   core['v'+k]-=sign*normal[k]*relative*mass/(core.mass+mass);
   dust['v'+k]+=sign*normal[k]*relative*core.mass/(core.mass+mass);
  }
  return Math.sqrt(2*internal/(mass*MS))/V;
 }
 const spreadA=split(a,da,lossA,-1,loss>0?eject*lossA/loss:0);
 const spreadB=split(b,db,lossB,1,loss>0?eject*lossB/loss:0);
 spend(budget,work,eject,eject*.5);
 return{a:da,b:db,spreadA,spreadB,work,eject};
}
function craterEjecta(target,projectile,removed,budget,normal){
 const before=target.mass+removed,total=before+projectile.mass,dustMass=removed+projectile.mass;
 const E=relativeEnergy(target,projectile,before,projectile.mass),work=removed*MS*budget.qA;
 const eject=Math.max(0,Math.min(budget.remaining-work,E-work)),bulk=eject*.5,internal=eject*.5;
 const mu=target.mass*dustMass/total*MS,relative=mu>0?Math.sqrt(2*bulk/mu)/V:0,dust={};
 for(const k of ['x','y','z']){
  const com=(before*target['v'+k]+projectile.mass*projectile['v'+k])/total;
  target['v'+k]=com-normal[k]*relative*dustMass/total;
  dust['v'+k]=com+normal[k]*relative*target.mass/total;
 }
 spend(budget,work,eject,internal);
 return{velocity:dust,spread:Math.sqrt(2*internal/(dustMass*MS))/V,work,eject};
}
// Low-energy/capacity-limited contact only. Energetic shaving is not billiards.
function respond(a,b,normal,restitution=.12){
 let vn=0;for(const k of ['x','y','z'])vn+=(b['v'+k]-a['v'+k])*normal[k];
 if(vn>=0||!(a.mass>0&&b.mass>0))return 0;
 const mu=a.mass*b.mass/(a.mass+b.mass),impulse=-(1+restitution)*vn*mu;
 for(const k of ['x','y','z']){a['v'+k]-=normal[k]*impulse/a.mass;b['v'+k]+=normal[k]*impulse/b.mass;}
 return .5*mu*MS*vn*vn*V*V*(1-restitution**2);
}
const api={analyze,fragments,swept,materialCost,relativeEnergy,contactBudget,removalLimits,shaveEjecta,craterEjecta,respond,units:{AU,MS,YEAR,G,V}};root.ImpactPhysics=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
