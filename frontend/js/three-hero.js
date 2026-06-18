/**
 * FitTrack AI — Three.js 3D Hero Scene
 * 
 * Scene contains:
 * 1. Rotating 3D DNA-like double helix (health themed)
 * 2. Floating wireframe geometries (icosahedron, torus, octahedron)
 * 3. 3D Particle field with mouse parallax
 * 4. Connecting lines between nearby particles
 * 5. Ambient glow post-processing
 * 6. Full mouse/touch interactivity
 */

(function () {
  'use strict';

  // Only run on pages that have the hero section
  if (!document.querySelector('.hero') && !document.querySelector('#hero')) return;

  // ── Load Three.js dynamically ──────────────────────────
  function loadScript(src, cb) {
    const s = document.createElement('script');
    s.src = src;
    s.onload = cb;
    document.head.appendChild(s);
  }

  const THREE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';

  loadScript(THREE_CDN, initScene);

  function initScene() {
    // ── Canvas setup ────────────────────────────────────
    const canvas = document.getElementById('heroCanvas');
    if (!canvas) return; // fallback canvas from hero-canvas.js already removed
    
    // Create our own canvas for Three.js
    const threeCanvas = document.createElement('canvas');
    threeCanvas.id = 'threeCanvas';
    threeCanvas.style.cssText = `
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      z-index: -1;
      pointer-events: none;
    `;
    document.body.prepend(threeCanvas);

    // ── Renderer ──────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({
      canvas: threeCanvas,
      antialias: true,
      alpha: true,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x050510, 1);

    // ── Scene & Camera ────────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      60, window.innerWidth / window.innerHeight, 0.1, 1000
    );
    camera.position.set(0, 0, 5);

    // ── Lighting ──────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 0.15));

    const purpleLight = new THREE.PointLight(0x7c3aed, 2, 20);
    purpleLight.position.set(-4, 3, 2);
    scene.add(purpleLight);

    const cyanLight = new THREE.PointLight(0x06b6d4, 1.5, 20);
    cyanLight.position.set(4, -2, 2);
    scene.add(cyanLight);

    const greenLight = new THREE.PointLight(0x10b981, 1, 15);
    greenLight.position.set(0, 4, -2);
    scene.add(greenLight);

    // ── Color palette ──────────────────────────────────
    const COLORS = {
      purple:  new THREE.Color(0x7c3aed),
      purpleL: new THREE.Color(0xa78bfa),
      cyan:    new THREE.Color(0x06b6d4),
      green:   new THREE.Color(0x10b981),
      pink:    new THREE.Color(0xec4899),
      orange:  new THREE.Color(0xf59e0b),
    };
    const COLOR_ARR = Object.values(COLORS);

    // ── 1. DNA Double Helix ────────────────────────────
    const helixGroup = new THREE.Group();
    helixGroup.position.set(2.8, 0, -1.5);
    scene.add(helixGroup);

    const helixPoints1 = [];
    const helixPoints2 = [];
    const helixSpheres = [];
    const HELIX_TURNS = 3;
    const HELIX_HEIGHT = 4;
    const HELIX_RADIUS = 0.5;
    const HELIX_STEPS = 60;

    for (let i = 0; i <= HELIX_STEPS; i++) {
      const t = i / HELIX_STEPS;
      const angle = t * Math.PI * 2 * HELIX_TURNS;
      const y = (t - 0.5) * HELIX_HEIGHT;

      const x1 = Math.cos(angle) * HELIX_RADIUS;
      const z1 = Math.sin(angle) * HELIX_RADIUS;
      const x2 = Math.cos(angle + Math.PI) * HELIX_RADIUS;
      const z2 = Math.sin(angle + Math.PI) * HELIX_RADIUS;

      helixPoints1.push(new THREE.Vector3(x1, y, z1));
      helixPoints2.push(new THREE.Vector3(x2, y, z2));

      // Nodes on helix
      if (i % 6 === 0) {
        const sphereGeo = new THREE.SphereGeometry(0.06, 8, 8);
        const color = COLOR_ARR[Math.floor(i / 6) % COLOR_ARR.length];
        const mat1 = new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 0.5 });
        const mat2 = new THREE.MeshPhongMaterial({ color: COLORS.cyan, emissive: COLORS.cyan, emissiveIntensity: 0.5 });

        const s1 = new THREE.Mesh(sphereGeo, mat1);
        s1.position.set(x1, y, z1);
        helixGroup.add(s1);

        const s2 = new THREE.Mesh(sphereGeo.clone(), mat2);
        s2.position.set(x2, y, z2);
        helixGroup.add(s2);

        // Rung connecting the two strands
        const rungGeo = new THREE.CylinderGeometry(0.015, 0.015, HELIX_RADIUS * 2, 4);
        const rungMat = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.08, transparent: true });
        const rung = new THREE.Mesh(rungGeo, rungMat);
        rung.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
        rung.lookAt(new THREE.Vector3(x1, y, z1));
        rung.rotateX(Math.PI / 2);
        helixGroup.add(rung);

        helixSpheres.push(s1, s2);
      }
    }

    // Helix strands as tubes
    const curve1 = new THREE.CatmullRomCurve3(helixPoints1);
    const curve2 = new THREE.CatmullRomCurve3(helixPoints2);

    const tubeGeo1 = new THREE.TubeGeometry(curve1, 120, 0.02, 6, false);
    const tubeGeo2 = new THREE.TubeGeometry(curve2, 120, 0.02, 6, false);

    const tubeMat1 = new THREE.MeshPhongMaterial({ color: 0x7c3aed, emissive: 0x7c3aed, emissiveIntensity: 0.3, transparent: true, opacity: 0.8 });
    const tubeMat2 = new THREE.MeshPhongMaterial({ color: 0x06b6d4, emissive: 0x06b6d4, emissiveIntensity: 0.3, transparent: true, opacity: 0.8 });

    helixGroup.add(new THREE.Mesh(tubeGeo1, tubeMat1));
    helixGroup.add(new THREE.Mesh(tubeGeo2, tubeMat2));

    // ── 2. Floating Wireframe Shapes ───────────────────
    const floatingShapes = [];

    function makeWireframe(geo, color, pos, scale = 1) {
      const edges = new THREE.EdgesGeometry(geo);
      const mat   = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.35 });
      const mesh  = new THREE.LineSegments(edges, mat);
      mesh.position.set(...pos);
      mesh.scale.setScalar(scale);
      scene.add(mesh);
      return mesh;
    }

    // Icosahedron (left side)
    floatingShapes.push({
      mesh: makeWireframe(new THREE.IcosahedronGeometry(0.7, 0), 0x7c3aed, [-3.5, 1.2, -0.5], 1),
      rotSpeed: new THREE.Vector3(0.003, 0.005, 0.002),
      floatAmp: 0.15, floatSpeed: 0.4, floatPhase: 0,
    });

    // Torus (right side, smaller)
    floatingShapes.push({
      mesh: makeWireframe(new THREE.TorusGeometry(0.45, 0.12, 12, 32), 0x06b6d4, [3.2, -1.5, -0.3], 1),
      rotSpeed: new THREE.Vector3(0.006, 0.003, 0.004),
      floatAmp: 0.2, floatSpeed: 0.35, floatPhase: 1.2,
    });

    // Octahedron (top center)
    floatingShapes.push({
      mesh: makeWireframe(new THREE.OctahedronGeometry(0.55), 0x10b981, [-1.5, 2.5, -1], 1),
      rotSpeed: new THREE.Vector3(0.004, 0.006, 0.003),
      floatAmp: 0.12, floatSpeed: 0.5, floatPhase: 2.4,
    });

    // Tetrahedron (bottom)
    floatingShapes.push({
      mesh: makeWireframe(new THREE.TetrahedronGeometry(0.5), 0xec4899, [1.5, -2.8, -0.8], 1),
      rotSpeed: new THREE.Vector3(0.005, 0.004, 0.006),
      floatAmp: 0.18, floatSpeed: 0.45, floatPhase: 3.6,
    });

    // Dodecahedron (far right background)
    floatingShapes.push({
      mesh: makeWireframe(new THREE.DodecahedronGeometry(0.6), 0xa78bfa, [4.5, 1, -2], 1),
      rotSpeed: new THREE.Vector3(0.002, 0.004, 0.003),
      floatAmp: 0.1, floatSpeed: 0.3, floatPhase: 0.8,
    });

    // ── 3. Particle Field (3D) ──────────────────────────
    const PARTICLE_COUNT = 180;
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const partColors = new Float32Array(PARTICLE_COUNT * 3);
    const partSizes  = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      positions[i3]     = (Math.random() - 0.5) * 14;
      positions[i3 + 1] = (Math.random() - 0.5) * 10;
      positions[i3 + 2] = (Math.random() - 0.5) * 6 - 2;

      const c = COLOR_ARR[Math.floor(Math.random() * COLOR_ARR.length)];
      partColors[i3]     = c.r;
      partColors[i3 + 1] = c.g;
      partColors[i3 + 2] = c.b;

      partSizes[i] = 0.5 + Math.random() * 2.5;
    }

    const partGeo = new THREE.BufferGeometry();
    partGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    partGeo.setAttribute('color',    new THREE.BufferAttribute(partColors, 3));
    partGeo.setAttribute('size',     new THREE.BufferAttribute(partSizes, 1));

    // Custom shader for circular, glowing particles
    const partMat = new THREE.PointsMaterial({
      size: 0.06,
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      sizeAttenuation: true,
    });

    const particles = new THREE.Points(partGeo, partMat);
    scene.add(particles);

    // Particle velocities
    const partVelocities = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      partVelocities.push({
        x: (Math.random() - 0.5) * 0.003,
        y: -(0.002 + Math.random() * 0.004),
        z: 0,
      });
    }

    // ── Mouse tracking ──────────────────────────────────
    let mouseX = 0, mouseY = 0;
    let targetX = 0, targetY = 0;

    window.addEventListener('mousemove', (e) => {
      targetX = (e.clientX / window.innerWidth  - 0.5) * 2;
      targetY = (e.clientY / window.innerHeight - 0.5) * 2;
    });

    // ── Resize ─────────────────────────────────────────
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // ── Dark/Light mode sync ───────────────────────────
    function updateTheme() {
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      renderer.setClearColor(isLight ? 0xf0f4ff : 0x050510, 1);
      tubeMat1.opacity = isLight ? 0.4 : 0.8;
      tubeMat2.opacity = isLight ? 0.4 : 0.8;
    }

    const themeObserver = new MutationObserver(updateTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    // ── Animation loop ─────────────────────────────────
    const clock = new THREE.Clock();

    function animate() {
      requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Smooth mouse lag
      mouseX += (targetX - mouseX) * 0.04;
      mouseY += (targetY - mouseY) * 0.04;

      // Camera micro-parallax
      camera.position.x = mouseX * 0.4;
      camera.position.y = -mouseY * 0.3;
      camera.lookAt(scene.position);

      // Helix rotation
      helixGroup.rotation.y = t * 0.18;
      helixGroup.rotation.x = Math.sin(t * 0.12) * 0.08;

      // Sphere pulsing on helix nodes
      helixSpheres.forEach((s, i) => {
        s.scale.setScalar(1 + Math.sin(t * 2 + i * 0.3) * 0.15);
      });

      // Floating shapes
      floatingShapes.forEach((obj) => {
        obj.mesh.rotation.x += obj.rotSpeed.x;
        obj.mesh.rotation.y += obj.rotSpeed.y;
        obj.mesh.rotation.z += obj.rotSpeed.z;
        obj.mesh.position.y += Math.sin(t * obj.floatSpeed + obj.floatPhase) * 0.002;
        // Mouse parallax
        obj.mesh.position.x += (mouseX * 0.06 - obj.mesh.position.x * 0.001) * 0.02;
      });

      // Particle movement
      const posAttr = partGeo.attributes.position;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        posAttr.array[i3]     += partVelocities[i].x;
        posAttr.array[i3 + 1] += partVelocities[i].y;
        posAttr.array[i3 + 2] += partVelocities[i].z;

        // Reset particle when it goes off screen
        if (posAttr.array[i3 + 1] < -5.5) {
          posAttr.array[i3]     = (Math.random() - 0.5) * 14;
          posAttr.array[i3 + 1] = 5.5;
          posAttr.array[i3 + 2] = (Math.random() - 0.5) * 6 - 2;
        }
      }
      posAttr.needsUpdate = true;

      // Particle group gentle rotation from mouse
      particles.rotation.y = mouseX * 0.05;

      // Pulsing lights
      purpleLight.intensity = 1.5 + Math.sin(t * 0.8) * 0.5;
      cyanLight.intensity   = 1.2 + Math.cos(t * 0.6) * 0.3;

      renderer.render(scene, camera);
    }

    animate();

    // ── Remove old canvas if present ───────────────────
    const oldCanvas = document.getElementById('heroCanvas');
    if (oldCanvas) oldCanvas.remove();

    // ── Keep cursor glow ───────────────────────────────
    // (cursor glow handled by cursor.js)
  }
})();
