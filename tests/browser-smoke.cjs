'use strict';
const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/local/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(process.env.BASE_URL||'http://127.0.0.1:8037/');
  await page.waitForFunction(()=>window.FoundryRendererInfo&&!document.getElementById('loading'),{timeout:60000});
  const initial=await page.evaluate(()=>({count:OrbitFoundry.bodies.length,paused:OrbitFoundry.paused}));
  assert.equal(initial.count,9);assert(initial.paused);
  const summary=await page.evaluate(async()=>{
   const api=OrbitFoundry,I=ImpactPhysics,U=I.units,R=6371e3/U.AU,M=5.972e24/U.MS;
   const snapshot=JSON.parse(JSON.stringify(api.payload()));
   const make=(id,x,v)=>({id,name:'Test '+id,kind:'rock',mass:M,r:R,x,y:0,z:0,vx:v*1000/U.V,vy:0,vz:0,color:'#a9c9e9'});
   function totals(){let m=0,p=[0,0,0],E=0;for(const b of api.bodies){m+=b.mass;p[0]+=b.mass*b.vx;p[1]+=b.mass*b.vy;p[2]+=b.mass*b.vz;E+=.5*b.mass*U.MS*(b.vx*b.vx+b.vy*b.vy+b.vz*b.vz)*U.V*U.V;}return{m,p,E};}
   function world(speed,d=1.8,count=2){const payload=JSON.parse(JSON.stringify(snapshot));payload.bodies=[make(1,0,0),make(2,R*d,-speed)];for(let i=2;i<count;i++)payload.bodies.push({...make(i+1,100+i,0),phase:'dust',kind:'debris',mass:1e-20});payload.selected=1;payload.follow=1;payload.t=0;api.restore(payload);return totals();}
   const tests=[];
   for(const speed of [.01,1,20,80]){
    const before=world(speed);api.contacts();const after=totals(),impact=api.lastImpact;
    tests.push({speed,before,after,outcome:impact?.outcome,budget:impact?.budget,cuts:api.bodies.slice(0,2).map(b=>b.solid?.cuts.length||0),dust:api.bodies.filter(b=>b.phase==='dust').length});
   }
   const capacityBefore=world(80,1.8,180);api.contacts();const capacity={before:capacityBefore,after:totals(),count:api.bodies.length,cuts:api.bodies.slice(0,2).map(b=>b.solid?.cuts.length||0)};
   // Whole encounters, not just pre-overlapped single calls.
   const trajectories=[];
   for(const [speed,offset] of [[.1,0],[20,0],[80,.72]]){
    const payload=JSON.parse(JSON.stringify(snapshot));
    payload.bodies=[make(1,0,0),{...make(2,speed<1?-1.999*R:-7.2*R,speed),y:offset*2*R}];
    payload.selected=1;payload.follow=1;api.restore(payload);const before=totals();
    let loops=0;
    for(;loops<1800;loops++){api.simulate(speed<1?1e-8:1e-7);if(api.lastImpact&&!api.contactPairs.size)break;}
    const internal=api.bodies.filter(b=>b.phase==='dust').reduce((e,b)=>e+.5*b.mass*U.MS*(b.spread||0)**2*U.V**2,0);
    trajectories.push({speed,offset,loops,before,after:totals(),internal,allocatedInternal:api.lastImpact?.budget?.internal||0,outcome:api.lastImpact?.outcome,cuts:api.bodies.filter(b=>b.phase!=='dust').map(b=>b.solid?.cuts.length||0)});
   }
   // A real laboratory crater with star gravity, time stepping, and worker upload.
   api.restore(snapshot);api.select(api.bodies.find(b=>b.planet==='earth').id);api.focusShowcase(true);
   document.getElementById('impactMass').value='1.26e13';document.getElementById('impactRadius').value='1';document.getElementById('impactSpeed').value='20';
   document.getElementById('impactOffset').value='0';document.getElementById('impactAutoPause').checked=true;
   const craterBefore=totals();api.launchImpact();api.pause();
   const massAfterLaunch=totals().m;
   let iterations=0;while(!api.lastImpact&&iterations++<3000)api.simulate(2e-8);
   const crater={iterations,impact:api.lastImpact,mass:totals().m,massAfterLaunch};
   return{tests,capacity,crater,trajectories};
  });
  for(const test of summary.tests){
   assert(Math.abs(test.before.m-test.after.m)<test.before.m*1e-11);
   for(let k=0;k<3;k++)assert(Math.abs(test.before.p[k]-test.after.p[k])<test.before.m*1e-9);
   assert(test.after.E<=test.before.E*(1+1e-10));assert(test.budget.fracture+test.budget.ejecta<=test.budget.initial*(1+1e-10));
  }
  assert.equal(summary.tests[0].outcome,'contact');assert.equal(summary.tests[0].dust,0);
  assert(summary.tests[3].dust>0);
  assert.equal(summary.capacity.count,180);assert(summary.capacity.cuts.every(n=>n===0));
  assert(Math.abs(summary.capacity.before.m-summary.capacity.after.m)<summary.capacity.before.m*1e-11);
  for(const t of summary.trajectories){assert(t.loops<1800&&t.outcome);assert(t.internal<=t.allocatedInternal*(1+1e-10));assert(Math.abs(t.after.m-t.before.m)<t.before.m*1e-11);for(let k=0;k<3;k++)assert(Math.abs(t.after.p[k]-t.before.p[k])<t.before.m*1e-9);}
  assert.equal(summary.crater.impact?.outcome,'crater');assert(Math.abs(summary.crater.mass-summary.crater.massAfterLaunch)<summary.crater.mass*1e-11);
  await page.waitForFunction(()=>{const a=OrbitFoundry.bodies.find(b=>b.planet==='earth'),o=FoundryRendererInfo.objects.get(a?.id);return o?.solidRef===a?.solid&&o?.solidRevision===a?.solid?.revision&&FoundryRenderer.pendingSolids()===0;},null,{timeout:60000});
  const mesh=await page.evaluate(()=>{const earth=OrbitFoundry.bodies.find(b=>b.planet==='earth');return FoundryRendererInfo.objects.get(earth.id).meshAudit;});
  assert(mesh.triangles>0);await page.evaluate(()=>OrbitFoundry.inspectImpact());
  await page.waitForTimeout(300);await page.screenshot({path:process.env.SHOT_PATH||'/data/orbit-energy-inspection.png'});
  // Start a second worker job, then import bodies with the same IDs.
  await page.evaluate(async()=>{
   const a=OrbitFoundry.bodies.find(b=>b.planet==='earth'),snap=JSON.parse(JSON.stringify(OrbitFoundry.payload()));
   SolidPhysics.cut(a,{x:-1,y:0,z:0,r:.12});FoundryRenderer.sculpt(a);
   await new Promise(r=>requestAnimationFrame(r));OrbitFoundry.restore(snap);
  });
  await page.waitForFunction(()=>{const a=OrbitFoundry.bodies.find(b=>b.planet==='earth'),o=FoundryRendererInfo.objects.get(a?.id);return o?.solidRef===a?.solid&&o?.solidRevision===a?.solid?.revision&&FoundryRenderer.pendingSolids()===0;},null,{timeout:60000});
  assert.deepEqual(errors,[]);console.log(JSON.stringify({tests:summary.tests.map(t=>({speed:t.speed,outcome:t.outcome,cuts:t.cuts,dust:t.dust,removedEnergy:t.budget.fracture,initialBudget:t.budget.initial})),capacity:summary.capacity.count,trajectories:summary.trajectories.map(t=>({speed:t.speed,offset:t.offset,loops:t.loops,outcome:t.outcome,cuts:t.cuts})),crater:{iterations:summary.crater.iterations,radius:summary.crater.impact.craterRadius,depth:summary.crater.impact.craterDepth},mesh,errors},null,2));
  console.log('browser-smoke: OK');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
