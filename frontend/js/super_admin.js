// super_admin.js - Super Admin specific logic
const ADMIN_API = `${BACKEND}/api/auth`;

// ── Auth Guard ──────────────────────────────────────────
auth.onAuthStateChanged(async user => {
    if (!user) {
        window.location.href = 'auth.html';
        return;
    }

    // Double check role
    try {
        const userEmail = (user.email || "").toLowerCase().trim();
        const isEmailSA = (userEmail === 'hr239531@gmail.com');

        const snapshot = await db.ref('users/' + user.uid).once('value');
        const userData = snapshot.val();
        
        const isDbSA = (userData && userData.role === 'SuperAdmin');
        
        if (!isDbSA && !isEmailSA) {
            showToast('Access Denied: Super Admin Only', 'danger');
            setTimeout(() => { window.location.href = 'dashboard.html'; }, 2000);
            return;
        }

        // If role was missing but email matches, fix it in DB silently
        if (isEmailSA && !isDbSA) {
             await db.ref('users/' + user.uid + '/role').set('SuperAdmin');
        }
        
        // If we are on the users tab, fetch them
        if (document.getElementById('tab-users').classList.contains('active')) {
            fetchAllUsers();
        }
    } catch (e) {
        console.error('Role check failed', e);
    }
});

// ── User Management ──────────────────────────────────────
async function fetchAllUsers() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    try {
        const token = await auth.currentUser.getIdToken();
        const response = await fetch(`${ADMIN_API}/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            renderUsers(data.users);
            document.getElementById('totalUsersCount').textContent = data.users.length;
        } else {
            showToast(data.error, 'danger');
        }
    } catch (e) {
        showToast('Failed to fetch users', 'danger');
    }
}

function renderUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    const currentUid = auth.currentUser.uid;

    tbody.innerHTML = users.map(user => `
        <tr>
            <td>
                <div class="user-cell">
                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=3b82f6&color=fff" class="user-avatar">
                    <span style="font-weight:600">${user.name} ${user.uid === currentUid ? '(You)' : ''}</span>
                </div>
            </td>
            <td style="color:var(--text-muted)">${user.email}</td>
            <td style="color:var(--text-muted)">${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</td>
            <td>
                <select class="role-select" onchange="updateUserRole('${user.uid}', this.value)" ${user.uid === currentUid ? 'disabled' : ''}>
                    <option value="Member" ${user.role === 'Member' ? 'selected' : ''}>Member</option>
                    <option value="Admin" ${user.role === 'Admin' ? 'selected' : ''}>Admin</option>
                    <option value="SuperAdmin" ${user.role === 'SuperAdmin' ? 'selected' : ''}>Super Admin</option>
                </select>
            </td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="deleteUser('${user.uid}')" ${user.uid === currentUid ? 'disabled' : ''}>
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

async function updateUserRole(uid, newRole) {
    if (!confirm(`Are you sure you want to change this user's role to ${newRole}?`)) {
        fetchAllUsers(); // Reset UI
        return;
    }

    try {
        const token = await auth.currentUser.getIdToken();
        const response = await fetch(`${ADMIN_API}/update-role`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ uid, role: newRole })
        });
        const data = await response.json();

        if (data.success) {
            showToast('Role updated successfully', 'success');
        } else {
            showToast(data.error, 'danger');
            fetchAllUsers(); // Reset UI
        }
    } catch (e) {
        showToast('Update failed', 'danger');
        fetchAllUsers();
    }
}

async function deleteUser(uid) {
    if (!confirm('Are you sure you want to delete this user from the database? This action cannot be undone.')) return;

    try {
        const token = await auth.currentUser.getIdToken();
        const response = await fetch(`${ADMIN_API}/delete-user?uid=${uid}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            showToast('User deleted successfully', 'success');
            fetchAllUsers();
        } else {
            showToast(data.error, 'danger');
        }
    } catch (e) {
        showToast('Delete failed', 'danger');
    }
}

// Override switchTab to include fetchAllUsers
const originalSwitchTab = window.switchTab;
window.switchTab = function(tab) {
    if (originalSwitchTab) originalSwitchTab(tab);
    if (tab === 'users') {
        fetchAllUsers();
    }
};

// Initialize if on Super Admin page
document.addEventListener('DOMContentLoaded', () => {
    // If there's a title that says Super Admin, we might want to do specific init
    console.log('Super Admin logic initialized');
});
