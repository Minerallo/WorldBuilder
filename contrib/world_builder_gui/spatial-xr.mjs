import * as THREE from "/vendor/three/build/three.module.js";

const FEATURE_COLORS={
  "continental plate":0xe8a851,"oceanic plate":0x36a4c2,"subducting plate":0x7357e8,
  fault:0xe36359,"mantle layer":0x9b72d0,plume:0xe45239
};

function prismGeometry(points,top,bottom) {
  if (points.length<3) return null;
  const positions=[];const indices=[];const count=points.length;
  points.forEach(([x,z])=>positions.push(x,top,z));points.forEach(([x,z])=>positions.push(x,bottom,z));
  for(let i=1;i<count-1;i++){indices.push(0,i,i+1,count,count+i+1,count+i);}
  for(let i=0;i<count;i++){const next=(i+1)%count;indices.push(i,next,count+next,i,count+next,count+i);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

function sphericalPoint(lon,lat,radius){const lambda=lon*Math.PI/180,phi=lat*Math.PI/180,c=Math.cos(phi);return new THREE.Vector3(radius*c*Math.cos(lambda),radius*Math.sin(phi),radius*c*Math.sin(lambda));}

function sphericalPatch(points,outer,inner){
  if(points.length<3)return null;const positions=[];const indices=[];const count=points.length;
  points.forEach(point=>positions.push(...sphericalPoint(point[0],point[1],outer)));
  points.forEach(point=>positions.push(...sphericalPoint(point[0],point[1],inner)));
  for(let i=1;i<count-1;i++){indices.push(0,i,i+1,count,count+i+1,count+i);}
  for(let i=0;i<count;i++){const next=(i+1)%count;indices.push(i,next,count+next,i,count+next,count+i);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

export class SpatialXRPreview{
  constructor({dialog,canvas,status,enterButton}){
    this.dialog=dialog;this.canvas=canvas;this.status=status;this.enterButton=enterButton;
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});this.renderer.setPixelRatio(Math.min(2,devicePixelRatio||1));this.renderer.xr.enabled=true;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x071015);
    this.camera=new THREE.PerspectiveCamera(48,1,.01,100);this.camera.position.set(0,2.2,5.2);
    this.scene.add(new THREE.HemisphereLight(0xccefff,0x1b2028,1.45));const light=new THREE.DirectionalLight(0xffffff,1.8);light.position.set(4,7,5);this.scene.add(light);
    this.model=new THREE.Group();this.model.position.y=.8;this.scene.add(this.model);
    this.handMeshes={};this.lastPinches=null;this.orbit={yaw:0,pitch:.22,distance:5.2,drag:null};
    this.bindDesktopNavigation();this.renderer.setAnimationLoop((time,frame)=>this.render(frame));
    new ResizeObserver(()=>this.resize()).observe(dialog);
  }

  bindDesktopNavigation(){
    this.canvas.addEventListener("pointerdown",event=>{this.orbit.drag={x:event.clientX,y:event.clientY};this.canvas.setPointerCapture(event.pointerId);});
    this.canvas.addEventListener("pointermove",event=>{if(!this.orbit.drag)return;this.orbit.yaw+=(event.clientX-this.orbit.drag.x)*.008;this.orbit.pitch=Math.max(-1.2,Math.min(1.2,this.orbit.pitch+(event.clientY-this.orbit.drag.y)*.006));this.orbit.drag={x:event.clientX,y:event.clientY};});
    const release=event=>{this.orbit.drag=null;if(this.canvas.hasPointerCapture(event.pointerId))this.canvas.releasePointerCapture(event.pointerId);};
    this.canvas.addEventListener("pointerup",release);this.canvas.addEventListener("pointercancel",release);
    this.canvas.addEventListener("wheel",event=>{event.preventDefault();this.orbit.distance=Math.max(2.4,Math.min(10,this.orbit.distance*Math.exp(event.deltaY*.001)));},{passive:false});
  }

  async capability(){
    if(!navigator.xr?.isSessionSupported)return false;
    try{return await navigator.xr.isSessionSupported("immersive-vr");}catch{return false;}
  }

  clear(){
    while(this.model.children.length){
      const child=this.model.children[0];
      this.model.remove(child);
      child.geometry?.dispose?.();
      child.material?.dispose?.();
    }
  }

  load(features,settings){
    this.clear();const spherical=settings.coordinateSystem==="spherical";const xSpan=Math.max(1,settings.xMax-settings.xMin),ySpan=Math.max(1,settings.yMax-settings.yMin),depthSpan=Math.max(1,settings.zMax-settings.zMin);
    const project=point=>[(point[0]-(settings.xMin+settings.xMax)/2)/Math.max(xSpan,ySpan)*4,(point[1]-(settings.yMin+settings.yMax)/2)/Math.max(xSpan,ySpan)*4];
    if(spherical){const globe=new THREE.Mesh(new THREE.SphereGeometry(1.95,64,32),new THREE.MeshStandardMaterial({color:0x15303a,roughness:.8,metalness:.05,transparent:true,opacity:.62}));this.model.add(globe);}
    else{const grid=new THREE.GridHelper(5,20,0x46616a,0x263940);grid.position.y=.02;this.model.add(grid);}
    features.forEach(feature=>{
      const color=FEATURE_COLORS[feature.model]||0x68bba9;let geometry=null;
      const thickness=Math.max(.035,Math.min(.8,Number(feature.thickness||feature.maxDepth-feature.minDepth||depthSpan*.1)/depthSpan*2.3));
      if(feature.model==="plume"){
        const center=spherical?sphericalPoint(feature.points[0][0],feature.points[0][1],1.82):new THREE.Vector3(...[project(feature.points[0])[0],-.35,project(feature.points[0])[1]]);
        const radius=Math.max(.08,Math.min(.45,Number(feature.semiMajorAxis||xSpan*.04)/Math.max(xSpan,ySpan)*4));
        const mesh=new THREE.Mesh(new THREE.SphereGeometry(radius,24,16),new THREE.MeshStandardMaterial({color,transparent:true,opacity:.78,roughness:.58}));mesh.position.copy(center);this.model.add(mesh);return;
      }
      if(feature.points.length>=3 && feature.model!=="subducting plate"&&feature.model!=="fault")geometry=spherical?sphericalPatch(feature.points,1.99,Math.max(1.1,1.99-thickness)):prismGeometry(feature.points.map(project),0,-thickness);
      if(geometry){const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:.76,roughness:.68,metalness:.04}));this.model.add(mesh);}
      const linePoints=feature.points.map(point=>spherical?sphericalPoint(point[0],point[1],2.015):new THREE.Vector3(project(point)[0],.025,project(point)[1]));
      if(linePoints.length>=2){const LineClass=feature.model==="subducting plate"||feature.model==="fault"?THREE.Line:THREE.LineLoop;const line=new LineClass(new THREE.BufferGeometry().setFromPoints(linePoints),new THREE.LineBasicMaterial({color,transparent:true,opacity:.95}));this.model.add(line);}
    });
    if(!features.length){const placeholder=new THREE.Mesh(new THREE.IcosahedronGeometry(1.2,2),new THREE.MeshStandardMaterial({color:0x31515b,wireframe:true}));this.model.add(placeholder);}
  }

  open(features,settings){this.load(features,settings);if(!this.dialog.open)this.dialog.showModal();this.resize();this.status.textContent=`${features.length} feature${features.length===1?"":"s"} in the true 3D scene · drag to orbit · wheel to zoom`;}

  async enterXR(){
    if(!await this.capability())throw new Error("Immersive VR is not available in this browser or device.");
    const session=await navigator.xr.requestSession("immersive-vr",{optionalFeatures:["local-floor","hand-tracking"]});
    session.addEventListener("end",()=>{this.lastPinches=null;this.status.textContent="XR session ended · desktop 3D preview remains open";});
    await this.renderer.xr.setSession(session);this.status.textContent="XR active · pinch one hand to move, two hands to scale and rotate the model";
  }

  updateXRHands(frame){
    if(!frame)return;const session=this.renderer.xr.getSession(),reference=this.renderer.xr.getReferenceSpace();if(!session||!reference)return;
    Object.values(this.handMeshes).forEach(hand=>Object.values(hand).forEach(mesh=>{mesh.visible=false;}));
    const pinches=[];
    for(const source of session.inputSources){if(!source.hand)continue;const handedness=source.handedness||"none";this.handMeshes[handedness]||={};
      for(const [name,joint] of source.hand.entries()){const pose=frame.getJointPose(joint,reference);if(!pose)continue;let mesh=this.handMeshes[handedness][name];if(!mesh){mesh=new THREE.Mesh(new THREE.SphereGeometry(.008,8,6),new THREE.MeshBasicMaterial({color:handedness==="left"?0x5be0c1:0xf2c85f}));this.scene.add(mesh);this.handMeshes[handedness][name]=mesh;}mesh.position.set(pose.transform.position.x,pose.transform.position.y,pose.transform.position.z);mesh.visible=true;}
      const thumb=frame.getJointPose(source.hand.get("thumb-tip"),reference),index=frame.getJointPose(source.hand.get("index-finger-tip"),reference);if(thumb&&index){const a=new THREE.Vector3(thumb.transform.position.x,thumb.transform.position.y,thumb.transform.position.z),b=new THREE.Vector3(index.transform.position.x,index.transform.position.y,index.transform.position.z);if(a.distanceTo(b)<.035)pinches.push(a.add(b).multiplyScalar(.5));}
    }
    if(pinches.length===1&&this.lastPinches?.length===1)this.model.position.add(pinches[0].clone().sub(this.lastPinches[0]));
    if(pinches.length>=2&&this.lastPinches?.length>=2){const oldDistance=this.lastPinches[0].distanceTo(this.lastPinches[1]),newDistance=pinches[0].distanceTo(pinches[1]);if(oldDistance>.01)this.model.scale.multiplyScalar(Math.max(.92,Math.min(1.08,newDistance/oldDistance)));const oldVector=this.lastPinches[1].clone().sub(this.lastPinches[0]),newVector=pinches[1].clone().sub(pinches[0]);this.model.rotateY(Math.atan2(newVector.x,newVector.z)-Math.atan2(oldVector.x,oldVector.z));}
    this.lastPinches=pinches;
  }

  resize(){const rect=this.canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;this.renderer.setSize(rect.width,rect.height,false);this.camera.aspect=rect.width/rect.height;this.camera.updateProjectionMatrix();}
  render(frame){if(!this.dialog.open)return;this.updateXRHands(frame);if(!this.renderer.xr.isPresenting){const cp=Math.cos(this.orbit.pitch);this.camera.position.set(Math.sin(this.orbit.yaw)*cp*this.orbit.distance,1+Math.sin(this.orbit.pitch)*this.orbit.distance,Math.cos(this.orbit.yaw)*cp*this.orbit.distance);this.camera.lookAt(0,.45,0);}this.model.rotation.y+=this.renderer.xr.isPresenting?0:.0006;this.renderer.render(this.scene,this.camera);}
  close(){if(this.renderer.xr.getSession())this.renderer.xr.getSession().end();this.dialog.close();}
}
