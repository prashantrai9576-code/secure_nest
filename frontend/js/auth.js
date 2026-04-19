// ================================================
// auth.js – Firebase Auth (Email Verification)
// ================================================

// ── Auth State Observer ──────────────────────────────────
auth.onAuthStateChanged(user => {
  if (user) {
    // Only redirect if email is verified
    if (user.emailVerified) {
      if (window.location.pathname.includes('auth.html')) {
        window.location.href = 'dashboard.html';
      }
    } else {
      // If not verified and trying to access dashboard, send back to auth
      if (!window.location.pathname.includes('auth.html')) {
        window.location.href = 'auth.html';
      }
    }
  }
});

// ── LOGIN ────────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  setLoading('loginBtn', true);
  try {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    if (!cred.user.emailVerified) {
      await auth.signOut();
      setLoading('loginBtn', false, 'Secure Login');
      showAuthError('Please verify your email before logging in. Check your inbox for the link.');
      return;
    }
    window.location.href = 'dashboard.html';
  } catch (err) {
    setLoading('loginBtn', false, 'Secure Login');
    showAuthError(firebaseErrorMsg(err.code));
  }
}

// ── SIGNUP (Email + Verification Link) ───────────────────
async function handleSignup(e) {
  e.preventDefault();
  const name     = document.getElementById('signupName').value.trim();
  const email    = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const confirm  = document.getElementById('signupConfirm').value;

  document.getElementById('authError').classList.remove('show');

  if (password !== confirm) {
    showAuthError('Passwords do not match.');
    return;
  }
  
  setLoading('signupBtn', true);
  
  try {
    // 1. Create User with Password
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    
    // 2. Send Verification Email (Native Firebase)
    await cred.user.sendEmailVerification();
    
    // 3. Update Profile
    await cred.user.updateProfile({ displayName: name });
    
    // 4. Save to DB
    await db.ref('users/' + cred.user.uid).set({
      name: name,
      email: email,
      role: 'Member',
      createdAt: firebase.database.ServerValue.TIMESTAMP
    });

    // 5. Important: Logout so they can't access dashboard until they verify
    await auth.signOut();

    // Update UI
    document.getElementById('signupFields').style.display = 'none';
    document.getElementById('otpSection').style.display = 'block';
    document.getElementById('otpSection').innerHTML = `
      <div style="text-align:center; padding: 2rem 0;">
        <i class="fa-solid fa-envelope-circle-check" style="font-size:3rem; color:var(--color-success); margin-bottom:1rem;"></i>
        <h3 style="color:var(--color-text);">Verification Email Sent!</h3>
        <p style="color:var(--color-text-muted); font-size:0.9rem; margin-top:0.5rem;">
          We have sent a verification link to <strong>${email}</strong>.<br>
          Please click the link in your email to activate your account, then log in.
        </p>
        <button onclick="location.reload()" class="auth-submit" style="margin-top:1.5rem; width:auto; padding:0.8rem 2rem;">
          Go to Login
        </button>
      </div>
    `;
    document.getElementById('signupBtn').style.display = 'none';

  } catch (err) {
    console.error(err);
    setLoading('signupBtn', false, 'Create Account');
    showAuthError(firebaseErrorMsg(err.code));
  }
}



// ── HELPERS ──────────────────────────────────────────────
function firebaseErrorMsg(code) {
  const map = {
    'auth/email-already-in-use': 'This email is already registered.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/invalid-email': 'Please enter a valid email.',
    'auth/user-not-found': 'No account found.',
    'auth/wrong-password': 'Wrong password.'
  };
  return map[code] || `Error: ${code}`;
}

function logout() {
  auth.signOut().then(() => window.location.href = 'auth.html');
}
