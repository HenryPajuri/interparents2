class Dashboard {
    constructor() {
        this.API_BASE = 'https://interparents-1.onrender.com/api';
        this.user = null;
        this.passwordChangeVisible = false;
        console.log('Dashboard initialized with API_BASE:', this.API_BASE);
        this.init();
    }

    async init() {
        console.log('Starting dashboard initialization...');
        await this.loadUserInfo();
        this.bindEvents();
        this.initializePasswordChange();
    }

    async loadUserInfo() {
        console.log('Loading user info from:', `${this.API_BASE}/auth/me`);
        try {
            const response = await fetch(`${this.API_BASE}/auth/me`, {
                credentials: 'include'
            });

            console.log('Response status:', response.status);

            if (response.ok) {
                const data = await response.json();
                console.log('Response data:', data);
                
                if (data.success) {
                    this.user = data.user;
                    console.log('User loaded successfully:', this.user);
                    this.updateUI();
                } else {
                    console.log('Response not successful, redirecting to login');
                    this.redirectToLogin();
                }
            } else {
                console.log('Response not ok, status:', response.status);
                const errorText = await response.text();
                console.log('Error response text:', errorText);
                this.redirectToLogin();
            }
        } catch (error) {
            console.error('Error loading user info:', error);
            this.redirectToLogin();
        }
    }

    updateUI() {
        console.log('Updating UI with user:', this.user);
        
        const greeting = document.getElementById('userGreeting');
        if (greeting) {
            greeting.textContent = `Welcome back, ${this.user.name}!`;
        }

        const userCard = document.getElementById('userInfoCard');
        if (userCard) {
            userCard.innerHTML = `
                <h2>Your Profile</h2>
                <button class="change-password-trigger" id="changePasswordTrigger">
                    🔒 Change Password
                </button>
                <div class="user-details">
                    <div class="detail-row">
                        <span class="label">Name:</span>
                        <span class="value">${this.user.name}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Email:</span>
                        <span class="value">${this.user.email}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Role:</span>
                        <span class="value role-${this.user.role}">${this.capitalizeRole(this.user.role)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">School:</span>
                        <span class="value">${this.user.school}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Position:</span>
                        <span class="value">${this.user.position}</span>
                    </div>
                    ${this.user.lastLogin ? `
                    <div class="detail-row">
                        <span class="label">Last Login:</span>
                        <span class="value">${new Date(this.user.lastLogin).toLocaleString()}</span>
                    </div>
                    ` : ''}
                </div>
            `;
        }

        if (this.user.role === 'admin' || this.user.role === 'executive') {
            const adminCard = document.getElementById('adminCard');
            const uploadBtn = document.getElementById('uploadBtn');
            
            if (adminCard) adminCard.style.display = 'block';
            if (uploadBtn) uploadBtn.style.display = 'block';
        }

        // Bind the change password trigger after UI update
        this.bindPasswordTrigger();
    }

    capitalizeRole(role) {
        if (role === 'admin') return 'Administrator';
        if (role === 'executive') return 'Executive Member';
        return 'Member';
    }

    bindEvents() {
        console.log('Binding events...');
        
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        }

        this.setCacheHeaders();
    }

    bindPasswordTrigger() {
        const trigger = document.getElementById('changePasswordTrigger');
        if (trigger) {
            trigger.addEventListener('click', () => this.togglePasswordChange());
        }
    }

    initializePasswordChange() {
        // Bind password change form events
        this.bindPasswordChangeEvents();
        this.initializePasswordValidation();
    }

    bindPasswordChangeEvents() {
        // Form submission
        const form = document.getElementById('passwordChangeForm');
        if (form) {
            form.addEventListener('submit', (e) => this.handlePasswordChange(e));
        }

        // Cancel button
        const cancelBtn = document.getElementById('cancelPasswordChange');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.hidePasswordChange());
        }

        // Password toggle buttons
        document.querySelectorAll('.password-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => this.togglePasswordVisibility(e));
        });
    }

    initializePasswordValidation() {
        const newPasswordInput = document.getElementById('newPassword');
        const confirmPasswordInput = document.getElementById('confirmPassword');

        if (newPasswordInput) {
            newPasswordInput.addEventListener('input', () => {
                this.validatePasswordStrength();
                this.validatePasswordMatch();
            });
        }

        if (confirmPasswordInput) {
            confirmPasswordInput.addEventListener('input', () => this.validatePasswordMatch());
        }
    }

    togglePasswordChange() {
        const passwordCard = document.getElementById('passwordChangeCard');
        
        if (!this.passwordChangeVisible) {
            this.showPasswordChange();
        } else {
            this.hidePasswordChange();
        }
    }

    showPasswordChange() {
        const passwordCard = document.getElementById('passwordChangeCard');
        const trigger = document.getElementById('changePasswordTrigger');
        
        if (passwordCard) {
            passwordCard.style.display = 'block';
            this.passwordChangeVisible = true;
            
            // Scroll to password change section
            setTimeout(() => {
                passwordCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
        
        if (trigger) {
            trigger.textContent = '❌ Cancel Password Change';
        }
    }

    hidePasswordChange() {
        const passwordCard = document.getElementById('passwordChangeCard');
        const trigger = document.getElementById('changePasswordTrigger');
        const form = document.getElementById('passwordChangeForm');
        
        if (passwordCard) {
            passwordCard.style.display = 'none';
            this.passwordChangeVisible = false;
        }
        
        if (trigger) {
            trigger.textContent = '🔒 Change Password';
        }
        
        if (form) {
            form.reset();
            this.clearPasswordValidation();
        }
        
        this.hidePasswordMessage();
    }

    togglePasswordVisibility(e) {
        const button = e.target.closest('.password-toggle');
        const targetId = button.getAttribute('data-target');
        const input = document.getElementById(targetId);
        const toggleText = button.querySelector('.toggle-text');

        if (input.type === 'password') {
            input.type = 'text';
            toggleText.textContent = 'Hide';
        } else {
            input.type = 'password';
            toggleText.textContent = 'Show';
        }
    }

    validatePasswordStrength() {
        const password = document.getElementById('newPassword').value;
        const strengthDiv = document.getElementById('passwordStrength');
        const requirements = {
            length: password.length >= 6,
            lowercase: /[a-z]/.test(password),
            uppercase: /[A-Z]/.test(password),
            number: /\d/.test(password)
        };

        // Update requirement indicators
        Object.keys(requirements).forEach(req => {
            const element = document.getElementById(`req-${req}`);
            if (element) {
                element.classList.toggle('met', requirements[req]);
            }
        });

        // Calculate strength
        const metRequirements = Object.values(requirements).filter(Boolean).length;
        let strength = '';
        let strengthClass = '';

        if (password.length === 0) {
            strength = '';
            strengthClass = '';
        } else if (metRequirements <= 1) {
            strength = 'Weak password';
            strengthClass = 'weak';
        } else if (metRequirements <= 3) {
            strength = 'Medium strength';
            strengthClass = 'medium';
        } else {
            strength = 'Strong password';
            strengthClass = 'strong';
        }

        strengthDiv.textContent = strength;
        strengthDiv.className = `password-strength ${strengthClass}`;

        return metRequirements >= 2; // Minimum viable password
    }

    validatePasswordMatch() {
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const matchDiv = document.getElementById('passwordMatch');

        if (confirmPassword.length === 0) {
            matchDiv.textContent = '';
            matchDiv.className = 'password-match';
            return false;
        }

        const isMatch = newPassword === confirmPassword;
        matchDiv.textContent = isMatch ? 'Passwords match ✓' : 'Passwords do not match';
        matchDiv.className = `password-match ${isMatch ? 'match' : 'no-match'}`;

        return isMatch;
    }

    clearPasswordValidation() {
        document.getElementById('passwordStrength').textContent = '';
        document.getElementById('passwordMatch').textContent = '';
        
        // Reset requirement indicators
        document.querySelectorAll('.password-requirements li').forEach(li => {
            li.classList.remove('met');
        });
    }

    async handlePasswordChange(e) {
        e.preventDefault();
        
        const form = e.target;
        const formData = new FormData(form);
        const data = {
            currentPassword: formData.get('currentPassword'),
            newPassword: formData.get('newPassword'),
            confirmPassword: formData.get('confirmPassword')
        };

        // Validate form
        if (!this.validatePasswordForm(data)) {
            return;
        }

        const saveBtn = document.getElementById('savePasswordBtn');
        const saveText = document.getElementById('savePasswordText');
        const saveSpinner = document.getElementById('savePasswordSpinner');

        // Set loading state
        saveBtn.disabled = true;
        saveText.style.display = 'none';
        saveSpinner.style.display = 'inline-flex';

        try {
            const response = await fetch(`${this.API_BASE}/auth/change-password`, {
                method: 'PUT',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                this.showPasswordMessage('Password changed successfully! You may need to log in again.', 'success');
                form.reset();
                this.clearPasswordValidation();
                
                // Auto-hide after success
                setTimeout(() => {
                    this.hidePasswordChange();
                }, 3000);
            } else {
                this.showPasswordMessage(result.message || 'Failed to change password', 'error');
            }

        } catch (error) {
            console.error('Password change error:', error);
            this.showPasswordMessage('Network error. Please try again.', 'error');
        } finally {
            // Reset loading state
            saveBtn.disabled = false;
            saveText.style.display = 'inline';
            saveSpinner.style.display = 'none';
        }
    }

    validatePasswordForm(data) {
        const { currentPassword, newPassword, confirmPassword } = data;

        if (!currentPassword) {
            this.showPasswordMessage('Current password is required', 'error');
            return false;
        }

        if (!newPassword || newPassword.length < 6) {
            this.showPasswordMessage('New password must be at least 6 characters long', 'error');
            return false;
        }

        if (newPassword !== confirmPassword) {
            this.showPasswordMessage('New passwords do not match', 'error');
            return false;
        }

        if (currentPassword === newPassword) {
            this.showPasswordMessage('New password must be different from current password', 'warning');
            return false;
        }

        if (!this.validatePasswordStrength()) {
            this.showPasswordMessage('Password does not meet minimum requirements', 'error');
            return false;
        }

        return true;
    }

    showPasswordMessage(message, type = 'info') {
        const messageDiv = document.getElementById('passwordChangeMessage');
        messageDiv.textContent = message;
        messageDiv.className = `show ${type}`;
    }

    hidePasswordMessage() {
        const messageDiv = document.getElementById('passwordChangeMessage');
        messageDiv.className = '';
        messageDiv.textContent = '';
    }

    setCacheHeaders() {
        if ('serviceWorker' in navigator) {
            caches.keys().then(names => {
                names.forEach(name => {
                    caches.delete(name);
                });
            });
        }
    }

    async logout() {
        console.log('Logging out...');
        try {
            const response = await fetch(`${this.API_BASE}/auth/logout`, {
                method: 'POST',
                credentials: 'include'
            });

            console.log('Logout response status:', response.status);
            sessionStorage.clear();
            console.log('Redirecting to login...');
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Logout error:', error);
            sessionStorage.clear();
            window.location.href = 'login.html';
        }
    }

    redirectToLogin() {
        console.log('Redirecting to login page...');
        sessionStorage.clear();
        window.location.href = 'login.html';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing dashboard...');
    new Dashboard();
});