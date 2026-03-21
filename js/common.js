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

document.addEventListener('DOMContentLoaded', () => {
  setActiveNavLink();

  // Hamburger toggle
  const toggle = document.getElementById('navbar-toggle');
  const nav    = document.getElementById('navbar-nav');
  const navbar = document.getElementById('main-navbar');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = navbar.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', open);
      toggle.textContent = open ? '✕' : '☰';
    });
    // Close menu when a nav link is clicked
    nav.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navbar.classList.remove('nav-open');
        toggle.setAttribute('aria-expanded', false);
        toggle.textContent = '☰';
      });
    });
  }
});

// ── Bracket override from Firestore ──────────────────────
// Admin can edit team names in the DB; this patches the global BRACKET constant.
async function loadBracketOverride() {
  try {
    const snap = await db.collection('settings').doc('bracket').get();
    if (!snap.exists) return;
    const data = snap.data();
    if (data.west?.r1?.length) BRACKET.west.r1 = data.west.r1;
    if (data.east?.r1?.length) BRACKET.east.r1 = data.east.r1;
  } catch (e) {
    console.warn('loadBracketOverride:', e);
  }
}
