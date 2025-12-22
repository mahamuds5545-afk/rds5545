// Firebase Configuration and Initialization
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

// Global Variables
let currentUser = null;
let isLoggedIn = false;
let tournaments = [];
let userTransactions = [];
let paymentMethods = [];
let systemSettings = {};
let rememberMe = false;
let userNotifications = [];

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    checkExistingLogin();
    loadSystemSettings();
    setupFirebaseListeners();
    initializePaymentMethods();
    // Create a demo tournament for testing
    createDemoTournament();
});

// Create Demo Tournament (for testing)
function createDemoTournament() {
    const demoTournament = {
        title: "Daily Solo Tournament",
        type: "solo",
        entryFee: 50,
        prize: 500,
        killReward: 10,
        maxPlayers: 50,
        joinedPlayers: 0,
        schedule: Date.now() + 86400000, // Tomorrow
        status: "upcoming",
        created: Date.now()
    };
    
    // Check if demo tournament already exists
    database.ref('tournaments/demo_tournament').once('value')
        .then((snapshot) => {
            if (!snapshot.exists()) {
                database.ref('tournaments/demo_tournament').set(demoTournament);
            }
        });
}

// Load System Settings
function loadSystemSettings() {
    database.ref('admin/settings').once('value')
        .then((snapshot) => {
            if (snapshot.exists()) {
                systemSettings = snapshot.val();
                if (systemSettings.minWithdrawal) {
                    document.getElementById('minWithdrawalText').textContent = 
                        `Minimum withdrawal: ৳${systemSettings.minWithdrawal}`;
                }
            } else {
                // Default settings if not exists
                systemSettings = {
                    minWithdrawal: 200,
                    minRecharge: 100
                };
            }
        })
        .catch((error) => {
            console.log('Settings load error:', error);
            // Default settings on error
            systemSettings = {
                minWithdrawal: 200,
                minRecharge: 100
            };
        });
}

// Check Existing Login
function checkExistingLogin() {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        try {
            const userData = JSON.parse(savedUser);
            autoLogin(userData.username);
        } catch (e) {
            localStorage.removeItem('currentUser');
        }
    }
}

// Setup Firebase Listeners
function setupFirebaseListeners() {
    // Listen for notices
    database.ref('notices').on('value', (snapshot) => {
        if (snapshot.exists()) {
            let noticeText = '';
            snapshot.forEach((child) => {
                const notice = child.val();
                if (notice.active) {
                    noticeText += ' 📢 ' + notice.message + ' | ';
                }
            });
            if (noticeText) {
                document.getElementById('noticeMarquee').innerHTML = noticeText;
            }
        }
    });
    
    // Listen for tournaments
    database.ref('tournaments').on('value', (snapshot) => {
        if (snapshot.exists()) {
            tournaments = [];
            snapshot.forEach((child) => {
                const tournament = child.val();
                tournament.id = child.key;
                tournaments.push(tournament);
            });
            
            // Update UI if user is logged in
            if (isLoggedIn) {
                displayTournaments();
                displayLiveTournament();
                displayUpcomingTournaments();
                displayActiveTournaments();
            }
        }
    });
    
    // Listen for user updates
    database.ref('users').on('value', (snapshot) => {
        if (snapshot.exists() && isLoggedIn && currentUser) {
            const userData = snapshot.val()[currentUser.username];
            if (userData) {
                currentUser.balance = userData.balance || 0;
                currentUser.name = userData.name || currentUser.username;
                currentUser.ffid = userData.ffid || '';
                currentUser.phone = userData.phone || '';
                currentUser.kills = userData.kills || 0;
                currentUser.wins = userData.wins || 0;
                currentUser.matches = userData.matches || 0;
                
                // Load transactions
                if (userData.transactions) {
                    userTransactions = [];
                    Object.keys(userData.transactions).forEach(key => {
                        const transaction = userData.transactions[key];
                        transaction.id = key;
                        userTransactions.push(transaction);
                    });
                    
                    // Sort by timestamp (newest first)
                    userTransactions.sort((a, b) => {
                        const timeA = a.timestamp || a.date || 0;
                        const timeB = b.timestamp || b.date || 0;
                        return timeB - timeA;
                    });
                    
                    if (document.getElementById('historySection').classList.contains('d-none') === false) {
                        displayTransactions(userTransactions);
                    }
                }
                
                updateUserUI();
            }
        }
    });
}

// Initialize Payment Methods
function initializePaymentMethods() {
    // Default payment methods
    paymentMethods = [
        { name: 'bkash', number: '018XXXXXXXX', type: 'Personal', status: 'active' },
        { name: 'nagad', number: '018XXXXXXXX', type: 'Personal', status: 'active' },
        { name: 'rocket', number: '018XXXXXXXX', type: 'Personal', status: 'active' },
        { name: 'upay', number: '018XXXXXXXX', type: 'Personal', status: 'active' }
    ];
    
    updatePaymentMethods();
}

// Update Payment Methods in Recharge Modal
function updatePaymentMethods() {
    const select = document.getElementById('paymentMethod');
    select.innerHTML = '<option value="">Select Payment Method</option>';
    
    paymentMethods.forEach(method => {
        if (method.status === 'active') {
            const option = document.createElement('option');
            option.value = method.name;
            option.textContent = method.name.charAt(0).toUpperCase() + method.name.slice(1);
            select.appendChild(option);
        }
    });
}

// Show Payment Number
function showPaymentNumber() {
    const methodName = document.getElementById('paymentMethod').value;
    const infoDiv = document.getElementById('paymentNumberInfo');
    
    if (methodName) {
        const method = paymentMethods.find(m => m.name === methodName);
        if (method) {
            document.getElementById('selectedMethodName').textContent = method.name.charAt(0).toUpperCase() + method.name.slice(1);
            document.getElementById('paymentNumber').textContent = method.number;
            document.getElementById('paymentType').textContent = method.type || 'Personal';
            infoDiv.style.display = 'block';
        } else {
            infoDiv.style.display = 'none';
        }
    } else {
        infoDiv.style.display = 'none';
    }
}

// User Login - FIXED VERSION
function userLogin() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    rememberMe = document.getElementById('rememberMe').checked;
    
    if (!username || !password) {
        showError('Please enter username and password');
        return;
    }
    
    database.ref(`users/${username}`).once('value')
        .then((snapshot) => {
            if (snapshot.exists()) {
                const userData = snapshot.val();
                
                if (userData.password === password) {
                    // Login successful
                    currentUser = userData;
                    currentUser.username = username;
                    isLoggedIn = true;
                    
                    // Save to localStorage if remember me is checked
                    if (rememberMe) {
                        localStorage.setItem('currentUser', JSON.stringify({
                            username: username,
                            timestamp: Date.now()
                        }));
                    }
                    
                    // Update UI
                    showUserDashboard();
                    loadUserData();
                    
                    // Close modal
                    const modalElement = document.getElementById('loginModal');
                    const modal = bootstrap.Modal.getInstance(modalElement);
                    if (modal) modal.hide();
                    
                    showSuccess('Login successful!');
                } else {
                    showError('Invalid password');
                }
            } else {
                showError('User not found. Please register first.');
            }
        })
        .catch((error) => {
            console.error('Login error:', error);
            showError('Login failed. Please check your connection.');
        });
}

// Auto Login
function autoLogin(username) {
    database.ref(`users/${username}`).once('value')
        .then((snapshot) => {
            if (snapshot.exists()) {
                const userData = snapshot.val();
                currentUser = userData;
                currentUser.username = username;
                isLoggedIn = true;
                
                showUserDashboard();
                loadUserData();
                showSuccess('Welcome back!');
            }
        })
        .catch((error) => {
            console.error('Auto login failed:', error);
        });
}

// Register User - FIXED VERSION
function registerUser() {
    const name = document.getElementById('regName').value.trim();
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value.trim();
    const ffid = document.getElementById('regFFID').value.trim();
    
    if (!name || !username || !password || !ffid) {
        showError('Please fill all fields');
        return;
    }
    
    if (username.length < 3) {
        showError('Username must be at least 3 characters');
        return;
    }
    
    if (password.length < 4) {
        showError('Password must be at least 4 characters');
        return;
    }
    
    // Check if user exists
    database.ref(`users/${username}`).once('value')
        .then((snapshot) => {
            if (snapshot.exists()) {
                showError('Username already exists. Please choose another.');
            } else {
                const userData = {
                    name: name,
                    password: password,
                    ffid: ffid,
                    balance: 100, // Starting bonus
                    kills: 0,
                    wins: 0,
                    matches: 0,
                    joinDate: new Date().toISOString(),
                    phone: '',
                    transactions: {
                        welcome_bonus: {
                            type: 'bonus',
                            amount: 100,
                            status: 'completed',
                            timestamp: Date.now(),
                            note: 'Welcome Bonus'
                        }
                    },
                    notifications: {}
                };
                
                // Create user in Firebase
                database.ref(`users/${username}`).set(userData)
                    .then(() => {
                        // Auto login
                        currentUser = userData;
                        currentUser.username = username;
                        isLoggedIn = true;
                        
                        // Save to localStorage
                        localStorage.setItem('currentUser', JSON.stringify({
                            username: username,
                            timestamp: Date.now()
                        }));
                        
                        // Update UI
                        showUserDashboard();
                        loadUserData();
                        
                        // Close modal
                        const modalElement = document.getElementById('loginModal');
                        const modal = bootstrap.Modal.getInstance(modalElement);
                        if (modal) modal.hide();
                        
                        showSuccess('Registration successful! You received ৳100 welcome bonus!');
                    })
                    .catch((error) => {
                        console.error('Registration error:', error);
                        showError('Registration failed: ' + error.message);
                    });
            }
        })
        .catch((error) => {
            console.error('Check user error:', error);
            showError('Error checking user. Please try again.');
        });
}

// Show User Dashboard
function showUserDashboard() {
    document.getElementById('guestView').classList.add('d-none');
    document.getElementById('userDashboard').classList.remove('d-none');
    document.getElementById('userBalanceCard').classList.remove('d-none');
    document.getElementById('loggedInUser').classList.remove('d-none');
    document.getElementById('loginBtn').classList.add('d-none');
    document.getElementById('floatingWithdrawBtn').classList.remove('d-none');
    
    showSection('home');
}

// Load User Data
function loadUserData() {
    if (!currentUser) return;
    
    // Update UI
    updateUserUI();
    
    // Load tournaments data
    displayTournaments();
    displayLiveTournament();
    displayUpcomingTournaments();
}

// Update User UI
function updateUserUI() {
    const userBalanceElement = document.getElementById('userBalance');
    if (userBalanceElement) {
        userBalanceElement.textContent = currentUser.balance || 0;
        userBalanceElement.classList.add('balance-update');
        setTimeout(() => {
            userBalanceElement.classList.remove('balance-update');
        }, 1000);
    }
    
    // Update profile card
    const profileCard = document.getElementById('userProfileCard');
    if (profileCard) {
        profileCard.innerHTML = `
            <img src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png" alt="User" class="user-avatar mb-2">
            <h6>${currentUser.name || currentUser.username}</h6>
            <p class="small text-muted mb-2">FF ID: <span class="text-warning">${currentUser.ffid || 'N/A'}</span></p>
            <div class="d-flex justify-content-around">
                <div>
                    <small class="text-warning">Balance</small>
                    <p class="mb-0 text-success">৳${currentUser.balance || 0}</p>
                </div>
                <div>
                    <small class="text-danger">Kills</small>
                    <p class="mb-0">${currentUser.kills || 0}</p>
                </div>
                <div>
                    <small class="text-success">Wins</small>
                    <p class="mb-0">${currentUser.wins || 0}</p>
                </div>
            </div>
        `;
    }
}

// Show Withdraw Modal
function showWithdrawModal() {
    if (!isLoggedIn) {
        showError('Please login first');
        return;
    }
    
    // Check minimum withdrawal
    const minWithdrawal = systemSettings.minWithdrawal || 200;
    document.getElementById('withdrawAmount').min = minWithdrawal;
    document.getElementById('withdrawAmount').value = minWithdrawal;
    
    const modal = new bootstrap.Modal(document.getElementById('withdrawModal'));
    modal.show();
}

// Submit Withdrawal Request
function submitWithdrawRequest() {
    if (!isLoggedIn) {
        showError('Please login first');
        return;
    }
    
    const amount = parseInt(document.getElementById('withdrawAmount').value);
    const method = document.getElementById('withdrawMethod').value;
    const accountNumber = document.getElementById('withdrawAccountNumber').value.trim();
    const minWithdrawal = systemSettings.minWithdrawal || 200;
    
    if (!amount || amount < minWithdrawal) {
        showError(`Minimum withdrawal amount is ৳${minWithdrawal}`);
        return;
    }
    
    if (!accountNumber || accountNumber.length < 11) {
        showError('Please enter a valid account number');
        return;
    }
    
    if (currentUser.balance < amount) {
        showError('Insufficient balance');
        return;
    }
    
    // Generate unique request ID
    const requestId = 'withdraw_' + Date.now();
    
    // Calculate new balance
    const newBalance = currentUser.balance - amount;
    
    // Create withdrawal data
    const withdrawData = {
        username: currentUser.username,
        name: currentUser.name || currentUser.username,
        amount: amount,
        method: method,
        accountNumber: accountNumber,
        status: 'pending',
        timestamp: Date.now(),
        processed: false
    };
    
    // 1. Update user balance in Firebase
    database.ref(`users/${currentUser.username}/balance`).set(newBalance)
        .then(() => {
            // 2. Save withdrawal request
            return database.ref(`withdrawRequests/${requestId}`).set(withdrawData);
        })
        .then(() => {
            // 3. Add transaction to user's history
            const transactionData = {
                type: 'withdrawal_request',
                amount: -amount,
                status: 'pending',
                timestamp: Date.now(),
                method: method,
                accountNumber: accountNumber,
                note: 'Withdrawal request submitted',
                balanceAfter: newBalance
            };
            
            return database.ref(`users/${currentUser.username}/transactions/${requestId}`).set(transactionData);
        })
        .then(() => {
            // Update current user object
            currentUser.balance = newBalance;
            
            // Update userTransactions array
            userTransactions.unshift({
                id: requestId,
                type: 'withdrawal_request',
                amount: -amount,
                status: 'pending',
                timestamp: Date.now(),
                method: method,
                accountNumber: accountNumber,
                note: 'Withdrawal request submitted',
                balanceAfter: newBalance
            });
            
            // Update UI
            updateUserUI();
            
            // Clear form
            document.getElementById('withdrawAmount').value = minWithdrawal;
            document.getElementById('withdrawAccountNumber').value = '';
            
            // Close modal
            const modalElement = document.getElementById('withdrawModal');
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) modal.hide();
            
            showSuccess(`Withdrawal request of ৳${amount} submitted successfully! Balance updated to ৳${newBalance}.`);
        })
        .catch((error) => {
            showError('Failed to submit withdrawal request: ' + error.message);
        });
}

// Submit Recharge Request
function submitRechargeRequest() {
    if (!isLoggedIn) {
        showError('Please login first');
        return;
    }
    
    const amountInput = document.getElementById('rechargeAmount');
    const methodInput = document.getElementById('paymentMethod');
    const transactionIdInput = document.getElementById('transactionId');
    const senderNumberInput = document.getElementById('senderNumber');
    
    const amount = parseInt(amountInput.value);
    const method = methodInput.value;
    const transactionId = transactionIdInput.value.trim();
    const senderNumber = senderNumberInput.value.trim();
    
    // Validation
    if (!amount || amount < 100) {
        showError('Minimum recharge amount is ৳100');
        return;
    }
    
    if (!method) {
        showError('Please select a payment method');
        return;
    }
    
    if (!transactionId) {
        showError('Please enter your transaction ID');
        return;
    }
    
    if (!senderNumber || senderNumber.length < 11) {
        showError('Please enter a valid phone number');
        return;
    }
    
    // Generate unique request ID
    const requestId = 'recharge_' + Date.now();
    
    // Create recharge data
    const rechargeData = {
        username: currentUser.username,
        name: currentUser.name || currentUser.username,
        amount: amount,
        method: method,
        transactionId: transactionId,
        senderNumber: senderNumber,
        status: 'pending',
        timestamp: Date.now(),
        processed: false
    };
    
    // Save recharge request
    database.ref(`rechargeRequests/${requestId}`).set(rechargeData)
        .then(() => {
            // Add transaction to user's history
            const transactionData = {
                type: 'recharge_request',
                amount: amount,
                status: 'pending',
                timestamp: Date.now(),
                method: method,
                transactionId: transactionId,
                senderNumber: senderNumber,
                note: 'Recharge request submitted',
                balanceAfter: currentUser.balance
            };
            
            return database.ref(`users/${currentUser.username}/transactions/${requestId}`).set(transactionData);
        })
        .then(() => {
            // Update userTransactions array
            userTransactions.unshift({
                id: requestId,
                type: 'recharge_request',
                amount: amount,
                status: 'pending',
                timestamp: Date.now(),
                method: method,
                transactionId: transactionId,
                senderNumber: senderNumber,
                note: 'Recharge request submitted',
                balanceAfter: currentUser.balance
            });
            
            // Clear form
            amountInput.value = '500';
            transactionIdInput.value = '';
            senderNumberInput.value = '';
            methodInput.value = '';
            document.getElementById('paymentNumberInfo').style.display = 'none';
            
            // Close modal
            const modalElement = document.getElementById('rechargeModal');
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) modal.hide();
            
            showSuccess(`Recharge request of ৳${amount} submitted! Admin will approve soon.`);
        })
        .catch((error) => {
            showError('Failed to submit recharge request: ' + error.message);
        });
}

// Update Profile
function updateProfile() {
    if (!isLoggedIn) return;
    
    const name = document.getElementById('updateName').value.trim();
    const ffid = document.getElementById('updateFFID').value.trim();
    const phone = document.getElementById('updatePhone').value.trim();
    
    const updates = {};
    if (name) updates.name = name;
    if (ffid) updates.ffid = ffid;
    if (phone) updates.phone = phone;
    
    if (Object.keys(updates).length === 0) {
        showError('No changes made');
        return;
    }
    
    database.ref(`users/${currentUser.username}`).update(updates)
        .then(() => {
            // Update current user
            Object.assign(currentUser, updates);
            
            // Update UI
            updateUserUI();
            
            // Close modal
            const modalElement = document.getElementById('updateProfileModal');
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) modal.hide();
            
            showSuccess('Profile updated successfully!');
        })
        .catch((error) => {
            showError('Failed to update profile: ' + error.message);
        });
}

// Show Join Tournament Modal
function showJoinTournamentModal(tournamentId) {
    if (!isLoggedIn) {
        showError('Please login first');
        return;
    }
    
    const tournament = tournaments.find(t => t.id === tournamentId);
    if (!tournament) return;
    
    // Check if tournament is upcoming (cannot join live tournaments)
    if (tournament.status !== 'upcoming') {
        showError('You can only join upcoming tournaments. This tournament is ' + tournament.status);
        return;
    }
    
    // Check if already joined
    database.ref(`tournaments/${tournamentId}/players/${currentUser.username}`).once('value')
        .then((snapshot) => {
            const modalBody = document.getElementById('tournamentDetails');
            
            if (snapshot.exists()) {
                // Already joined
                modalBody.innerHTML = `
                    <h6>${tournament.title}</h6>
                    <div class="alert alert-success">
                        <p class="mb-0"><i class="fas fa-check-circle"></i> You have already joined this tournament!</p>
                        <p class="mb-0 small mt-1">Payment Status: <span class="badge bg-success">Completed</span></p>
                    </div>
                    <p class="small mb-1"><strong>Type:</strong> ${tournament.type}</p>
                    <p class="small mb-1"><strong>Schedule:</strong> ${new Date(tournament.schedule).toLocaleString()}</p>
                    <p class="small mb-1"><strong>Entry Fee Paid:</strong> <span class="text-warning">৳${tournament.entryFee}</span></p>
                    
                    <button class="btn btn-success w-100 mt-2" onclick="viewJoinedTournament('${tournament.id}')">
                        <i class="fas fa-eye"></i> View Details
                    </button>
                `;
            } else {
                // Not joined yet
                const isDuo = tournament.type === 'duo';
                const entryFee = tournament.entryFee;
                
                modalBody.innerHTML = `
                    <h6>${tournament.title}</h6>
                    <p class="small mb-1"><strong>Type:</strong> ${tournament.type} ${isDuo ? '(You can choose Solo or Duo)' : ''}</p>
                    <p class="small mb-1"><strong>Schedule:</strong> ${new Date(tournament.schedule).toLocaleString()}</p>
                    <p class="small mb-1"><strong>Prize Pool:</strong> <span class="text-success">৳${tournament.prize}</span></p>
                    <p class="small mb-1"><strong>Kill Reward:</strong> <span class="text-danger">৳${tournament.killReward}/kill</span></p>
                    <p class="small mb-2"><strong>Your Balance:</strong> <span class="text-info">৳${currentUser.balance}</span></p>
                    
                    ${currentUser.balance < entryFee ? 
                        `<div class="alert alert-danger">
                            <p class="mb-0"><i class="fas fa-exclamation-triangle"></i> Insufficient balance! Need ৳${entryFee - currentUser.balance} more.</p>
                        </div>` : ''
                    }
                    
                    ${isDuo ? `
                        <div class="mb-3">
                            <h6 class="small">Choose Your Play Mode:</h6>
                            <div class="form-check mb-2">
                                <input class="form-check-input" type="radio" name="playMode" id="modeSolo" value="solo" checked>
                                <label class="form-check-label" for="modeSolo">
                                    Solo (৳${entryFee})
                                </label>
                            </div>
                            <div class="form-check mb-2">
                                <input class="form-check-input" type="radio" name="playMode" id="modeDuo" value="duo">
                                <label class="form-check-label" for="modeDuo">
                                    Duo (৳${entryFee} × 2 = ৳${entryFee * 2})
                                </label>
                            </div>
                            
                            <div id="duoDetails" style="display: none;">
                                <div class="player-input-group">
                                    <div class="player-label">Player 1 (You)</div>
                                    <input type="text" class="form-control form-control-sm mb-2" id="player1Name" 
                                           value="${currentUser.name || currentUser.username}" readonly>
                                    <div class="player-label">Free Fire ID</div>
                                    <input type="text" class="form-control form-control-sm" id="player1FFID" 
                                           value="${currentUser.ffid || ''}" placeholder="Enter your FF ID" required>
                                </div>
                                <div class="player-input-group">
                                    <div class="player-label">Player 2 (Partner)</div>
                                    <input type="text" class="form-control form-control-sm mb-2" id="player2Name" 
                                           placeholder="Enter partner name" required>
                                    <div class="player-label">Partner Free Fire ID</div>
                                    <input type="text" class="form-control form-control-sm" id="player2FFID" 
                                           placeholder="Enter partner FF ID" required>
                                </div>
                            </div>
                        </div>
                    ` : `
                        <div class="mb-3">
                            <div class="player-input-group">
                                <div class="player-label">Player Name</div>
                                <input type="text" class="form-control" id="playerName" 
                                       value="${currentUser.name || currentUser.username}" readonly>
                                <div class="player-label mt-2">Free Fire ID</div>
                                <input type="text" class="form-control" id="playerFFID" 
                                       value="${currentUser.ffid || ''}" placeholder="Enter your FF ID" required>
                            </div>
                        </div>
                    `}
                    
                    <button class="btn btn-ff w-100" onclick="joinTournament('${tournament.id}')" 
                            ${currentUser.balance < entryFee ? 'disabled' : ''}>
                        Confirm Join
                    </button>
                    
                    <div class="alert alert-warning mt-2 p-2">
                        <p class="small mb-0"><i class="fas fa-info-circle"></i> 
                            <strong>Important:</strong> Room ID & Password will be available only when tournament goes live.
                        </p>
                    </div>
                `;
                
                // Add event listeners for duo mode toggle
                if (isDuo) {
                    setTimeout(() => {
                        document.querySelectorAll('input[name="playMode"]').forEach(radio => {
                            radio.addEventListener('change', function() {
                                document.getElementById('duoDetails').style.display = 
                                    this.value === 'duo' ? 'block' : 'none';
                            });
                        });
                    }, 100);
                }
            } 
            const modal = new bootstrap.Modal(document.getElementById('joinTournamentModal'));
            modal.show();
        });
}

// Join Tournament
function joinTournament(tournamentId) {
    if (!isLoggedIn) {
        showError('Please login first');
        return;
    }
    
    const tournament = tournaments.find(t => t.id === tournamentId);
    if (!tournament) {
        showError('Tournament not found');
        return;
    }
    
    // Check if tournament is upcoming
    if (tournament.status !== 'upcoming') {
        showError('You can only join upcoming tournaments');
        return;
    }
    
    const isDuoTournament = tournament.type === 'duo';
    let playMode = 'solo';
    let entryFee = tournament.entryFee;
    let playerData = {};
    
    if (isDuoTournament) {
        const modeInput = document.querySelector('input[name="playMode"]:checked');
        if (!modeInput) {
            showError('Please select a play mode');
            return;
        }
        playMode = modeInput.value;
        if (playMode === 'duo') {
            entryFee = tournament.entryFee * 2;
            
            // Validate duo details
            const player2Name = document.getElementById('player2Name').value.trim();
            const player2FFID = document.getElementById('player2FFID').value.trim();
            
            if (!player2Name || !player2FFID) {
                showError('Please fill partner details for duo mode');
                return;
            }
            
            const player1FFID = document.getElementById('player1FFID').value.trim();
            if (!player1FFID) {
                showError('Please enter your Free Fire ID');
                return;
            }
            
            playerData = {
                username: currentUser.username,
                player1: {
                    name: currentUser.name || currentUser.username,
                    ffid: player1FFID
                },
                player2: {
                    name: player2Name,
                    ffid: player2FFID
                },
                playMode: 'duo',
                entryPaid: entryFee,
                joinedAt: Date.now(),
                status: 'joined'
            };
        } else {
            const playerFFID = document.getElementById('player1FFID').value.trim();
            if (!playerFFID) {
                showError('Please enter your Free Fire ID');
                return;
            }
            
            playerData = {
                username: currentUser.username,
                name: currentUser.name || currentUser.username,
                ffid: playerFFID,
                playMode: 'solo',
                entryPaid: entryFee,
                joinedAt: Date.now(),
                status: 'joined'
            };
        }
    } else {
        const playerFFID = document.getElementById('playerFFID').value.trim();
        if (!playerFFID) {
            showError('Please enter your Free Fire ID');
            return;
        }
        
        playerData = {
            username: currentUser.username,
            name: currentUser.name || currentUser.username,
            ffid: playerFFID,
            playMode: 'solo',
            entryPaid: entryFee,
            joinedAt: Date.now(),
            status: 'joined'
        };
    }
    
    // Check balance
    if (currentUser.balance < entryFee) {
        showError('Insufficient balance');
        return;
    }
    
    // Calculate new balance
    const newBalance = currentUser.balance - entryFee;
    const transactionId = Date.now().toString();
    
    // 1. Update user balance
    database.ref(`users/${currentUser.username}/balance`).set(newBalance)
        .then(() => {
            // 2. Join tournament
            return database.ref(`tournaments/${tournamentId}/players/${currentUser.username}`).set(playerData);
        })
        .then(() => {
            // 3. Update tournament player count
            const newCount = (tournament.joinedPlayers || 0) + 1;
            return database.ref(`tournaments/${tournamentId}/joinedPlayers`).set(newCount);
        })
        .then(() => {
            // 4. Add transaction
            const transactionData = {
                type: 'tournament_entry',
                tournamentId: tournamentId,
                tournamentName: tournament.title,
                amount: -entryFee,
                status: 'completed',
                timestamp: Date.now(),
                playMode: isDuoTournament ? playMode : 'solo',
                balanceAfter: newBalance
            };
            
            return database.ref(`users/${currentUser.username}/transactions/${transactionId}`).set(transactionData);
        })
        .then(() => {
            // Update current user
            currentUser.balance = newBalance;
            
            // Update userTransactions array
            userTransactions.unshift({
                id: transactionId,
                type: 'tournament_entry',
                tournamentId: tournamentId,
                tournamentName: tournament.title,
                amount: -entryFee,
                status: 'completed',
                timestamp: Date.now(),
                playMode: isDuoTournament ? playMode : 'solo',
                balanceAfter: newBalance
            });
            
            // Update UI
            updateUserUI();
            
            // Close modal
            const modalElement = document.getElementById('joinTournamentModal');
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) modal.hide();
            
            showSuccess(`Successfully joined tournament as ${isDuoTournament ? playMode : 'solo'}! Entry fee ৳${entryFee} deducted. New balance: ৳${newBalance}`);
        })
        .catch((error) => {
            showError('Failed to join tournament: ' + error.message);
        });
}

// View Joined Tournament
function viewJoinedTournament(tournamentId) {
    const tournament = tournaments.find(t => t.id === tournamentId);
    if (!tournament) return;
    
    database.ref(`tournaments/${tournamentId}/players/${currentUser.username}`).once('value')
        .then((snapshot) => {
            if (snapshot.exists()) {
                const playerData = snapshot.val();
                const modalBody = document.getElementById('tournamentDetails');
                
                let playerInfo = '';
                if (playerData.playMode === 'duo') {
                    playerInfo = `
                        <p class="small mb-1"><strong>Player 1:</strong> ${playerData.player1.name} (${playerData.player1.ffid})</p>
                        <p class="small mb-1"><strong>Player 2:</strong> ${playerData.player2.name} (${playerData.player2.ffid})</p>
                    `;
                } else {
                    playerInfo = `
                        <p class="small mb-1"><strong>Player:</strong> ${playerData.name} (${playerData.ffid})</p>
                    `;
                }
                
                modalBody.innerHTML = `
                    <h6>${tournament.title}</h6>
                    <div class="alert alert-success">
                        <p class="mb-0"><i class="fas fa-check-circle"></i> You have joined this tournament!</p>
                        <p class="mb-0 small mt-1">Payment Status: <span class="badge bg-success">Completed</span></p>
                        <p class="mb-0 small mt-1">Play Mode: <span class="badge bg-info">${playerData.playMode}</span></p>
                    </div>
                    ${playerInfo}
                    <p class="small mb-1"><strong>Entry Fee Paid:</strong> <span class="text-warning">৳${playerData.entryPaid}</span></p>
                    <p class="small mb-1"><strong>Tournament Status:</strong> <span class="badge bg-${tournament.status === 'live' ? 'danger' : 'warning'}">${tournament.status}</span></p>
                    
                    ${tournament.status === 'live' && tournament.roomId ? `
                        <button class="btn btn-success w-100 mt-2" onclick="viewRoomDetails('${tournament.id}')">
                            <i class="fas fa-door-open"></i> View Room Details
                        </button>
                    ` : ''}
                    ${tournament.status === 'live' && !tournament.roomId ? `
                        <div class="alert alert-info mt-2">
                            <p class="mb-0 small"><i class="fas fa-clock"></i> Room details will be available soon. Admin is setting up the room.</p>
                        </div>
                    ` : ''}
                `;
                
                const modal = new bootstrap.Modal(document.getElementById('joinTournamentModal'));
                modal.show();
            }
        });
}

// View Room Details
function viewRoomDetails(tournamentId) {
    if (!isLoggedIn) {
        showError('Please login first');
        return;
    }
    
    const tournament = tournaments.find(t => t.id === tournamentId);
    if (!tournament) return;
    
    // Check if user has joined this tournament
    database.ref(`tournaments/${tournamentId}/players/${currentUser.username}`).once('value')
        .then((snapshot) => {
            if (!snapshot.exists()) {
                showError('You must join the tournament first to view room details');
                return;
            }
            
            // Check if tournament is live and room details are available
            if (tournament.status === 'live' && tournament.roomId) {
                const modalBody = document.getElementById('roomDetails');
                modalBody.innerHTML = `
                    <h6>${tournament.title}</h6>
                    <div class="room-details-box">
                        <h5><i class="fas fa-door-open"></i> Room Details</h5>
                        <div class="room-id">${tournament.roomId}</div>
                        <div class="room-password">${tournament.password}</div>
                        <button class="copy-btn" onclick="copyRoomDetails('${tournament.roomId}', '${tournament.password}')">
                            <i class="fas fa-copy"></i> Copy Details
                        </button>
                    </div>
                    
                    <div class="alert alert-info mt-3">
                        <h6 class="mb-2"><i class="fas fa-info-circle"></i> Important Instructions</h6>
                        <p class="small mb-1">1. Open Free Fire and go to Custom Room</p>
                        <p class="small mb-1">2. Enter the Room ID and Password above</p>
                        <p class="small mb-1">3. Join the room immediately</p>
                        <p class="small mb-1">4. Tournament is LIVE now!</p>
                        <p class="small mb-1">5. Report your kills after match ends</p>
                    </div>
                `;
                
                const modal = new bootstrap.Modal(document.getElementById('viewRoomModal'));
                modal.show();
            } else if (tournament.status === 'live') {
                // Tournament is live but room details not set yet
                const modalBody = document.getElementById('roomDetails');
                modalBody.innerHTML = `
                    <h6>${tournament.title}</h6>
                    <div class="alert alert-warning">
                        <p class="mb-0"><i class="fas fa-clock"></i> 
                            Room details are being set by admin. Please wait...
                        </p>
                    </div>
                    <p class="small text-muted">Tournament Status: <span class="badge bg-danger">LIVE</span></p>
                    <p class="small text-muted">Admin will provide room details shortly.</p>
                `;
                
                const modal = new bootstrap.Modal(document.getElementById('viewRoomModal'));
                modal.show();
            } else {
                showError('Room details are only available for live tournaments');
            }
        });
}

// Copy Room Details
function copyRoomDetails(roomId, password) {
    const text = `Room ID: ${roomId}\nPassword: ${password}`;
    navigator.clipboard.writeText(text)
        .then(() => {
            showSuccess('Room details copied to clipboard!');
        })
        .catch(() => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showSuccess('Room details copied to clipboard!');
        });
}

// Display Active Tournaments
function displayActiveTournaments() {
    const container = document.getElementById('activeTournaments');
    if (!tournaments.length) {
        container.innerHTML = '<p class="text-center small">No active tournaments</p>';
        return;
    }
    
    let activeTournaments = [];
    
    // Check each tournament if user has joined
    tournaments.forEach(tournament => {
        if (tournament.players && tournament.players[currentUser.username]) {
            activeTournaments.push({
                ...tournament,
                playerData: tournament.players[currentUser.username]
            });
        }
    });
    
    if (!activeTournaments.length) {
        container.innerHTML = '<p class="text-center small">You have not joined any tournaments</p>';
        return;
    }
    
    let html = '';
    activeTournaments.forEach(tournament => {
        const roomAvailable = tournament.status === 'live' && tournament.roomId;
        
        html += `
            <div class="mb-2 p-2 border-bottom">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-1">${tournament.title}</h6>
                        <p class="small mb-1">
                            <span class="badge bg-${tournament.status === 'live' ? 'danger' : 'warning'}">
                                ${tournament.status}
                            </span>
                            ${tournament.playerData.playMode === 'duo' ? '<span class="badge bg-info ms-1">Duo</span>' : ''}
                            ${roomAvailable ? '<span class="badge bg-success ms-1">Room Available</span>' : ''}
                        </p>
                    </div>
                    ${roomAvailable ? 
                        `<button class="btn btn-sm btn-success" onclick="viewRoomDetails('${tournament.id}')">
                            View Room
                        </button>` :
                        `<button class="btn btn-sm btn-outline-info" onclick="viewJoinedTournament('${tournament.id}')">
                            Details
                        </button>`
                    }
                </div>
                ${tournament.playerData.playMode === 'duo' ? `
                    <p class="small mb-1">Mode: Duo Team</p>
                ` : `
                    <p class="small mb-1">Mode: Solo</p>
                `}
                <p class="small mb-1">Entry Paid: <span class="text-success">৳${tournament.playerData.entryPaid}</span></p>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Display Transactions
function displayTransactions(transactions) {
    const container = document.getElementById('transactionsList');
    
    if (!transactions || transactions.length === 0) {
        container.innerHTML = `
            <div class="text-center py-4">
                <i class="fas fa-exchange-alt fa-3x text-muted mb-3"></i>
                <p class="text-muted">No transactions found</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    transactions.forEach(transaction => {
        if (!transaction) return;
        
        const date = new Date(transaction.timestamp || transaction.date || Date.now()).toLocaleString();
        let type = transaction.type || 'unknown';
        const amount = transaction.amount || 0;
        const amountText = amount > 0 ? `+${amount}` : `${amount}`;
        const status = transaction.status || 'completed';
        
        // Determine transaction class
        let transactionClass = 'transaction-card';
        if (amount > 0) {
            transactionClass += ' transaction-positive';
        } else if (amount < 0) {
            transactionClass += ' transaction-negative';
        }
        if (status === 'pending') {
            transactionClass += ' transaction-pending';
        }
        
        // Format transaction type
        let typeText = '';
        let icon = '';
        let details = '';
        
        switch(type) {
            case 'withdrawal_request':
                typeText = 'Withdrawal';
                icon = 'fa-money-bill-wave';
                details = `To: ${transaction.method || ''} (${transaction.accountNumber || ''})`;
                break;
            case 'recharge_request':
                typeText = 'Recharge';
                icon = 'fa-wallet';
                details = `Via: ${transaction.method || ''}`;
                break;
            case 'tournament_entry':
                typeText = 'Tournament Entry';
                icon = 'fa-gamepad';
                details = `${transaction.tournamentName || 'Tournament'}`;
                break;
            case 'tournament_winning':
                typeText = 'Tournament Winning';
                icon = 'fa-trophy';
                details = 'Prize Money';
                break;
            case 'kill_reward':
                typeText = 'Kill Reward';
                icon = 'fa-skull';
                details = 'Kill Bonus';
                break;
            case 'bonus':
                typeText = 'Bonus';
                icon = 'fa-gift';
                details = transaction.note || 'System Bonus';
                break;
            default:
                typeText = type.replace('_', ' ').toUpperCase();
                icon = 'fa-exchange-alt';
                details = transaction.note || '';
        }
        
        // Status badge
        let statusBadge = '';
        if (status === 'pending') {
            statusBadge = '<span class="badge bg-warning float-end">Pending</span>';
        } else if (status === 'approved') {
            statusBadge = '<span class="badge bg-success float-end">Approved</span>';
        } else if (status === 'rejected') {
            statusBadge = '<span class="badge bg-danger float-end">Rejected</span>';
        }
        
        html += `
            <div class="${transactionClass}">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <h6 class="mb-1"><i class="fas ${icon}"></i> ${typeText}</h6>
                        <p class="small mb-1 text-muted">${details}</p>
                        <p class="small mb-0">${date}</p>
                    </div>
                    <div class="text-end">
                        <h5 class="${amount > 0 ? 'text-success' : 'text-danger'}">${amountText} ৳</h5>
                        ${statusBadge}
                    </div>
                </div>
                ${transaction.balanceAfter !== undefined ? `
                    <div class="mt-2">
                        <small class="text-muted">Balance After: <strong>${transaction.balanceAfter} ৳</strong></small>
                    </div>
                ` : ''}
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Display Tournaments
function displayTournaments() {
    const container = document.getElementById('allTournamentsContainer');
    
    if (!tournaments.length) {
        container.innerHTML = '<p class="text-center">No tournaments available</p>';
        return;
    }
    
    let html = '';
    tournaments.forEach(tournament => {
        const isJoined = tournament.players && tournament.players[currentUser.username];
        const isDuo = tournament.type === 'duo';
        const entryFeeDisplay = isDuo ? `৳${tournament.entryFee} (Solo) / ৳${tournament.entryFee * 2} (Duo)` : `৳${tournament.entryFee}`;
        
        html += `
            <div class="col-md-6 mb-3">
                <div class="tournament-card">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h6>${tournament.title}</h6>
                            <p class="small text-muted mb-1">
                                <i class="fas fa-calendar"></i> ${new Date(tournament.schedule).toLocaleString()}
                            </p>
                        </div>
                        <span class="status-badge status-${tournament.status}">
                            ${tournament.status.toUpperCase()}
                        </span>
                    </div>
                    
                    <div class="row mt-2">
                        <div class="col-6">
                            <p class="small mb-1"><i class="fas fa-ticket-alt"></i> Entry: <span class="text-warning">${entryFeeDisplay}</span></p>
                            <p class="small mb-1"><i class="fas fa-users"></i> Players: ${tournament.joinedPlayers || 0}/${tournament.maxPlayers || 0}</p>
                        </div>
                        <div class="col-6">
                            <p class="small mb-1"><i class="fas fa-trophy"></i> Prize: <span class="text-success">৳${tournament.prize}</span></p>
                            <p class="small mb-1"><i class="fas fa-skull"></i> Kill: <span class="text-danger">৳${tournament.killReward}</span></p>
                        </div>
                    </div>
                    
                    <div class="btn-group w-100 mt-2">
                        ${isJoined ? 
                            `<button class="btn btn-success btn-sm" onclick="viewJoinedTournament('${tournament.id}')">
                                <i class="fas fa-eye"></i> View
                            </button>` :
                            `<button class="btn btn-ff btn-sm" onclick="showJoinTournamentModal('${tournament.id}')">
                                Join Tournament
                            </button>`
                        }
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = `<div class="row">${html}</div>`;
}

// Display Live Tournament
function displayLiveTournament() {
    const container = document.getElementById('liveTournamentCard');
    const liveTournament = tournaments.find(t => t.status === 'live');
    
    if (!liveTournament) {
        container.innerHTML = '<p class="text-center">No live tournament at the moment</p>';
        return;
    }
    
    const isJoined = liveTournament.players && liveTournament.players[currentUser.username];
    const isDuo = liveTournament.type === 'duo';
    const entryFeeDisplay = isDuo ? `৳${liveTournament.entryFee} (Solo) / ৳${liveTournament.entryFee * 2} (Duo)` : `৳${liveTournament.entryFee}`;
    
    container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center">
            <h5><i class="fas fa-fire text-danger"></i> ${liveTournament.title}</h5>
            <span class="live-badge">LIVE NOW</span>
        </div>
        
        <div class="row mt-2">
            <div class="col-md-6">
                <p class="mb-1"><strong>Entry Fee:</strong> <span class="text-danger">${entryFeeDisplay}</span></p>
                <p class="mb-1"><strong>Players:</strong> ${liveTournament.joinedPlayers || 0}/${liveTournament.maxPlayers || 0}</p>
                <p class="mb-1"><strong>Type:</strong> ${liveTournament.type}</p>
            </div>
            <div class="col-md-6">
                <div class="winner-prize">
                    <h6 class="text-warning mb-1">🏆 Prize: ৳${liveTournament.prize}</h6>
                    <p class="mb-0 small">Kill Reward: ৳${liveTournament.killReward}/kill</p>
                </div>
            </div>
        </div>
        
        <div class="text-center mt-3">
            ${isJoined ? 
                `<div class="btn-group">
                    ${liveTournament.roomId ? `
                        <button class="btn btn-success btn-sm" onclick="viewRoomDetails('${liveTournament.id}')">
                            <i class="fas fa-door-open"></i> View Room
                        </button>
                    ` : `
                        <button class="btn btn-info btn-sm" onclick="viewJoinedTournament('${liveTournament.id}')">
                            <i class="fas fa-eye"></i> View Status
                        </button>
                    `}
                </div>
                <p class="small text-muted mt-1">You have joined this tournament</p>` :
                `<button class="btn btn-ff btn-sm disabled">
                    <i class="fas fa-times-circle"></i> Cannot Join (Tournament is LIVE)
                </button>
                <p class="small text-muted mt-1">You can only join upcoming tournaments</p>`
            }
        </div>
    `;
}

// Display Upcoming Tournaments
function displayUpcomingTournaments() {
    const container = document.getElementById('upcomingTournaments');
    const upcoming = tournaments.filter(t => t.status === 'upcoming').slice(0, 3);
    
    if (!upcoming.length) {
        container.innerHTML = '<p class="text-center">No upcoming tournaments</p>';
        return;
    }
    
    let html = '';
    upcoming.forEach(tournament => {
        const isJoined = tournament.players && tournament.players[currentUser.username];
        const isDuo = tournament.type === 'duo';
        const entryFeeDisplay = isDuo ? `৳${tournament.entryFee} (Solo/Duo)` : `৳${tournament.entryFee}`;
        
        html += `
            <div class="col-md-4 mb-3">
                <div class="tournament-card">
                    <h6>${tournament.title}</h6>
                    <p class="small mb-1"><i class="fas fa-clock"></i> ${new Date(tournament.schedule).toLocaleTimeString()}</p>
                    <p class="small mb-1"><i class="fas fa-ticket-alt"></i> Entry: ${entryFeeDisplay}</p>
                    <p class="small mb-1"><i class="fas fa-trophy"></i> Prize: ৳${tournament.prize}</p>
                    <button class="btn btn-ff btn-sm w-100 mt-2" onclick="showJoinTournamentModal('${tournament.id}')">
                        ${isJoined ? 'Joined' : 'Join'}
                    </button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = `<div class="row">${html}</div>`;
}

// Show Section
function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('#mainContent > section').forEach(section => {
        section.classList.add('d-none');
    });
    
    // Show selected section
    const section = document.getElementById(sectionName + 'Section');
    if (section) {
        section.classList.remove('d-none');
        
        // Load section data
        if (sectionName === 'tournaments' && isLoggedIn) {
            displayTournaments();
        } else if (sectionName === 'history' && isLoggedIn) {
            displayTransactions(userTransactions);
        } else if (sectionName === 'profile' && isLoggedIn) {
            loadProfileSection();
        }
    }
}

// Load Profile Section
function loadProfileSection() {
    const profileCard = document.getElementById('profileCard');
    const accountInfo = document.getElementById('accountInfo');
    
    if (!currentUser) return;
    
    profileCard.innerHTML = `
        <img src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png" alt="User" class="user-avatar mb-2">
        <h6>${currentUser.name || currentUser.username}</h6>
        <p class="small text-muted">FF ID: ${currentUser.ffid || 'N/A'}</p>
        <div class="mt-2">
            <h4 class="text-success">৳${currentUser.balance || 0}</h4>
            <p class="small text-muted">Current Balance</p>
        </div>
        <button class="btn btn-ff btn-sm w-100 mt-2" data-bs-toggle="modal" data-bs-target="#updateProfileModal">
            <i class="fas fa-edit"></i> Edit Profile
        </button>
    `;
    
    accountInfo.innerHTML = `
        <div class="row mt-2">
            <div class="col-6">
                <p class="small mb-1"><strong>Username:</strong><br>${currentUser.username}</p>
                <p class="small mb-1"><strong>Phone:</strong><br>${currentUser.phone || 'N/A'}</p>
                <p class="small mb-1"><strong>Total Kills:</strong><br>${currentUser.kills || 0}</p>
            </div>
            <div class="col-6">
                <p class="small mb-1"><strong>Total Wins:</strong><br>${currentUser.wins || 0}</p>
                <p class="small mb-1"><strong>Total Matches:</strong><br>${currentUser.matches || 0}</p>
                <p class="small mb-1"><strong>Join Date:</strong><br>${new Date(currentUser.joinDate).toLocaleDateString()}</p>
            </div>
        </div>
    `;
    
    // Load active tournaments
    displayActiveTournaments();
}

// Logout
function logout() {
    currentUser = null;
    isLoggedIn = false;
    localStorage.removeItem('currentUser');
    
    document.getElementById('guestView').classList.remove('d-none');
    document.getElementById('userDashboard').classList.add('d-none');
    document.getElementById('userBalanceCard').classList.add('d-none');
    document.getElementById('loggedInUser').classList.add('d-none');
    document.getElementById('loginBtn').classList.remove('d-none');
    document.getElementById('floatingWithdrawBtn').classList.add('d-none');
    
    showSection('home');
    showSuccess('Logged out successfully');
}

// Helper Functions
function showSuccess(message) {
    document.getElementById('successToastBody').textContent = message;
    const toast = new bootstrap.Toast(document.getElementById('successToast'));
    toast.show();
}

function showError(message) {
    document.getElementById('errorToastBody').textContent = message;
    const toast = new bootstrap.Toast(document.getElementById('errorToast'));
    toast.show();
}

function filterTournaments() {
    const filter = document.getElementById('tournamentFilter').value;
    const container = document.getElementById('allTournamentsContainer');
    
    if (filter === 'all') {
        displayTournaments();
        return;
    }
    
    const filtered = tournaments.filter(t => t.type === filter);
    
    if (!filtered.length) {
        container.innerHTML = `<p class="text-center">No ${filter} tournaments found</p>`;
        return;
    }
    
    let html = '';
    filtered.forEach(tournament => {
        const isJoined = tournament.players && tournament.players[currentUser.username];
        const isDuo = tournament.type === 'duo';
        const entryFeeDisplay = isDuo ? `৳${tournament.entryFee} (Solo) / ৳${tournament.entryFee * 2} (Duo)` : `৳${tournament.entryFee}`;
        
        html += `
            <div class="col-md-6 mb-3">
                <div class="tournament-card">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h6>${tournament.title}</h6>
                            <p class="small text-muted mb-1">
                                <i class="fas fa-calendar"></i> ${new Date(tournament.schedule).toLocaleString()}
                            </p>
                        </div>
                        <span class="status-badge status-${tournament.status}">
                            ${tournament.status.toUpperCase()}
                        </span>
                    </div>
                    
                    <div class="row mt-2">
                        <div class="col-6">
                            <p class="small mb-1"><i class="fas fa-ticket-alt"></i> Entry: <span class="text-warning">${entryFeeDisplay}</span></p>
                            <p class="small mb-1"><i class="fas fa-users"></i> Players: ${tournament.joinedPlayers || 0}/${tournament.maxPlayers || 0}</p>
                        </div>
                        <div class="col-6">
                            <p class="small mb-1"><i class="fas fa-trophy"></i> Prize: <span class="text-success">৳${tournament.prize}</span></p>
                            <p class="small mb-1"><i class="fas fa-skull"></i> Kill: <span class="text-danger">৳${tournament.killReward}</span></p>
                        </div>
                    </div>
                    
                    <div class="btn-group w-100 mt-2">
                        ${isJoined ? 
                            `<button class="btn btn-success btn-sm" onclick="viewJoinedTournament('${tournament.id}')">
                                <i class="fas fa-eye"></i> View
                            </button>` :
                            `<button class="btn btn-ff btn-sm" onclick="showJoinTournamentModal('${tournament.id}')">
                                Join Tournament
                            </button>`
                        }
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = `<div class="row">${html}</div>`;
}

function searchTournaments() {
    const searchTerm = document.getElementById('searchTournament').value.toLowerCase();
    const container = document.getElementById('allTournamentsContainer');
    
    if (!searchTerm) {
        displayTournaments();
        return;
    }
    
    const filtered = tournaments.filter(t => 
        t.title.toLowerCase().includes(searchTerm) ||
        t.type.toLowerCase().includes(searchTerm)
    );
    
    if (!filtered.length) {
        container.innerHTML = `<p class="text-center">No tournaments found matching "${searchTerm}"</p>`;
        return;
    }
    
    let html = '';
    filtered.forEach(tournament => {
        const isJoined = tournament.players && tournament.players[currentUser.username];
        const isDuo = tournament.type === 'duo';
        const entryFeeDisplay = isDuo ? `৳${tournament.entryFee} (Solo) / ৳${tournament.entryFee * 2} (Duo)` : `৳${tournament.entryFee}`;
        
        html += `
            <div class="col-md-6 mb-3">
                <div class="tournament-card">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h6>${tournament.title}</h6>
                            <p class="small text-muted mb-1">
                                <i class="fas fa-calendar"></i> ${new Date(tournament.schedule).toLocaleString()}
                            </p>
                        </div>
                        <span class="status-badge status-${tournament.status}">
                            ${tournament.status.toUpperCase()}
                        </span>
                    </div>
                    
                    <div class="row mt-2">
                        <div class="col-6">
                            <p class="small mb-1"><i class="fas fa-ticket-alt"></i> Entry: <span class="text-warning">${entryFeeDisplay}</span></p>
                            <p class="small mb-1"><i class="fas fa-users"></i> Players: ${tournament.joinedPlayers || 0}/${tournament.maxPlayers || 0}</p>
                        </div>
                        <div class="col-6">
                            <p class="small mb-1"><i class="fas fa-trophy"></i> Prize: <span class="text-success">৳${tournament.prize}</span></p>
                            <p class="small mb-1"><i class="fas fa-skull"></i> Kill: <span class="text-danger">৳${tournament.killReward}</span></p>
                        </div>
                    </div>
                    
                    <div class="btn-group w-100 mt-2">
                        ${isJoined ? 
                            `<button class="btn btn-success btn-sm" onclick="viewJoinedTournament('${tournament.id}')">
                                <i class="fas fa-eye"></i> View
                            </button>` :
                            `<button class="btn btn-ff btn-sm" onclick="showJoinTournamentModal('${tournament.id}')">
                                Join Tournament
                            </button>`
                        }
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = `<div class="row">${html}</div>`;
}

function filterTransactions() {
    const type = document.getElementById('transactionTypeFilter').value;
    const date = document.getElementById('transactionDateFilter').value;
    
    let filtered = userTransactions;
    
    if (type !== 'all') {
        filtered = filtered.filter(t => {
            if (!t) return false;
            
            if (type === 'recharge') return t.type === 'recharge_request';
            if (type === 'withdrawal') return t.type === 'withdrawal_request';
            if (type === 'tournament') return t.type === 'tournament_entry';
            if (type === 'winning') return t.type === 'tournament_winning';
            if (type === 'kill') return t.type === 'kill_reward';
            if (type === 'bonus') return t.type === 'bonus';
            return true;
        });
    }
    
    if (date) {
        const selectedDate = new Date(date).toDateString();
        filtered = filtered.filter(t => {
            if (!t) return false;
            const transactionDate = new Date(t.timestamp || t.date || Date.now()).toDateString();
            return transactionDate === selectedDate;
        });
    }
    
    displayTransactions(filtered);
}
function setupPaymentMethodListeners() {
    // Listen for payment method updates
    database.ref('admin/settings/paymentMethods').on('value', (snapshot) => {
        if (snapshot.exists()) {
            const paymentMethods = {};
            snapshot.forEach((child) => {
                const method = child.val();
                method.name = child.key;
                paymentMethods[child.key] = method;
            });
            
            // Update UI with new payment methods
            updatePaymentMethodsUI(paymentMethods);
        }
    });
}

function updatePaymentMethodsUI(paymentMethods) {
    // Update recharge modal
    const rechargeSelect = document.getElementById('paymentMethod');
    const withdrawSelect = document.getElementById('withdrawMethod');
    
    if (rechargeSelect) {
        rechargeSelect.innerHTML = '<option value="">Select Payment Method</option>';
        Object.keys(paymentMethods).forEach(key => {
            const method = paymentMethods[key];
            if (method.status === 'active') {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = key.charAt(0).toUpperCase() + key.slice(1);
                rechargeSelect.appendChild(option);
            }
        });
    }
    
    if (withdrawSelect) {
        withdrawSelect.innerHTML = '<option value="">Select Payment Method</option>';
        Object.keys(paymentMethods).forEach(key => {
            const method = paymentMethods[key];
            if (method.status === 'active') {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = key.charAt(0).toUpperCase() + key.slice(1);
                withdrawSelect.appendChild(option);
            }
        });
    }
}

// Call this in your setupFirebaseListeners function
function setupFirebaseListeners() {
    // ... existing code ...
    
    // Add payment method listener
    setupPaymentMethodListeners();
    
    // ... rest of your code ...
}// ============================================
// ADMIN PAYMENT NUMBER SYSTEM
// ============================================

// Load admin payment numbers from Firebase
function loadAdminPaymentNumbers() {
    return new Promise((resolve, reject) => {
        database.ref('admin/settings/paymentMethods').once('value')
            .then((snapshot) => {
                if (snapshot.exists()) {
                    const methods = {};
                    snapshot.forEach((child) => {
                        const method = child.val();
                        methods[child.key] = method;
                    });
                    resolve(methods);
                } else {
                    resolve({}); // Empty object if no data
                }
            })
            .catch((error) => {
                console.error("Error loading payment methods:", error);
                reject(error);
            });
    });
}

// Populate payment method dropdowns
function populatePaymentMethods(adminPaymentNumbers) {
    const rechargeSelect = document.getElementById('paymentMethod');
    const withdrawSelect = document.getElementById('withdrawMethod');
    
    // Clear existing options except first one
    if (rechargeSelect) {
        rechargeSelect.innerHTML = '<option value="">Select Payment Method</option>';
    }
    if (withdrawSelect) {
        withdrawSelect.innerHTML = '<option value="">Select Payment Method</option>';
    }
    
    // Add options from Firebase data
    if (adminPaymentNumbers && Object.keys(adminPaymentNumbers).length > 0) {
        Object.keys(adminPaymentNumbers).forEach(methodName => {
            const method = adminPaymentNumbers[methodName];
            if (method.status === 'active') {
                // For recharge modal
                if (rechargeSelect) {
                    const option = document.createElement('option');
                    option.value = methodName;
                    option.textContent = methodName.charAt(0).toUpperCase() + methodName.slice(1);
                    rechargeSelect.appendChild(option);
                }
                
                // For withdraw modal
                if (withdrawSelect) {
                    const option2 = document.createElement('option');
                    option2.value = methodName;
                    option2.textContent = methodName.charAt(0).toUpperCase() + methodName.slice(1);
                    withdrawSelect.appendChild(option2);
                }
            }
        });
    } else {
        // Fallback: Use default methods if Firebase data is empty
        const defaultMethods = ['bkash', 'nagad', 'rocket', 'upay'];
        defaultMethods.forEach(method => {
            if (rechargeSelect) {
                const option = document.createElement('option');
                option.value = method;
                option.textContent = method.charAt(0).toUpperCase() + method.slice(1);
                rechargeSelect.appendChild(option);
            }
            if (withdrawSelect) {
                const option2 = document.createElement('option');
                option2.value = method;
                option2.textContent = method.charAt(0).toUpperCase() + method.slice(1);
                withdrawSelect.appendChild(option2);
            }
        });
    }
}

// Show payment number when method is selected (for recharge)
function showPaymentNumber() {
    const methodName = document.getElementById('paymentMethod').value;
    const infoDiv = document.getElementById('paymentNumberInfo');
    
    if (!methodName) {
        infoDiv.style.display = 'none';
        return;
    }
    
    // Load data from Firebase
    loadAdminPaymentNumbers()
        .then(adminPaymentNumbers => {
            const method = adminPaymentNumbers[methodName];
            if (method && method.number) {
                document.getElementById('selectedMethodName').textContent = 
                    methodName.charAt(0).toUpperCase() + methodName.slice(1);
                document.getElementById('paymentNumber').textContent = method.number;
                document.getElementById('paymentType').textContent = method.type || 'Personal';
                infoDiv.style.display = 'block';
            } else {
                // If no data in Firebase, show default numbers
                const defaultNumbers = {
                    bkash: { number: '018XXXXXXXX', type: 'Personal' },
                    nagad: { number: '019XXXXXXXX', type: 'Personal' },
                    rocket: { number: '017XXXXXXXX', type: 'Personal' },
                    upay: { number: '016XXXXXXXX', type: 'Personal' }
                };
                
                if (defaultNumbers[methodName]) {
                    document.getElementById('selectedMethodName').textContent = 
                        methodName.charAt(0).toUpperCase() + methodName.slice(1);
                    document.getElementById('paymentNumber').textContent = defaultNumbers[methodName].number;
                    document.getElementById('paymentType').textContent = defaultNumbers[methodName].type;
                    infoDiv.style.display = 'block';
                } else {
                    infoDiv.style.display = 'none';
                }
            }
        })
        .catch(error => {
            console.error("Error loading payment number:", error);
            infoDiv.style.display = 'none';
        });
}

// Show withdraw payment number when method is selected
function showWithdrawNumber() {
    const methodName = document.getElementById('withdrawMethod').value;
    const infoDiv = document.getElementById('withdrawNumberInfo');
    
    if (!methodName) {
        infoDiv.style.display = 'none';
        return;
    }
    
    // Load data from Firebase
    loadAdminPaymentNumbers()
        .then(adminPaymentNumbers => {
            const method = adminPaymentNumbers[methodName];
            if (method && method.number) {
                document.getElementById('selectedWithdrawMethod').textContent = 
                    methodName.charAt(0).toUpperCase() + methodName.slice(1);
                document.getElementById('withdrawNumber').textContent = method.number;
                document.getElementById('withdrawType').textContent = method.type || 'Personal';
                infoDiv.style.display = 'block';
            } else {
                // If no data in Firebase, show default numbers
                const defaultNumbers = {
                    bkash: { number: '018XXXXXXXX', type: 'Personal' },
                    nagad: { number: '019XXXXXXXX', type: 'Personal' },
                    rocket: { number: '017XXXXXXXX', type: 'Personal' },
                    upay: { number: '016XXXXXXXX', type: 'Personal' }
                };
                
                if (defaultNumbers[methodName]) {
                    document.getElementById('selectedWithdrawMethod').textContent = 
                        methodName.charAt(0).toUpperCase() + methodName.slice(1);
                    document.getElementById('withdrawNumber').textContent = defaultNumbers[methodName].number;
                    document.getElementById('withdrawType').textContent = defaultNumbers[methodName].type;
                    infoDiv.style.display = 'block';
                } else {
                    infoDiv.style.display = 'none';
                }
            }
        })
        .catch(error => {
            console.error("Error loading withdraw number:", error);
            infoDiv.style.display = 'none';
        });
}

// Initialize payment methods on page load
function initializePaymentMethods() {
    // Load payment methods and populate dropdowns
    loadAdminPaymentNumbers()
        .then(adminPaymentNumbers => {
            populatePaymentMethods(adminPaymentNumbers);
        })
        .catch(error => {
            console.error("Failed to load payment methods:", error);
            // Still populate with default methods
            populatePaymentMethods({});
        });
    
    // Set event listeners for payment method changes
    const paymentMethodSelect = document.getElementById('paymentMethod');
    const withdrawMethodSelect = document.getElementById('withdrawMethod');
    
    if (paymentMethodSelect) {
        paymentMethodSelect.addEventListener('change', showPaymentNumber);
    }
    
    if (withdrawMethodSelect) {
        withdrawMethodSelect.addEventListener('change', showWithdrawNumber);
    }
}

// Call this in your main initialization
document.addEventListener('DOMContentLoaded', function() {
    // ... আপনার অন্যান্য initialization কোড ...
    
    // Initialize payment methods
    initializePaymentMethods();
});
// Make functions available globally
window.userLogin = userLogin;
window.registerUser = registerUser;
window.submitRechargeRequest = submitRechargeRequest;
window.updateProfile = updateProfile;
window.joinTournament = joinTournament;
window.viewRoomDetails = viewRoomDetails;
window.viewJoinedTournament = viewJoinedTournament;
window.showSection = showSection;
window.logout = logout;
window.filterTournaments = filterTournaments;
window.searchTournaments = searchTournaments;
window.filterTransactions = filterTransactions;
window.showWithdrawModal = showWithdrawModal;
window.submitWithdrawRequest = submitWithdrawRequest;
window.showPaymentNumber = showPaymentNumber;
window.showJoinTournamentModal = showJoinTournamentModal;
window.copyRoomDetails = copyRoomDetails;
// Firebase setup for payment methods
