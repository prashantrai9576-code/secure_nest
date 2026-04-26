// ================================================
// auth.js – Firebase Auth (Email Verification)
// ================================================

// ── Auth State Observer ──────────────────────────────────
auth.onAuthStateChanged(async user => {
  const isAuthPage = window.location.pathname.includes('auth.html') || window.location.pathname.endsWith('/') || window.location.pathname === '';

  if (user) {
    const userEmail = (user.email || "").toLowerCase().trim();
    const isEmailSA = (userEmail === 'hr239531@gmail.com');

    // 1. Instant Bypass for Super Admin Email
    if (isEmailSA && isAuthPage) {
        window.location.href = 'super_admin.html';
        return;
    }

    // 2. Fetch role for others
    const snapshot = await db.ref('users/' + user.uid).once('value');
    const userData = snapshot.val();
    const role = userData ? userData.role : 'Member';
    const isDbSA = (role === 'SuperAdmin');

    if (user.emailVerified || isEmailSA || isDbSA) {
      if (isAuthPage) {
        window.location.href = (isEmailSA || isDbSA) ? 'super_admin.html' : 'dashboard.html';
      }
    } else {
      if (!isAuthPage) {
        window.location.href = 'auth.html';
      }
    }
  } else if (!isAuthPage) {
    window.location.href = 'auth.html';
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

    // Check role in DB for others
    const snapshot = await db.ref('users/' + cred.user.uid).once('value');
    const userData = snapshot.val();
    const role = userData ? userData.role : 'Member';

    const isSA = (email.toLowerCase() === 'hr239531@gmail.com');

    // If it's SuperAdmin, bypass email verification check
    if (!cred.user.emailVerified && role !== 'SuperAdmin' && !isSA) {
      await auth.signOut();
      setLoading('loginBtn', false, 'Secure Login');
      showAuthError('Please verify your email before logging in. Check your inbox for the link.');
      return;
    }

    if (isSA && role !== 'SuperAdmin') {
        // Automatically promote this email to SuperAdmin in DB if not already
        await db.ref('users/' + cred.user.uid + '/role').set('SuperAdmin');
    }

    window.location.href = (role === 'SuperAdmin' || isSA) ? 'super_admin.html' : 'dashboard.html';
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
    
    const isSA = (email.toLowerCase() === 'hr239531@gmail.com');

    // 2. Send Verification Email (Native Firebase) - Skip for Super Admin
    if (!isSA) {
      await cred.user.sendEmailVerification();
    }
    
    // 3. Update Profile
    await cred.user.updateProfile({ displayName: name });
    
    // 4. Save to DB
    const role = isSA ? 'SuperAdmin' : 'Member';
    await db.ref('users/' + cred.user.uid).set({
      name: name,
      email: email,
      role: role,
      createdAt: firebase.database.ServerValue.TIMESTAMP
    });

    // 5. Important: Logout so they can't access dashboard until they verify
    // Skip for Super Admin so they can enter immediately
    if (!isSA) {
      await auth.signOut();
      
      // Update UI for regular users
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
    } else {
      // Super Admin: Redirect directly
      window.location.href = 'super_admin.html';
    }

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
