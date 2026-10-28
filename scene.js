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
const inspectLight=new THREE.DirectionalLight(0xffe7cf,0);scene.add(inspectLight,inspectLight.target);
const sphere=new THREE.SphereGeometry(1,96,64);sphere.rotateX(Math.PI/2);
const manager=new THREE.LoadingManager();manager.onLoad=()=>{ if($('loading')){$('loading').classList.add('gone');setTimeout(()=>$('loading')?.remove(),700)}api.focusShowcase(true)};manager.onError=url=>{$('loadStatus').textContent='Ошибка текстуры — используется резервный материал';console.error('Texture failed:',url.slice(0,80))};
const loader=new THREE.TextureLoader(manager);function tex(uri,srgb=true){let t=loader.load(uri);t.wrapS=THREE.RepeatWrapping;if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t}
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
const keyFor=b=>b.kind==='debris'?null:planetData[b.planet]?b.planet:nameKeys[b.name]||(b.kind==='star'?'sun':null);
let spinPaused=matchMedia('(prefers-reduced-motion: reduce)').matches,visualClock=0,lastPhysicsTime=api.time,lastMode='showcase';
const vec=new THREE.Vector3(),viewVec=new THREE.Vector3(),ray=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,0,1),0),origin=new THREE.Vector3();
let view=null,lastStamp='',lightDirection=new THREE.Vector3(-1,1,.3).normalize();
function sync(){const v=api.getView();let stamp=[v.W,v.H,v.cam.x,v.cam.y,v.cam.z,v.scale,v.yaw,v.tilt].join(':');if(stamp===lastStamp)return;lastStamp=stamp;view=v;let dist=v.H/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*v.scale)*SCALE;camera.aspect=v.W/v.H;camera.near=Math.max(dist*.002,1e-9);camera.far=Math.max(1e6,dist*1e5);let st=Math.sin(v.tilt),ct=Math.cos(v.tilt);camera.position.set(Math.sin(v.yaw)*st*dist,Math.cos(v.yaw)*st*dist,ct*dist);camera.up.set(0,v.tilt<.0001?1:0,v.tilt<.0001?0:1);camera.lookAt(0,0,0);camera.updateProjectionMatrix();camera.updateMatrixWorld();}
function position(x,y,z,out=vec){return out.set((x-view.cam.x)*SCALE,(y-view.cam.y)*SCALE,(z-view.cam.z)*SCALE)}
function visualRadius(b){sync();let p=position(b.x,b.y,b.z,new THREE.Vector3()),distance=p.distanceTo(camera.position),pixels=b.kind==='bh'?18:b.kind==='star'?6:b.kind==='gas'?4:2.4;return Math.max(b.r*SCALE,distance*2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/view.H*pixels)*Number($('sizeScale').value)}
const fogCanvas=document.createElement('canvas');fogCanvas.width=fogCanvas.height=128;const fogCtx=fogCanvas.getContext('2d'),fogGradient=fogCtx.createRadialGradient(64,64,0,64,64,64);fogGradient.addColorStop(0,'rgba(255,255,255,.9)');fogGradient.addColorStop(.3,'rgba(255,255,255,.65)');fogGradient.addColorStop(.65,'rgba(255,255,255,.18)');fogGradient.addColorStop(1,'rgba(255,255,255,0)');fogCtx.fillStyle=fogGradient;fogCtx.fillRect(0,0,128,128);const fogTexture=new THREE.CanvasTexture(fogCanvas);
const solidWorker=new Worker('./solid-mesh-worker.js?v=solid6');let meshToken=0,meshEpoch=0,meshBusy=null,lastMeshStart=0;const meshLatest=new Map(),meshUploads=[];
const meshStats={requested:0,completed:0,coalesced:0,stale:0,workerMs:0,uploadMs:0,updatedPatches:0,maxQueued:0,maxInFlight:0,recent:[]};
function decorateSolidMaterial(mat,key){const original=mat.onBeforeCompile;mat.onBeforeCompile=shader=>{if(original)original.call(mat,shader);shader.uniforms.solidHeat={value:.15};shader.vertexShader='attribute float interior; varying float vInterior; varying vec3 vLocalSolid;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvInterior=interior;vLocalSolid=position;');shader.fragmentShader='varying float vInterior;varying vec3 vLocalSolid;uniform float solidHeat;\n'+shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nfloat layer=clamp(vInterior,0.,1.);float stone=.72+.16*sin(vLocalSolid.x*83.+sin(vLocalSolid.y*57.)*2.)*sin(vLocalSolid.z*67.);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.18,.115,.075)*stone,layer);').replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vec3(1.,.16,.015)*solidHeat*clamp(vInterior,0.,1.);').replace('nightFactor*.65','nightFactor*.65*(1.-clamp(vInterior,0.,1.))');mat.userData.solidShader=shader;};mat.customProgramCacheKey=()=>key+'-solid6';}
function prepareSolid(b){if(b.solidQuaternion)return;let o=objects.get(b.id);if(!o)o=build(b);o.surface.rotation.z=o.spin+(o.earth?2.3:.5);o.group.updateMatrixWorld(true);const q=o.surface.getWorldQuaternion(new THREE.Quaternion());b.solidQuaternion=[q.x,q.y,q.z,q.w];b.solidSpin=o.spin;}
function meshQuality(b){for(const p of api.contactPairs.values())if(p.a===b.id||p.b===b.id)return 'preview';return 'final';}
function sculpt(b){const quality=meshQuality(b),o=objects.get(b.id);if(!o||!b.solid?.cuts.length||b.phase==='dust')return;if(o.solidRevision===b.solid.revision&&o.solidRef===b.solid&&o.solidQuality===quality)return;
 if(meshBusy?.o===o&&meshBusy.ref===b.solid&&meshBusy.revision===b.solid.revision&&meshBusy.quality===quality)return;
 const queued=meshLatest.get(b.id);if(queued&&queued.o===o&&queued.revision===b.solid.revision&&queued.ref===b.solid&&queued.quality===quality)return;
 if(queued)meshStats.coalesced++;meshLatest.set(b.id,{b,o,ref:b.solid,revision:b.solid.revision,quality});meshStats.maxQueued=Math.max(meshStats.maxQueued,meshLatest.size);}
function pumpMeshes(now){if(meshBusy||meshUploads.length||now-lastMeshStart<40)return;for(const [id,job]of meshLatest){if(objects.get(id)!==job.o||!api.bodies.includes(job.b)||!job.b.solid?.cuts.length){meshLatest.delete(id);continue;}const {b,o}=job,quality=meshQuality(b);
 if(o.solidRevision===b.solid.revision&&o.solidRef===b.solid&&o.solidQuality===quality){meshLatest.delete(id);continue;}
 if(!o.meshEpoch)o.meshEpoch=++meshEpoch;meshLatest.delete(id);const token=++meshToken;meshBusy={id,token,o,ref:b.solid,revision:b.solid.revision,quality};lastMeshStart=now;meshStats.requested++;meshStats.maxInFlight=1;solidWorker.postMessage({id,epoch:o.meshEpoch,token,solid:b.solid,quality});break;}}
function clearSolidParts(o){if(o.solidParts){for(const p of o.solidParts.values()){o.surface.remove(p.surface);if(p.cloud)o.cloud?.remove(p.cloud);p.surface.geometry.dispose();}o.solidParts.clear();}else o.solidParts=new Map();if(o.surface.geometry!==sphere)o.surface.geometry.dispose();const empty=new THREE.BufferGeometry();empty.setAttribute('position',new THREE.Float32BufferAttribute([],3));o.surface.geometry=empty;if(o.cloud)o.cloud.geometry=empty;}
function uploadPatch(o,m){let part=o.solidParts.get(m.key);if(!m.position.length){if(part){o.surface.remove(part.surface);if(part.cloud)o.cloud?.remove(part.cloud);part.surface.geometry.dispose();o.solidParts.delete(m.key);}return;}
 let g=part?.surface.geometry;const attrs=[['position',3],['normal',3],['uv',2],['interior',1]],reuse=g&&attrs.every(([n])=>g.getAttribute(n)?.array.length>=m[n].length);
 if(!reuse){if(g)g.dispose();g=new THREE.BufferGeometry();for(const [n,size]of attrs)g.setAttribute(n,new THREE.BufferAttribute(m[n],size).setUsage(THREE.DynamicDrawUsage));}else{for(const [n]of attrs){const a=g.getAttribute(n);a.array.set(m[n]);a.clearUpdateRanges();a.addUpdateRange(0,m[n].length);a.needsUpdate=true;}}
 g.setDrawRange(0,m.position.length/3);g.computeBoundingSphere();
 if(!part){const surface=new THREE.Mesh(g,o.surface.material);o.surface.add(surface);const cloud=o.cloud?new THREE.Mesh(g,o.cloud.material):null;if(cloud)o.cloud.add(cloud);part={surface,cloud};o.solidParts.set(m.key,part);}else{part.surface.geometry=g;if(part.cloud)part.cloud.geometry=g;}}
function drainMeshUploads(){const start=performance.now();while(meshUploads.length){const job=meshUploads[0],o=objects.get(job.id);if(o!==job.pending.o||!api.bodies.some(b=>b.id===job.id&&b.solid===job.pending.ref)){meshStats.stale++;meshUploads.shift();continue;}
 if(job.m.reset&&!job.initialized){job.target={surface:new THREE.Group(),cloud:o.cloud?new THREE.Group():null,solidParts:new Map()};job.target.surface.material=o.surface.material;if(job.target.cloud)job.target.cloud.material=o.cloud.material;job.initialized=true;}else if(!o.solidParts&&!job.target)clearSolidParts(o);
 if(job.next<job.m.patches.length){uploadPatch(job.target||o,job.m.patches[job.next++]);if(performance.now()-start>=3)break;continue;}
 if(job.target){clearSolidParts(o);o.solidParts=job.target.solidParts;for(const part of o.solidParts.values()){part.surface.material=o.surface.material;o.surface.add(part.surface);if(part.cloud)o.cloud.add(part.cloud);}}
 o.solidQuality=job.m.quality;o.solidRevision=job.pending.revision;o.solidRef=job.pending.ref;o.meshAudit={method:job.m.method,triangles:job.m.triangles,volume:job.m.volume,milliseconds:job.m.milliseconds,totalPatches:job.m.totalPatches,updatedPatches:job.m.updatedPatches,evaluated:job.m.evaluated};o.heatBorn=performance.now();if(o.cloud)o.cloud.scale.setScalar(1.001);meshStats.completed++;meshStats.updatedPatches+=job.m.updatedPatches;meshUploads.shift();
 }meshStats.uploadMs+=performance.now()-start;}
solidWorker.onmessage=e=>{const m=e.data,pending=meshBusy;if(!pending||pending.token!==m.token)return;meshBusy=null;const o=objects.get(m.id);if(!o||o!==pending.o||!api.bodies.some(b=>b.id===m.id&&b.solid===pending.ref)){meshStats.stale++;return;}if(m.error){console.error('Solid reconstruction:',m.error);return;}meshStats.workerMs+=m.milliseconds;meshStats.recent.push({id:m.id,quality:m.quality,ms:m.milliseconds,updated:m.updatedPatches,total:m.totalPatches});if(meshStats.recent.length>16)meshStats.recent.shift();meshUploads.push({id:m.id,m,pending,next:0,initialized:false});};
solidWorker.onerror=e=>{console.error('Solid worker:',e.message);meshBusy=null;meshLatest.clear();meshUploads.length=0;};
function pendingSolids(){return (meshBusy?1:0)+meshLatest.size+meshUploads.length;}
function dustGeometry(id,count=1800){let positions=[],colors=[],directions=[];for(let i=0;i<count;i++){const z=rand()*2-1,a=rand()*Math.PI*2,r=Math.cbrt(rand()),q=Math.sqrt(1-z*z);positions.push(Math.cos(a)*q*r,Math.sin(a)*q*r,z*r);const heat=.2+rand()*.8;colors.push(1*heat,.24*heat,.045*heat);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));return g;}
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
 let geometry=sphere;
 if(b.kind==='debris'||b.kind==='asteroid'){
  geometry=new THREE.IcosahedronGeometry(1,b.kind==='debris'?2:3);const pos=geometry.attributes.position;
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),noise=1+.085*Math.sin(x*13+y*7+z*19+b.id)+.04*Math.cos(x*29-z*17+b.id*.7);pos.setXYZ(i,x*noise,y*noise,z*noise)}geometry.computeVertexNormals();
  if(b.hot&&b.phase!=='gas'){mat.emissive=new THREE.Color(0xa8360c);mat.emissiveIntensity=.5;mat.userData.born=performance.now();}
  if(b.phase==='gas'){mat.transparent=true;mat.opacity=.35;mat.depthWrite=false;}
 }
 if(b.phase!=='gas'&&b.phase!=='dust'&&b.kind!=='bh'&&b.kind!=='star')decorateSolidMaterial(mat,key||b.kind);
 const surface=b.phase==='dust'?new THREE.Points(dustGeometry(b.id),new THREE.PointsMaterial({vertexColors:true,transparent:true,opacity:.8,size:Math.max(b.r*SCALE*.009,1e-7),sizeAttenuation:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false})):b.phase==='gas'?new THREE.Sprite(new THREE.SpriteMaterial({map:fogTexture,color:b.color,transparent:true,opacity:.75,depthWrite:false,toneMapped:false})):new THREE.Mesh(geometry,mat);
 if(b.phase==='gas'){surface.scale.set(3,3,1);mat.dispose();if(geometry!==sphere)geometry.dispose();}else if(b.phase==='dust'){mat.dispose();if(geometry!==sphere)geometry.dispose();}else surface.scale.z=1-(data?.flatten||0);axis.add(surface);
 let cloud=null,atm=null,ring=null,glow=null;
 if(earth){const cloudMat=new THREE.MeshPhongMaterial({map:maps.clouds,transparent:true,opacity:.58,depthWrite:false,specular:0x000000});cloudMat.onBeforeCompile=sh=>{sh.vertexShader='attribute float interior;varying float vCloudInside;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCloudInside=interior;');sh.fragmentShader='varying float vCloudInside;\n'+sh.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(vCloudInside>.01)discard;');};cloud=new THREE.Mesh(sphere,cloudMat);cloud.scale.setScalar(1.009);axis.add(cloud);}
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
 scene.add(group);const record={group,axis,surface,scarLayer:null,scarStamp:null,cloud,atm,ring,glow,earth,key,data,kind:b.kind,phase:b.phase,color:b.color,bodyRef:b,solidRevision:-1,spin:b.solidSpin||0};objects.set(b.id,record);return record;
}
// Physical angular footprints: no minimum crater size is imposed for readability.
const scarVertex=`varying vec3 localNormal;void main(){localNormal=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const scarFragment=`varying vec3 localNormal;uniform vec3 directions[8];uniform float angles[8];uniform float heats[8];void main(){vec3 n=normalize(localNormal);vec3 color=vec3(0.);float alpha=0.;for(int i=0;i<8;i++){if(angles[i]<=0.)continue;float a=acos(clamp(dot(n,directions[i]),-1.,1.))/angles[i];float inside=1.-smoothstep(.84,1.,a);float rim=smoothstep(.62,.82,a)*(1.-smoothstep(.9,1.12,a));float h=heats[i]*(1.-smoothstep(.15,.68,a));vec3 c=mix(vec3(.055,.031,.022),vec3(1.,.24,.025),h);c=mix(c,vec3(.30,.23,.17),rim*.8);float op=max(inside*.90,rim*.6);color=mix(color,c,op);alpha=max(alpha,op);}gl_FragColor=vec4(color,alpha);}`;
function updateScars(b,o,dt){
 const scars=b.scars||[];if(!scars.length){if(o.scarLayer)o.scarLayer.visible=false;return;}
 if(!o.scarLayer){const uniforms={directions:{value:Array.from({length:8},()=>new THREE.Vector3(0,0,1))},angles:{value:new Float32Array(8)},heats:{value:new Float32Array(8)}};
  o.scarLayer=new THREE.Mesh(sphere,new THREE.ShaderMaterial({uniforms,vertexShader:scarVertex,fragmentShader:scarFragment,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,toneMapped:false}));o.scarLayer.scale.setScalar(1.002);o.surface.add(o.scarLayer);
 }
 o.scarLayer.visible=true;const u=o.scarLayer.material.uniforms;
 for(let i=0;i<8;i++){const scar=scars[i];u.angles.value[i]=scar?.angle||0;if(scar){u.directions.value[i].set(scar.normal.x,scar.normal.y,scar.normal.z).normalize();if(o.scarStamp!==scars)o.scarBirth=performance.now();u.heats.value[i]=(scar.heat||0)*Math.exp(-(performance.now()-(o.scarBirth||performance.now()))/9000);}}
 o.scarStamp=scars;
}
const impactFX=[];
function clearImpacts(){for(const f of impactFX){if(f.glow){scene.remove(f.glow);f.glow.material.dispose()}scene.remove(f.points);f.points.geometry.dispose();f.points.material.dispose()}impactFX.length=0;}
function localImpactNormal(id,normal){const o=objects.get(id);if(!o)return normal;o.group.updateMatrixWorld(true);const q=o.surface.getWorldQuaternion(new THREE.Quaternion()).invert();const v=new THREE.Vector3(normal.x,normal.y,normal.z).applyQuaternion(q).normalize();return{x:v.x,y:v.y,z:v.z};}
function impact(target,normal,angle,stellar){
 sync();const center={x:target.x+normal.x*target.r,y:target.y+normal.y*target.r,z:target.z+normal.z*target.r};
 const n=new THREE.Vector3(normal.x,normal.y,normal.z),u=new THREE.Vector3(0,0,1);if(Math.abs(n.z)>.8)u.set(0,1,0);u.cross(n).normalize();const v=new THREE.Vector3().crossVectors(n,u);
 const radius=target.r*Math.min(stellar?.12:1.4,Math.max(stellar?.08:.001,angle)),count=stellar?90:140,positions=[],motion=[];
 for(let i=0;i<count;i++){const a=rand()*Math.PI*2,h=rand(),d=u.clone().multiplyScalar(Math.cos(a)*Math.sqrt(h)).addScaledVector(v,Math.sin(a)*Math.sqrt(h)).addScaledVector(n,stellar?-.7-h:.4+2*h);positions.push(0,0,0);motion.push(d.multiplyScalar(.3+rand()*1.5));}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));const material=new THREE.PointsMaterial({color:stellar?0xffcf79:0xffa25c,size:stellar?2.8:2,sizeAttenuation:false,transparent:true,opacity:1,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});const points=new THREE.Points(geometry,material);material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','float pointRadius=length(gl_PointCoord-vec2(.5))*2.;diffuseColor.a*=1.-smoothstep(.1,1.,pointRadius);\n#include <opaque_fragment>');};scene.add(points);
 let glow=null;if(stellar){glow=new THREE.Sprite(new THREE.SpriteMaterial({map:fogTexture,color:0xfff4bb,transparent:true,opacity:.95,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));scene.add(glow);}
 impactFX.push({points,glow,normal,targetRadius:target.r,center,radius,motion,age:0,stellar});
 if(impactFX.length>6){const old=impactFX.shift();if(old.glow){scene.remove(old.glow);old.glow.material.dispose()}scene.remove(old.points);old.points.geometry.dispose();old.points.material.dispose();}
}
function updateImpacts(dt){for(let i=impactFX.length-1;i>=0;i--){const f=impactFX[i];f.age+=dt;if(f.age>5){if(f.glow){scene.remove(f.glow);f.glow.material.dispose()}scene.remove(f.points);f.points.geometry.dispose();f.points.material.dispose();impactFX.splice(i,1);continue;}position(f.center.x,f.center.y,f.center.z,f.points.position);
 if(f.glow){position(f.center.x+f.normal.x*f.targetRadius*.006,f.center.y+f.normal.y*f.targetRadius*.006,f.center.z+f.normal.z*f.targetRadius*.006,f.glow.position);f.glow.scale.setScalar(f.radius*SCALE*(2+Math.sqrt(f.age)*1.5));f.glow.material.opacity=.95*Math.exp(-f.age*1.4);}
 const arr=f.points.geometry.attributes.position;for(let j=0;j<f.motion.length;j++){const d=f.motion[j],distance=f.radius*SCALE*(.1+f.age*1.3);arr.setXYZ(j,d.x*distance,d.y*distance,d.z*distance)}arr.needsUpdate=true;f.points.geometry.computeBoundingSphere();f.points.material.opacity=Math.max(0,1-f.age/5);}}
function disposeObject(o){scene.remove(o.group);o.group.traverse(n=>{if(n.geometry&&n.geometry!==sphere&&!n.isSprite)n.geometry.dispose();if(n.material)n.material.dispose()});}
let field=null,fieldKey='',potentialTime=0;
function updatePotential(bodies){$('fieldCaption').textContent='Сглаженный потенциал / высота условная · силы не изменены';let now=performance.now();if(fieldKey==='potential'&&now-potentialTime<220){if(field)field.visible=true;return}potentialTime=now;let ext=190/view.scale*SCALE,dim=40;if(fieldKey!=='potential'){if(field){scene.remove(field);field.geometry.dispose();field.material.dispose()}field=new THREE.Mesh(new THREE.PlaneGeometry(ext*2,ext*2,dim,dim),new THREE.MeshBasicMaterial({color:0x8896a8,transparent:true,opacity:.10,wireframe:true,depthWrite:false}));scene.add(field);fieldKey='potential'}let sources=[...bodies].sort((a,b)=>b.mass-a.mass).slice(0,12),max=sources[0]?.mass||1,w=55/view.scale,norm=6.283185307179586**2*max/w,amp=Number($('fieldStrength').value),pos=field.geometry.attributes.position;for(let i=0;i<pos.count;i++){let ix=i%(dim+1),iy=Math.floor(i/(dim+1)),x=-ext+ix/dim*ext*2,y=ext-iy/dim*ext*2,wx=view.cam.x+x/SCALE,wy=view.cam.y+y/SCALE,p=0;for(let b of sources)p+=39.47841760435743*b.mass/Math.sqrt((wx-b.x)**2+(wy-b.y)**2+w*w);pos.setXYZ(i,x,y,-Math.min(3,p/Math.max(1e-30,norm))*amp*45/view.scale*SCALE)}pos.needsUpdate=true;field.position.set(0,0,-view.cam.z*SCALE);field.geometry.computeBoundingSphere();field.visible=true}
function updateField(bodies){let on=$('curvature').checked;$('fieldCaption').hidden=!on;if(!on){if(field)field.visible=false;return}let bh=bodies.filter(b=>b.kind==='bh').sort((a,b)=>b.mass-a.mass)[0];if($('fieldMode').value==='potential'||!bh){updatePotential(bodies);return}let rs=bh.r,outer=Math.max(rs*14,220/view.scale),amp=Number($('fieldStrength').value),key=[bh.id,rs,outer,amp].join(':');if(key!==fieldKey){if(field){scene.remove(field);field.geometry.dispose();field.material.dispose()}let points=[];function p(r,a){return new THREE.Vector3(r*Math.cos(a)*SCALE,r*Math.sin(a)*SCALE,2*Math.sqrt(rs*Math.max(0,r-rs))*amp*SCALE)}for(let i=0;i<28;i++){let r=rs+(outer-rs)*(i/27)**2;for(let j=0;j<96;j++)points.push(p(r,j/96*Math.PI*2),p(r,(j+1)/96*Math.PI*2))}for(let j=0;j<40;j++)for(let i=0;i<40;i++)points.push(p(rs+(outer-rs)*(i/40)**2,j/40*Math.PI*2),p(rs+(outer-rs)*((i+1)/40)**2,j/40*Math.PI*2));field=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x8b9aaf,transparent:true,opacity:.16,depthWrite:false}));scene.add(field);fieldKey=key}field.visible=true;position(bh.x,bh.y,bh.z,field.position);$('fieldCaption').textContent='Срез Шварцшильда / поверхность Фламма · высота ×'+amp+' · не полная ОТО'}
let lensWasActive=false;function updateStarLensing(bodies){let holes=$('lensing').checked?bodies.filter(b=>b.kind==='bh').slice(0,3):[];if(!holes.length){if(lensWasActive){starGeo.attributes.position.array.set(starPositions);starGeo.attributes.position.needsUpdate=true;lensWasActive=false}return}lensWasActive=true;let lenses=holes.map(b=>{let p=position(b.x,b.y,b.z,new THREE.Vector3()).project(camera);return{x:(p.x*.5+.5)*view.W,y:(.5-p.y*.5)*view.H,re:window.FoundryRenderer.radius(b)*2.5}});let attr=starGeo.attributes.position;for(let i=0;i<starPositions.length;i+=3){let world=new THREE.Vector3(starPositions[i],starPositions[i+1],starPositions[i+2]).add(camera.position),ndc=world.clone().project(camera);if(ndc.z>1){attr.setXYZ(i/3,starPositions[i],starPositions[i+1],starPositions[i+2]);continue}let x=(ndc.x*.5+.5)*view.W,y=(.5-ndc.y*.5)*view.H;for(let l of lenses){let dx=x-l.x,dy=y-l.y,beta=Math.hypot(dx,dy);if(beta<.01||beta>l.re*6)continue;let outer=(beta+Math.sqrt(beta*beta+4*l.re*l.re))*.5;x=l.x+dx/beta*outer;y=l.y+dy/beta*outer}ndc.x=x/view.W*2-1;ndc.y=1-y/view.H*2;ndc.unproject(camera).sub(camera.position);attr.setXYZ(i/3,ndc.x,ndc.y,ndc.z)}attr.needsUpdate=true}
const grid=new THREE.GridHelper(100,30,0x1b2027,0x10151b);grid.rotation.x=Math.PI/2;grid.material.transparent=true;grid.material.opacity=.35;scene.add(grid);
window.FoundryRenderer={sculpt,pendingSolids,meshStats,prepareSolid,impact,localImpactNormal,clearImpacts,project(x,y,z){sync();let world=position(x,y,z,new THREE.Vector3()),behind=world.clone().applyMatrix4(camera.matrixWorldInverse).z>=0,p=world.project(camera);return {behind,x:(p.x*.5+.5)*view.W,y:(-.5*p.y+.5)*view.H,depth:p.z,k:1}},unproject(x,y,z){sync();ray.setFromCamera(new THREE.Vector2(x/view.W*2-1,1-y/view.H*2),camera);plane.constant=-(z-view.cam.z)*SCALE;let hit=ray.ray.intersectPlane(plane,new THREE.Vector3());if(!hit)return{x:view.cam.x,y:view.cam.y,z};return {x:hit.x/SCALE+view.cam.x,y:hit.y/SCALE+view.cam.y,z}},radius(b){sync();let p=position(b.x,b.y,b.z,new THREE.Vector3()),dist=Math.max(1e-10,p.distanceTo(camera.position));return visualRadius(b)*view.H/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*dist)},render(bodies,now,dt){sync();drainMeshUploads();stars.position.copy(camera.position);updateStarLensing(bodies);let star=bodies.filter(b=>b.kind==='star').sort((a,b)=>b.mass-a.mass)[0];if(star){position(star.x,star.y,star.z,sunLight.position);lightDirection.copy(sunLight.position).normalize()}else{sunLight.position.set(-5,3,5);lightDirection.copy(sunLight.position).normalize()}const ids=new Set(bodies.map(b=>b.id));for(let [id,o]of objects)if(!ids.has(id)){disposeObject(o);objects.delete(id)}fillLight.intensity=$('lightingMode').value==='inspect'?.65:.10;
 const mode=$('rotationMode').value,physicsDelta=api.time-lastPhysicsTime;lastPhysicsTime=api.time;
 if(!spinPaused)visualClock+=dt;
 for(let b of bodies){
  let o=objects.get(b.id);const key=keyFor(b);
  if(o&&(o.bodyRef!==b||o.kind!==b.kind||o.phase!==b.phase||o.color!==b.color||o.key!==key)){disposeObject(o);objects.delete(b.id);o=null;}
  if(!o)o=build(b);
  position(b.x,b.y,b.z,o.group.position);o.group.scale.setScalar(visualRadius(b));
  const d=o.data,inspecting=api.surfaceInspection?.body===b.id;
  if(inspecting&&!o.originalMaterial){o.originalMaterial=o.surface.material;o.inspectionMaterial=new THREE.MeshStandardMaterial({color:0x969c9a,roughness:.96});decorateSolidMaterial(o.inspectionMaterial,'inspection');o.surface.material=o.inspectionMaterial;}else if(!inspecting&&o.originalMaterial){o.surface.material=o.originalMaterial;o.inspectionMaterial.dispose();o.originalMaterial=null;o.inspectionMaterial=null;}
  if(o.cloud)o.cloud.visible=!inspecting;if(o.atm&&inspecting)o.atm.visible=false;if(b.phase==='dust')o.group.visible=!api.surfaceInspection;else o.group.visible=true;
  if(!spinPaused&&!b.solidLock&&b.phase!=='dust'){
   const delta=mode==='physical'?(physicsDelta>=0?physicsDelta:0)*365.25*24/Math.abs(d?.hours||24)*Math.PI*2:dt/(d?.period||40)*Math.PI*2;
   o.spin=(o.spin+delta)%(Math.PI*2);
  }
  o.surface.rotation.z=o.spin+(o.earth?2.3:.5);
  if(o.surface.material.userData.born)o.surface.material.emissiveIntensity=.08+.55*Math.exp(-(performance.now()-o.surface.material.userData.born)/13000);
  if(b.phase==='dust'){
   const age=Math.max(0,api.time-(b.born||0)),extent=b.r*1.1+Math.min(b.r*180,age*(b.spread||0));o.group.scale.setScalar(1);o.surface.scale.setScalar(extent*SCALE);o.surface.material.size=Math.max(b.r*SCALE*.012,1e-7);o.surface.material.opacity=Math.max(.12,.8/(1+age*(b.spread||0)/Math.max(b.r,1e-30)*.05));
  }else{
   b.solidSpin=o.spin;o.group.updateMatrixWorld(true);const q=o.surface.getWorldQuaternion(new THREE.Quaternion());b.solidQuaternion=[q.x,q.y,q.z,q.w];
   if(b.solid?.cuts.length){sculpt(b);if(o.atm&&b.solid.cuts.some(c=>!c.crater||c.angle>.05))o.atm.visible=false;}
  }
  if(o.solidParts)for(const part of o.solidParts.values())part.surface.material=o.surface.material;
  if(o.surface.material.userData.solidShader)o.surface.material.userData.solidShader.uniforms.solidHeat.value=inspecting?0:.004+.065*Math.exp(-(performance.now()-(o.heatBorn||0))/10000);
  if(o.cloud)o.cloud.rotation.z=b.solid?.cuts.length?o.surface.rotation.z:o.spin*1.025+2.32;
  if(o.atm)o.atm.material.uniforms.lightDir.value.copy(sunLight.position).sub(o.group.position).normalize();
  if(o.surface.material.userData.shader)o.surface.material.userData.shader.uniforms.toSun.value.copy(sunLight.position);
  const rs=o.ring?.material.userData.shader;if(rs){rs.uniforms.planetCenter.value.copy(o.group.position);rs.uniforms.solarPosition.value.copy(sunLight.position);rs.uniforms.planetRadius.value=o.group.scale.x;}
 }
 inspectLight.intensity=api.surfaceInspection?4.5:0;if(api.surfaceInspection){inspectLight.position.copy(camera.position);inspectLight.target.position.set(0,0,0);fillLight.intensity=.85;}else fillLight.intensity=$('lightingMode').value==='inspect'?.65:.10;
 pumpMeshes(now);if($('meshStatus'))$('meshStatus').hidden=!pendingSolids();
 updateImpacts(dt);
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
 document.querySelector('.viewport-label').style.visibility=api.surfaceInspection?'hidden':'visible';
 const caption=document.querySelector('.planet-caption');caption.hidden=!d||!!api.surfaceInspection||api.following!==selected?.id;
 if(d){$('planetKicker').textContent=String(Object.keys(planetData).indexOf(key)).padStart(2,'0')+' / '+d.latin;$('planetSubtitle').textContent=selected.solid?.cuts.length?'Поверхность изменена объёмным контактом.':d.tag;const retro=d.hours<0?' · обратное вращение':'';$('planetFacts').textContent='Наклон '+d.tilt.toLocaleString('ru-RU')+'° · оборот '+Math.abs(d.hours).toLocaleString('ru-RU',{maximumFractionDigits:2})+' ч'+retro;}
 const distance=view.H/(2*Math.tan(21*Math.PI/180)*view.scale)*149597870.7;
 const radius=api.following===selected?.id?selected.r*149597870.7:0;
 const height=Math.max(0,distance-radius);$('cameraDistance').textContent=(radius?'Над поверхностью · ':'До центра кадра · ')+(height>14959787?(height/149597870.7).toLocaleString('ru-RU',{maximumFractionDigits:2})+' а.е.':Math.round(height).toLocaleString('ru-RU')+' км');
}

$('impactOffset').oninput=()=>{$('impactOffsetValue').textContent=Number($('impactOffset').value).toLocaleString('ru-RU',{maximumFractionDigits:2})};
