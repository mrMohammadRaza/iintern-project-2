import { api, auth, showToast } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
  // If already authenticated, redirect immediately to dashboard
  auth.redirectIfAuthenticated();

  // Setup quick demo fill buttons if on login page
  const demoButtons = document.querySelectorAll('.demo-acc-btn');
  demoButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const email = btn.dataset.email;
      const pass = btn.dataset.pass;
      const emailInput = document.getElementById('login-email');
      const passInput = document.getElementById('login-password');
      if (emailInput && passInput) {
        emailInput.value = email;
        passInput.value = pass;
        showToast(`Filled demo credentials for ${email}`, 'info', 2000);
      }
    });
  });

  // Login form handler
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('btn-login-submit');
      const emailInput = document.getElementById('login-email');
      const passwordInput = document.getElementById('login-password');

      const email = emailInput.value.trim();
      const password = passwordInput.value;

      if (!email || !password) {
        showToast('Please fill in both email and password', 'warning');
        return;
      }

      try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Signing in...';

        const data = await api.post('/auth/login', { email, password });
        auth.setToken(data.token);
        auth.setUser(data.user);

        showToast('Welcome back! Redirecting...', 'success', 1500);
        setTimeout(() => {
          window.location.href = '/dashboard.html';
        }, 800);
      } catch (error) {
        showToast(error.message || 'Login failed', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In';
      }
    });
  }

  // Register form handler
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('btn-register-submit');
      const nameInput = document.getElementById('register-name');
      const emailInput = document.getElementById('register-email');
      const passwordInput = document.getElementById('register-password');

      const name = nameInput.value.trim();
      const email = emailInput.value.trim();
      const password = passwordInput.value;

      if (!name || !email || !password) {
        showToast('All fields are required', 'warning');
        return;
      }

      if (password.length < 6) {
        showToast('Password must be at least 6 characters', 'warning');
        return;
      }

      try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating account...';

        const data = await api.post('/auth/register', { name, email, password });
        auth.setToken(data.token);
        auth.setUser(data.user);

        showToast('Account created successfully! Redirecting...', 'success', 1500);
        setTimeout(() => {
          window.location.href = '/dashboard.html';
        }, 800);
      } catch (error) {
        showToast(error.message || 'Registration failed', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Account';
      }
    });
  }
});
