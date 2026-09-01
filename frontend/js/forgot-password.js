const API_BASE=window.location.hostname==='localhost'||window.location.hostname==='127.0.0.1'?'http://localhost:3000/api':'https://fittrack-ai.onrender.com/api';
function showError(id,msg){const el=document.getElementById(id);if(!el)return;el.textContent=msg;el.classList.remove('hidden');}
function hideError(id){const el=document.getElementById(id);if(el)el.classList.add('hidden');}
function togglePwd(id){const inp=document.getElementById(id);if(!inp)return;inp.type=inp.type==='password'?'text':'password';}

function copyToken(el) {
  const text = el.textContent;
  navigator.clipboard.writeText(text).then(()=>{
    document.getElementById('tokenInput').value = text;
    el.style.color = '#10b981';
    setTimeout(()=>el.style.color='var(--accent-cyan)',1000);
  });
}

// Check if token in URL
const urlParams = new URLSearchParams(window.location.search);
const urlToken = urlParams.get('token');
if (urlToken) {
  document.getElementById('step1').style.display = 'none';
  document.getElementById('step2').style.display = 'block';
  document.getElementById('formTitle').textContent = 'Reset Password';
  document.getElementById('formSubtitle').textContent = 'Enter your new password below';
  document.getElementById('tokenInput').value = urlToken;
}

// Step 1: Request reset
document.getElementById('forgotForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError('forgotError');
  const btn   = document.getElementById('sendBtn');
  const email = document.getElementById('emailInput').value.trim();
  if (!email) { showError('forgotError','Please enter your email address.'); return; }
  btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Sending...'; btn.disabled=true;
  try {
    const r = await fetch(`${API_BASE}/auth/forgot-password`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email}) });
    const data = await r.json();
    // Show step 2
    document.getElementById('step1').style.display='none';
    document.getElementById('step2').style.display='block';
    document.getElementById('formTitle').textContent='Reset Password';
    document.getElementById('formSubtitle').textContent='Enter your token and new password';
    // Show demo token
    if (data.demo_token) {
      const box = document.getElementById('demoTokenBox');
      const val = document.getElementById('demoTokenVal');
      box.style.display='block';
      val.textContent = data.demo_token;
      document.getElementById('tokenInput').value = data.demo_token;
    }
  } catch(err) {
    showError('forgotError','Server error. Please try again.');
  } finally {
    btn.innerHTML='<i class="fas fa-paper-plane"></i> Send Reset Link'; btn.disabled=false;
  }
});

// Step 2: Reset password
document.getElementById('resetForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError('resetError');
  const btn  = document.getElementById('resetBtn');
  const token= document.getElementById('tokenInput').value.trim();
  const pwd  = document.getElementById('newPassword').value;
  const cpwd = document.getElementById('confirmNewPassword').value;
  if (!token) { showError('resetError','Please enter the reset token.'); return; }
  if (pwd.length < 6) { showError('resetError','Password must be at least 6 characters.'); return; }
  if (pwd !== cpwd)   { showError('resetError','Passwords do not match.'); return; }
  btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Resetting...'; btn.disabled=true;
  try {
    const r = await fetch(`${API_BASE}/auth/reset-password`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({token, new_password:pwd}) });
    const data = await r.json();
    if (!r.ok) { showError('resetError', data.error||'Invalid or expired token.'); return; }
    // Show step 3
    document.getElementById('step2').style.display='none';
    document.getElementById('step3').style.display='block';
    document.getElementById('formTitle').textContent='Success!';
    document.getElementById('formSubtitle').textContent='';
  } catch(err) {
    showError('resetError','Server error. Please try again.');
  } finally {
    btn.innerHTML='<i class="fas fa-check-circle"></i> Reset Password'; btn.disabled=false;
  }
});
