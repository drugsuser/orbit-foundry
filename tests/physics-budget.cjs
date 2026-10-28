'use strict';
const assert=require('node:assert/strict');
const I=require('../impact-physics.js'),S=require('../solid-physics.js');
const {MS,V,AU}=I.units,R=6371e3/AU,M=5.972e24/MS;
function body(id,x,v,m=M,r=R){return{id,kind:'rock',mass:m,r,x,y:0,z:0,vx:v*1000/V,vy:0,vz:0};}
function totals(parts){let m=0,p=[0,0,0],E=0;for(const b of parts){m+=b.mass;for(const [i,k]of ['vx','vy','vz'].entries())p[i]+=b.mass*b[k];}const v=p.map(x=>x/m);for(const b of parts)E+=.5*b.mass*MS*((b.vx-v[0])**2+(b.vy-v[1])**2+(b.vz-v[2])**2)*V*V;return{m,p,E};}
function close(a,b,tol=1e-10){assert(Math.abs(a-b)<=tol*Math.max(Math.abs(a),Math.abs(b),1e-40),`${a} != ${b}`);}
function conservation(before,parts){const after=totals(parts);close(after.m,before.m);for(let k=0;k<3;k++)assert(Math.abs(after.p[k]-before.p[k])<=1e-10*before.m*Math.max(1,...parts.map(b=>Math.hypot(b.vx,b.vy,b.vz))));return after;}
const results=[];
for(const speed of [.01,.1,1,5,20,80]){
 const a=body(1,0,0),b=body(2,R,-speed),before=totals([a,b]);
 const budget=I.contactBudget(a,b),limits=I.removalLimits(a,b,budget),r=S.shave(a,b,S.overlap(a,b),limits);
 assert(r.a<=limits.maxA*(1+1e-10));assert(r.b<=limits.maxB*(1+1e-10));
 const e=I.shaveEjecta(a,b,r.a,r.b,budget,{x:1,y:0,z:0});
 const parts=[a,b,{mass:r.a,...e.a},{mass:r.b,...e.b}],after=conservation(before,parts);
 assert(after.E+budget.fracture+budget.internal<=before.E*(1+1e-10));
 assert(budget.fracture+budget.ejecta<=budget.initial*(1+1e-10));
 results.push({speed,removed:r.a/M,energyFraction:before.E?after.E/before.E:0});
 // Subsequent steps must never refill this contact's budget.
 const initial=budget.initial;
 for(let k=0;k<5;k++){const previous=budget.remaining;const r=S.shave(a,b,S.overlap(a,b),I.removalLimits(a,b,budget));I.shaveEjecta(a,b,r.a,r.b,budget,{x:1,y:0,z:0});assert(budget.remaining<=previous*(1+1e-12));}
 assert(budget.fracture+budget.ejecta<=initial*(1+1e-10));
}
assert(results[1].removed<results[2].removed&&results[2].removed<results[4].removed&&results[4].removed<=results[5].removed);
// Low energy: no free tunnelling, P conserved and restitution dissipates energy.
{
 const a=body(1,0,.1),b=body(2,2*R,-.1),before=totals([a,b]);const heat=I.respond(a,b,{x:1,y:0,z:0});
 const after=conservation(before,[a,b]);close(after.E+heat,before.E);assert(b.vx-a.vx>0);
 const v=a.vx;assert.equal(I.respond(a,b,{x:1,y:0,z:0}),0);assert.equal(a.vx,v);
}
// Small crater: real geometry, bounded cost, P and energy including recoil.
{
 const a=body(1,0,0),b=body(2,R+1e3/AU,-20,1.26e13/MS,1e3/AU),before=totals([a,b]);
 const analysis=I.analyze(a,b);analysis.normal={x:1,y:0,z:0};analysis.incidence=1;
 const budget=I.contactBudget(a,b,analysis),maxLoss=.75*budget.remaining/(budget.qA*MS);
 const r=S.crater(a,b,analysis,maxLoss);assert(r.changed&&r.removed>0);assert(r.removed<=maxLoss*(1+1e-9));
 assert(r.craterDepth>0&&r.craterRadius>0);assert(!S.contains(a,{x:R*(1-r.depth*.3),y:0,z:0}));
 const e=I.craterEjecta(a,b,r.removed,budget,analysis.normal),after=conservation(before,[a,{mass:r.removed+b.mass,...e.velocity}]);
 assert(after.E+budget.fracture+budget.internal<=before.E*(1+1e-9));
}
// Exact volume helper and a cut smaller than one voxel must not spend free mass.
close(S.intersectionFraction({x:1,y:0,z:0,r:1}),5/16);
{
 const a=body(1,0,0),r=S.limitedCut(a,{x:1,y:0,z:0,r:.5},M*1e-12);
 assert(!r.changed&&r.limited);close(a.mass,M);
}
// Unequal masses/radii, boosts, oblique velocities and damaged targets.
let seed=17;const rand=()=>((seed=(1664525*seed+1013904223)>>>0)/2**32);
for(let i=0;i<80;i++){
 const a=body(1,0,rand()*20),b=body(2,R*(.2+rand()),-rand()*100,M*(.05+rand()*2),R*(.3+rand()));
 a.vy=rand()*10;b.vz=rand()*10;
 if(i%3===0)S.cut(a,{x:-1,y:0,z:0,r:.3});
 const before=totals([a,b]),budget=I.contactBudget(a,b),r=S.shave(a,b,S.overlap(a,b),I.removalLimits(a,b,budget));
 const e=I.shaveEjecta(a,b,r.a,r.b,budget,{x:1,y:0,z:0}),after=conservation(before,[a,b,{mass:r.a,...e.a},{mass:r.b,...e.b}]);
 assert(after.E+budget.fracture+budget.internal<=before.E*(1+1e-9));
 assert(budget.remaining>=0&&budget.fracture+budget.ejecta<=budget.initial*(1+1e-9));
}
console.table(results);console.log('physics-budget: OK (speed dependence, geometry, repeated budget, mass/P/energy, crater, 80 varied contacts)');
