'use strict';
const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/local/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const base=process.env.BASE_URL||'http://127.0.0.1:8037/';
  async function ready(){await page.waitForFunction(()=>window.FoundryRendererInfo&&!document.getElementById('loading'),null,{timeout:60000});await page.evaluate(()=>OrbitFoundry.pause());}
  await page.goto(base);await ready();
  assert.equal(await page.locator('#lookSensitivity').inputValue(),'1');
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
  const combinations=[];
  for(const key of ['w','a','s','d','q','e']){
   await page.evaluate(()=>OrbitFoundry.focusShowcase(true));await page.mouse.move(800,500);await page.mouse.down({button:'right'});
   const before=await page.evaluate(()=>OrbitFoundry.getView());
   await page.keyboard.down(key);
   await page.waitForFunction(c=>{const v=OrbitFoundry.getView().cam;return Math.hypot(v.x-c.x,v.y-c.y,v.z-c.z)>1e-12;},before.cam);
   await page.mouse.move(825,508,{steps:3});
   const after=await page.evaluate(()=>({view:OrbitFoundry.getView(),following:OrbitFoundry.following,pointer:OrbitFoundry.pointer?.button}));
   await page.keyboard.up(key);await page.mouse.up({button:'right'});
   assert(distance(before.cam,after.view.cam)>1e-12);assert.notEqual(before.yaw,after.view.yaw);assert.equal(after.following,null);assert.equal(after.pointer,2);
   combinations.push(key);
  }
  const deltas=[];
  for(const value of [.5,1,2]){
   await page.evaluate(value=>{const el=document.getElementById('lookSensitivity');el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));OrbitFoundry.focusShowcase(true);},value);
   await page.mouse.move(800,500);const before=await page.evaluate(()=>OrbitFoundry.getView());
   await page.mouse.down({button:'right'});await page.mouse.move(840,500,{steps:4});await page.mouse.up({button:'right'});
   const after=await page.evaluate(()=>OrbitFoundry.getView());deltas.push(after.yaw-before.yaw);
   assert(distance(before.cam,after.cam)<1e-14,'RMB orbit moved the look-at target');
  }
  assert(Math.abs(deltas[1]/deltas[0]-2)<1e-8);assert(Math.abs(deltas[2]/deltas[1]-2)<1e-8);
  await page.reload();await ready();assert.equal(await page.locator('#lookSensitivity').inputValue(),'2');
  await page.locator('[data-left="display"]').click();await page.locator('#resetLookSensitivity').click();
  assert.equal(await page.locator('#lookSensitivityValue').innerText(),'100%');
  await page.reload();await ready();assert.equal(await page.locator('#lookSensitivity').inputValue(),'1');
  // Editing a control blocks hotkeys, but clicking RMB in space returns flight.
  await page.locator('[data-left="display"]').click();await page.locator('#lookSensitivity').focus();
  const editing=await page.evaluate(()=>OrbitFoundry.getView().cam);await page.keyboard.down('w');
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.keyboard.up('w');
  assert(distance(editing,await page.evaluate(()=>OrbitFoundry.getView().cam))<1e-14);
  await page.mouse.move(800,500);await page.mouse.down({button:'right'});await page.keyboard.down('w');
  await page.waitForFunction(c=>{const v=OrbitFoundry.getView().cam;return Math.hypot(v.x-c.x,v.y-c.y,v.z-c.z)>1e-12;},editing);
  await page.keyboard.up('w');await page.mouse.up({button:'right'});
  // An active left-button launch must still freeze navigation and physics.
  await page.locator('[data-left="create"]').click();await page.locator('[data-tool="launch"]').click();
  await page.mouse.move(800,500);await page.mouse.down({button:'left'});
  const aiming=await page.evaluate(()=>({view:OrbitFoundry.getView(),time:OrbitFoundry.time}));
  await page.keyboard.down('w');await page.waitForTimeout(180);await page.keyboard.up('w');
  const aimAfter=await page.evaluate(()=>({view:OrbitFoundry.getView(),time:OrbitFoundry.time}));
  assert(distance(aiming.view.cam,aimAfter.view.cam)<1e-14);assert.equal(aiming.time,aimAfter.time);
  await page.evaluate(()=>OrbitFoundry.cancelPointer());await page.mouse.up({button:'left'});await page.keyboard.press('Escape');
  // Focus loss clears both held movement and the RMB gesture.
  await page.evaluate(()=>OrbitFoundry.focusShowcase(true));await page.mouse.move(800,500);await page.mouse.down({button:'right'});await page.keyboard.down('d');
  await page.waitForFunction(()=>OrbitFoundry.following===null);
  const cleared=await page.evaluate(()=>{window.dispatchEvent(new Event('blur'));return OrbitFoundry.getView().cam;});
  await page.waitForTimeout(180);const stopped=await page.evaluate(()=>({cam:OrbitFoundry.getView().cam,pointer:OrbitFoundry.pointer}));
  assert(distance(cleared,stopped.cam)<1e-14);assert.equal(stopped.pointer,null);
  await page.keyboard.up('d');await page.mouse.up({button:'right'});
  await page.evaluate(()=>{localStorage.setItem('orbit-foundry-look-sensitivity-v1','not-a-number');});await page.reload();await ready();
  assert.equal(await page.locator('#lookSensitivity').inputValue(),'1');
  await page.locator('[data-left="display"]').click();await page.locator('#resetLookSensitivity').click();
  await page.screenshot({path:process.env.SHOT_PATH||'/data/orbit-controls.png'});
  assert.deepEqual(errors,[]);console.log(JSON.stringify({combinations,deltas,persistence:true,reset:true,aimingBlocked:true,blurClears:true,invalidPreferenceSafe:true,errors}));
  console.log('navigation-smoke: OK');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
