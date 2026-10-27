import * as THREE from './vendor/three.module.min.js';
import earthDay from './assets/earth-day.js';
import earthNormal from './assets/earth-normal.js';
import earthSpecular from './assets/earth-specular.js';
import earthClouds from './assets/earth-clouds.js';
import moonMap from './assets/moon.js';
const $=id=>document.getElementById(id),api=window.OrbitFoundry;
const SCALE=10000,objects=new Map(),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.001,1e9);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight);renderer.setClearColor(0x010203);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;$('webgl').append(renderer.domElement);
// One light at the actual Sun: the terminator is independent of texture spin and camera.
const sunLight=new THREE.PointLight(0xfff8ef,3.1,0,0);scene.add(sunLight);
const fillLight=new THREE.AmbientLight(0xb4c2d4,.10);scene.add(fillLight);
const sphere=new THREE.SphereGeometry(1,96,64);sphere.rotateX(Math.PI/2);
const manager=new THREE.LoadingManager();manager.onLoad=()=>{ if($('loading')){$('loading').classList.add('gone');setTimeout(()=>$('loading')?.remove(),700)}api.focusShowcase(true)};manager.onError=url=>{$('loadStatus').textContent='Ошибка текстуры — используется резервный материал';console.error('Texture failed:',url.slice(0,80))};
const loader=new THREE.TextureLoader(manager);function tex(uri,srgb=true){let t=loader.load(uri);if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t}
const maps={earth:tex(earthDay),normal:tex(earthNormal,false),specular:tex(earthSpecular,false),clouds:tex(earthClouds),moon:tex(moonMap),
mercury:tex('./assets/mercury.jpg'),venus:tex('./assets/venus_atmosphere.jpg'),mars:tex('./assets/mars.jpg'),jupiter:tex('./assets/jupiter.jpg'),saturn:tex('./assets/saturn.jpg'),uranus:tex('./assets/uranus.jpg'),neptune:tex('./assets/neptune.jpg'),sun:tex('./assets/sun.jpg'),night:tex('./assets/earth_nightmap.jpg'),rings:tex('./assets/saturn_ring_alpha.png')};
let seed=18741;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};
// Quiet, genuinely black backdrop. Stars are small, distant points, never a glowing fog.
const starPositions=[],starColors=[];for(let i=0;i<950;i++){let z=rand()*2-1,a=rand()*Math.PI*2,r=Math.sqrt(1-z*z),d=60000;starPositions.push(Math.cos(a)*r*d,Math.sin(a)*r*d,z*d);let br=.08+Math.pow(rand(),5)*.35;starColors.push(br*.86,br*.92,br)}
let starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));starGeo.setAttribute('color',new THREE.Float32BufferAttribute(starColors,3));let stars=new THREE.Points(starGeo,new THREE.PointsMaterial({size:1.05,sizeAttenuation:false,vertexColors:true,transparent:true,opacity:.75,depthWrite:false}));scene.add(stars);
const atmosphereVertex=`varying vec3 vN; varying vec3 vP; void main(){vec4 w=modelMatrix*vec4(position,1.);vP=w.xyz;vN=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*w;}`;
const atmosphereFragment=`varying vec3 vN;varying vec3 vP;uniform vec3 lightDir;uniform vec3 tint;void main(){vec3 n=normalize(vN),v=normalize(cameraPosition-vP);float edge=pow(1.-abs(dot(n,v)),4.);float day=smoothstep(-.16,.45,dot(n,normalize(lightDir)));gl_FragColor=vec4(tint,edge*day*.43);}`;
// Rotation periods and axial inclinations: NASA planetary fact sheets.
const planetData={
 sun:{label:'Солнце',latin:'SOL',tag:'Звезда, которая держит всё вместе.',hours:609.12,tilt:7.25,period:65,color:'#ffce84'},
 mercury:{label:'Меркурий',latin:'MERCURY',tag:'Кратеры. Тишина. Почти без атмосферы.',hours:1407.6,tilt:.034,period:120,color:'#c5b5a1'},
 venus:{label:'Венера',latin:'VENUS',tag:'Мир, скрытый под плотным облачным покровом.',hours:-5832.5,tilt:177.36,period:150,color:'#dfc895'},
 earth:{label:'Земля',latin:'EARTH',tag:'Океаны, облака и тонкая голубая атмосфера.',hours:23.9345,tilt:23.44,period:40,color:'#91bed4'},
 mars:{label:'Марс',latin:'MARS',tag:'Ржавые равнины и белые полярные шапки.',hours:24.6229,tilt:25.19,period:41,color:'#cf9072'},
 jupiter:{label:'Юпитер',latin:'JUPITER',tag:'Облачные пояса и Большое красное пятно.',hours:9.925,tilt:3.13,period:19,color:'#cfb497',flatten:.06487},
 saturn:{label:'Сатурн',latin:'SATURN',tag:'Лёд, пыль и тысячи тонких колец.',hours:10.7,tilt:26.73,period:21,color:'#d4c59f',flatten:.09796},
 uranus:{label:'Уран',latin:'URANUS',tag:'Ледяной гигант, вращающийся почти на боку.',hours:-17.24,tilt:97.77,period:29,color:'#a2d5d9',flatten:.0229},
 neptune:{label:'Нептун',latin:'NEPTUNE',tag:'Далёкий мир облаков и быстрых ветров.',hours:16.11,tilt:28.32,period:27,color:'#819fce',flatten:.0171}
};
const nameKeys=Object.fromEntries(Object.entries(planetData).map(([k,d])=>[d.label,k]));
const keyFor=b=>planetData[b.planet]?b.planet:nameKeys[b.name]||(b.kind==='star'?'sun':null);
let spinPaused=matchMedia('(prefers-reduced-motion: reduce)').matches,visualClock=0,lastPhysicsTime=api.time,lastMode='showcase';
const vec=new THREE.Vector3(),viewVec=new THREE.Vector3(),ray=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,0,1),0),origin=new THREE.Vector3();
let view=null,lastStamp='',lightDirection=new THREE.Vector3(-1,1,.3).normalize();
function sync(){const v=api.getView();let stamp=[v.W,v.H,v.cam.x,v.cam.y,v.cam.z,v.scale,v.yaw,v.tilt].join(':');if(stamp===lastStamp)return;lastStamp=stamp;view=v;let dist=v.H/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*v.scale)*SCALE;camera.aspect=v.W/v.H;camera.near=Math.max(dist*1e-5,1e-9);camera.far=Math.max(1e6,dist*1e5);let st=Math.sin(v.tilt),ct=Math.cos(v.tilt);camera.position.set(Math.sin(v.yaw)*st*dist,Math.cos(v.yaw)*st*dist,ct*dist);camera.up.set(0,v.tilt<.0001?1:0,v.tilt<.0001?0:1);camera.lookAt(0,0,0);camera.updateProjectionMatrix();camera.updateMatrixWorld();}
function position(x,y,z,out=vec){return out.set((x-view.cam.x)*SCALE,(y-view.cam.y)*SCALE,(z-view.cam.z)*SCALE)}
function visualRadius(b){sync();let p=position(b.x,b.y,b.z,new THREE.Vector3()),distance=p.distanceTo(camera.position),pixels=b.kind==='bh'?18:b.kind==='star'?6:b.kind==='gas'?4:2.4;return Math.max(b.r*SCALE,distance*2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/view.H*pixels)*Number($('sizeScale').value)}
function build(b){
 const key=keyFor(b),data=planetData[key],earth=key==='earth';
 const group=new THREE.Group(),axis=new THREE.Group();group.add(axis);
 axis.rotation.order='ZXY';axis.rotation.x=(data?.tilt||0)*Math.PI/180;axis.rotation.z=.35;
 let mat;
 if(b.kind==='bh')mat=new THREE.MeshBasicMaterial({color:0x000000});
 else if(key==='sun')mat=new THREE.MeshBasicMaterial({map:maps.sun,color:0xffe9c2,toneMapped:false});
 else if(earth){
  mat=new THREE.MeshPhongMaterial({map:maps.earth,normalMap:maps.normal,normalScale:new THREE.Vector2(.28,.28),specularMap:maps.specular,specular:new THREE.Color(.012,.014,.016),shininess:125});
  // Cities only on the night hemisphere. The Sun direction is evaluated in world space.
  mat.onBeforeCompile=shader=>{
   shader.uniforms.nightMap={value:maps.night};shader.uniforms.toSun={value:new THREE.Vector3()};
   shader.vertexShader='varying vec3 earthNormal; varying vec3 earthWorld;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nearthNormal=normalize(mat3(modelMatrix)*objectNormal);earthWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
   shader.fragmentShader='uniform sampler2D nightMap;uniform vec3 toSun;varying vec3 earthNormal;varying vec3 earthWorld;\n'+shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\nfloat nightFactor=1.-smoothstep(-.2,.12,dot(normalize(earthNormal),normalize(toSun-earthWorld)));totalEmissiveRadiance+=texture2D(nightMap,vMapUv).rgb*nightFactor*.65;');
   mat.userData.shader=shader;
  };
 }else if(key)mat=new THREE.MeshStandardMaterial({map:maps[key],roughness:key==='venus'?.98:.92,metalness:0,bumpMap:['mercury','mars'].includes(key)?maps[key]:null,bumpScale:key==='mercury'?.006:.002});
 else mat=new THREE.MeshStandardMaterial({map:maps.moon,color:b.color,roughness:1});
 const surface=new THREE.Mesh(sphere,mat);surface.scale.z=1-(data?.flatten||0);axis.add(surface);
 let cloud=null,atm=null,ring=null,glow=null;
 if(earth){cloud=new THREE.Mesh(sphere,new THREE.MeshPhongMaterial({map:maps.clouds,transparent:true,opacity:.58,depthWrite:false,specular:0x000000}));cloud.scale.setScalar(1.009);axis.add(cloud);}
 const hues={earth:new THREE.Vector3(.12,.38,.78),venus:new THREE.Vector3(.72,.46,.18),mars:new THREE.Vector3(.42,.18,.10),uranus:new THREE.Vector3(.2,.55,.64),neptune:new THREE.Vector3(.13,.29,.64)};
 if(hues[key]){atm=new THREE.Mesh(sphere,new THREE.ShaderMaterial({vertexShader:atmosphereVertex,fragmentShader:atmosphereFragment,uniforms:{lightDir:{value:new THREE.Vector3()},tint:{value:hues[key]}},transparent:true,side:THREE.BackSide,depthWrite:false,blending:THREE.AdditiveBlending}));atm.scale.set(1.018,1.018,(1-(data?.flatten||0))*1.018);axis.add(atm);}
 if(key==='saturn'||b.ring){
  const geometry=new THREE.RingGeometry(1.19,2.34,192,8),pos=geometry.attributes.position,uv=geometry.attributes.uv;
  for(let i=0;i<pos.count;i++)uv.setXY(i,(Math.hypot(pos.getX(i),pos.getY(i))-1.19)/1.15,.5);
  ring=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map:maps.rings,color:0xffedcf,transparent:true,side:THREE.DoubleSide,depthWrite:false,opacity:.94,toneMapped:false}));
  // Analytic planet shadow on the ring; no shadow-map precision loss at solar-system scales.
  ring.material.onBeforeCompile=sh=>{sh.uniforms.planetCenter={value:new THREE.Vector3()};sh.uniforms.solarPosition={value:new THREE.Vector3()};sh.uniforms.planetRadius={value:1};sh.vertexShader='varying vec3 ringWorld;\n'+sh.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nringWorld=(modelMatrix*vec4(transformed,1.)).xyz;');sh.fragmentShader='varying vec3 ringWorld;uniform vec3 planetCenter;uniform vec3 solarPosition;uniform float planetRadius;\n'+sh.fragmentShader.replace('#include <opaque_fragment>','vec3 rayToSun=normalize(solarPosition-ringWorld);vec3 fromPlanet=ringWorld-planetCenter;float along=dot(fromPlanet,rayToSun);float miss=length(fromPlanet-rayToSun*along)/planetRadius;float shadow=(1.-smoothstep(.92,1.04,miss))*step(along,0.);outgoingLight*=mix(1.,.10,shadow);\n#include <opaque_fragment>');ring.material.userData.shader=sh;};axis.add(ring);
 }
 if(key==='uranus'){
  for(const [radius,width,opacity]of [[1.64,.009,.13],[1.93,.008,.11],[2.02,.013,.20]]){const ringlet=new THREE.Mesh(new THREE.RingGeometry(radius,radius+width,192),new THREE.MeshBasicMaterial({color:0xb3a89a,transparent:true,opacity,side:THREE.DoubleSide,depthWrite:false}));axis.add(ringlet);}
 }
 if(key==='sun'){
  const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d'),g=ctx.createRadialGradient(64,64,25,64,64,64);g.addColorStop(0,'rgba(255,195,100,.30)');g.addColorStop(.4,'rgba(255,162,52,.08)');g.addColorStop(1,'rgba(255,130,30,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);
  glow=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));glow.scale.setScalar(3.5);group.add(glow);
 }
 scene.add(group);const record={group,axis,surface,cloud,atm,ring,glow,earth,key,data,kind:b.kind,color:b.color,spin:0};objects.set(b.id,record);return record;
}
let field=null,fieldKey='',potentialTime=0;
function updatePotential(bodies){$('fieldCaption').textContent='Сглаженный потенциал / высота условная · силы не изменены';let now=performance.now();if(fieldKey==='potential'&&now-potentialTime<220){if(field)field.visible=true;return}potentialTime=now;let ext=190/view.scale*SCALE,dim=40;if(fieldKey!=='potential'){if(field){scene.remove(field);field.geometry.dispose();field.material.dispose()}field=new THREE.Mesh(new THREE.PlaneGeometry(ext*2,ext*2,dim,dim),new THREE.MeshBasicMaterial({color:0x8896a8,transparent:true,opacity:.10,wireframe:true,depthWrite:false}));scene.add(field);fieldKey='potential'}let sources=[...bodies].sort((a,b)=>b.mass-a.mass).slice(0,12),max=sources[0]?.mass||1,w=55/view.scale,norm=6.283185307179586**2*max/w,amp=Number($('fieldStrength').value),pos=field.geometry.attributes.position;for(let i=0;i<pos.count;i++){let ix=i%(dim+1),iy=Math.floor(i/(dim+1)),x=-ext+ix/dim*ext*2,y=ext-iy/dim*ext*2,wx=view.cam.x+x/SCALE,wy=view.cam.y+y/SCALE,p=0;for(let b of sources)p+=39.47841760435743*b.mass/Math.sqrt((wx-b.x)**2+(wy-b.y)**2+w*w);pos.setXYZ(i,x,y,-Math.min(3,p/Math.max(1e-30,norm))*amp*45/view.scale*SCALE)}pos.needsUpdate=true;field.position.set(0,0,-view.cam.z*SCALE);field.geometry.computeBoundingSphere();field.visible=true}
function updateField(bodies){let on=$('curvature').checked;$('fieldCaption').hidden=!on;if(!on){if(field)field.visible=false;return}let bh=bodies.filter(b=>b.kind==='bh').sort((a,b)=>b.mass-a.mass)[0];if($('fieldMode').value==='potential'||!bh){updatePotential(bodies);return}let rs=bh.r,outer=Math.max(rs*14,220/view.scale),amp=Number($('fieldStrength').value),key=[bh.id,rs,outer,amp].join(':');if(key!==fieldKey){if(field){scene.remove(field);field.geometry.dispose();field.material.dispose()}let points=[];function p(r,a){return new THREE.Vector3(r*Math.cos(a)*SCALE,r*Math.sin(a)*SCALE,2*Math.sqrt(rs*Math.max(0,r-rs))*amp*SCALE)}for(let i=0;i<28;i++){let r=rs+(outer-rs)*(i/27)**2;for(let j=0;j<96;j++)points.push(p(r,j/96*Math.PI*2),p(r,(j+1)/96*Math.PI*2))}for(let j=0;j<40;j++)for(let i=0;i<40;i++)points.push(p(rs+(outer-rs)*(i/40)**2,j/40*Math.PI*2),p(rs+(outer-rs)*((i+1)/40)**2,j/40*Math.PI*2));field=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x8b9aaf,transparent:true,opacity:.16,depthWrite:false}));scene.add(field);fieldKey=key}field.visible=true;position(bh.x,bh.y,bh.z,field.position);$('fieldCaption').textContent='Срез Шварцшильда / поверхность Фламма · высота ×'+amp+' · не полная ОТО'}
let lensWasActive=false;function updateStarLensing(bodies){let holes=$('lensing').checked?bodies.filter(b=>b.kind==='bh').slice(0,3):[];if(!holes.length){if(lensWasActive){starGeo.attributes.position.array.set(starPositions);starGeo.attributes.position.needsUpdate=true;lensWasActive=false}return}lensWasActive=true;let lenses=holes.map(b=>{let p=position(b.x,b.y,b.z,new THREE.Vector3()).project(camera);return{x:(p.x*.5+.5)*view.W,y:(.5-p.y*.5)*view.H,re:window.FoundryRenderer.radius(b)*2.5}});let attr=starGeo.attributes.position;for(let i=0;i<starPositions.length;i+=3){let world=new THREE.Vector3(starPositions[i],starPositions[i+1],starPositions[i+2]).add(camera.position),ndc=world.clone().project(camera);if(ndc.z>1){attr.setXYZ(i/3,starPositions[i],starPositions[i+1],starPositions[i+2]);continue}let x=(ndc.x*.5+.5)*view.W,y=(.5-ndc.y*.5)*view.H;for(let l of lenses){let dx=x-l.x,dy=y-l.y,beta=Math.hypot(dx,dy);if(beta<.01||beta>l.re*6)continue;let outer=(beta+Math.sqrt(beta*beta+4*l.re*l.re))*.5;x=l.x+dx/beta*outer;y=l.y+dy/beta*outer}ndc.x=x/view.W*2-1;ndc.y=1-y/view.H*2;ndc.unproject(camera).sub(camera.position);attr.setXYZ(i/3,ndc.x,ndc.y,ndc.z)}attr.needsUpdate=true}
const grid=new THREE.GridHelper(100,30,0x1b2027,0x10151b);grid.rotation.x=Math.PI/2;grid.material.transparent=true;grid.material.opacity=.35;scene.add(grid);
window.FoundryRenderer={project(x,y,z){sync();let p=position(x,y,z,new THREE.Vector3()).project(camera);return {x:(p.x*.5+.5)*view.W,y:(-.5*p.y+.5)*view.H,depth:p.z,k:1}},unproject(x,y,z){sync();ray.setFromCamera(new THREE.Vector2(x/view.W*2-1,1-y/view.H*2),camera);plane.constant=-(z-view.cam.z)*SCALE;let hit=ray.ray.intersectPlane(plane,new THREE.Vector3());if(!hit)return{x:view.cam.x,y:view.cam.y,z};return {x:hit.x/SCALE+view.cam.x,y:hit.y/SCALE+view.cam.y,z}},radius(b){sync();let p=position(b.x,b.y,b.z,new THREE.Vector3()),dist=Math.max(1e-10,p.distanceTo(camera.position));return visualRadius(b)*view.H/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*dist)},render(bodies,now,dt){sync();stars.position.copy(camera.position);updateStarLensing(bodies);let star=bodies.filter(b=>b.kind==='star').sort((a,b)=>b.mass-a.mass)[0];if(star){position(star.x,star.y,star.z,sunLight.position);lightDirection.copy(sunLight.position).normalize()}else{sunLight.position.set(-5,3,5);lightDirection.copy(sunLight.position).normalize()}const ids=new Set(bodies.map(b=>b.id));for(let [id,o]of objects)if(!ids.has(id)){scene.remove(o.group);o.group.traverse(n=>{if(n.material)n.material.dispose()});objects.delete(id)}fillLight.intensity=$('lightingMode').value==='inspect'?.65:.10;
 const mode=$('rotationMode').value,physicsDelta=api.time-lastPhysicsTime;lastPhysicsTime=api.time;
 if(!spinPaused)visualClock+=dt;
 for(let b of bodies){
  let o=objects.get(b.id);const key=keyFor(b);
  if(o&&(o.kind!==b.kind||o.color!==b.color||o.key!==key)){scene.remove(o.group);o.group.traverse(n=>{if(n.material)n.material.dispose()});objects.delete(b.id);o=null;}
  if(!o)o=build(b);
  position(b.x,b.y,b.z,o.group.position);o.group.scale.setScalar(visualRadius(b));
  const d=o.data;
  if(!spinPaused){
   const delta=mode==='physical'?(physicsDelta>=0?physicsDelta:0)*365.25*24/Math.abs(d?.hours||24)*Math.PI*2:dt/(d?.period||40)*Math.PI*2;
   o.spin=(o.spin+delta)%(Math.PI*2);
  }
  o.surface.rotation.z=o.spin+(o.earth?2.3:.5);
  if(o.cloud)o.cloud.rotation.z=o.spin*1.025+2.32;
  if(o.atm)o.atm.material.uniforms.lightDir.value.copy(sunLight.position).sub(o.group.position).normalize();
  if(o.surface.material.userData.shader)o.surface.material.userData.shader.uniforms.toSun.value.copy(sunLight.position);
  const rs=o.ring?.material.userData.shader;if(rs){rs.uniforms.planetCenter.value.copy(o.group.position);rs.uniforms.solarPosition.value.copy(sunLight.position);rs.uniforms.planetRadius.value=o.group.scale.x;}
 }
 updatePlanetUI(bodies,now);
 let spacing=10**Math.floor(Math.log10(100/view.scale))*SCALE;grid.scale.setScalar(spacing);grid.visible=$('grid').checked;updateField(bodies);renderer.render(scene,camera)}};
addEventListener('resize',()=>renderer.setSize(innerWidth,innerHeight));
const sections=[...document.querySelector('.left').children].filter(n=>n.classList.contains('section'));sections.forEach((s,i)=>s.dataset.pane=['scenes','create','display'][i]);window.showLeft=name=>{sections.forEach(s=>s.classList.toggle('pane-active',s.dataset.pane===name));document.querySelectorAll('[data-left]').forEach(b=>b.classList.toggle('active',b.dataset.left===name))};document.querySelectorAll('[data-left]').forEach(b=>b.onclick=()=>showLeft(b.dataset.left));showLeft('scenes');$('editorToggle').onclick=()=>{$('editorSection').hidden=!$('editorSection').hidden};$('overviewBtn').onclick=()=>api.fit();$('planetViewBtn').onclick=()=>api.focusShowcase();
$('zoomIn').onclick=()=>api.zoomBy(1.65);$('zoomOut').onclick=()=>api.zoomBy(1/1.65);
$('spinToggle').onclick=()=>{spinPaused=!spinPaused;$('spinToggle').textContent=spinPaused?'▶ Продолжить вращение':'Ⅱ Остановить вращение';$('spinToggle').setAttribute('aria-pressed',String(spinPaused));};
if(spinPaused){$('spinToggle').textContent='▶ Продолжить вращение';$('spinToggle').setAttribute('aria-pressed','true');}
$('rotationMode').onchange=()=>{$('spinNote').textContent=$('rotationMode').value==='physical'?'Периоды вращения связаны со временем орбит. Пауза останавливает оба движения.':'Вращение ускорено отдельно от орбит. Пауза внизу останавливает движение по орбите.';};
// First launch shows a real, resolved planet rather than a tiny symbol in an empty map.
setTimeout(()=>{if($('loading')){$('loadStatus').textContent='Материалы загружаются…'}},2500);
window.FoundryRendererInfo={three:THREE.REVISION,renderer:'WebGL',objects,planetData,camera,sunLight};

let navStamp='',uiStamp='',uiTime=0;
function updatePlanetUI(bodies,now){
 const stamp=bodies.map(b=>b.id+':'+b.name).join('|');
 if(stamp!==navStamp){navStamp=stamp;$('planetNavigator').replaceChildren(...bodies.map((b,i)=>{
  const k=keyFor(b),d=planetData[k],bt=document.createElement('button');bt.className='planet-nav';bt.dataset.planetId=b.id;bt.setAttribute('aria-label','Приблизиться: '+b.name);
  const n=document.createElement('span');n.className='planet-order';n.textContent=String(i).padStart(2,'0');const orb=document.createElement('span');orb.className='planet-thumb';orb.style.backgroundColor=d?.color||b.color;
  const sources={earth:earthDay,venus:'./assets/venus_atmosphere.jpg'};if(k)orb.style.backgroundImage=`url("${sources[k]||'./assets/'+k+'.jpg'}")`;
  const name=document.createElement('span');name.textContent=b.name;const arrow=document.createElement('span');arrow.className='planet-arrow';arrow.textContent='↗';bt.append(n,orb,name,arrow);bt.onclick=()=>{api.select(b.id);api.focusShowcase();};return bt;
 }));}
 if(now-uiTime<120)return;uiTime=now;
 document.querySelectorAll('[data-planet-id]').forEach(bt=>{let active=Number(bt.dataset.planetId)===api.selected;bt.classList.toggle('active',active);bt.setAttribute('aria-current',active?'true':'false');});
 const selected=bodies.find(b=>b.id===api.selected),key=selected&&keyFor(selected),d=planetData[key];
 const caption=document.querySelector('.planet-caption');caption.hidden=!d;
 if(d){$('planetKicker').textContent=String(Object.keys(planetData).indexOf(key)).padStart(2,'0')+' / '+d.latin;$('planetSubtitle').textContent=d.tag;const retro=d.hours<0?' · обратное вращение':'';$('planetFacts').textContent='Наклон '+d.tilt.toLocaleString('ru-RU')+'° · оборот '+Math.abs(d.hours).toLocaleString('ru-RU',{maximumFractionDigits:2})+' ч'+retro;}
 const distance=view.H/(2*Math.tan(21*Math.PI/180)*view.scale)*149597870.7;
 const radius=api.following===selected?.id?selected.r*149597870.7:0;
 const height=Math.max(0,distance-radius);$('cameraDistance').textContent=(radius?'Над поверхностью · ':'До центра кадра · ')+(height>14959787?(height/149597870.7).toLocaleString('ru-RU',{maximumFractionDigits:2})+' а.е.':Math.round(height).toLocaleString('ru-RU')+' км');
}
