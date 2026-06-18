/* =====================================================
   FitTrack AI — landing.js  (Professional Redesign)
   ===================================================== */

/* ── Navbar scroll effect ── */
const nav = document.getElementById('landingNav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 20);
}, { passive: true });

/* ── Mobile nav ── */
function toggleMobileNav() {
  const drawer  = document.getElementById('mobileNavDrawer');
  const burger  = document.getElementById('navHamburger');
  const isOpen  = drawer.classList.contains('open');
  drawer.classList.toggle('open', !isOpen);
  burger.classList.toggle('open', !isOpen);
}
function closeMobileNav() {
  document.getElementById('mobileNavDrawer').classList.remove('open');
  document.getElementById('navHamburger').classList.remove('open');
}

/* ── Smooth anchor scroll ── */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href').slice(1);
    const el = document.getElementById(id);
    if (el) {
      e.preventDefault();
      closeMobileNav();
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

/* ── Scroll reveal ── */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

/* ── Animated counters ── */
function animateCounter(el) {
  const target   = parseInt(el.dataset.target);
  const suffix   = el.dataset.suffix || '';
  const duration = 1800;
  const start    = performance.now();

  function step(now) {
    const elapsed  = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased    = 1 - Math.pow(1 - progress, 4);
    const current  = Math.round(target * eased);

    if (target >= 1000000) {
      el.textContent = (current / 1000000).toFixed(1) + 'M' + suffix;
    } else if (target >= 1000) {
      el.textContent = (current / 1000).toFixed(current >= 1000 ? 0 : 1) + 'K' + suffix;
    } else {
      el.textContent = current.toLocaleString() + suffix;
    }

    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      animateCounter(entry.target);
      counterObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.4 });

document.querySelectorAll('.stat-number[data-target]').forEach(el => counterObserver.observe(el));

/* ── Hero stat counters (smaller ones) ── */
document.querySelectorAll('.hero-stat-number[data-target]').forEach(el => {
  const target = parseInt(el.dataset.target);
  const suffix = el.dataset.suffix || '';
  const io = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      const start = performance.now();
      const dur = 1400;
      function step(now) {
        const p = Math.min((now - start) / dur, 1);
        const v = Math.round(target * (1 - Math.pow(1 - p, 3)));
        el.textContent = (target >= 1000000 ? (v / 1000000).toFixed(1) + 'M'
          : target >= 1000 ? (v / 1000).toFixed(0) + 'K'
          : v.toString()) + suffix;
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
      io.disconnect();
    }
  }, { threshold: 0.5 });
  io.observe(el);
});

/* ── FAQ toggle ── */
function toggleFaq(questionEl) {
  const item   = questionEl.closest('.faq-item');
  const answer = item.querySelector('.faq-answer');
  const isOpen = item.classList.contains('open');

  // Close all
  document.querySelectorAll('.faq-item.open').forEach(openItem => {
    openItem.classList.remove('open');
    openItem.querySelector('.faq-answer').style.maxHeight = '0';
  });

  if (!isOpen) {
    item.classList.add('open');
    answer.style.maxHeight = answer.scrollHeight + 'px';
  }
}

/* ── Pricing toggle ── */
let isAnnual = false;

const prices = {
  monthly: { free: '0', pro: '12', team: '29' },
  annual:  { free: '0', pro: '9',  team: '22' }
};

function toggleBilling() {
  isAnnual = !isAnnual;
  const toggle = document.getElementById('billingToggle');
  const monthlyLabel = document.getElementById('monthlyLabel');
  const annualLabel  = document.getElementById('annualLabel');

  toggle.classList.toggle('on', isAnnual);
  monthlyLabel.classList.toggle('active', !isAnnual);
  annualLabel.classList.toggle('active', isAnnual);

  const p = isAnnual ? prices.annual : prices.monthly;

  animatePrice('price-free', p.free);
  animatePrice('price-pro',  p.pro);
  animatePrice('price-team', p.team);

  document.getElementById('note-free').innerHTML  = isAnnual ? '&nbsp;' : '&nbsp;';
  document.getElementById('note-pro').innerHTML   = isAnnual ? 'Billed $108/yr · Save $36' : '&nbsp;';
  document.getElementById('note-team').innerHTML  = isAnnual ? 'Billed $264/yr · Save $84' : '&nbsp;';
}

function animatePrice(elId, target) {
  const el  = document.getElementById(elId);
  const from = parseInt(el.textContent) || 0;
  const to   = parseInt(target);
  const dur  = 400;
  const start = performance.now();

  function step(now) {
    const p = Math.min((now - start) / dur, 1);
    el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 2)));
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ── CTA email passthrough ── */
function passCtaEmail() {
  const email = document.getElementById('ctaEmail')?.value;
  if (email) {
    sessionStorage.setItem('signup_email', email);
  }
}

/* ── Active nav link on scroll ── */
const sections = document.querySelectorAll('section[id], div[id]');
const navLinks = document.querySelectorAll('.nav-center a');

const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const id = entry.target.id;
      navLinks.forEach(link => {
        link.style.color = link.getAttribute('href') === `#${id}`
          ? '#f1f5f9' : '';
      });
    }
  });
}, { threshold: 0.4 });

sections.forEach(s => sectionObserver.observe(s));

/* ── Tilt on dashboard mockup ── */
const dashboard = document.querySelector('.hero-dashboard');
const heroRight  = document.querySelector('.hero-right');

if (heroRight && dashboard) {
  heroRight.addEventListener('mousemove', (e) => {
    const rect = heroRight.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width  - 0.5;
    const y = (e.clientY - rect.top)  / rect.height - 0.5;
    dashboard.style.transform = `perspective(1000px) rotateY(${x * 8}deg) rotateX(${-y * 5}deg)`;
    dashboard.style.transition = 'transform 0.1s ease';
  });

  heroRight.addEventListener('mouseleave', () => {
    dashboard.style.transform = 'perspective(1000px) rotateY(0) rotateX(0)';
    dashboard.style.transition = 'transform 0.6s ease';
  });
}

/* ── Pickup signup email if passed from CTA ── */
document.addEventListener('DOMContentLoaded', () => {
  const stored = sessionStorage.getItem('signup_email');
  const emailInput = document.getElementById('email');
  if (stored && emailInput) {
    emailInput.value = stored;
    sessionStorage.removeItem('signup_email');
  }
});
