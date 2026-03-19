// ============================================================
// AUTH — Firebase Authentication helpers
// ============================================================

const auth = firebase.auth();

// ── Redirect if not logged in (call on protected pages) ──
function requireAuth(redirectTo = 'index.html') {
  return new Promise((resolve) => {
    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        window.location.href = redirectTo;
        return;
      }
      let userData = await getUserData(user.uid);
      // Если документ не создался при регистрации — создаём сейчас
      if (!userData) {
        userData = { username: user.email.split('@')[0], email: user.email, isAdmin: false };
        await db.collection('users').doc(user.uid).set({
          ...userData,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
      resolve({ user, userData });
    });
  });
}

// ── Redirect logged-in users away from auth page ─────────
function redirectIfLoggedIn(redirectTo = 'app.html') {
  auth.onAuthStateChanged((user) => {
    if (user) window.location.href = redirectTo;
  });
}

// ── Fetch user profile from Firestore ────────────────────
async function getUserData(uid) {
  try {
    const snap = await db.collection('users').doc(uid).get();
    return snap.exists ? snap.data() : null;
  } catch (e) {
    console.error('getUserData:', e);
    return null;
  }
}

// ── Register new user ─────────────────────────────────────
async function registerUser(email, password, username) {
  const cred = await auth.createUserWithEmailAndPassword(email, password);
  await db.collection('users').doc(cred.user.uid).set({
    username,
    email,
    isAdmin: false,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  return cred.user;
}

// ── Login ─────────────────────────────────────────────────
async function loginUser(email, password) {
  const cred = await auth.signInWithEmailAndPassword(email, password);
  return cred.user;
}

// ── Logout ────────────────────────────────────────────────
async function logoutUser() {
  await auth.signOut();
  window.location.href = 'index.html';
}

// ── Render user chip in navbar ─────────────────────────────
function renderUserChip(userData) {
  const el = document.getElementById('user-chip');
  if (!el || !userData) return;
  const initial = (userData.username || userData.email || '?')[0].toUpperCase();
  el.innerHTML = `
    <div class="avatar">${initial}</div>
    <span>${userData.username || userData.email}</span>
  `;
}

// ── Show/hide admin link ──────────────────────────────────
function applyAdminUI(userData) {
  const adminLinks = document.querySelectorAll('.admin-only');
  adminLinks.forEach(el => {
    el.style.display = userData?.isAdmin ? '' : 'none';
  });
}
