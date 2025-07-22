class Dashboard {
    constructor() {
        this.API_BASE = 'https://interparents-1.onrender.com/api';
        this.user = null;
        console.log('Dashboard initialized with API_BASE:', this.API_BASE);
        this.init();
    }

    async init() {
        console.log('Starting dashboard initialization...');
        await this.loadUserInfo();
        this.bindEvents();
    }

    async loadUserInfo() {
        console.log('Loading user info from:', `${this.API_BASE}/auth/me`);
        try {
            const response = await fetch(`${this.API_BASE}/auth/me`, {
                credentials: 'include'
            });

            console.log('Response status:', response.status);
            console.log('Response headers:', [...response.headers.entries()]);

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
                // Try to get error text
                const errorText = await response.text();
                console.log('Error response text:', errorText);
                this.redirectToLogin();
            }
        } catch (error) {
            console.error('Error loading user info:', error);
            console.error('Error details:', error.message, error.stack);
            this.redirectToLogin();
        }
    }

    updateUI() {
        console.log('Updating UI with user:', this.user);
        
        // Update greeting
        const greeting = document.getElementById('userGreeting');
        if (greeting) {
            greeting.textContent = `Welcome back, ${this.user.name}!`;
            console.log('Updated greeting');
        } else {
            console.error('Greeting element not found');
        }

        // Update user info card
        const userCard = document.getElementById('userInfoCard');
        if (userCard) {
            userCard.innerHTML = `
                <h2>Your Profile</h2>
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
            console.log('Updated user info card');
        } else {
            console.error('User info card element not found');
        }

        // Show admin features if user has admin or executive role
        if (this.user.role === 'admin' || this.user.role === 'executive') {
            console.log('User has admin/executive role, showing admin features');
            
            const adminCard = document.getElementById('adminCard');
            const uploadBtn = document.getElementById('uploadBtn');
            
            if (adminCard) {
                adminCard.style.display = 'block';
                console.log('Showed admin card');
            } else {
                console.error('Admin card element not found');
            }
            
            if (uploadBtn) {
                uploadBtn.style.display = 'block';
                console.log('Showed upload button');
            } else {
                console.error('Upload button element not found');
            }
        } else {
            console.log('User role is:', this.user.role, '- no admin features');
        }
    }

    capitalizeRole(role) {
        if (role === 'admin') return 'Administrator';
        if (role === 'executive') return 'Executive Member';
        return 'Member';
    }

    bindEvents() {
        console.log('Binding events...');
        
        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Logout clicked');
                this.logout();
            });
            console.log('Logout button bound');
        } else {
            console.error('Logout button not found');
        }

        // Add proper cache control headers via JavaScript
        this.setCacheHeaders();
    }

    setCacheHeaders() {
        // Prevent caching of this authenticated page
        if ('serviceWorker' in navigator) {
            // Clear any cached versions
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

            // Clear session storage
            sessionStorage.clear();

            // Redirect to login
            console.log('Redirecting to login...');
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Logout error:', error);
            // Force redirect even if logout request fails
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

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing dashboard...');
    new Dashboard();
});