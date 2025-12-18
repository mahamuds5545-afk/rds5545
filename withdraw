// ADMIN FUNCTION - Approve or Reject Withdrawal (to be called from admin panel)
function processWithdrawal(requestId, action) {
    // action can be 'approve' or 'reject'
    
    database.ref(`withdrawRequests/${requestId}`).once('value')
        .then((snapshot) => {
            if (!snapshot.exists()) {
                showError('Withdrawal request not found');
                return;
            }
            
            const request = snapshot.val();
            const newStatus = action === 'approve' ? 'approved' : 'rejected';
            
            // Update withdrawal request status
            database.ref(`withdrawRequests/${requestId}/status`).set(newStatus)
                .then(() => {
                    // Update user's transaction status
                    database.ref(`users/${request.username}/transactions/${requestId}/status`).set(newStatus);
                    
                    // If rejected, refund the amount
                    if (action === 'reject') {
                        return database.ref(`users/${request.username}/balance`).transaction((currentBalance) => {
                            return (currentBalance || 0) + request.amount;
                        });
                    }
                    return Promise.resolve();
                })
                .then(() => {
                    showSuccess(`Withdrawal ${action}d successfully!`);
                })
                .catch((error) => {
                    showError('Failed to process withdrawal: ' + error.message);
                });
        });
}
