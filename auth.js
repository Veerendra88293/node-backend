// auth.js: Handles login/signup and per-user session logic

function getUsers() {
  return JSON.parse(localStorage.getItem('users') || '{}');
}
function setUsers(users) {
  localStorage.setItem('users', JSON.stringify(users));
}
function getCurrentUser() {
  return localStorage.getItem('currentUser') || null;
}
function setCurrentUser(email) {
  localStorage.setItem('currentUser', email);
}
function clearCurrentUser() {
  localStorage.removeItem('currentUser');
}

function showAuthSection(showLogin = true) {
  document.getElementById('auth-section').style.display = '';
  document.getElementById('main-navbar').style.display = 'none';
  document.getElementById('home-section').style.display = 'none';
  document.getElementById('user-list-section').style.display = 'none';
  document.getElementById('login-box').style.display = showLogin ? '' : 'none';
  document.getElementById('signup-box').style.display = showLogin ? 'none' : '';
  document.getElementById('login-error').textContent = '';
  document.getElementById('signup-error').textContent = '';
}
function showApp() {
  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('main-navbar').style.display = '';
  document.getElementById('home-section').style.display = '';
}

// Login/signup logic
window.onload = function() {
  // Show login/signup if not logged in
  if (!getCurrentUser()) {
    showAuthSection(true);
  } else {
    showApp();
  }
  // Switch between login/signup
  document.getElementById('show-signup').onclick = function(e) {
    e.preventDefault();
    showAuthSection(false);
  };
  document.getElementById('show-login').onclick = function(e) {
    e.preventDefault();
    showAuthSection(true);
  };
  // Login
  document.getElementById('login-btn').onclick = function() {
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;
    const users = getUsers();
    if (!email || !password) {
      document.getElementById('login-error').textContent = 'Please enter email and password.';
      return;
    }
    if (!users[email] || users[email].password !== password) {
      document.getElementById('login-error').textContent = 'Invalid email or password.';
      return;
    }
    setCurrentUser(email);
    showApp();
    window.location.reload();
  };
  // Signup
  document.getElementById('signup-btn').onclick = function() {
    const email = document.getElementById('signup-email').value.trim().toLowerCase();
    const password = document.getElementById('signup-password').value;
    const users = getUsers();
    if (!email || !password) {
      document.getElementById('signup-error').textContent = 'Please enter email and password.';
      return;
    }
    if (users[email]) {
      document.getElementById('signup-error').textContent = 'User already exists.';
      return;
    }
    users[email] = { password: password };
    setUsers(users);
    setCurrentUser(email);
    showApp();
    window.location.reload();
  };
  // Logout
  document.getElementById('logout-link').onclick = function(e) {
    e.preventDefault();
    clearCurrentUser();
    window.location.reload();
  };
};

// Per-user DPIDs storage
function getUserDpids() {
  const user = getCurrentUser();
  if (!user) return [];
  return JSON.parse(localStorage.getItem('dpids_' + user) || '[]');
}
function setUserDpids(dpids) {
  const user = getCurrentUser();
  if (!user) return;
  localStorage.setItem('dpids_' + user, JSON.stringify(dpids));
}
// Patch global dpids for compatibility with existing code
Object.defineProperty(window, 'dpids', {
  get: function() { return getUserDpids(); },
  set: function(val) { setUserDpids(val); }
});
// Patch displayDpids and displayUserEntries to use per-user storage
window.displayDpids = function() {
  setUserDpids(window.dpids);
  if (typeof displayUserEntries === 'function') displayUserEntries();
};
// On load, set dpids to current user's entries
if (getCurrentUser()) {
  window.dpids = getUserDpids();
}
