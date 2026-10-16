/**
 * TaskBoard API Fetch Wrapper & State Helpers
 */

const API_BASE = '/api';

export const auth = {
  getToken() {
    return localStorage.getItem('taskboard_token');
  },
  setToken(token) {
    if (token) {
      localStorage.setItem('taskboard_token', token);
    } else {
      localStorage.removeItem('taskboard_token');
    }
  },
  getUser() {
    const userStr = localStorage.getItem('taskboard_user');
    try {
      return userStr ? JSON.parse(userStr) : null;
    } catch (e) {
      return null;
    }
  },
  setUser(user) {
    if (user) {
      localStorage.setItem('taskboard_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('taskboard_user');
    }
  },
  clearAuth() {
    localStorage.removeItem('taskboard_token');
    localStorage.removeItem('taskboard_user');
  },
  isAuthenticated() {
    return !!localStorage.getItem('taskboard_token');
  },
  requireAuth() {
    if (!this.isAuthenticated()) {
      window.location.href = '/login.html';
      return false;
    }
    return true;
  },
  redirectIfAuthenticated() {
    if (this.isAuthenticated()) {
      window.location.href = '/dashboard.html';
      return true;
    }
    return false;
  }
};

/**
 * Universal API Request Helper
 */
export async function apiRequest(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const token = auth.getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers
  };

  try {
    const response = await fetch(url, config);

    // Handle 401 Unauthorized - redirect to login
    if (response.status === 401) {
      const isAuthPage = window.location.pathname.includes('login.html') || window.location.pathname.includes('register.html');
      if (!isAuthPage) {
        auth.clearAuth();
        window.location.href = '/login.html';
      }
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(data.error || data.message || `Request failed with status ${response.status}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (error) {
    console.error(`API Error on [${options.method || 'GET'} ${endpoint}]:`, error);
    throw error;
  }
}

export const api = {
  get: (endpoint) => apiRequest(endpoint, { method: 'GET' }),
  post: (endpoint, body) => apiRequest(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: (endpoint, body) => apiRequest(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (endpoint, body) => apiRequest(endpoint, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (endpoint) => apiRequest(endpoint, { method: 'DELETE' })
};

/**
 * Toast Notification Helper
 */
export function showToast(message, type = 'info', duration = 3500) {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'warning' ? '⚠' : 'ℹ';
  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-message">${escapeHtml(message)}</span>
    <button class="toast-close">&times;</button>
  `;

  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.remove();
  });

  toastContainer.appendChild(toast);

  // Auto remove
  setTimeout(() => {
    if (toast.parentElement) {
      toast.classList.add('toast-fade');
      setTimeout(() => toast.remove(), 300);
    }
  }, duration);
}

/**
 * Helper to escape HTML characters
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Helper to get user initials for avatar
 */
export function getInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/**
 * Helper to format date strings
 */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (e) {
    return dateStr;
  }
}

/**
 * Relative time helper
 */
export function timeAgo(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays}d ago`;
  return formatDate(dateStr);
}
