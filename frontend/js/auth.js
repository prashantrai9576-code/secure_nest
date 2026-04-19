// ================================================
// auth.js – Firebase Auth Logic
// ================================================

const BACKEND = 'http://localhost:5000';

// ── Auth State Observer ──────────────────────────────────
auth.onAuthStateChanged(user => {
  // If on auth page and already logged in, go to dashboard
  if (user && window.location.pathname.includes('auth.html')) {
    window.location.href = 'dashboard.html';
  }
});

// ── LOGIN ────────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const remember = document.getElementById('rememberMe').checked;

  if (!email || !password) {
    showAuthError('Please fill in all fields.');
    return;
  }

  setLoading('loginBtn', true);
  document.getElementById('authError').classList.remove('show');

  if (typeof firebaseConfig !== 'undefined' && firebaseConfig.apiKey === 'YOUR_API_KEY') {
    showToast('Demo Login successful! Redirecting...', 'success');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 800);
    return;
  }

  try {
    // Set persistence
    const persistence = remember
      ? firebase.auth.Auth.Persistence.LOCAL
      : firebase.auth.Auth.Persistence.SESSION;
    await auth.setPersistence(persistence);

    const cred = await auth.signInWithEmailAndPassword(email, password);

    // Verify with backend (optional)
    const token = await cred.user.getIdToken();
    try {
      await fetch(`${BACKEND}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      });
    } catch (_) { /* backend optional */ }

    showToast('Login successful! Redirecting...', 'success');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 800);

  } catch (err) {
    setLoading('loginBtn', false, '<i class="fa-solid fa-right-to-bracket"></i> Secure Login');
    showAuthError(firebaseErrorMsg(err.code));
  }
}

// ── SIGNUP ───────────────────────────────────────────────
async function handleSignup(e) {
  e.preventDefault();
  const name     = document.getElementById('signupName').value.trim();
  const email    = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const confirm  = document.getElementById('signupConfirm').value;

  if (password !== confirm) {
    showAuthError('Passwords do not match.');
    return;
  }

  setLoading('signupBtn', true);
  document.getElementById('authError').classList.remove('show');

  if (typeof firebaseConfig !== 'undefined' && firebaseConfig.apiKey === 'YOUR_API_KEY') {
    showToast('Demo Account created! Redirecting...', 'success');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 800);
    return;
  }

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await cred.user.updateProfile({ displayName: name });
    showToast('Account created! Redirecting...', 'success');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 800);

  } catch (err) {
    setLoading('signupBtn', false, '<i class="fa-solid fa-user-plus"></i> Create Account');
    showAuthError(firebaseErrorMsg(err.code));
  }
}

// ── FORGOT PASSWORD ──────────────────────────────────────
async function handleForgotPassword(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  if (!email) { showAuthError('Enter your email above first.'); return; }
  try {
    await auth.sendPasswordResetEmail(email);
    showToast('Password reset email sent!', 'success');
  } catch (err) {
    showAuthError(firebaseErrorMsg(err.code));
  }
}

// ── Error Messages ───────────────────────────────────────
function firebaseErrorMsg(code) {
  const map = {
    'auth/user-not-found':       'No account found with this email.',
    'auth/wrong-password':       'Incorrect password. Please try again.',
    'auth/invalid-email':        'Please enter a valid email address.',
    'auth/email-already-in-use': 'This email is already registered.',
    'auth/weak-password':        'Password must be at least 8 characters.',
    'auth/too-many-requests':    'Too many attempts. Please try later.',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/invalid-credential':   'Invalid email or password.',
  };
  return map[code] || 'Authentication failed. Please try again.';
}
