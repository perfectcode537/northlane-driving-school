/* Northlane: the 3D showroom. The learner car turns as you scroll, and you can drag it round. */
(function () {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  function Showroom(canvas, opts) {
    this.canvas = canvas;
    this.hotspots = opts.hotspots || [];
    this.target = 0; this.p = 0;
    this.drag = 0; this.dragV = 0; this.down = false;
    this.visible = false;
    this.build();
    this.resize();
    addEventListener('resize', () => this.resize());
    canvas.addEventListener('pointerdown', e => { this.down = true; this.lastX = e.clientX; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => { if (!this.down) return; const dx = e.clientX - this.lastX; this.lastX = e.clientX; this.dragV = dx * 0.006; this.drag += this.dragV; });
    const up = () => { this.down = false; };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    this.clock = new THREE.Clock();
    const loop = () => { requestAnimationFrame(loop); if (this.visible) this.frame(); };
    loop();
  }

  Showroom.prototype.build = function () {
    const r = this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    r.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.1;
    const scene = this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

    // studio reflections: a dark room with three softboxes
    const env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.BoxGeometry(30, 30, 30), new THREE.MeshBasicMaterial({ color: '#0d1320', side: THREE.BackSide })));
    const box = (w, h, pos, c) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); m.position.copy(pos); m.lookAt(0, 0, 0); env.add(m); };
    box(14, 3, V(0, 12, 0), '#ffffff');
    box(6, 10, V(-12, 4, 4), '#fff1d6');
    box(6, 10, V(12, 4, -4), '#cfe0ff');
    box(20, 1.2, V(0, 3, -13), '#ffc531');
    const pmrem = new THREE.PMREMGenerator(r);
    scene.environment = pmrem.fromScene(env, 0.04).texture;

    scene.add(new THREE.HemisphereLight('#ffffff', '#1b2538', 0.35));
    const key = new THREE.SpotLight('#fff3e0', 2.2, 40, 0.6, 0.6);
    key.position.set(4, 9, 5); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004;
    scene.add(key, key.target);
    const rim = new THREE.DirectionalLight('#ffc531', 0.9); rim.position.set(-6, 3, -6); scene.add(rim);

    // the floor: a soft round stage that fades into the page
    const floorMat = new THREE.MeshStandardMaterial({ color: '#121a2a', roughness: 0.35, metalness: 0.2, transparent: true });
    floorMat.alphaMap = this.radialTexture();
    const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 64), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const ring = new THREE.Mesh(new THREE.RingGeometry(3.6, 3.64, 96), new THREE.MeshBasicMaterial({ color: '#ffc531', transparent: true, opacity: 0.5 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.005; scene.add(ring);
    this.ring = ring;

    this.car = this.makeCar(); scene.add(this.car);
  };

  Showroom.prototype.radialTexture = function () {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'), grd = g.createRadialGradient(128, 128, 20, 128, 128, 128);
    grd.addColorStop(0, '#fff'); grd.addColorStop(0.55, '#888'); grd.addColorStop(1, '#000');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  };

  Showroom.prototype.makeCar = function () {
    const car = new THREE.Group();
    const paint = new THREE.MeshPhysicalMaterial({ color: '#ffc531', metalness: 0.35, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08 });
    const black = new THREE.MeshStandardMaterial({ color: '#0d1118', roughness: 0.5, metalness: 0.3 });
    const glass = new THREE.MeshPhysicalMaterial({ color: '#0b1220', metalness: 0.9, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.92 });
    const chrome = new THREE.MeshStandardMaterial({ color: '#d9dde3', metalness: 1, roughness: 0.18 });
    const W = 1.78;
    const extrude = (pts, depth, bevel) => {
      const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(p => s.lineTo(p[0], p[1]));
      const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 5, curveSegments: 12 });
      g.translate(0, 0, -depth / 2); return g;
    };
    // lower body, side profile (x = length, y = height)
    const body = new THREE.Mesh(extrude([[-2.05, 0.42], [2.0, 0.42], [2.12, 0.62], [2.08, 0.86], [1.7, 0.98], [0.8, 1.06], [-1.75, 1.06], [-2.1, 0.98], [-2.14, 0.6]], W - 0.24, 0.12), paint);
    body.castShadow = true; car.add(body);
    // glasshouse
    const cabin = new THREE.Mesh(extrude([[0.8, 1.04], [0.12, 1.52], [-1.1, 1.54], [-1.72, 1.08]], W - 0.42, 0.1), glass);
    cabin.castShadow = true; car.add(cabin);
    // roof panel and pillars in paint
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, W - 0.2), paint); roof.position.set(-0.48, 1.62, 0); car.add(roof);
    // skirts and bumpers
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.14, W + 0.02), black); skirt.position.y = 0.36; car.add(skirt);
    // wheels with rims
    this.wheels = [];
    const tireG = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 40), rimG = new THREE.CylinderGeometry(0.26, 0.26, 0.31, 6), hubG = new THREE.CylinderGeometry(0.08, 0.08, 0.33, 16);
    const tireM = new THREE.MeshStandardMaterial({ color: '#0a0c10', roughness: 0.85 });
    [[1.3, 1], [1.3, -1], [-1.35, 1], [-1.35, -1]].forEach(([x, sz]) => {
      const w = new THREE.Group();
      const t = new THREE.Mesh(tireG, tireM); t.castShadow = true; w.add(t);
      const rm = new THREE.Mesh(rimG, chrome); w.add(rm);
      w.add(new THREE.Mesh(hubG, paint));
      w.rotation.x = Math.PI / 2; w.position.set(x, 0.4, sz * (W / 2 - 0.02));
      car.add(w); this.wheels.push(w);
      const arch = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.05, 8, 24, Math.PI), black);
      arch.position.set(x, 0.42, sz * (W / 2 + 0.01)); car.add(arch);
    });
    // lights
    const head = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff6dc', emissiveIntensity: 2.2 });
    const tail = new THREE.MeshStandardMaterial({ color: '#ff2d2d', emissive: '#ff1a1a', emissiveIntensity: 1.6 });
    [-1, 1].forEach(sz => {
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.42), head); h.position.set(2.1, 0.8, sz * 0.58); h.rotation.z = -0.35; car.add(h);
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.46), tail); t.position.set(-2.16, 0.86, sz * 0.56); car.add(t);
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.2), paint); m.position.set(0.62, 1.12, sz * (W / 2 + 0.06)); car.add(m);
    });
    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 1.0), black); grille.position.set(2.13, 0.6, 0); car.add(grille);
    // roof sign: tells other drivers to give you space
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const g = c.getContext('2d'); g.fillStyle = '#0a0f1a'; g.fillRect(0, 0, 512, 128);
    g.fillStyle = '#fff'; g.fillRect(14, 14, 100, 100); g.fillStyle = '#d6302b'; g.font = 'bold 92px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('L', 64, 70);
    g.fillStyle = '#ffc531'; g.font = '600 52px "Inter Tight", sans-serif'; g.textAlign = 'left'; g.fillText('NORTHLANE', 136, 68);
    const signTex = new THREE.CanvasTexture(c);
    const signMat = [black, black, black, black, new THREE.MeshStandardMaterial({ map: signTex, emissive: '#ffffff', emissiveMap: signTex, emissiveIntensity: 0.5 }), new THREE.MeshStandardMaterial({ map: signTex, emissive: '#ffffff', emissiveMap: signTex, emissiveIntensity: 0.5 })];
    const sign = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.28, 0.08), signMat);
    sign.position.set(-0.45, 1.82, 0); car.add(sign);
    car.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return car;
  };

  Showroom.prototype.resize = function () {
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.fov = w < 700 ? 44 : 30; this.camera.updateProjectionMatrix();
  };

  Showroom.prototype.setProgress = function (p) { this.target = clamp(p, 0, 1); };

  Showroom.prototype.frame = function () {
    const dt = Math.min(this.clock.getDelta(), 0.05), t = this.clock.elapsedTime;
    this.p += (this.target - this.p) * (1 - Math.pow(0.002, dt));
    if (!this.down) { this.dragV *= 0.94; this.drag += this.dragV; }
    const p = this.p;
    // the car turns a full lap and a bit as you scroll; drag adds your own spin
    this.car.rotation.y = -0.7 + p * Math.PI * 2.2 + this.drag;
    this.wheels.forEach(w => { w.rotation.y += dt * 2; });
    this.ring.material.opacity = 0.35 + Math.sin(t * 2) * 0.15;
    // camera: low and close at the start, rising to a hero three-quarter view
    // narrow screens need the camera further back so the whole car fits
    const fit = this.camera.aspect < 1 ? 0.72 / this.camera.aspect : 1;
    const dist = lerp(9.5, 12.5, Math.sin(p * Math.PI)) * Math.min(fit, 1.7);
    const h = lerp(1.2, 3.4, p);
    this.camera.position.set(Math.sin(0.5) * dist, h, Math.cos(0.5) * dist);
    this.camera.lookAt(0, 0.85, 0);
    this.renderer.render(this.scene, this.camera);
    // hotspots: project points on the car to the screen
    const w = this.canvas.clientWidth, hgt = this.canvas.clientHeight;
    // on narrow screens only one label shows at a time, so they never pile up
    const single = w < 760, slot = Math.min(this.hotspots.length - 1, Math.floor(p * this.hotspots.length));
    this.hotspots.forEach((hs, i) => {
      const v = hs.local.clone().applyMatrix4(this.car.matrixWorld).project(this.camera);
      const facing = hs.normal.clone().applyQuaternion(this.car.quaternion).dot(this.camera.position.clone().normalize()) > -0.1;
      hs.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * hgt}px)`;
      hs.el.classList.toggle('is-on', facing && p >= hs.from && p <= hs.to && (!single || i === slot));
    });
  };

  window.Showroom = Showroom;
})();
