// ============================================================
// COMMON — shared utilities used across all pages
// ============================================================

// Initialize Firebase
firebase.initializeApp(FIREBASE_CONFIG);

const db = firebase.firestore();

// ── Toast notifications ───────────────────────────────────
function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ── Navigation active link ────────────────────────────────
function setActiveNavLink() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(el => {
    const href = el.getAttribute('href') || '';
    el.classList.toggle('active', href === path || href.startsWith(path.split('.')[0]));
  });
}

document.addEventListener('DOMContentLoaded', setActiveNavLink);
