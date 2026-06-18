/* ============================================================
   FitTrack AI — landing2.js
   Three.js particles + smooth animations
   ============================================================ */

(function () {
  'use strict';

  // ── THREE.JS PARTICLE BACKGROUND ──────────────────────────
  const canvas = document.getElementById('heroCanvas');
  if (canvas && typeof THREE !== 'undefined') {
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 200);
    camera.position.z = 40;

    // Particles
    const COUNT = 200;
    const positions = new Float32Array(COUNT * 3);
    const sizes     = new Float32Array(COUNT);

    for (let i = 0; i < COUNT; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 120;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 80;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 60;
      sizes[i] = Math.random() * 1.5 + 0.3;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.PointsMaterial({
      color:       0xc4f135,
      size:        0.4,
      transparent: true,
      opacity:     0.35,
      sizeAttenuation: true,
    });

    const particles = new THREE.Points(geom, mat);
    scene.add(particles);

    // Connecting lines (sparse)
    const lineMat = new THREE.LineBasicMaterial({ color: 0x7c3aed, transparent: true, opacity: 0.07 });
    const lineGeom = new THREE.BufferGeometry();
    const linePositions = [];
    for (let i = 0; i < 50; i++) {
      const a = Math.floor(Math.random() * COUNT);
      const b = Math.floor(Math.random() * COUNT);
      linePositions.push(
        positions[a * 3], positions[a * 3 + 1], positions[a * 3 + 2],
        positions[b * 3], positions[b * 3 + 1], positions[b * 3 + 2]
      );
    }
    lineGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePositions), 3));
    scene.add(new THREE.LineSegments(lineGeom, lineMat));

    // Mouse parallax
    let mouse = { x: 0, y: 0 };
    let targetMouse = { x: 0, y: 0 };
    document.addEventListener('mousemove', e => {
      targetMouse.x = (e.clientX / window.innerWidth  - 0.5) * 2;
      targetMouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
    });

    // Resize
    const onResize = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    // Animate
    let clock = 0;
    const animate = () => {
      requestAnimationFrame(animate);
      clock += 0.005;

      // Smooth mouse
      mouse.x += (targetMouse.x - mouse.x) * 0.04;
      mouse.y += (targetMouse.y - mouse.y) * 0.04;

      particles.rotation.y = clock * 0.06 + mouse.x * 0.3;
      particles.rotation.x = mouse.y * 0.2;
      camera.position.x = mouse.x * 3;
      camera.position.y = -mouse.y * 2;

      renderer.render(scene, camera);
    };
    animate();
  }

  // ── GSAP HERO ENTRANCE ────────────────────────────────────
  if (typeof gsap !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);

    const tl = gsap.timeline({ delay: 0.2 });
    tl.from('.hero-badge',    { y: -20, opacity: 0, duration: 0.6, ease: 'power3.out' })
      .from('.hero-title',    { y: 40,  opacity: 0, duration: 0.8, ease: 'power3.out' }, '-=0.3')
      .from('.hero-subtitle', { y: 20,  opacity: 0, duration: 0.6, ease: 'power3.out' }, '-=0.4')
      .from('.hero-cta-row',  { y: 20,  opacity: 0, duration: 0.6, ease: 'power3.out' }, '-=0.3')
      .from('.hero-trust',    { y: 20,  opacity: 0, duration: 0.5, ease: 'power3.out' }, '-=0.3')
      .from('.rings-container', { x: 60, opacity: 0, duration: 1, ease: 'power3.out' }, '-=0.8')
      .from('.scroll-indicator',{ opacity: 0, duration: 0.5 }, '-=0.2');

    // Scroll animations
    gsap.utils.toArray('.stat-item').forEach((el, i) => {
      gsap.from(el, {
        scale: 0.9, opacity: 0, duration: 0.6,
        ease: 'back.out(1.5)',
        delay: i * 0.1,
        scrollTrigger: { trigger: el, start: 'top 85%', once: true }
      });
    });

    gsap.utils.toArray('.step-card').forEach((el, i) => {
      gsap.from(el, {
        y: 30, opacity: 0, duration: 0.6,
        ease: 'power3.out',
        delay: i * 0.12,
        scrollTrigger: { trigger: el, start: 'top 85%', once: true }
      });
    });

    gsap.utils.toArray('.bento-card').forEach((el, i) => {
      gsap.from(el, {
        y: 20, opacity: 0, duration: 0.6,
        ease: 'power3.out',
        delay: (i % 4) * 0.08,
        scrollTrigger: { trigger: el, start: 'top 88%', once: true }
      });
    });
  }

  // ── MAGNETIC BUTTONS ──────────────────────────────────────
  document.querySelectorAll('.magnetic-btn').forEach(btn => {
    btn.addEventListener('mousemove', e => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width  / 2;
      const y = e.clientY - rect.top  - rect.height / 2;
      btn.style.transform = `translate(${x * 0.18}px, ${y * 0.18}px)`;
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = '';
    });
  });

  // ── RING ANIMATION RESET ON SCROLL INTO VIEW ──────────────
  const ringsEl = document.querySelector('.rings-svg');
  if (ringsEl) {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          document.querySelectorAll('.ring-fill').forEach(r => {
            r.style.animation = 'none';
            r.offsetHeight; // reflow
            r.style.animation = '';
          });
          obs.unobserve(ringsEl);
        }
      });
    }, { threshold: 0.3 });
    obs.observe(ringsEl);
  }

})();
