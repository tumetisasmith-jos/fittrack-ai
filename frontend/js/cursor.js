/* =====================================================
   FitTrack AI — cursor.js
   Custom cursor with trail + magnetic buttons
   ===================================================== */
(function () {
  'use strict';

  // Create cursor elements
  const dot   = document.createElement('div');
  const ring  = document.createElement('div');
  dot.id   = 'cursorDot';
  ring.id  = 'cursorRing';
  document.body.appendChild(dot);
  document.body.appendChild(ring);

  // Trail dots
  const TRAIL_COUNT = 8;
  const trail = [];
  for (let i = 0; i < TRAIL_COUNT; i++) {
    const t = document.createElement('div');
    t.className = 'cursor-trail';
    t.style.opacity = ((TRAIL_COUNT - i) / TRAIL_COUNT * 0.4).toString();
    t.style.transform = 'scale(' + ((TRAIL_COUNT - i) / TRAIL_COUNT * 0.5) + ')';
    document.body.appendChild(t);
    trail.push({ el: t, x: window.innerWidth / 2, y: window.innerHeight / 2 });
  }

  let curX = window.innerWidth / 2;
  let curY = window.innerHeight / 2;
  let ringX = curX, ringY = curY;
  let isHovering = false;
  let isMagnetic = false;
  let magnetTarget = null;

  // Track mouse
  window.addEventListener('mousemove', (e) => {
    curX = e.clientX;
    curY = e.clientY;
    dot.style.left = curX + 'px';
    dot.style.top  = curY + 'px';
  });

  // Ring follows with lag, trail follows ring
  function animateCursor() {
    // Ring lag
    const ease = isMagnetic ? 0.18 : 0.12;

    if (isMagnetic && magnetTarget) {
      const rect = magnetTarget.getBoundingClientRect();
      const mx   = rect.left + rect.width  / 2;
      const my   = rect.top  + rect.height / 2;
      const dx   = curX - mx;
      const dy   = curY - my;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 80) {
        const force = (1 - dist / 80);
        ringX += (mx + dx * (1 - force * 0.7) - ringX) * 0.15;
        ringY += (my + dy * (1 - force * 0.7) - ringY) * 0.15;
        // Move button slightly
        magnetTarget.style.transform = `translate(${-dx * force * 0.25}px, ${-dy * force * 0.25}px)`;
      } else {
        ringX += (curX - ringX) * ease;
        ringY += (curY - ringY) * ease;
        magnetTarget.style.transform = '';
      }
    } else {
      ringX += (curX - ringX) * ease;
      ringY += (curY - ringY) * ease;
    }

    ring.style.left = ringX + 'px';
    ring.style.top  = ringY + 'px';

    // Trail follows ring with cascading lag
    let px = ringX, py = ringY;
    trail.forEach((t, i) => {
      const lagEase = 0.18 - i * 0.015;
      t.x += (px - t.x) * Math.max(lagEase, 0.04);
      t.y += (py - t.y) * Math.max(lagEase, 0.04);
      t.el.style.left = t.x + 'px';
      t.el.style.top  = t.y + 'px';
      px = t.x; py = t.y;
    });

    requestAnimationFrame(animateCursor);
  }
  animateCursor();

  // Hover detection
  const hoverTargets = 'a, button, [role="button"], .feature-card, .pricing-card, .testimonial-card, .faq-question, input, select, textarea, .nav-logo, .btn-hero-primary, .btn-hero-secondary';

  document.addEventListener('mouseover', (e) => {
    if (e.target.closest(hoverTargets)) {
      isHovering = true;
      dot.classList.add('cursor-hover');
      ring.classList.add('cursor-hover');
    }
  });

  document.addEventListener('mouseout', (e) => {
    if (!e.target.closest(hoverTargets)) {
      isHovering = false;
      dot.classList.remove('cursor-hover');
      ring.classList.remove('cursor-hover');
    }
  });

  // Magnetic buttons
  document.addEventListener('mouseover', (e) => {
    const magBtn = e.target.closest('.btn-hero-primary, .btn-auth-submit, .btn-pricing-primary, .nav-get-started, .btn-primary');
    if (magBtn) {
      isMagnetic = true;
      magnetTarget = magBtn;
    }
  });

  document.addEventListener('mouseout', (e) => {
    const magBtn = e.target.closest('.btn-hero-primary, .btn-auth-submit, .btn-pricing-primary, .nav-get-started, .btn-primary');
    if (magBtn) {
      isMagnetic = false;
      magnetTarget = null;
      magBtn.style.transform = '';
    }
  });

  // Click ripple
  document.addEventListener('click', (e) => {
    dot.classList.add('cursor-click');
    ring.classList.add('cursor-click');
    setTimeout(() => {
      dot.classList.remove('cursor-click');
      ring.classList.remove('cursor-click');
    }, 300);
  });

  // Hide on leave / show on enter
  document.addEventListener('mouseleave', () => {
    dot.style.opacity  = '0';
    ring.style.opacity = '0';
    trail.forEach(t => t.el.style.opacity = '0');
  });

  document.addEventListener('mouseenter', () => {
    dot.style.opacity  = '1';
    ring.style.opacity = '1';
    trail.forEach((t, i) => {
      t.el.style.opacity = ((TRAIL_COUNT - i) / TRAIL_COUNT * 0.4).toString();
    });
  });
})();
