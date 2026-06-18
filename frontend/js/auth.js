const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000/api'
  : window.location.origin + '/api';

// ─── Helpers ────────────────────────────────────────────────────────────────
function getToken() {
  migrateStorageKeys();
  return localStorage.getItem('fittrack_token') || localStorage.getItem('fittrack-token');
}
function getUser() {
  migrateStorageKeys();
  const raw = localStorage.getItem('fittrack_user') || localStorage.getItem('fittrack-user') || '{}';
  try { return JSON.parse(raw); } catch { return {}; }
}
function migrateStorageKeys() {
  const token = localStorage.getItem('fittrack-token');
  const user = localStorage.getItem('fittrack-user');
  const theme = localStorage.getItem('fittrack-theme');
  if (token && !localStorage.getItem('fittrack_token')) localStorage.setItem('fittrack_token', token);
  if (user && !localStorage.getItem('fittrack_user')) localStorage.setItem('fittrack_user', user);
  if (theme && !localStorage.getItem('fittrack_theme')) localStorage.setItem('fittrack_theme', theme);
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}
function clearError(id) {
  const el = document.getElementById(id);
  if (el) { el.textContent = ''; el.classList.add('hidden'); }
}

function showToast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = `auth-toast auth-toast-${type}`;
  t.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${msg}`;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3500);
}

function setLoading(btn, loading) {
  if (loading) {
    btn.dataset.originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Please wait...';
    btn.disabled = true;
  } else {
    btn.innerHTML = btn.dataset.originalText || btn.innerHTML;
    btn.disabled = false;
  }
}

// ─── Password strength ───────────────────────────────────────────────────────
function checkPasswordStrength(password) {
  let score = 0;
  if (password.length >= 8)  score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score; // 0-4
}

function updateStrengthBar(password) {
  const bar  = document.getElementById('strengthBar');
  const text = document.getElementById('strengthText');
  if (!bar || !text) return;
  const score = checkPasswordStrength(password);
  const levels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['', '#ef4444', '#f59e0b', '#06b6d4', '#10b981'];
  const widths  = ['0%', '25%', '50%', '75%', '100%'];
  bar.style.width = widths[score] || '0%';
  bar.style.background = colors[score] || 'transparent';
  text.textContent = levels[score] || '';
  text.style.color = colors[score] || '';
}

// ─── Toggle password visibility ──────────────────────────────────────────────
function togglePassword(inputId, btnId) {
  const input = document.getElementById(inputId);
  const btn   = document.getElementById(btnId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    if (btn) btn.innerHTML = '<i class="fas fa-eye-slash"></i>';
  } else {
    input.type = 'password';
    if (btn) btn.innerHTML = '<i class="fas fa-eye"></i>';
  }
}

// ─── LOGIN ───────────────────────────────────────────────────────────────────
function initLoginPage() {
  // Redirect if already logged in
  if (getToken()) { window.location.href = 'dashboard.html'; return; }

  const form = document.getElementById('loginForm');
  if (!form) return;

  document.getElementById('togglePassword')?.addEventListener('click', () => togglePassword('password', 'togglePassword'));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError('loginError');
    const btn   = form.querySelector('button[type="submit"]');
    const email = document.getElementById('email').value.trim();
    const pass  = document.getElementById('password').value;

    if (!email || !pass) { showError('loginError', 'Please fill in all fields.'); return; }

    setLoading(btn, true);
    try {
      const res  = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      localStorage.setItem('fittrack_token', data.token);
      localStorage.setItem('fittrack_user', JSON.stringify(data.user));
      showToast('Login successful! Redirecting…');
      setTimeout(() => {
        window.location.href = data.user.role === 'admin' ? 'admin.html' : 'dashboard.html';
      }, 800);
    } catch (err) {
      showError('loginError', err.message);
      // Shake animation
      form.classList.add('shake');
      setTimeout(() => form.classList.remove('shake'), 500);
    } finally {
      setLoading(btn, false);
    }
  });
}

// ─── SIGNUP ──────────────────────────────────────────────────────────────────
function initSignupPage() {
  if (getToken()) { window.location.href = 'dashboard.html'; return; }

  const form = document.getElementById('signupForm');
  if (!form) return;

  // Password toggles
  document.getElementById('togglePassword')?.addEventListener('click',  () => togglePassword('password', 'togglePassword'));
  document.getElementById('togglePassword2')?.addEventListener('click', () => togglePassword('confirmPassword', 'togglePassword2'));

  // Password strength live update
  document.getElementById('password')?.addEventListener('input', (e) => updateStrengthBar(e.target.value));

  // Optional section toggle
  const toggleOptional = document.getElementById('toggleOptional');
  const optionalSection = document.getElementById('optionalSection');
  if (toggleOptional && optionalSection) {
    toggleOptional.addEventListener('click', () => {
      const isOpen = optionalSection.style.display !== 'none';
      optionalSection.style.display = isOpen ? 'none' : 'block';
      toggleOptional.innerHTML = isOpen
        ? '<i class="fas fa-chevron-down"></i> Show Optional Details'
        : '<i class="fas fa-chevron-up"></i> Hide Optional Details';
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError('signupError');

    const btn         = form.querySelector('button[type="submit"]');
    const full_name   = document.getElementById('fullName').value.trim();
    const username    = document.getElementById('username').value.trim();
    const email       = document.getElementById('email').value.trim();
    const password    = document.getElementById('password').value;
    const confirm     = document.getElementById('confirmPassword').value;
    const height_cm   = parseFloat(document.getElementById('height')?.value) || null;
    const weight_kg   = parseFloat(document.getElementById('weight')?.value) || null;
    const age         = parseInt(document.getElementById('age')?.value)  || null;
    const gender      = document.getElementById('gender')?.value || null;
    const terms       = document.getElementById('terms')?.checked;

    // Validation
    if (!full_name || !username || !email || !password || !confirm) {
      showError('signupError', 'Please fill in all required fields.'); return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      showError('signupError', 'Please enter a valid email address.'); return;
    }
    if (username.length < 3) {
      showError('signupError', 'Username must be at least 3 characters.'); return;
    }
    if (password.length < 6) {
      showError('signupError', 'Password must be at least 6 characters.'); return;
    }
    if (password !== confirm) {
      showError('signupError', 'Passwords do not match.'); return;
    }
    if (!terms) {
      showError('signupError', 'You must agree to the Terms of Service.'); return;
    }

    setLoading(btn, true);
    try {
      const payload = { full_name, username, email, password };
      if (height_cm) payload.height_cm = height_cm;
      if (weight_kg) payload.weight_kg = weight_kg;
      if (age)       payload.age       = age;
      if (gender)    payload.gender    = gender;

      const res  = await fetch(`${API_BASE}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Signup failed');

      showToast('Account created! Please log in. 🎉');
      setTimeout(() => { window.location.href = 'login.html'; }, 900);
    } catch (err) {
      showError('signupError', err.message);
      form.classList.add('shake');
      setTimeout(() => form.classList.remove('shake'), 500);
    } finally {
      setLoading(btn, false);
    }
  });
}

// ─── Logout (global) ─────────────────────────────────────────────────────────
function logout() {
  localStorage.removeItem('fittrack_token');
  localStorage.removeItem('fittrack_user');
  window.location.href = 'index.html';
}

// ─── Boot ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('loginForm'))  initLoginPage();
  if (document.getElementById('signupForm')) initSignupPage();
});

// ─── Toggle password visibility ──────────────────────────────────────────────
function togglePwd(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isText = input.type === 'text';
  input.type = isText ? 'password' : 'text';
  const icon = btn.querySelector('i');
  if (icon) icon.className = isText ? 'fas fa-eye' : 'fas fa-eye-slash';
}

// ─── Password strength meter ──────────────────────────────────────────────────
function checkPasswordStrength(password) {
  let strength = 0;
  if (password.length >= 6)  strength++;
  if (password.length >= 10) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^A-Za-z0-9]/.test(password)) strength++;
  strength = Math.min(strength, 4);

  const fill  = document.getElementById('strengthFill');
  const label = document.getElementById('strengthLabel');
  if (!fill) return;

  const configs = [
    { width: '0%',   color: 'transparent', text: '' },
    { width: '25%',  color: '#ef4444',     text: 'Weak' },
    { width: '50%',  color: '#f59e0b',     text: 'Fair' },
    { width: '75%',  color: '#06b6d4',     text: 'Good' },
    { width: '100%', color: '#10b981',     text: 'Strong' },
  ];

  const cfg = configs[strength] || configs[0];
  fill.style.width      = cfg.width;
  fill.style.background = cfg.color;
  if (label) {
    label.textContent = cfg.text;
    label.style.color = cfg.color;
  }
}

// ─── Toggle optional fields (signup) ─────────────────────────────────────────
function toggleOptional() {
  const fields = document.getElementById('optionalFields');
  const toggle = document.getElementById('optionalToggle');
  const span   = toggle ? toggle.querySelector('span') : null;
  const icon   = toggle ? toggle.querySelector('i') : null;
  if (!fields) return;

  const isOpen = fields.classList.contains('open');
  fields.classList.toggle('open', !isOpen);
  if (toggle) toggle.classList.toggle('open', !isOpen);
  if (icon)   icon.style.transform = isOpen ? '' : 'rotate(180deg)';
  if (span)   span.textContent = isOpen ? '+ Add profile info (optional)' : '− Hide profile info';
}

// ─── Show forgot-password error ───────────────────────────────────────────────
function showFpError(msg) {
  const el = document.getElementById('fpError');
  if (el) { el.textContent = msg; el.style.display = 'flex'; }
}

// ─── Forgot Password ──────────────────────────────────────────────────────────
async function handleForgotPassword(event) {
  event.preventDefault();
  const emailInput = document.getElementById('fpEmail');
  const btn        = document.getElementById('fpBtn');
  if (!emailInput || !btn) return;

  const email = emailInput.value.trim();
  if (!email) { showFpError('Please enter your email address.'); return; }

  const fpErr = document.getElementById('fpError');
  if (fpErr) fpErr.style.display = 'none';

  setLoading(btn, true);

  try {
    const res  = await fetch(`${API_BASE}/auth/forgot-password`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email }),
    });
    const data = await res.json();

    if (res.ok) {
      const formEl    = document.getElementById('fpForm');
      const successEl = document.getElementById('fpSuccess');
      if (formEl)    formEl.style.display = 'none';
      if (successEl) successEl.style.display = 'block';

      // Demo: expose reset link directly
      if (data.token) {
        const linkBtn = document.getElementById('fpResetLink');
        if (linkBtn) {
          linkBtn.href = `reset-password.html?token=${data.token}`;
          linkBtn.style.display = 'inline-flex';
        }
      }
    } else {
      showFpError(data.error || 'Email not found. Please check and try again.');
    }
  } catch (err) {
    showFpError('Connection error. Is the server running on port 3000?');
  } finally {
    setLoading(btn, false);
  }
}

// ─── Reset Password ───────────────────────────────────────────────────────────
async function handleResetPassword(event) {
  event.preventDefault();
  const token           = new URLSearchParams(window.location.search).get('token');
  const newPwdInput     = document.getElementById('newPassword');
  const confirmPwdInput = document.getElementById('confirmPassword');
  const btn             = document.getElementById('resetBtn');
  const errBox          = document.getElementById('rpError');
  const errMsg          = document.getElementById('rpErrorMsg');

  if (!token) { showToast('Invalid or missing reset token.', 'error'); return; }

  const newPassword     = newPwdInput?.value || '';
  const confirmPassword = confirmPwdInput?.value || '';

  if (newPassword.length < 6) {
    showToast('Password must be at least 6 characters.', 'error'); return;
  }
  if (newPassword !== confirmPassword) {
    showToast('Passwords do not match.', 'error'); return;
  }

  if (errBox) errBox.classList.add('hidden');
  setLoading(btn, true);

  try {
    const res  = await fetch(`${API_BASE}/auth/reset-password`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token, newPassword }),
    });
    const data = await res.json();

    if (res.ok) {
      showToast('Password reset successfully! Redirecting to sign in...', 'success');
      setTimeout(() => { window.location.href = 'login.html'; }, 2000);
    } else {
      if (errBox && errMsg) {
        errMsg.textContent = data.error || 'Reset failed. Token may be expired.';
        errBox.classList.remove('hidden');
      }
    }
  } catch (err) {
    showToast('Connection error. Is the server running on port 3000?', 'error');
  } finally {
    setLoading(btn, false);
  }
}

