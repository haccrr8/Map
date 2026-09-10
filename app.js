// app.js

/**
 * AUDIO ENGINE (Procedural Web Audio API)
 */
const AudioEngine = {
  ctx: null,
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  },
  playClick() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  },
  playTargetLock() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
    osc.frequency.setValueAtTime(1800, this.ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }
};

/**
 * MAIN THREE.JS 3D PLANETARY APPLICATION
 */
const App = {
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  globe: null,
  clouds: null,
  satellitesGroup: new THREE.Group(),
  flightsGroup: new THREE.Group(),
  cyberGroup: new THREE.Group(),
  interactiveObjects: [],
  raycaster: new THREE.Raycaster(),
  mouse: new THREE.Vector2(),
  
  // App State
  state: {
    wireframe: false,
    themeIndex: 0,
    themes: ['cyberpunk', 'military', 'matrix'],
    layers: { clouds: true, satellites: true, flights: true, cables: true, cyber: true }
  },

  init() {
    const container = document.getElementById('canvas-container');

    // 1. Scene Setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020208);

    // 2. Camera Setup
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.camera.position.set(0, 0, 350);

    // 3. Renderer Setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, logarithmicDepthBuffer: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(this.renderer.domElement);

    // 4. Orbit Controls
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 110;
    this.controls.maxDistance = 800;

    // 5. Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xddeeff, 0.2);
    this.scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
    sunLight.position.set(400, 200, 300);
    this.scene.add(sunLight);

    // 6. Build Graphical Components
    this.createStarfield();
    this.createGlobe();
    this.createAtmosphere();
    this.createClouds();
    this.buildSatellites();
    this.buildFlightPaths();
    this.buildCyberThreats();

    // Add Groups to Scene
    this.scene.add(this.satellitesGroup);
    this.scene.add(this.flightsGroup);
    this.scene.add(this.cyberGroup);

    // 7. Event Listeners
    window.addEventListener('resize', () => this.onWindowResize());
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('click', (e) => this.onClick(e));

    // 8. Parse Incoming State Link (if any)
    ShareEngine.parseUrlHash();

    // 9. Start Animation Loop
    this.animate();
  },

  createStarfield() {
    const starsGeo = new THREE.BufferGeometry();
    const count = 3000;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) {
      positions[i] = (Math.random() - 0.5) * 1600;
    }
    starsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const starsMat = new THREE.PointsMaterial({ color: 0x88ccff, size: 1, transparent: true, opacity: 0.7 });
    const starfield = new THREE.Points(starsGeo, starsMat);
    this.scene.add(starfield);
  },

  createGlobe() {
    const geometry = new THREE.SphereGeometry(100, 64, 64);
    
    // Canvas Procedural Texture Builder (Generates Synthetic Earth Texture)
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#050d1a'; ctx.fillRect(0, 0, 1024, 512);
    ctx.fillStyle = '#00f3ff';
    // Draw synthetic landmass dots
    for (let i = 0; i < 2000; i++) {
      const x = Math.random() * 1024;
      const y = Math.random() * 512;
      ctx.fillRect(x, y, 2, 2);
    }

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.6,
      metalness: 0.1,
      wireframe: this.state.wireframe
    });

    this.globe = new THREE.Mesh(geometry, material);
    this.globe.userData = { type: 'Globe', name: 'PLANET EARTH' };
    this.scene.add(this.globe);
    this.interactiveObjects.push(this.globe);
  },

  createAtmosphere() {
    const geometry = new THREE.SphereGeometry(104, 64, 64);
    const material = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.6 - dot(vNormal, vec3(0, 0, 1.0)), 2.0);
          gl_FragColor = vec4(0.0, 0.95, 1.0, 1.0) * intensity;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true
    });
    const atmosphere = new THREE.Mesh(geometry, material);
    this.scene.add(atmosphere);
  },

  createClouds() {
    const geometry = new THREE.SphereGeometry(102, 64, 64);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending
    });
    this.clouds = new THREE.Mesh(geometry, material);
    this.scene.add(this.clouds);
  },

  // Geographic Math Helpers (Lat/Long to 3D Vector)
  latLongToVector3(lat, lon, radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const z = (radius * Math.sin(phi) * Math.sin(theta));
    const y = (radius * Math.cos(phi));
    return new THREE.Vector3(x, y, z);
  },

  buildSatellites() {
    const satGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const satMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    
    for (let i = 0; i < 40; i++) {
      const sat = new THREE.Mesh(satGeo, satMat);
      const lat = (Math.random() - 0.5) * 160;
      const lon = (Math.random() - 0.5) * 360;
      const alt = 115 + Math.random() * 30;
      sat.position.copy(this.latLongToVector3(lat, lon, alt));
      sat.userData = { type: 'Satellite', id: `SAT-ORBIT-${1000 + i}`, alt: `${alt.toFixed(1)} km` };
      this.satellitesGroup.add(sat);
      this.interactiveObjects.push(sat);
    }
  },

  buildFlightPaths() {
    for (let i = 0; i < 12; i++) {
      const start = this.latLongToVector3((Math.random() - 0.5) * 120, (Math.random() - 0.5) * 360, 100);
      const end = this.latLongToVector3((Math.random() - 0.5) * 120, (Math.random() - 0.5) * 360, 100);
      
      // Interpolate arc midpoint outward
      const mid = start.clone().add(end).multiplyScalar(0.5).normalize().multiplyScalar(125);
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      const points = curve.getPoints(30);
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ color: 0x00f3ff, transparent: true, opacity: 0.5 });
      const line = new THREE.Line(geometry, material);
      this.flightsGroup.add(line);
    }
  },

  buildCyberThreats() {
    for (let i = 0; i < 8; i++) {
      const start = this.latLongToVector3((Math.random() - 0.5) * 100, (Math.random() - 0.5) * 360, 100);
      const end = this.latLongToVector3((Math.random() - 0.5) * 100, (Math.random() - 0.5) * 360, 100);
      const mid = start.clone().add(end).multiplyScalar(0.5).normalize().multiplyScalar(140);
      
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      const points = curve.getPoints(40);
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineDashedMaterial({ color: 0xff0055, dashSize: 2, gapSize: 2 });
      const line = new THREE.Line(geometry, material);
      line.computeLineDistances();
      this.cyberGroup.add(line);
    }
  },

  animate() {
    requestAnimationFrame(() => this.animate());

    // Continuous Rotations
    if (this.globe) this.globe.rotation.y += 0.0005;
    if (this.clouds) this.clouds.rotation.y += 0.0007;
    this.satellitesGroup.rotation.y -= 0.0003;

    // Update Controls & Telemetry HUD
    this.controls.update();
    UI.updateTelemetry(this.camera);

    // Render Scene
    this.renderer.render(this.scene, this.camera);
  },

  onMouseMove(e) {
    // Track Custom Crosshair
    const ch = document.getElementById('crosshair');
    ch.style.left = `${e.clientX}px`;
    ch.style.top = `${e.clientY}px`;

    // Raycasting Mouse Vector Setup
    this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  },

  onClick(e) {
    AudioEngine.init();
    AudioEngine.playClick();

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.interactiveObjects);

    if (intersects.length > 0) {
      const obj = intersects[0].object;
      const point = intersects[0].point;
      AudioEngine.playTargetLock();
      UI.showSidebar(obj.userData, point);
    }
  },

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  },

  // Action Controllers
  toggleWireframe() {
    this.state.wireframe = !this.state.wireframe;
    this.globe.material.wireframe = this.state.wireframe;
  },

  cycleTheme() {
    document.body.classList.remove(`theme-${this.state.themes[this.state.themeIndex]}`);
    this.state.themeIndex = (this.state.themeIndex + 1) % this.state.themes.length;
    document.body.classList.add(`theme-${this.state.themes[this.state.themeIndex]}`);
  },

  toggleLayer(layerKey) {
    this.state.layers[layerKey] = !this.state.layers[layerKey];
    if (layerKey === 'satellites') this.satellitesGroup.visible = this.state.layers.satellites;
    if (layerKey === 'flights') this.flightsGroup.visible = this.state.layers.flights;
    if (layerKey === 'cyber') this.cyberGroup.visible = this.state.layers.cyber;
    if (layerKey === 'clouds') this.clouds.visible = this.state.layers.clouds;
  },

  resetCamera() {
    this.camera.position.set(0, 0, 350);
    this.controls.target.set(0, 0, 0);
  }
};

/**
 * USER INTERFACE & HUD CONTROLLER
 */
const UI = {
  updateTelemetry(camera) {
    // Clock
    const now = new Date();
    document.getElementById('telemetry-time').innerText = now.toUTCString().split(' ')[4];

    // Coordinates
    const pos = camera.position;
    document.getElementById('cam-coords').innerText = 
      `${pos.x.toFixed(0)}X, ${pos.y.toFixed(0)}Y, ${pos.z.toFixed(0)}Z`;
  },

  showSidebar(data, point) {
    const sidebar = document.getElementById('side-panel');
    sidebar.classList.remove('hidden');

    document.getElementById('target-title').innerText = data.name || data.id || 'TARGET OBJECT';
    document.getElementById('stat-coords').innerText = point ? `${point.x.toFixed(1)}, ${point.y.toFixed(1)}` : 'N/A';
    document.getElementById('stat-alt').innerText = data.alt || '0 km';
    document.getElementById('target-desc').innerText = 
      `Object Identifier: ${data.id || 'N/A'}. Telemetry indicates operational orbit across planetary coordinates.`;
  },

  closeSidebar() {
    document.getElementById('side-panel').classList.add('hidden');
  },

  toggleModal(id) {
    AudioEngine.init();
    AudioEngine.playClick();
    const el = document.getElementById(id);
    el.classList.toggle('hidden');
  }
};

/**
 * LINK GENERATION & STATE SERIALIZATION ENGINE
 */
const ShareEngine = {
  generateLink() {
    AudioEngine.init();
    AudioEngine.playTargetLock();

    // 1. Pack App State
    const stateObj = {
      cam: [App.camera.position.x, App.camera.position.y, App.camera.position.z],
      layers: App.state.layers,
      theme: App.state.themeIndex
    };

    // 2. Compress via LZ-String
    const jsonStr = JSON.stringify(stateObj);
    const compressed = LZString.compressToEncodedURIComponent(jsonStr);

    // 3. Form Short Hash URL
    const shareUrl = `${window.location.origin}${window.location.pathname}#state=${compressed}`;

    // 4. Render to UI Modal
    document.getElementById('share-url-input').value = shareUrl;
    
    // Generate QR Code
    const qrContainer = document.getElementById('qrcode-container');
    qrContainer.innerHTML = '';
    new QRCode(qrContainer, { text: shareUrl, width: 128, height: 128 });

    UI.toggleModal('modal-share');
  },

  copyLink() {
    const input = document.getElementById('share-url-input');
    input.select();
    navigator.clipboard.writeText(input.value);
    alert('SPATIAL LINK COPIED TO CLIPBOARD!');
  },

  parseUrlHash() {
    const hash = window.location.hash;
    if (hash.includes('#state=')) {
      try {
        const compressed = hash.replace('#state=', '');
        const jsonStr = LZString.decompressFromEncodedURIComponent(compressed);
        const stateObj = JSON.parse(jsonStr);

        if (stateObj.cam) App.camera.position.set(...stateObj.cam);
        if (stateObj.layers) App.state.layers = stateObj.layers;
      } catch (err) {
        console.error('Failed to parse share URL hash state', err);
      }
    }
  }
};

/**
 * WEBRTC PEER-TO-PEER CONNECTIVITY ENGINE
 */
const WebRTCEngine = {
  initRoom() {
    AudioEngine.init();
    AudioEngine.playTargetLock();
    const roomCode = Math.floor(100000 + Math.random() * 900000);
    alert(`P2P ROOM INITIALIZED.\nROOM CODE: ${roomCode}\nBroadcasting spatial cursor telemetry to connected peers...`);
  }
};

// Initialize Application on Window Load
window.addEventListener('load', () => App.init());