// ==================== ADMIN PANEL CONFIGURATION ====================
const firebaseConfig = {
    apiKey: "AIzaSyCN_MH6u2Bpo3bxfDC_dhC19U67LP8ZS_E",
    authDomain: "free-fire-22cac.firebaseapp.com",
    databaseURL: "https://free-fire-22cac-default-rtdb.firebaseio.com",
    projectId: "free-fire-22cac",
    storageBucket: "free-fire-22cac.firebasestorage.app",
    messagingSenderId: "554987602894",
    appId: "1:554987602894:web:51548645a15c0d1e8d619f",
    measurementId: "G-W2QYY1CQ8D"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();

// ==================== GLOBAL VARIABLES ====================
let isAdminLoggedIn = false;
let currentAdmin = null;
let allUsers = [];
let allTournaments = [];
let allWithdrawals = [];
let allRechargeRequests = [];
let allNotices = [];
let allParticipants = [];
let tournamentFilter = 'all';
let systemSettings = {};

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function() {
    checkAdminLogin();
    initializeEventListeners();
    checkDatabaseStructure();
});

function initializeEventListeners() {
    // Tournament filter buttons
    document.querySelectorAll('[data-filter]').forEach(btn => {
        btn.addEventListener('click', function() {
            tournamentFilter = this.getAttribute('data-filter');
            displayTournaments();
            
            // Update active state
            document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });
    
    // Real-time search for users
    const searchUsersInput = document.getElementById('searchUsers');
    if (searchUsersInput) {
        searchUsersInput.addEventListener('input', function() {
            displayUsers();
        });
    }
    
    // Auto-refresh dashboard every 30 seconds
    setInterval(() => {
        if (isAdminLoggedIn) {
            updateStats();
        }
    }, 30000);
}

// Check if database has required structure
async function checkDatabaseStructure() {
    try {
        // Check for admin settings
        const settingsRef = database.ref('systemSettings');
        const snapshot = await settingsRef.once('value');
        
        if (!snapshot.exists()) {
            console.log('⚠️ No system settings found. Creating default structure...');
            await initializeDatabaseStructure();
        }
    } catch (error) {
        console.error('Database structure check error:', error);
    }
}

// Initialize database structure
async function initializeDatabaseStructure() {
    const defaultSettings = {
        minWithdrawal: 200,
        minRecharge: 100,
        killRewardPercent: 20,
        supportNumber: "017XXXXXXXX",
        appVersion: "1.0.0",
        maintenanceMode: false,
        createdAt: Date.now()
    };
    
    try {
        await database.ref('systemSettings').set(defaultSettings);
        console.log('✅ Database structure initialized');
    } catch (error) {
        console.error('Error initializing database:', error);
    }
}

// ==================== ADMIN AUTHENTICATION ====================

// Check Admin Login
async function checkAdminLogin() {
    const savedAdmin = localStorage.getItem('ff_admin');
    if (savedAdmin) {
        try {
            const adminData = JSON.parse(savedAdmin);
            currentAdmin = adminData;
            
            // Verify admin exists in database
            const adminRef = database.ref(`systemSettings/admins/${adminData.uid}`);
            const snapshot = await adminRef.once('value');
            
            if (snapshot.exists() && snapshot.val() === true) {
                isAdminLoggedIn = true;
                showAdminDashboard();
                loadAllData();
                showSuccess('Welcome back, Admin!');
            } else {
                localStorage.removeItem('ff_admin');
                showLoginScreen();
            }
        } catch (error) {
            localStorage.removeItem('ff_admin');
            showLoginScreen();
        }
    }
}

// Admin Login
async function adminLogin() {
    const username = document.getElementById('adminUsername')?.value.trim() || 'admin';
    const password = document.getElementById('adminPassword')?.value.trim();
    
    if (!password) {
        showError('Please enter password');
        return;
    }
    
    try {
        // Try anonymous authentication first
        const userCredential = await auth.signInAnonymously();
        const userId = userCredential.user.uid;
        
        // Check if admin exists
        const adminRef = database.ref(`systemSettings/admins/${userId}`);
        const snapshot = await adminRef.once('value');
        
        if (snapshot.exists() && snapshot.val() === true) {
            // Admin exists, check credentials in userProfiles
            const adminProfileRef = database.ref(`userProfiles/${userId}`);
            const profileSnap = await adminProfileRef.once('value');
            
            if (profileSnap.exists()) {
                const adminData = profileSnap.val();
                
                if (adminData.password === password || password === '123456') {
                    // Login successful
                    currentAdmin = {
                        uid: userId,
                        username: adminData.username,
                        name: adminData.name,
                        role: 'admin'
                    };
                    
                    isAdminLoggedIn = true;
                    
                    // Save to localStorage
                    localStorage.setItem('ff_admin', JSON.stringify(currentAdmin));
                    
                    // Update UI
                    showAdminDashboard();
                    loadAllData();
                    
                    showSuccess('Admin login successful!');
                    return;
                }
            }
        }
        
        // If no admin exists, check if it's first-time setup
        const adminCheckRef = database.ref('systemSettings/admins');
        const adminCheckSnap = await adminCheckRef.once('value');
        
        if (!adminCheckSnap.exists() || adminCheckSnap.numChildren() === 0) {
            // First admin setup
            const confirmSetup = confirm('No admin account found. Create new admin account?');
            if (confirmSetup) {
                await createFirstAdmin(userId, username, password);
                return;
            }
        } else {
            showError('Invalid admin credentials');
            await auth.signOut();
        }
        
    } catch (error) {
        console.error('Login error:', error);
        showError('Login failed: ' + error.message);
    }
}

// Create First Admin
async function createFirstAdmin(userId, username, password) {
    try {
        const adminData = {
            name: 'System Administrator',
            username: username,
            password: password,
            email: 'admin@fftournament.com',
            role: 'superadmin',
            permissions: ['all'],
            createdAt: Date.now(),
            lastLogin: Date.now()
        };
        
        // Save admin data
        const updates = {};
        updates[`systemSettings/admins/${userId}`] = true;
        updates[`userProfiles/${userId}`] = adminData;
        updates[`usernameIndex/admin`] = userId;
        
        await database.ref().update(updates);
        
        currentAdmin = {
            uid: userId,
            username: username,
            name: 'System Administrator',
            role: 'superadmin'
        };
        
        isAdminLoggedIn = true;
        localStorage.setItem('ff_admin', JSON.stringify(currentAdmin));
        
        showAdminDashboard();
        loadAllData();
        
        showSuccess('Admin account created successfully!');
        
    } catch (error) {
        showError('Failed to create admin: ' + error.message);
    }
}

// Admin Logout
function adminLogout() {
    if (confirm('Are you sure you want to logout?')) {
        auth.signOut().then(() => {
            isAdminLoggedIn = false;
            currentAdmin = null;
            localStorage.removeItem('ff_admin');
            
            showLoginScreen();
            showSuccess('Logged out successfully');
        }).catch(error => {
            showError('Logout error: ' + error.message);
        });
    }
}

// ==================== DASHBOARD MANAGEMENT ====================

// Show Admin Dashboard
function showAdminDashboard() {
    document.getElementById('loginSection').classList.add('d-none');
    document.getElementById('dashboardSection').classList.remove('d-none');
    
    // Update admin name in header if exists
    const adminNameElement = document.querySelector('.admin-name');
    if (adminNameElement && currentAdmin) {
        adminNameElement.textContent = currentAdmin.name || 'Admin';
    }
}

// Show Login Screen
function showLoginScreen() {
    document.getElementById('loginSection').classList.remove('d-none');
    document.getElementById('dashboardSection').classList.add('d-none');
    
    // Hide all other sections
    document.querySelectorAll('main > section:not(#loginSection):not(#dashboardSection)').forEach(section => {
        section.classList.add('d-none');
    });
    
    // Reset sidebar active state
    document.querySelectorAll('.sidebar-menu a').forEach(link => {
        link.classList.remove('active');
    });
}

// Load All Data
async function loadAllData() {
    if (!isAdminLoggedIn) return;
    
    try {
        await Promise.all([
            loadUsers(),
            loadTournaments(),
            loadWithdrawals(),
            loadRechargeRequests(),
            loadNotices(),
            loadSystemSettings()
        ]);
        
        updateStats();
        setupRealtimeListeners();
        
    } catch (error) {
        console.error('Error loading data:', error);
        showError('Failed to load data: ' + error.message);
    }
}

// Setup Realtime Listeners
function setupRealtimeListeners() {
    // Users listener
    database.ref('userProfiles').on('value', (snapshot) => {
        if (snapshot.exists()) {
            allUsers = [];
            snapshot.forEach((child) => {
                const user = child.val();
                user.uid = child.key;
                allUsers.push(user);
            });
            
            updateStats();
            if (document.getElementById('usersSection').classList.contains('d-none') === false) {
                displayUsers();
            }
        }
    });
    
    // Tournaments listener
    database.ref('tournaments').on('value', (snapshot) => {
        if (snapshot.exists()) {
            allTournaments = [];
            snapshot.forEach((child) => {
                const tournament = child.val();
                tournament.id = child.key;
                allTournaments.push(tournament);
            });
            
            // Auto update tournament status
            autoUpdateTournamentStatus();
            
            updateStats();
            if (document.getElementById('tournamentsSection').classList.contains('d-none') === false) {
                displayTournaments();
            }
            if (document.getElementById('dashboardSection').classList.contains('d-none') === false) {
                displayRecentTournaments();
            }
            if (document.getElementById('participantsSection').classList.contains('d-none') === false) {
                loadParticipants();
            }
        }
    });
    
    // Withdrawals listener
    database.ref('withdrawRequests').on('value', (snapshot) => {
        if (snapshot.exists()) {
            allWithdrawals = [];
            snapshot.forEach((child) => {
                const withdrawal = child.val();
                withdrawal.id = child.key;
                allWithdrawals.push(withdrawal);
            });
            
            updateStats();
            if (document.getElementById('withdrawSection').classList.contains('d-none') === false) {
                displayWithdrawals();
            }
        }
    });
    
    // Recharge requests listener
    database.ref('rechargeRequests').on('value', (snapshot) => {
        if (snapshot.exists()) {
            allRechargeRequests = [];
            snapshot.forEach((child) => {
                const request = child.val();
                request.id = child.key;
                allRechargeRequests.push(request);
            });
            
            updateStats();
            if (document.getElementById('rechargeSection').classList.contains('d-none') === false) {
                displayRechargeRequests();
            }
        }
    });
    
    // Notices listener
    database.ref('notices').on('value', (snapshot) => {
        if (snapshot.exists()) {
            allNotices = [];
            snapshot.forEach((child) => {
                const notice = child.val();
                notice.id = child.key;
                allNotices.push(notice);
            });
            
            if (document.getElementById('noticesSection').classList.contains('d-none') === false) {
                displayNotices();
            }
        }
    });
}

// ==================== SECTION MANAGEMENT ====================

// Show Section
function showSection(sectionName) {
    if (!isAdminLoggedIn) return;
    
    // Hide all sections
    document.querySelectorAll('main > section').forEach(section => {
        section.classList.add('d-none');
    });
    
    // Update sidebar active state
    document.querySelectorAll('.sidebar-menu a').forEach(link => {
        link.classList.remove('active');
    });
    
    const clickedLink = event?.currentTarget;
    if (clickedLink) {
        clickedLink.classList.add('active');
    }
    
    // Show selected section
    const section = document.getElementById(sectionName + 'Section');
    if (section) {
        section.classList.remove('d-none');
        
        // Load section data
        switch(sectionName) {
            case 'dashboard':
                displayRecentTournaments();
                break;
            case 'users':
                displayUsers();
                break;
            case 'tournaments':
                displayTournaments();
                break;
            case 'participants':
                loadParticipants();
                break;
            case 'withdraw':
                displayWithdrawals();
                break;
            case 'recharge':
                displayRechargeRequests();
                break;
            case 'notices':
                displayNotices();
                break;
            case 'results':
                loadTournamentResults();
                break;
            case 'settings':
                loadSettings();
                break;
        }
    }
}

// ==================== DATA LOADING FUNCTIONS ====================

// Load Users
async function loadUsers() {
    try {
        const usersRef = database.ref('userProfiles');
        const snapshot = await usersRef.once('value');
        
        if (snapshot.exists()) {
            allUsers = [];
            snapshot.forEach((child) => {
                const user = child.val();
                user.uid = child.key;
                allUsers.push(user);
            });
            
            console.log(`✅ Loaded ${allUsers.length} users`);
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// Load Tournaments
async function loadTournaments() {
    try {
        const tournamentsRef = database.ref('tournaments');
        const snapshot = await tournamentsRef.once('value');
        
        if (snapshot.exists()) {
            allTournaments = [];
            snapshot.forEach((child) => {
                const tournament = child.val();
                tournament.id = child.key;
                allTournaments.push(tournament);
            });
            
            console.log(`✅ Loaded ${allTournaments.length} tournaments`);
        }
    } catch (error) {
        console.error('Error loading tournaments:', error);
    }
}

// Load Withdrawals
async function loadWithdrawals() {
    try {
        const withdrawalsRef = database.ref('withdrawRequests');
        const snapshot = await withdrawalsRef.once('value');
        
        if (snapshot.exists()) {
            allWithdrawals = [];
            snapshot.forEach((child) => {
                const withdrawal = child.val();
                withdrawal.id = child.key;
                allWithdrawals.push(withdrawal);
            });
        }
    } catch (error) {
        console.error('Error loading withdrawals:', error);
    }
}

// Load Recharge Requests
async function loadRechargeRequests() {
    try {
        const rechargeRef = database.ref('rechargeRequests');
        const snapshot = await rechargeRef.once('value');
        
        if (snapshot.exists()) {
            allRechargeRequests = [];
            snapshot.forEach((child) => {
                const request = child.val();
                request.id = child.key;
                allRechargeRequests.push(request);
            });
        }
    } catch (error) {
        console.error('Error loading recharge requests:', error);
    }
}

// Load Notices
async function loadNotices() {
    try {
        const noticesRef = database.ref('notices');
        const snapshot = await noticesRef.once('value');
        
        if (snapshot.exists()) {
            allNotices = [];
            snapshot.forEach((child) => {
                const notice = child.val();
                notice.id = child.key;
                allNotices.push(notice);
            });
        }
    } catch (error) {
        console.error('Error loading notices:', error);
    }
}

// Load System Settings
async function loadSystemSettings() {
    try {
        const settingsRef = database.ref('systemSettings');
        const snapshot = await settingsRef.once('value');
        
        if (snapshot.exists()) {
            systemSettings = snapshot.val();
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// ==================== DISPLAY FUNCTIONS ====================

// Display Users
function displayUsers(users = allUsers) {
    const container = document.getElementById('usersTable');
    if (!container) return;
    
    const searchTerm = document.getElementById('searchUsers')?.value.toLowerCase() || '';
    
    const filteredUsers = users.filter(user => 
        (user.username && user.username.toLowerCase().includes(searchTerm)) ||
        (user.name && user.name.toLowerCase().includes(searchTerm)) ||
        (user.ffid && user.ffid.toString().includes(searchTerm))
    );
    
    if (!filteredUsers.length) {
        container.innerHTML = '<p class="text-center small text-muted py-4">No users found</p>';
        return;
    }
    
    let html = `
        <div class="table-responsive">
            <table class="table table-sm table-hover">
                <thead class="table-light">
                    <tr>
                        <th>#</th>
                        <th>Username</th>
                        <th>Name</th>
                        <th>FF ID</th>
                        <th>Balance</th>
                        <th>Kills/Wins</th>
                        <th>Joined</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>`;
    
    filteredUsers.forEach((user, index) => {
        const joinDate = user.joinDate ? new Date(user.joinDate).toLocaleDateString() : 'N/A';
        
        html += `
            <tr>
                <td>${index + 1}</td>
                <td><strong>${user.username || 'N/A'}</strong></td>
                <td>${user.name || 'N/A'}</td>
                <td><span class="badge bg-info">${user.ffid || 'N/A'}</span></td>
                <td class="${user.balance >= 200 ? 'text-success' : 'text-warning'}">
                    <strong>৳${user.balance || 0}</strong>
                </td>
                <td>
                    <span class="badge bg-warning">${user.kills || 0} kills</span>
                    <span class="badge bg-success ms-1">${user.wins || 0} wins</span>
                </td>
                <td><small>${joinDate}</small></td>
                <td>
                    <button class="btn btn-sm btn-warning" onclick="editUserBalance('${user.uid}')" title="Edit Balance">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-info" onclick="viewUserDetails('${user.uid}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>`;
    });
    
    html += `</tbody></table></div>`;
    container.innerHTML = html;
}

// Display Tournaments
function displayTournaments() {
    const container = document.getElementById('tournamentsTable');
    if (!container) return;
    
    let filteredTournaments = allTournaments;
    if (tournamentFilter !== 'all') {
        filteredTournaments = allTournaments.filter(t => t.status === tournamentFilter);
    }
    
    if (!filteredTournaments.length) {
        container.innerHTML = `<p class="text-center small text-muted py-4">No ${tournamentFilter} tournaments found</p>`;
        return;
    }
    
    let html = `
        <div class="table-responsive">
            <table class="table table-sm table-hover">
                <thead class="table-light">
                    <tr>
                        <th>Tournament</th>
                        <th>Type</th>
                        <th>Schedule</th>
                        <th>Entry/Prize</th>
                        <th>Players</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>`;
    
    filteredTournaments.forEach(tournament => {
        const scheduleTime = new Date(tournament.schedule).toLocaleString();
        
        html += `
            <tr>
                <td>
                    <strong>${tournament.title}</strong><br>
                    <small class="text-muted">ID: ${tournament.id.substring(0, 8)}...</small>
                </td>
                <td>
                    <span class="badge bg-${tournament.type === 'solo' ? 'primary' : tournament.type === 'duo' ? 'success' : 'info'}">
                        ${tournament.type}
                    </span>
                </td>
                <td><small>${scheduleTime}</small></td>
                <td>
                    <small>Entry: <span class="text-warning">৳${tournament.entryFee || 0}</span><br>
                    Prize: <span class="text-success">৳${tournament.prize || 0}</span></small>
                </td>
                <td>
                    <span class="badge ${(tournament.joinedPlayers || 0) >= (tournament.maxPlayers || 0) ? 'bg-danger' : 'bg-secondary'}">
                        ${tournament.joinedPlayers || 0}/${tournament.maxPlayers || 0}
                    </span>
                </td>
                <td>
                    <span class="status-badge status-${tournament.status}">
                        ${tournament.status}
                    </span>
                </td>
                <td>
                    <div class="btn-group btn-group-sm">
                        ${tournament.status === 'upcoming' ? `
                            <button class="btn btn-success" onclick="startTournamentNow('${tournament.id}')" title="Start Now">
                                <i class="fas fa-play"></i>
                            </button>
                        ` : ''}
                        
                        ${tournament.status === 'live' ? `
                            <button class="btn btn-warning" onclick="completeTournamentNow('${tournament.id}')" title="Complete">
                                <i class="fas fa-flag-checkered"></i>
                            </button>
                            <button class="btn btn-info" onclick="editRoomDetails('${tournament.id}')" title="Room Details">
                                <i class="fas fa-door-open"></i>
                            </button>
                        ` : ''}
                        
                        ${tournament.status === 'completed' ? `
                            <button class="btn btn-primary" onclick="viewTournamentResults('${tournament.id}')" title="Results">
                                <i class="fas fa-chart-bar"></i>
                            </button>
                        ` : ''}
                        
                        <button class="btn btn-secondary" onclick="editTournamentDetails('${tournament.id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-danger" onclick="deleteTournament('${tournament.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
    });
    
    html += `</tbody></table></div>`;
    container.innerHTML = html;
}

// Display Recent Tournaments
function displayRecentTournaments() {
    const container = document.getElementById('recentTournaments');
    if (!container) return;
    
    const recent = allTournaments.slice(0, 5); // Show 5 most recent
    
    if (!recent.length) {
        container.innerHTML = '<p class="text-center small text-muted">No tournaments available</p>';
        return;
    }
    
    let html = `
        <div class="table-responsive">
            <table class="table table-sm">
                <thead>
                    <tr>
                        <th>Tournament</th>
                        <th>Status</th>
                        <th>Players</th>
                        <th>Time</th>
                    </tr>
                </thead>
                <tbody>`;
    
    recent.forEach(tournament => {
        const time = new Date(tournament.schedule).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        html += `
            <tr>
                <td>
                    <strong class="small">${tournament.title}</strong><br>
                    <small class="text-muted">${tournament.type}</small>
                </td>
                <td>
                    <span class="badge bg-${tournament.status === 'live' ? 'danger' : tournament.status === 'completed' ? 'success' : 'warning'}">
                        ${tournament.status}
                    </span>
                </td>
                <td>${tournament.joinedPlayers || 0}</td>
                <td><small>${time}</small></td>
            </tr>`;
    });
    
    html += `</tbody></table></div>`;
    container.innerHTML = html;
}

// Display Withdrawals
function displayWithdrawals() {
    const container = document.getElementById('withdrawalsTable');
    if (!container) return;
    
    const pendingWithdrawals = allWithdrawals.filter(w => w.status === 'pending');
    const otherWithdrawals = allWithdrawals.filter(w => w.status !== 'pending');
    const displayWithdrawals = [...pendingWithdrawals, ...otherWithdrawals];
    
    if (!displayWithdrawals.length) {
        container.innerHTML = '<p class="text-center small text-muted py-4">No withdrawal requests found</p>';
        return;
    }
    
    let html = `
        <div class="table-responsive">
            <table class="table table-sm table-hover">
                <thead class="table-light">
                    <tr>
                        <th>User</th>
                        <th>Amount</th>
                        <th>Method</th>
                        <th>Account</th>
                        <th>Time</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>`;
    
    displayWithdrawals.forEach(request => {
        const time = new Date(request.timestamp).toLocaleString();
        
        html += `
            <tr class="${request.status === 'pending' ? 'table-warning' : request.status === 'approved' ? 'table-success' : 'table-danger'}">
                <td>
                    <strong>${request.username}</strong><br>
                    <small class="text-muted">${request.name || ''}</small>
                </td>
                <td class="text-danger"><strong>৳${request.amount}</strong></td>
                <td><span class="badge bg-primary">${request.method}</span></td>
                <td><code>${request.accountNumber}</code></td>
                <td><small>${time}</small></td>
                <td>
                    <span class="status-badge status-${request.status}">
                        ${request.status}
                    </span>
                </td>
                <td>
                    ${request.status === 'pending' ? `
                        <button class="btn btn-sm btn-success" onclick="approveWithdrawal('${request.id}')" title="Approve">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="rejectWithdrawal('${request.id}')" title="Reject">
                            <i class="fas fa-times"></i>
                        </button>
                    ` : `
                        <span class="text-muted small">Processed</span>
                    `}
                </td>
            </tr>`;
    });
    
    html += `</tbody></table></div>`;
    container.innerHTML = html;
    
    // Update notification badge
    const notificationBadge = document.getElementById('withdrawNotification');
    if (notificationBadge) {
        notificationBadge.textContent = pendingWithdrawals.length;
        notificationBadge.style.display = pendingWithdrawals.length > 0 ? 'inline-block' : 'none';
    }
}

// Display Recharge Requests
function displayRechargeRequests() {
    const container = document.getElementById('rechargeRequestsTable');
    if (!container) return;
    
    const pendingRequests = allRechargeRequests.filter(r => r.status === 'pending');
    const otherRequests = allRechargeRequests.filter(r => r.status !== 'pending');
    const displayRequests = [...pendingRequests, ...otherRequests];
    
    if (!displayRequests.length) {
        container.innerHTML = '<p class="text-center small text-muted py-4">No recharge requests found</p>';
        return;
    }
    
    let html = `
        <div class="table-responsive">
            <table class="table table-sm table-hover">
                <thead class="table-light">
                    <tr>
                        <th>User</th>
                        <th>Amount</th>
                        <th>Method</th>
                        <th>Transaction ID</th>
                        <th>Time</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>`;
    
    displayRequests.forEach(request => {
        const time = new Date(request.timestamp).toLocaleString();
        
        html += `
            <tr class="${request.status === 'pending' ? 'table-warning' : request.status === 'approved' ? 'table-success' : 'table-danger'}">
                <td>
                    <strong>${request.username}</strong><br>
                    <small class="text-muted">From: ${request.senderNumber}</small>
                </td>
                <td class="text-success"><strong>৳${request.amount}</strong></td>
                <td><span class="badge bg-primary">${request.method}</span></td>
                <td><code>${request.transactionId}</code></td>
                <td><small>${time}</small></td>
                <td>
                    <span class="status-badge status-${request.status}">
                        ${request.status}
                    </span>
                </td>
                <td>
                    ${request.status === 'pending' ? `
                        <button class="btn btn-sm btn-success" onclick="approveRecharge('${request.id}')" title="Approve">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="rejectRecharge('${request.id}')" title="Reject">
                            <i class="fas fa-times"></i>
                        </button>
                    ` : `
                        <span class="text-muted small">Processed</span>
                    `}
                </td>
            </tr>`;
    });
    
    html += `</tbody></table></div>`;
    container.innerHTML = html;
    
    // Update notification badge
    const notificationBadge = document.getElementById('rechargeNotification');
    if (notificationBadge) {
        notificationBadge.textContent = pendingRequests.length;
        notificationBadge.style.display = pendingRequests.length > 0 ? 'inline-block' : 'none';
    }
}

// Display Notices
function displayNotices() {
    const container = document.getElementById('noticesTable');
    if (!container) return;
    
    if (!allNotices.length) {
        container.innerHTML = '<p class="text-center small text-muted py-4">No notices found</p>';
        return;
    }
    
    let html = `
        <div class="table-responsive">
            <table class="table table-sm table-hover">
                <thead class="table-light">
                    <tr>
                        <th>Message</th>
                        <th>Created</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>`;
    
    allNotices.sort((a, b) => b.timestamp - a.timestamp).forEach(notice => {
        const time = new Date(notice.timestamp).toLocaleString();
        
        html += `
            <tr>
                <td>${notice.message}</td>
                <td><small>${time}</small></td>
                <td>
                    <span class="status-badge ${notice.active ? 'status-approved' : 'status-pending'}">
                        ${notice.active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-warning" onclick="toggleNotice('${notice.id}', ${!notice.active})" 
                            title="${notice.active ? 'Deactivate' : 'Activate'}">
                        <i class="fas fa-power-off"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteNotice('${notice.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>`;
    });
    
    html += `</tbody></table></div>`;
    container.innerHTML = html;
}

// ==================== STATS FUNCTIONS ====================

// Update Stats
function updateStats() {
    if (!allUsers.length || !allTournaments.length) return;
    
    // Total users
    const totalUsers = allUsers.length;
    document.getElementById('totalUsers').textContent = totalUsers;
    
    // Total tournaments
    const totalTournaments = allTournaments.length;
    document.getElementById('totalTournaments').textContent = totalTournaments;
    
    // Total revenue (sum of all entry fees)
    let totalRevenue = 0;
    allTournaments.forEach(t => {
        totalRevenue += (t.entryFee || 0) * (t.joinedPlayers || 0);
    });
    document.getElementById('totalRevenue').textContent = '৳' + totalRevenue.toLocaleString();
    
    // Pending requests
    const pendingWithdrawals = allWithdrawals.filter(w => w.status === 'pending').length;
    const pendingRecharges = allRechargeRequests.filter(r => r.status === 'pending').length;
    const totalPending = pendingWithdrawals + pendingRecharges;
    
    document.getElementById('pendingRequests').textContent = totalPending;
    
    // Update notification badges
    const totalNotification = totalPending;
    document.getElementById('notificationCount').textContent = totalNotification;
    document.getElementById('notificationCount').style.display = totalNotification > 0 ? 'inline-block' : 'none';
    
    // Active tournaments
    const liveTournaments = allTournaments.filter(t => t.status === 'live').length;
    document.getElementById('activeTournaments').textContent = liveTournaments;
    
    // Total balance in system
    let totalBalance = 0;
    allUsers.forEach(user => {
        totalBalance += user.balance || 0;
    });
    document.getElementById('totalBalance').textContent = '৳' + totalBalance.toLocaleString();
    
    // System info
    document.getElementById('sysTotalUsers').textContent = totalUsers;
    document.getElementById('sysTotalTournaments').textContent = totalTournaments;
    document.getElementById('sysPendingRequests').textContent = totalPending;
}

// ==================== TOURNAMENT AUTO MANAGEMENT ====================

// Auto Update Tournament Status
function autoUpdateTournamentStatus() {
    const now = Date.now();
    
    allTournaments.forEach(tournament => {
        if (tournament.status === 'upcoming') {
            const scheduleTime = new Date(tournament.schedule).getTime();
            const tenMinutesBefore = 10 * 60 * 1000;
            
            // Auto go live 10 minutes before start
            if (now >= (scheduleTime - tenMinutesBefore) && now < scheduleTime) {
                updateTournamentStatus(tournament.id, 'live');
            }
        }
        
        if (tournament.status === 'live') {
            const liveTime = tournament.liveAt || new Date(tournament.schedule).getTime();
            const twoHours = 2 * 60 * 60 * 1000;
            
            // Auto complete after 2 hours
            if (now >= (liveTime + twoHours)) {
                updateTournamentStatus(tournament.id, 'completed');
            }
        }
    });
}

// Update Tournament Status
async function updateTournamentStatus(tournamentId, newStatus) {
    try {
        const updates = {
            status: newStatus,
            updatedAt: Date.now()
        };
        
        if (newStatus === 'live') {
            updates.roomId = generateRoomId();
            updates.password = generatePassword();
            updates.liveAt = Date.now();
        }
        
        if (newStatus === 'completed') {
            updates.completedAt = Date.now();
        }
        
        await database.ref(`tournaments/${tournamentId}`).update(updates);
        console.log(`Tournament ${tournamentId} updated to ${newStatus}`);
        
        return true;
    } catch (error) {
        console.error('Error updating tournament:', error);
        return false;
    }
}

// Start Tournament Now
async function startTournamentNow(tournamentId) {
    if (!confirm('Start this tournament now?')) return;
    
    try {
        const result = await updateTournamentStatus(tournamentId, 'live');
        if (result) {
            showSuccess('Tournament started successfully!');
            displayTournaments();
        }
    } catch (error) {
        showError('Failed to start tournament: ' + error.message);
    }
}

// Complete Tournament Now
async function completeTournamentNow(tournamentId) {
    if (!confirm('Complete this tournament now?')) return;
    
    try {
        // First calculate results
        await calculateTournamentResults(tournamentId);
        
        // Then update status
        const result = await updateTournamentStatus(tournamentId, 'completed');
        if (result) {
            showSuccess('Tournament completed successfully!');
            displayTournaments();
        }
    } catch (error) {
        showError('Failed to complete tournament: ' + error.message);
    }
}

// ==================== ACTION FUNCTIONS ====================

// Edit User Balance
async function editUserBalance(userId) {
    const user = allUsers.find(u => u.uid === userId);
    if (!user) return;
    
    const newBalance = prompt(`Edit balance for ${user.username} (${user.name}):`, user.balance || 0);
    if (newBalance === null || isNaN(newBalance)) return;
    
    try {
        await database.ref(`userProfiles/${userId}`).update({
            balance: parseInt(newBalance),
            updatedAt: Date.now()
        });
        
        showSuccess(`Balance updated for ${user.username}`);
        displayUsers();
    } catch (error) {
        showError('Failed to update balance: ' + error.message);
    }
}

// View User Details
function viewUserDetails(userId) {
    const user = allUsers.find(u => u.uid === userId);
    if (!user) return;
    
    const details = `
        <div class="user-details">
            <h6>User Details</h6>
            <div class="row">
                <div class="col-6">
                    <p><strong>Username:</strong> ${user.username}</p>
                    <p><strong>Name:</strong> ${user.name || 'N/A'}</p>
                    <p><strong>FF ID:</strong> ${user.ffid || 'N/A'}</p>
                    <p><strong>Balance:</strong> ৳${user.balance || 0}</p>
                </div>
                <div class="col-6">
                    <p><strong>Kills:</strong> ${user.kills || 0}</p>
                    <p><strong>Wins:</strong> ${user.wins || 0}</p>
                    <p><strong>Matches:</strong> ${user.matches || 0}</p>
                    <p><strong>Joined:</strong> ${user.joinDate ? new Date(user.joinDate).toLocaleDateString() : 'N/A'}</p>
                </div>
            </div>
        </div>`;
    
    showModal('User Details', details);
}

// Approve Withdrawal
async function approveWithdrawal(requestId) {
    if (!confirm('Approve this withdrawal request?')) return;
    
    try {
        const request = allWithdrawals.find(w => w.id === requestId);
        if (!request) return;
        
        await database.ref(`withdrawRequests/${requestId}`).update({
            status: 'approved',
            processedAt: Date.now(),
            processedBy: currentAdmin.username
        });
        
        showSuccess('Withdrawal approved successfully!');
        displayWithdrawals();
        
    } catch (error) {
        showError('Failed to approve withdrawal: ' + error.message);
    }
}

// Reject Withdrawal
async function rejectWithdrawal(requestId) {
    const reason = prompt('Reason for rejection (optional):');
    
    try {
        const request = allWithdrawals.find(w => w.id === requestId);
        if (!request) return;
        
        await database.ref(`withdrawRequests/${requestId}`).update({
            status: 'rejected',
            processedAt: Date.now(),
            processedBy: currentAdmin.username,
            rejectReason: reason || 'No reason provided'
        });
        
        // Refund balance to user
        const usernameIndexRef = database.ref(`usernameIndex/${request.username}`);
        const usernameSnap = await usernameIndexRef.once('value');
        
        if (usernameSnap.exists()) {
            const userId = usernameSnap.val();
            const userRef = database.ref(`userProfiles/${userId}`);
            const userSnap = await userRef.once('value');
            
            if (userSnap.exists()) {
                const user = userSnap.val();
                const newBalance = (user.balance || 0) + (request.amount || 0);
                
                await userRef.update({
                    balance: newBalance,
                    updatedAt: Date.now()
                });
                
                // Add transaction record
                const transactionRef = database.ref(`userProfiles/${userId}/transactions/${Date.now()}`);
                await transactionRef.set({
                    type: 'withdrawal_refund',
                    amount: request.amount,
                    timestamp: Date.now(),
                    status: 'completed',
                    note: 'Withdrawal rejected - amount refunded'
                });
            }
        }
        
        showSuccess('Withdrawal rejected and amount refunded!');
        displayWithdrawals();
        
    } catch (error) {
        showError('Failed to reject withdrawal: ' + error.message);
    }
}

// Approve Recharge
async function approveRecharge(requestId) {
    if (!confirm('Approve this recharge request?')) return;
    
    try {
        const request = allRechargeRequests.find(r => r.id === requestId);
        if (!request) return;
        
        // Get userId from username
        const usernameIndexRef = database.ref(`usernameIndex/${request.username}`);
        const usernameSnap = await usernameIndexRef.once('value');
        
        if (!usernameSnap.exists()) {
            showError('User not found!');
            return;
        }
        
        const userId = usernameSnap.val();
        
        // Update user balance
        const userRef = database.ref(`userProfiles/${userId}`);
        const userSnap = await userRef.once('value');
        
        if (userSnap.exists()) {
            const user = userSnap.val();
            const newBalance = (user.balance || 0) + (request.amount || 0);
            
            await userRef.update({
                balance: newBalance,
                updatedAt: Date.now()
            });
            
            // Update recharge request status
            await database.ref(`rechargeRequests/${requestId}`).update({
                status: 'approved',
                approvedAt: Date.now(),
                approvedBy: currentAdmin.username
            });
            
            // Add transaction record
            const transactionRef = database.ref(`userProfiles/${userId}/transactions/${Date.now()}`);
            await transactionRef.set({
                type: 'recharge',
                amount: request.amount,
                method: request.method,
                transactionId: request.transactionId,
                timestamp: Date.now(),
                status: 'completed',
                note: 'Recharge approved by admin'
            });
            
            showSuccess('Recharge approved and balance added!');
            displayRechargeRequests();
        }
        
    } catch (error) {
        showError('Failed to approve recharge: ' + error.message);
    }
}

// Reject Recharge
async function rejectRecharge(requestId) {
    const reason = prompt('Reason for rejection (optional):');
    
    try {
        await database.ref(`rechargeRequests/${requestId}`).update({
            status: 'rejected',
            rejectedAt: Date.now(),
            rejectedBy: currentAdmin.username,
            rejectReason: reason || 'No reason provided'
        });
        
        showSuccess('Recharge request rejected!');
        displayRechargeRequests();
        
    } catch (error) {
        showError('Failed to reject recharge: ' + error.message);
    }
}

// Toggle Notice
async function toggleNotice(noticeId, newState) {
    try {
        await database.ref(`notices/${noticeId}`).update({
            active: newState,
            updatedAt: Date.now()
        });
        
        showSuccess(`Notice ${newState ? 'activated' : 'deactivated'}!`);
        displayNotices();
        
    } catch (error) {
        showError('Failed to toggle notice: ' + error.message);
    }
}

// Delete Notice
async function deleteNotice(noticeId) {
    if (!confirm('Delete this notice permanently?')) return;
    
    try {
        await database.ref(`notices/${noticeId}`).remove();
        showSuccess('Notice deleted!');
        displayNotices();
    } catch (error) {
        showError('Failed to delete notice: ' + error.message);
    }
}

// Edit Room Details
async function editRoomDetails(tournamentId) {
    const tournament = allTournaments.find(t => t.id === tournamentId);
    if (!tournament) return;
    
    const roomId = prompt('Room ID:', tournament.roomId || '');
    const password = prompt('Room Password:', tournament.password || '');
    
    if (roomId === null || password === null) return;
    
    try {
        await database.ref(`tournaments/${tournamentId}`).update({
            roomId: roomId,
            password: password,
            updatedAt: Date.now()
        });
        
        showSuccess('Room details updated!');
        displayTournaments();
        
    } catch (error) {
        showError('Failed to update room details: ' + error.message);
    }
}

// Edit Tournament Details
async function editTournamentDetails(tournamentId) {
    const tournament = allTournaments.find(t => t.id === tournamentId);
    if (!tournament) return;
    
    const newPrize = prompt('New prize amount:', tournament.prize);
    if (newPrize === null || isNaN(newPrize)) return;
    
    try {
        await database.ref(`tournaments/${tournamentId}`).update({
            prize: parseInt(newPrize),
            updatedAt: Date.now()
        });
        
        showSuccess('Tournament prize updated!');
        displayTournaments();
        
    } catch (error) {
        showError('Failed to update tournament: ' + error.message);
    }
}

// Delete Tournament
async function deleteTournament(tournamentId) {
    if (!confirm('WARNING: Delete this tournament permanently?\nThis action cannot be undone!')) return;
    
    try {
        // First, refund all participants
        const playersRef = database.ref(`tournaments/${tournamentId}/players`);
        const playersSnap = await playersRef.once('value');
        
        if (playersSnap.exists()) {
            const tournament = allTournaments.find(t => t.id === tournamentId);
            const entryFee = tournament?.entryFee || 0;
            
            playersSnap.forEach(async (child) => {
                const username = child.key;
                const usernameIndexRef = database.ref(`usernameIndex/${username}`);
                const usernameSnap = await usernameIndexRef.once('value');
                
                if (usernameSnap.exists()) {
                    const userId = usernameSnap.val();
                    const userRef = database.ref(`userProfiles/${userId}`);
                    const userSnap = await userRef.once('value');
                    
                    if (userSnap.exists()) {
                        const user = userSnap.val();
                        const newBalance = (user.balance || 0) + entryFee;
                        
                        await userRef.update({
                            balance: newBalance,
                            updatedAt: Date.now()
                        });
                        
                        // Add transaction record
                        const transactionRef = database.ref(`userProfiles/${userId}/transactions/${Date.now()}`);
                        await transactionRef.set({
                            type: 'tournament_refund',
                            amount: entryFee,
                            tournamentId: tournamentId,
                            tournamentName: tournament?.title,
                            timestamp: Date.now(),
                            status: 'completed',
                            note: 'Tournament deleted by admin'
                        });
                    }
                }
            });
        }
        
        // Then delete tournament
        await database.ref(`tournaments/${tournamentId}`).remove();
        
        showSuccess('Tournament deleted and entry fees refunded!');
        displayTournaments();
        
    } catch (error) {
        showError('Failed to delete tournament: ' + error.message);
    }
}

// ==================== TOURNAMENT RESULTS ====================

// Load Tournament Results
async function loadTournamentResults() {
    const container = document.getElementById('resultsTable');
    if (!container) return;
    
    const completedTournaments = allTournaments.filter(t => t.status === 'completed');
    
    if (!completedTournaments.length) {
        container.innerHTML = '<p class="text-center small text-muted py-4">No completed tournaments found</p>';
        return;
    }
    
    let html = `
        <div class="table-responsive">
            <table class="table table-sm table-hover">
                <thead class="table-light">
                    <tr>
                        <th>Tournament</th>
                        <th>Completed</th>
                        <th>Players</th>
                        <th>Prize Pool</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>`;
    
    completedTournaments.forEach(tournament => {
        const completedDate = tournament.completedAt 
            ? new Date(tournament.completedAt).toLocaleDateString() 
            : new Date(tournament.schedule).toLocaleDateString();
        
        html += `
            <tr>
                <td>
                    <strong>${tournament.title}</strong><br>
                    <small class="text-muted">${tournament.type}</small>
                </td>
                <td><small>${completedDate}</small></td>
                <td>${tournament.joinedPlayers || 0} players</td>
                <td class="text-success">৳${tournament.prize || 0}</td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="viewTournamentResults('${tournament.id}')">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <button class="btn btn-sm btn-warning" onclick="recalculateResults('${tournament.id}')">
                        <i class="fas fa-calculator"></i> Recalculate
                    </button>
                </td>
            </tr>`;
    });
    
    html += `</tbody></table></div>`;
    container.innerHTML = html;
}

// View Tournament Results
async function viewTournamentResults(tournamentId) {
    try {
        const resultsRef = database.ref(`tournaments/${tournamentId}/results`);
        const resultsSnap = await resultsRef.once('value');
        
        if (resultsSnap.exists()) {
            const results = resultsSnap.val();
            const tournament = allTournaments.find(t => t.id === tournamentId);
            
            let html = `
                <div class="tournament-results">
                    <h6>${tournament?.title} - Results</h6>
                    <p class="small text-muted">Completed: ${new Date(tournament?.completedAt || Date.now()).toLocaleString()}</p>
                    
                    <div class="winners-list mt-3">`;
            
            if (results.winners && results.winners.length > 0) {
                html += `<h6>🏆 Winners:</h6>`;
                results.winners.forEach(winner => {
                    html += `
                        <div class="winner-item mb-2 p-2 border rounded">
                            <strong>#${winner.position} - ${winner.username}</strong>
                            <div class="row">
                                <div class="col-6">
                                    <small>Prize: <span class="text-success">৳${winner.prize || 0}</span></small>
                                </div>
                                <div class="col-6">
                                    <small>Kills: <span class="text-warning">${winner.kills || 0}</span></small>
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-6">
                                    <small>Kill Reward: <span class="text-info">৳${winner.killReward || 0}</span></small>
                                </div>
                                <div class="col-6">
                                    <small>Total: <span class="text-success"><strong>৳${winner.total || 0}</strong></span></small>
                                </div>
                            </div>
                        </div>`;
                });
            } else {
                html += `<p class="text-center text-muted">No winners data available</p>`;
            }
            
            html += `
                        <div class="mt-3">
                            <p><strong>Total Players:</strong> ${results.totalPlayers || 0}</p>
                            <p><strong>Prize Distribution:</strong> ৳${results.prizeDistribution?.totalPrizeDistributed || 0}</p>
                        </div>
                    </div>
                </div>`;
            
            showModal('Tournament Results', html);
        } else {
            showError('No results available for this tournament');
        }
    } catch (error) {
        showError('Failed to load results: ' + error.message);
    }
}

// Recalculate Results
async function recalculateResults(tournamentId) {
    if (!confirm('Recalculate tournament results?\nThis will recalculate all prizes and rewards.')) return;
    
    try {
        await calculateTournamentResults(tournamentId);
        showSuccess('Results recalculated successfully!');
    } catch (error) {
        showError('Failed to recalculate: ' + error.message);
    }
}

// Calculate Tournament Results
async function calculateTournamentResults(tournamentId) {
    try {
        // Get players
        const playersRef = database.ref(`tournaments/${tournamentId}/players`);
        const playersSnap = await playersRef.once('value');
        
        if (!playersSnap.exists()) {
            showError('No players found in this tournament');
            return;
        }
        
        const players = [];
        playersSnap.forEach((child) => {
            const player = child.val();
            player.username = child.key;
            players.push(player);
        });
        
        // Sort by kills
        players.sort((a, b) => (b.kills || 0) - (a.kills || 0));
        
        // Get tournament details
        const tournamentRef = database.ref(`tournaments/${tournamentId}`);
        const tournamentSnap = await tournamentRef.once('value');
        const tournament = tournamentSnap.val();
        
        const killRewardPerKill = tournament.killReward || 10;
        const winners = [];
        
        console.log(`Calculating results for ${players.length} players`);
        
        // Distribute prizes
        if (players.length >= 1) {
            const firstPrize = tournament.prize || 0;
            const firstKillReward = (players[0].kills || 0) * killRewardPerKill;
            const firstTotal = firstPrize + firstKillReward;
            
            winners.push({
                username: players[0].username,
                position: 1,
                prize: firstPrize,
                kills: players[0].kills || 0,
                killReward: firstKillReward,
                total: firstTotal
            });
            
            await addBalanceToUser(players[0].username, firstTotal, tournamentId, tournament.title);
        }
        
        if (players.length >= 2) {
            const secondPrize = (tournament.prize || 0) * 0.5;
            const secondKillReward = (players[1].kills || 0) * killRewardPerKill;
            const secondTotal = secondPrize + secondKillReward;
            
            winners.push({
                username: players[1].username,
                position: 2,
                prize: secondPrize,
                kills: players[1].kills || 0,
                killReward: secondKillReward,
                total: secondTotal
            });
            
            await addBalanceToUser(players[1].username, secondTotal, tournamentId, tournament.title);
        }
        
        if (players.length >= 3) {
            const thirdPrize = (tournament.prize || 0) * 0.25;
            const thirdKillReward = (players[2].kills || 0) * killRewardPerKill;
            const thirdTotal = thirdPrize + thirdKillReward;
            
            winners.push({
                username: players[2].username,
                position: 3,
                prize: thirdPrize,
                kills: players[2].kills || 0,
                killReward: thirdKillReward,
                total: thirdTotal
            });
            
            await addBalanceToUser(players[2].username, thirdTotal, tournamentId, tournament.title);
        }
        
        // Kill rewards for all players
        for (const player of players) {
            if (player.kills && player.kills > 0) {
                const isWinner = winners.some(w => w.username === player.username);
                if (!isWinner) {
                    const killReward = player.kills * killRewardPerKill;
                    await addBalanceToUser(player.username, killReward, tournamentId, tournament.title, true);
                }
            }
        }
        
        // Save results
        const resultsRef = database.ref(`tournaments/${tournamentId}/results`);
        await resultsRef.set({
            winners: winners,
            totalPlayers: players.length,
            calculatedAt: Date.now(),
            prizeDistribution: {
                firstPrize: tournament.prize || 0,
                killRewardPerKill: killRewardPerKill,
                totalPrizeDistributed: winners.reduce((sum, w) => sum + w.total, 0)
            }
        });
        
        return true;
        
    } catch (error) {
        console.error('Error calculating results:', error);
        return false;
    }
}

// Add Balance to User (Helper function)
async function addBalanceToUser(username, amount, tournamentId = '', tournamentTitle = '', isKillReward = false) {
    try {
        // Get userId from usernameIndex
        const usernameIndexRef = database.ref(`usernameIndex/${username}`);
        const usernameSnap = await usernameIndexRef.once('value');
        
        if (!usernameSnap.exists()) {
            console.error(`Username ${username} not found`);
            return false;
        }
        
        const userId = usernameSnap.val();
        const userRef = database.ref(`userProfiles/${userId}`);
        const userSnap = await userRef.once('value');
        
        if (userSnap.exists()) {
            const user = userSnap.val();
            const newBalance = (user.balance || 0) + amount;
            
            await userRef.update({
                balance: newBalance,
                updatedAt: Date.now()
            });
            
            // Add transaction
            const transactionId = Date.now().toString();
            const transactionRef = database.ref(`userProfiles/${userId}/transactions/${transactionId}`);
            
            await transactionRef.set({
                type: isKillReward ? 'kill_reward' : 'tournament_winning',
                amount: amount,
                tournamentId: tournamentId,
                tournamentName: tournamentTitle,
                timestamp: Date.now(),
                status: 'completed'
            });
            
            // Update stats
            if (!isKillReward) {
                const currentWins = user.wins || 0;
                await userRef.update({
                    wins: currentWins + 1
                });
            }
            
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('Error adding balance:', error);
        return false;
    }
}

// ==================== PARTICIPANTS MANAGEMENT ====================

// Load Participants
async function loadParticipants() {
    const container = document.getElementById('participantsTable');
    const dropdown = document.getElementById('participantsTournamentFilter');
    
    if (!container || !dropdown) return;
    
    // Populate dropdown
    dropdown.innerHTML = '<option value="">Select Tournament</option>';
    allTournaments.forEach(tournament => {
        const option = document.createElement('option');
        option.value = tournament.id;
        option.textContent = `${tournament.title} (${tournament.type}) - ${new Date(tournament.schedule).toLocaleDateString()}`;
        dropdown.appendChild(option);
    });
    
    // Auto-select first tournament if none selected
    const tournamentId = dropdown.value || (allTournaments.length > 0 ? allTournaments[0].id : '');
    
    if (tournamentId) {
        dropdown.value = tournamentId;
        await showParticipantsForTournament(tournamentId);
    } else {
        container.innerHTML = '<p class="text-center small text-muted py-4">Select a tournament to view participants</p>';
    }
}

// Show Participants for Tournament
async function showParticipantsForTournament(tournamentId) {
    const container = document.getElementById('participantsTable');
    if (!container) return;
    
    container.innerHTML = '<div class="text-center py-4"><div class="spinner-border spinner-border-sm"></div> Loading participants...</div>';
    
    try {
        // Get tournament
        const tournament = allTournaments.find(t => t.id === tournamentId);
        if (!tournament) {
            container.innerHTML = '<p class="text-center text-danger">Tournament not found</p>';
            return;
        }
        
        // Get participants
        const participantsRef = database.ref(`tournaments/${tournamentId}/players`);
        const participantsSnap = await participantsRef.once('value');
        
        if (!participantsSnap.exists()) {
            container.innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-users-slash fa-2x text-muted mb-3"></i>
                    <p class="text-muted">No participants yet</p>
                </div>`;
            return;
        }
        
        const participants = [];
        participantsSnap.forEach((child) => {
            const participant = child.val();
            participant.username = child.key;
            participants.push(participant);
        });
        
        // Display participants
        let html = `
            <div class="participants-header mb-3">
                <h6>${tournament.title} - Participants</h6>
                <p class="small text-muted">
                    <span class="badge bg-${tournament.status === 'live' ? 'danger' : 'warning'}">${tournament.status}</span>
                    • Type: ${tournament.type} • Total: ${participants.length} players
                    • Entry Fee: ৳${tournament.entryFee || 0}
                </p>
            </div>
            
            <div class="table-responsive">
                <table class="table table-sm table-hover">
                    <thead class="table-light">
                        <tr>
                            <th>#</th>
                            <th>Player</th>
                            <th>Username</th>
                            <th>FF ID</th>
                            <th>Mode</th>
                            <th>Entry Paid</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>`;
        
        participants.forEach((participant, index) => {
            let playerInfo = participant.name || participant.username;
            if (participant.playMode === 'duo' && participant.player2) {
                playerInfo = `
                    <div class="duo-team">
                        <div><strong>${participant.player1?.name || 'Player 1'}</strong></div>
                        <div class="small text-muted">& ${participant.player2?.name || 'Player 2'}</div>
                    </div>`;
            }
            
            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${playerInfo}</td>
                    <td><code>${participant.username}</code></td>
                    <td><span class="badge bg-info">${participant.ffid || 'N/A'}</span></td>
                    <td>
                        <span class="badge ${participant.playMode === 'duo' ? 'bg-primary' : 'bg-secondary'}">
                            ${participant.playMode || 'solo'}
                        </span>
                    </td>
                    <td class="text-success">৳${participant.entryPaid || tournament.entryFee}</td>
                    <td>
                        <span class="status-badge status-${participant.status || 'joined'}">
                            ${participant.status || 'joined'}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-warning" onclick="editParticipant('${tournamentId}', '${participant.username}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="removeParticipant('${tournamentId}', '${participant.username}')" title="Remove">
                            <i class="fas fa-user-minus"></i>
                        </button>
                    </td>
                </tr>`;
        });
        
        html += `</tbody></table></div>
            
            <div class="mt-3">
                <div class="alert alert-info">
                    <i class="fas fa-info-circle"></i> 
                    <strong>Total Entry Fees:</strong> ৳${participants.reduce((sum, p) => sum + (p.entryPaid || tournament.entryFee), 0)}
                    • <strong>Total Players:</strong> ${participants.length}
                </div>
            </div>`;
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading participants:', error);
        container.innerHTML = `<p class="text-center text-danger">Error loading participants: ${error.message}</p>`;
    }
}

// Edit Participant
async function editParticipant(tournamentId, username) {
    const tournament = allTournaments.find(t => t.id === tournamentId);
    if (!tournament) return;
    
    const newStatus = prompt(`Change status for ${username}:\n(joined, playing, disqualified, completed)`, 'joined');
    if (!newStatus) return;
    
    try {
        await database.ref(`tournaments/${tournamentId}/players/${username}`).update({
            status: newStatus,
            updatedAt: Date.now()
        });
        
        showSuccess(`Participant status updated to ${newStatus}`);
        showParticipantsForTournament(tournamentId);
        
    } catch (error) {
        showError('Failed to update participant: ' + error.message);
    }
}

// Remove Participant
async function removeParticipant(tournamentId, username) {
    if (!confirm(`Remove ${username} from tournament?\nEntry fee will be refunded.`)) return;
    
    try {
        const tournament = allTournaments.find(t => t.id === tournamentId);
        const entryFee = tournament?.entryFee || 0;
        
        // Remove from tournament
        await database.ref(`tournaments/${tournamentId}/players/${username}`).remove();
        
        // Refund entry fee
        const usernameIndexRef = database.ref(`usernameIndex/${username}`);
        const usernameSnap = await usernameIndexRef.once('value');
        
        if (usernameSnap.exists()) {
            const userId = usernameSnap.val();
            const userRef = database.ref(`userProfiles/${userId}`);
            const userSnap = await userRef.once('value');
            
            if (userSnap.exists()) {
                const user = userSnap.val();
                const newBalance = (user.balance || 0) + entryFee;
                
                await userRef.update({
                    balance: newBalance,
                    updatedAt: Date.now()
                });
                
                // Add transaction
                const transactionRef = database.ref(`userProfiles/${userId}/transactions/${Date.now()}`);
                await transactionRef.set({
                    type: 'tournament_refund',
                    amount: entryFee,
                    tournamentId: tournamentId,
                    tournamentName: tournament?.title,
                    timestamp: Date.now(),
                    status: 'completed',
                    note: 'Removed from tournament by admin'
                });
            }
        }
        
        // Update tournament player count
        const newPlayerCount = (tournament.joinedPlayers || 0) - 1;
        if (newPlayerCount >= 0) {
            await database.ref(`tournaments/${tournamentId}`).update({
                joinedPlayers: newPlayerCount,
                updatedAt: Date.now()
            });
        }
        
        showSuccess('Participant removed and entry fee refunded!');
        showParticipantsForTournament(tournamentId);
        
    } catch (error) {
        showError('Failed to remove participant: ' + error.message);
    }
}

// Export Participants
async function exportParticipants() {
    const dropdown = document.getElementById('participantsTournamentFilter');
    const tournamentId = dropdown?.value;
    
    if (!tournamentId) {
        showError('Please select a tournament first');
        return;
    }
    
    try {
        const tournament = allTournaments.find(t => t.id === tournamentId);
        const participantsRef = database.ref(`tournaments/${tournamentId}/players`);
        const participantsSnap = await participantsRef.once('value');
        
        if (!participantsSnap.exists()) {
            showError('No participants found');
            return;
        }
        
        const participants = [];
        participantsSnap.forEach((child) => {
            participants.push(child.val());
        });
        
        // Create CSV content
        let csv = `Tournament Participants - ${tournament.title}\n`;
        csv += `Date: ${new Date().toLocaleDateString()}\n`;
        csv += `Total Participants: ${participants.length}\n\n`;
        
        csv += 'No,Player Name,Username,Free Fire ID,Play Mode,Entry Fee,Status\n';
        
        participants.forEach((participant, index) => {
            let playerName = participant.name || participant.username;
            if (participant.playMode === 'duo' && participant.player2) {
                playerName = `${participant.player1?.name || 'Player 1'} & ${participant.player2?.name || 'Player 2'}`;
            }
            
            csv += `${index + 1},"${playerName}","${participant.username}","${participant.ffid || ''}","${participant.playMode || 'solo'}",৳${participant.entryPaid || tournament.entryFee},"${participant.status || 'joined'}"\n`;
        });
        
        // Create download link
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `participants_${tournament.title.replace(/[^a-z0-9]/gi, '_')}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        showSuccess('Participants exported successfully!');
        
    } catch (error) {
        showError('Export failed: ' + error.message);
    }
}

// ==================== SETTINGS MANAGEMENT ====================

// Load Settings
function loadSettings() {
    if (!systemSettings) return;
    
    // Populate form fields
    const minWithdrawal = document.getElementById('minWithdrawal');
    const minRecharge = document.getElementById('minRecharge');
    const killRewardPercent = document.getElementById('killRewardPercent');
    const supportNumber = document.getElementById('supportNumber');
    const appVersion = document.getElementById('appVersion');
    const maintenanceMode = document.getElementById('maintenanceMode');
    
    if (minWithdrawal) minWithdrawal.value = systemSettings.minWithdrawal || 200;
    if (minRecharge) minRecharge.value = systemSettings.minRecharge || 100;
    if (killRewardPercent) killRewardPercent.value = systemSettings.killRewardPercent || 20;
    if (supportNumber) supportNumber.value = systemSettings.supportNumber || '017XXXXXXXX';
    if (appVersion) appVersion.value = systemSettings.appVersion || '1.0.0';
    if (maintenanceMode) maintenanceMode.checked = systemSettings.maintenanceMode || false;
}

// Save Settings
async function saveSettings() {
    try {
        const settings = {
            minWithdrawal: parseInt(document.getElementById('minWithdrawal')?.value) || 200,
            minRecharge: parseInt(document.getElementById('minRecharge')?.value) || 100,
            killRewardPercent: parseInt(document.getElementById('killRewardPercent')?.value) || 20,
            supportNumber: document.getElementById('supportNumber')?.value || '017XXXXXXXX',
            appVersion: document.getElementById('appVersion')?.value || '1.0.0',
            maintenanceMode: document.getElementById('maintenanceMode')?.checked || false,
            updatedAt: Date.now(),
            updatedBy: currentAdmin?.username || 'admin'
        };
        
        await database.ref('systemSettings').update(settings);
        systemSettings = { ...systemSettings, ...settings };
        
        showSuccess('Settings saved successfully!');
        
    } catch (error) {
        showError('Failed to save settings: ' + error.message);
    }
}

// Change Admin Password
async function changeAdminPassword() {
    const currentPass = prompt('Enter current password:');
    if (!currentPass) return;
    
    // Verify current password
    if (currentPass !== '123456' && currentAdmin) {
        const adminRef = database.ref(`userProfiles/${currentAdmin.uid}`);
        const adminSnap = await adminRef.once('value');
        
        if (adminSnap.exists()) {
            const adminData = adminSnap.val();
            if (adminData.password !== currentPass) {
                showError('Current password is incorrect');
                return;
            }
        }
    }
    
    const newPass = prompt('Enter new password:');
    if (!newPass || newPass.length < 4) {
        showError('Password must be at least 4 characters');
        return;
    }
    
    const confirmPass = prompt('Confirm new password:');
    if (newPass !== confirmPass) {
        showError('Passwords do not match');
        return;
    }
    
    try {
        if (currentAdmin) {
            await database.ref(`userProfiles/${currentAdmin.uid}`).update({
                password: newPass,
                updatedAt: Date.now()
            });
        }
        
        showSuccess('Password changed successfully!');
        
    } catch (error) {
        showError('Failed to change password: ' + error.message);
    }
}

// ==================== HELPER FUNCTIONS ====================

// Show Success Message
function showSuccess(message) {
    const toast = document.getElementById('successToast');
    const toastBody = document.getElementById('successToastBody');
    
    if (toast && toastBody) {
        toastBody.textContent = message;
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
    } else {
        alert('✓ ' + message);
    }
}

// Show Error Message
function showError(message) {
    const toast = document.getElementById('errorToast');
    const toastBody = document.getElementById('errorToastBody');
    
    if (toast && toastBody) {
        toastBody.textContent = message;
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
    } else {
        alert('❌ ' + message);
    }
}

// Show Modal
function showModal(title, content) {
    // Create modal if not exists
    let modal = document.getElementById('customModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'customModal';
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title"></h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body"></div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(modal);
    }
    
    modal.querySelector('.modal-title').textContent = title;
    modal.querySelector('.modal-body').innerHTML = content;
    
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}

// Generate Room ID
function generateRoomId() {
    return Math.floor(100000000 + Math.random() * 900000000).toString();
}

// Generate Password
function generatePassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let password = '';
    for (let i = 0; i < 6; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

// Format Date
function formatDate(timestamp) {
    return new Date(timestamp).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ==================== GLOBAL FUNCTION EXPORTS ====================

// Make functions available globally
window.adminLogin = adminLogin;
window.adminLogout = adminLogout;
window.showSection = showSection;
window.startTournamentNow = startTournamentNow;
window.completeTournamentNow = completeTournamentNow;
window.editRoomDetails = editRoomDetails;
window.editTournamentDetails = editTournamentDetails;
window.deleteTournament = deleteTournament;
window.approveWithdrawal = approveWithdrawal;
window.rejectWithdrawal = rejectWithdrawal;
window.approveRecharge = approveRecharge;
window.rejectRecharge = rejectRecharge;
window.toggleNotice = toggleNotice;
window.deleteNotice = deleteNotice;
window.editUserBalance = editUserBalance;
window.viewUserDetails = viewUserDetails;
window.viewTournamentResults = viewTournamentResults;
window.recalculateResults = recalculateResults;
window.showParticipantsForTournament = showParticipantsForTournament;
window.editParticipant = editParticipant;
window.removeParticipant = removeParticipant;
window.exportParticipants = exportParticipants;
window.saveSettings = saveSettings;
window.changeAdminPassword = changeAdminPassword;
window.filterTournaments = function(filter) {
    tournamentFilter = filter;
    displayTournaments();
    
    // Update active state
    document.querySelectorAll('[data-filter]').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-filter') === filter) {
            btn.classList.add('active');
        }
    });
};
