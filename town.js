/* Northlane: the 3D town. The learner car drives the first-lesson route as you scroll. */
(function () {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  // scroll progress → route progress; the car almost stops around the stop sign
  const KEYS = [[0, 0], [0.5, 0.55], [0.6, 0.565], [1, 1]];
  function routeOf(p) {
    for (let i = 1; i < KEYS.length; i++) {
      if (p <= KEYS[i][0]) {
        const [p0, r0] = KEYS[i - 1], [p1, r1] = KEYS[i];
        return lerp(r0, r1, (p - p0) / (p1 - p0));
      }
    }
    return 1;
  }

  function Town(canvas, opts) {
    this.canvas = canvas;
    this.onSpeed = opts.onSpeed || (() => {});
    this.target = 0; this.p = 0; this.prevRoute = 0; this.speed = 0;
    this.visible = false;
    this.mouse = { x: 0, y: 0 };
    this.build();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('pointermove', e => {
      this.mouse.x = e.clientX / innerWidth - 0.5;
      this.mouse.y = e.clientY / innerHeight - 0.5;
    });
    this.clock = new THREE.Clock();
    const loop = () => { requestAnimationFrame(loop); if (this.visible) this.frame(); };
    loop();
  }

  Town.prototype.build = function () {
    const r = this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    r.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.1;

    const scene = this.scene = new THREE.Scene();
    const sky = new THREE.Color('#efe9dc');
    scene.background = sky;
    scene.fog = new THREE.Fog(sky, 70, 160);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
    this.camera.position.set(0, 60, 60);
    this.camLook = V(0, 0, 0);

    // sky, haze and light: a sunny morning
    scene.add(new THREE.HemisphereLight('#ffffff', '#9fb38a', 0.75));
    const sun = this.sun = new THREE.DirectionalLight('#fff3dc', 1.35);
    sun.position.set(-30, 50, 25);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 140 });
    sun.shadow.bias = -0.0005;
    scene.add(sun, sun.target);

    const mat = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.85, metalness: 0 }, o));

    // ground
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), mat('#8fb06a'));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    scene.add(ground);

    // the lesson loop
    const pts = [[-20, -12], [0, -14], [20, -12], [26, 0], [20, 12], [0, 14], [-20, 12], [-26, 0]].map(([x, z]) => V(x, 0, z));
    const curve = this.curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    const N = 600, W = 1.7;
    const samples = curve.getSpacedPoints(N);
    this.samples = samples;
    const pos = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const p = samples[i % N], t = curve.getTangentAt((i % N) / N);
      const s = V(-t.z, 0, t.x).normalize().multiplyScalar(W);
      pos.push(p.x + s.x, 0.02, p.z + s.z, p.x - s.x, 0.02, p.z - s.z);
      if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const roadGeo = new THREE.BufferGeometry();
    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    roadGeo.setIndex(idx); roadGeo.computeVertexNormals();
    const roadMat = mat('#2f3644', { side: THREE.DoubleSide });
    const road = new THREE.Mesh(roadGeo, roadMat); road.receiveShadow = true; scene.add(road);

    // kerb + dashed centre line
    const dash = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.03, 0.12), mat('#f3efe6'), 120);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = V(1, 1, 1);
    for (let i = 0; i < 120; i++) {
      const u = i / 120, p = curve.getPointAt(u), t = curve.getTangentAt(u);
      q.setFromUnitVectors(V(1, 0, 0), t);
      m4.compose(V(p.x, 0.04, p.z), q, sc); dash.setMatrixAt(i, m4);
    }
    scene.add(dash);

    // the school: lot, building, sign
    const lotC = this.lot = V(-9, 0, -21.5);
    const lot = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), mat('#4a5262'));
    lot.rotation.x = -Math.PI / 2; lot.position.set(lotC.x, 0.03, lotC.z); lot.receiveShadow = true; scene.add(lot);
    for (let i = 0; i < 5; i++) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 2.6), mat('#f3efe6'));
      line.rotation.x = -Math.PI / 2; line.position.set(lotC.x - 5 + i * 2.5, 0.04, lotC.z - 2.2); scene.add(line);
    }
    const drive = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 6), mat('#3a4150'));
    drive.rotation.x = -Math.PI / 2; drive.position.set(lotC.x + 2, 0.025, lotC.z + 5); scene.add(drive);

    const school = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(14, 5, 6), mat('#f3efe6'));
    body.position.y = 2.5; body.castShadow = body.receiveShadow = true; school.add(body);
    const band = new THREE.Mesh(new THREE.BoxGeometry(14.2, 0.6, 6.2), mat('#ffc531'));
    band.position.y = 5.1; school.add(band);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(9, 2.4, 0.1), mat('#22324a', { roughness: 0.2, metalness: 0.4 }));
    glass.position.set(0, 1.6, 3.02); school.add(glass);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.5), new THREE.MeshBasicMaterial({ map: this.signTexture(), transparent: true }));
    sign.position.set(0, 3.8, 3.06); school.add(sign);
    school.position.set(lotC.x, 0, lotC.z - 8); scene.add(school);

    // roundabout around the east bend
    const rbC = this.rb = V(31, 0, 0);
    const ring = new THREE.Mesh(new THREE.RingGeometry(3.4, 6.8, 64), roadMat);
    ring.rotation.x = -Math.PI / 2; ring.position.set(rbC.x, 0.021, rbC.z); ring.receiveShadow = true; scene.add(ring);
    const island = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.6, 0.35, 48), mat('#8fb56b'));
    island.position.set(rbC.x, 0.17, rbC.z); island.receiveShadow = true; scene.add(island);
    const kerb = new THREE.Mesh(new THREE.TorusGeometry(3.5, 0.12, 8, 64), mat('#f3efe6'));
    kerb.rotation.x = Math.PI / 2; kerb.position.set(rbC.x, 0.3, rbC.z); scene.add(kerb);

    // pond and park in the middle of town
    const pond = new THREE.Mesh(new THREE.CircleGeometry(5.5, 48), mat('#6fa9c9', { roughness: 0.15, metalness: 0.2 }));
    pond.rotation.x = -Math.PI / 2; pond.position.set(2, 0.03, 1); scene.add(pond);

    // houses and trees, kept clear of the road, the lot and the roundabout
    const clearOf = (x, z, d) => {
      for (let i = 0; i < N; i += 4) { const s = samples[i]; if ((s.x - x) ** 2 + (s.z - z) ** 2 < d * d) return false; }
      if (Math.abs(x - lotC.x) < 10 && Math.abs(z - (lotC.z - 3)) < 10) return false;
      if ((x - rbC.x) ** 2 + z * z < 100) return false;
      if ((x - 2) ** 2 + (z - 1) ** 2 < 49) return false;
      return true;
    };
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const houses = [], trees = [];
    for (let x = -70; x <= 70; x += 6.5) for (let z = -55; z <= 55; z += 6.5) {
      const jx = x + (rnd() - 0.5) * 3, jz = z + (rnd() - 0.5) * 3;
      if (!clearOf(jx, jz, 5.2)) continue;
      const k = rnd();
      if (k < 0.38) houses.push([jx, jz, rnd()]); else if (k < 0.85) trees.push([jx, jz, rnd()]);
    }
    const palette = ['#f3efe6', '#e9c9a8', '#cfd9e0', '#f1d78a', '#d7b8b0', '#bfcfb5'].map(c => new THREE.Color(c));
    const roofCol = ['#3d4a5e', '#a5513f', '#59606b'].map(c => new THREE.Color(c));
    const hBody = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat('#ffffff', { map: this.windowTexture() }), houses.length);
    const hRoof = new THREE.InstancedMesh(new THREE.ConeGeometry(0.8, 1, 4), mat('#ffffff'), houses.length);
    hBody.castShadow = hBody.receiveShadow = hRoof.castShadow = true;
    houses.forEach(([x, z, k], i) => {
      const w = 2.6 + k * 1.6, h = 2 + k * 2.2, d = 2.4 + (1 - k) * 1.4, rot = Math.round(k * 3) * Math.PI / 2;
      q.setFromAxisAngle(V(0, 1, 0), rot);
      m4.compose(V(x, h / 2, z), q, V(w, h, d)); hBody.setMatrixAt(i, m4);
      hBody.setColorAt(i, palette[Math.floor(k * 997) % palette.length]);
      q.setFromAxisAngle(V(0, 1, 0), rot + Math.PI / 4);
      m4.compose(V(x, h + 0.7, z), q, V(w * 0.95, 1.4, d * 0.95)); hRoof.setMatrixAt(i, m4);
      hRoof.setColorAt(i, roofCol[Math.floor(k * 331) % roofCol.length]);
    });
    scene.add(hBody, hRoof);

    const treeCols = ['#5f8f4e', '#4f7d45', '#78a35a', '#3f6b3e'].map(c => new THREE.Color(c));
    const extra = [];
    for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2; extra.push([2 + Math.cos(a) * 8.5, 1 + Math.sin(a) * 8.5, rnd()]); }
    const allTrees = trees.concat(extra);
    const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), mat('#ffffff', { flatShading: true }), allTrees.length);
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.16, 1, 6), mat('#7a5a40'), allTrees.length);
    crown.castShadow = trunk.castShadow = true;
    allTrees.forEach(([x, z, k], i) => {
      const s = 0.9 + k * 0.9;
      m4.compose(V(x, 0.6 * s, z), new THREE.Quaternion(), V(1, 1.2 * s, 1)); trunk.setMatrixAt(i, m4);
      q.setFromEuler(new THREE.Euler(k, k * 3, 0));
      m4.compose(V(x, 1.6 * s, z), q, V(s, s * 1.15, s)); crown.setMatrixAt(i, m4);
      crown.setColorAt(i, treeCols[Math.floor(k * 101) % treeCols.length]);
    });
    scene.add(crown, trunk);

    // street furniture: stop sign, traffic light, lamps
    const stopU = this.stopU = 0.62;
    const sp = curve.getPointAt(stopU), st = curve.getTangentAt(stopU), side = V(-st.z, 0, st.x).normalize();
    const pole = (h) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, h, 8), mat('#cfd3d8', { metalness: 0.6, roughness: 0.4 })); m.position.y = h / 2; m.castShadow = true; return m; };
    const stop = new THREE.Group();
    stop.add(pole(2.4));
    const oct = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.06, 8), mat('#d6302b'));
    oct.rotation.x = Math.PI / 2; oct.rotation.y = Math.PI / 8; oct.position.y = 2.5; stop.add(oct);
    stop.position.copy(sp).addScaledVector(side, 2.4); stop.lookAt(stop.position.clone().sub(st));
    scene.add(stop);
    const stopLine = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.03, W * 2), mat('#f3efe6'));
    stopLine.position.set(sp.x, 0.05, sp.z); stopLine.lookAt(V(sp.x + st.x, 0.05, sp.z + st.z)); stopLine.rotateY(Math.PI / 2);
    scene.add(stopLine);

    const tlU = 0.21, tp = curve.getPointAt(tlU), tt = curve.getTangentAt(tlU), ts = V(-tt.z, 0, tt.x).normalize();
    const tl = new THREE.Group(); tl.add(pole(3));
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.4, 0.4), mat('#1b2538')); box.position.y = 3.4; box.castShadow = true; tl.add(box);
    this.lights = ['#ff4d3d', '#ffc531', '#3ddc97'].map((c, i) => {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), new THREE.MeshBasicMaterial({ color: c }));
      l.position.set(0, 3.85 - i * 0.44, 0.21); tl.add(l); return l;
    });
    tl.position.copy(tp).addScaledVector(ts, 2.4); tl.lookAt(tl.position.clone().sub(tt));
    scene.add(tl);

    for (let i = 0; i < 16; i++) {
      const u = (i + 0.5) / 16, p = curve.getPointAt(u), t = curve.getTangentAt(u), s = V(-t.z, 0, t.x).normalize();
      const lamp = new THREE.Group(); lamp.add(pole(3.2));
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), new THREE.MeshBasicMaterial({ color: '#fff6dc' })); head.position.y = 3.3; lamp.add(head);
      lamp.position.copy(p).addScaledVector(s, -2.6); scene.add(lamp);
    }

    // clouds
    this.clouds = [];
    const cloudMat = mat('#ffffff', { roughness: 1 });
    for (let i = 0; i < 9; i++) {
      const g = new THREE.Group();
      for (let j = 0; j < 4; j++) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(1.6 + rnd() * 1.4, 12, 10), cloudMat);
        b.position.set(j * 1.9 - 3, rnd() * 0.8, rnd() * 1.2); b.scale.y = 0.6; g.add(b);
      }
      g.position.set(-70 + rnd() * 140, 20 + rnd() * 8, -60 + rnd() * 120);
      scene.add(g); this.clouds.push(g);
    }

    // cars: the Northlane learner car and some traffic
    this.car = this.makeCar('#ffc531', true); scene.add(this.car);
    this.traffic = ['#d6302b', '#3d6ea8', '#f3efe6'].map((c, i) => { const car = this.makeCar(c, false); car.userData.off = 0.28 + i * 0.27; scene.add(car); return car; });

    // where the route joins the road, outside the lot
    this.u0 = 0.06;
  };

  Town.prototype.signTexture = function () {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 170;
    const g = c.getContext('2d');
    g.fillStyle = '#0a0f1a'; g.fillRect(0, 0, 1024, 170);
    g.fillStyle = '#ffc531'; g.beginPath(); g.arc(85, 85, 34, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f3efe6'; g.font = '600 78px "Inter Tight", sans-serif'; g.textBaseline = 'middle';
    g.fillText('NORTHLANE', 150, 90);
    g.fillStyle = 'rgba(243,239,230,.6)'; g.font = '400 34px "Inter Tight", sans-serif'; g.fillText('DRIVING SCHOOL', 680, 92);
    const t = new THREE.CanvasTexture(c); t.anisotropy = 8; return t;
  };

  // a house wall: two windows upstairs, a window and a door below (tinted by each house colour)
  Town.prototype.windowTexture = function () {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 128);
    const win = (x, y, w, h) => {
      g.fillStyle = '#ffffff'; g.fillRect(x - 3, y - 3, w + 6, h + 6);
      g.fillStyle = '#3a4a63'; g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x, y, w * .4, h);
      g.fillStyle = '#ffffff'; g.fillRect(x + w / 2 - 1, y, 2, h);
    };
    g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(0, 60, 128, 3);
    win(20, 18, 28, 26); win(80, 18, 28, 26); win(20, 76, 28, 26);
    g.fillStyle = '#6b4a35'; g.fillRect(80, 72, 26, 56);
    g.fillStyle = '#ffc531'; g.fillRect(100, 100, 3, 3);
    return new THREE.CanvasTexture(c);
  };

  Town.prototype.makeCar = function (color, learner) {
    const m = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.35, metalness: 0.25 }, o || {}));
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.6, 1.15), m(color)); body.position.y = 0.55; body.castShadow = true; g.add(body);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.5, 1.02), m('#1b2538', { roughness: 0.15, metalness: 0.6 })); cab.position.set(-0.15, 1.08, 0); cab.castShadow = true; g.add(cab);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.06, 1.04), m(color)); roof.position.set(-0.15, 1.35, 0); g.add(roof);
    const wheelG = new THREE.CylinderGeometry(0.27, 0.27, 0.22, 16), wheelM = m('#14161b', { roughness: 0.9 });
    [[0.72, 0.6], [0.72, -0.6], [-0.72, 0.6], [-0.72, -0.6]].forEach(([x, z]) => {
      const w = new THREE.Mesh(wheelG, wheelM); w.rotation.x = Math.PI / 2; w.position.set(x, 0.28, z); g.add(w);
    });
    const lampM = new THREE.MeshBasicMaterial({ color: '#fff6dc' });
    [0.38, -0.38].forEach(z => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.26), lampM); l.position.set(1.16, 0.62, z); g.add(l); });
    if (learner) {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 128, 128); x.fillStyle = '#d6302b'; x.font = 'bold 110px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('L', 64, 70);
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.45), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) }));
      plate.position.set(0, 1.6, 0); plate.rotation.y = Math.PI / 2; g.add(plate);
      const plate2 = plate.clone(); plate2.rotation.y = -Math.PI / 2; g.add(plate2);
      const stand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.06), m('#1b2538')); stand.position.set(0, 1.45, 0); g.add(stand);
    }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  };

  Town.prototype.resize = function () {
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < 700 ? 58 : 42;
    this.camera.updateProjectionMatrix();
  };

  Town.prototype.setProgress = function (p) { this.target = clamp(p, 0, 1); };

  // place a car on the loop at u, in the right-hand lane
  Town.prototype.onLoop = function (car, u, lane) {
    u = ((u % 1) + 1) % 1;
    const p = this.curve.getPointAt(u), t = this.curve.getTangentAt(u), s = V(-t.z, 0, t.x).normalize();
    car.position.copy(p).addScaledVector(s, lane);
    car.rotation.y = Math.atan2(-t.z, t.x);
    return { p, t, s };
  };

  Town.prototype.frame = function () {
    const dt = Math.min(this.clock.getDelta(), 0.05), time = this.clock.elapsedTime;
    this.p += (this.target - this.p) * (1 - Math.pow(0.0015, dt));
    const p = this.p, route = routeOf(p);

    // the car leaves the lot, drives the loop, and parks back in the lot
    const u = this.u0 + route;
    const { t, s } = this.onLoop(this.car, u, 0.85);
    const lotSpot = V(this.lot.x + 2, 0, this.lot.z - 1);
    const out = smooth(0, 0.07, p) * (1 - smooth(0.93, 1, p));
    if (out < 1) {
      const onRoad = this.car.position.clone();
      this.car.position.lerpVectors(lotSpot, onRoad, out);
      const yRoad = this.car.rotation.y;
      const toward = p < 0.5 ? onRoad.clone().sub(lotSpot) : lotSpot.clone().sub(onRoad);
      const yLot = Math.atan2(-toward.z, toward.x);
      let d = yRoad - yLot; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.car.rotation.y = yLot + d * smooth(0.4, 1, out);
    }
    this.car.position.y = Math.sin(time * 18) * 0.012 * out;

    // speed readout from how fast the route is moving
    const v = Math.abs(route - this.prevRoute) / Math.max(dt, 0.001);
    this.prevRoute = route;
    this.speed += (clamp(v * 140, 0, 62) - this.speed) * 0.08;
    this.onSpeed(Math.round(this.speed), p);

    // traffic drives the other way in the other lane
    this.traffic.forEach((c, i) => { this.onLoop(c, c.userData.off - time * 0.012 * (1 + i * 0.15), -0.85); c.rotation.y += Math.PI; });

    // the traffic light cycles
    const phase = Math.floor(time / 2.2) % 3;
    this.lights.forEach((l, i) => l.material.color.setStyle(['#ff4d3d', '#ffc531', '#3ddc97'][i]).multiplyScalar(i === (2 - phase) ? 1 : 0.18));

    this.clouds.forEach((c, i) => { c.position.x += dt * (0.6 + i * 0.05); if (c.position.x > 80) c.position.x = -80; });

    // camera: a wide shot at the start and end, chasing the car in between
    const car = this.car.position;
    const wide = 1 - smooth(0.02, 0.16, p) + smooth(0.86, 0.99, p);
    const swing = Math.sin(p * Math.PI * 4) * 2.5;
    const chase = car.clone().addScaledVector(t, -11).addScaledVector(s, swing).add(V(0, 7 + Math.sin(p * Math.PI * 2) * 2, 0));
    const over = V(car.x * 0.4 - 6 + this.mouse.x * 6, 46, car.z * 0.4 + 40 + this.mouse.y * 4);
    const camT = chase.lerp(over, wide);
    camT.x += this.mouse.x * 1.5 * (1 - wide); camT.y -= this.mouse.y * 1 * (1 - wide);
    this.camera.position.lerp(camT, 1 - Math.pow(0.02, dt));
    const lookT = car.clone().addScaledVector(t, 5).lerp(V(car.x * 0.5, 0, car.z * 0.5), wide * 0.7);
    this.camLook.lerp(lookT, 1 - Math.pow(0.01, dt));
    this.camera.lookAt(this.camLook);

    // the sun follows the action, so shadows stay sharp
    this.sun.position.set(car.x - 30, 50, car.z + 25);
    this.sun.target.position.copy(car);

    this.renderer.render(this.scene, this.camera);
  };

  window.Town = Town;
})();
