'use strict';

// Redireciona se já tiver token válido
(async () => {
  const token = sessionStorage.getItem('auth_token');
  if (!token) return;
  try {
    const res = await fetch('/api/verify', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) window.location.replace('/dashboard.html');
  } catch {}
})();

const form = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const errorBox = document.getElementById('loginError');
const submitBtn = document.getElementById('submitBtn');
const btnText = document.getElementById('btnText');
const btnLoader = document.getElementById('btnLoader');
const togglePwd = document.getElementById('togglePwd');
const eyeOpen = document.getElementById('eyeOpen');
const eyeClosed = document.getElementById('eyeClosed');

// Toggle visibilidade da password
togglePwd.addEventListener('click', () => {
  const isPassword = passwordInput.type === 'password';
  passwordInput.type = isPassword ? 'text' : 'password';
  eyeOpen.style.display = isPassword ? 'none' : '';
  eyeClosed.style.display = isPassword ? '' : 'none';
  togglePwd.setAttribute('aria-label', isPassword ? 'Esconder password' : 'Mostrar password');
});

function setLoading(loading) {
  submitBtn.disabled = loading;
  btnText.style.display = loading ? 'none' : '';
  btnLoader.style.display = loading ? '' : 'none';
}

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.style.display = '';
}

function hideError() {
  errorBox.style.display = 'none';
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    showError('Preenche o utilizador e a password.');
    return;
  }

  setLoading(true);

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      showError(data.error || 'Erro ao autenticar. Tenta novamente.');
      passwordInput.value = '';
      passwordInput.focus();
      return;
    }

    sessionStorage.setItem('auth_token', data.token);
    sessionStorage.setItem('token_expiry', Date.now() + data.expiresIn * 1000);
    window.location.replace('/dashboard.html');

  } catch {
    showError('Não foi possível ligar ao servidor. Verifica a tua ligação.');
  } finally {
    setLoading(false);
  }
});
