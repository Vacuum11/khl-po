// ============================================================
// AUTH — Firebase Authentication helpers
// ============================================================

const auth = firebase.auth();

// ── Username → fake email for Firebase Auth ───────────────
// Firebase requires an email, so we generate one from the username.
// The email is never shown to the user.
const _TRANSLIT = {
  'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh',
  'з':'z','и':'i','й':'j','к':'k','л':'l','м':'m','н':'n','о':'o',
  'п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts',
  'ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'
};

function usernameToEmail(username) {
  const slug = username.toLowerCase()
    .split('').map(c => _TRANSLIT[c] ?? c).join('')
    .replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_')
    .replace(/^_|_$/, '').slice(0, 30) || 'user';
  return `${slug}@khlpo.local`;
}

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
        userData = { username: 'Игрок', isAdmin: false };
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

// ── Register new user (by username, no email needed) ─────
async function registerUser(username, password) {
  const email = usernameToEmail(username);
  const cred = await auth.createUserWithEmailAndPassword(email, password);
  await db.collection('users').doc(cred.user.uid).set({
    username,
    isAdmin: false,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  return cred.user;
}

// ── Login (by username) ───────────────────────────────────
async function loginUser(username, password) {
  const email = usernameToEmail(username);
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
    el.classList.toggle('hidden', !userData?.isAdmin);
  });
}
