// Login Page JavaScript

class LoginManager {
    constructor() {
        this.form = document.getElementById('loginForm');
        this.emailInput = document.getElementById('email');
        this.passwordInput = document.getElementById('password');
        this.loginButton = document.getElementById('loginButton');
        this.passwordToggle = document.getElementById('passwordToggle');
        this.messageDiv = document.getElementById('loginMessage');
        
        // ✅ Fixed: Use full API URL for deployed version
        this.API_BASE = 'https://interparents-1.onrender.com/api';
        this.isLoading = false;
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkExistingAuth();
        this.setupFormValidation();
        
        // Hide demo credentials in production
        if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            document.body.classList.add('production');
        }
    }

    bindEvents() {
        // Form submission
        this.form.addEventListener('submit', (e) => this.handleLogin(e));
        
        // Password toggle
        this.passwordToggle.addEventListener('click', () => this.togglePassword());
        
        // Real-time validation
        this.emailInput.addEventListener('blur', () => this.validateEmail());
        this.passwordInput.addEventListener('blur', () => this.validatePassword());
        
        // Clear errors on input
        this.emailInput.addEventListener('input', () => this.clearFieldError('email'));
        this.passwordInput.addEventListener('input', () => this.clearFieldError('password'));
        
        // Enter key handling
        this.emailInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.passwordInput.focus();
            }
        });
    }

    async checkExistingAuth() {
        try {
            const response = await fetch(`${this.API_BASE}/auth/me`, {
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.showMessage('You are already logged in. Redirecting...', 'info');
                    setTimeout(() => {
                        // ✅ Fixed: Use correct dashboard path
                        window.location.href = 'dashboard.html';
                    }, 1500);
                }
            }
        } catch (error) {
            // User not logged in, continue normally
            console.log('No existing authentication found');
        }
    }

    setupFormValidation() {
        // Email validation
        this.emailInput.addEventListener('invalid', (e) => {
            e.preventDefault();
            this.showFieldError('email', 'Please enter a valid email address');
        });
        
        // Password validation
        this.passwordInput.addEventListener('invalid', (e) => {
            e.preventDefault();
            this.showFieldError('password', 'Password must be at least 6 characters long');
        });
    }

    async handleLogin(e) {
        e.preventDefault();
        
        if (this.isLoading) return;
        
        // Clear previous messages
        this.hideMessage();
        this.clearAllErrors();
        
        // Validate form
        if (!this.validateForm()) {
            return;
        }
        
        const email = this.emailInput.value.trim();
        const password = this.passwordInput.value;
        
        this.setLoadingState(true);
        
        try {
            const response = await fetch(`${this.API_BASE}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                this.showMessage(`Welcome back, ${data.user.name}!`, 'success');
                
                // Store user info for the session
                sessionStorage.setItem('user', JSON.stringify(data.user));
                
                // Redirect after short delay
                setTimeout(() => {
                    // ✅ Fixed: Use correct dashboard path
                    window.location.href = 'dashboard.html';
                }, 1500);
                
            } else {
                // Handle different error types
                if (response.status === 429) {
                    this.showMessage('Too many login attempts. Please try again later.', 'error');
                } else if (response.status === 401) {
                    this.showMessage('Invalid email or password. Please try again.', 'error');
                    this.passwordInput.focus();
                } else if (data.errors && Array.isArray(data.errors)) {
                    this.handleValidationErrors(data.errors);
                } else {
                    this.showMessage(data.message || 'Login failed. Please try again.', 'error');
                }
            }
            
        } catch (error) {
            console.error('Login error:', error);
            this.showMessage('Network error. Please check your connection and try again.', 'error');
        } finally {
            this.setLoadingState(false);
        }
    }

    validateForm() {
        let isValid = true;
        
        // Validate email
        if (!this.validateEmail()) {
            isValid = false;
        }
        
        // Validate password
        if (!this.validatePassword()) {
            isValid = false;
        }
        
        return isValid;
    }

    validateEmail() {
        const email = this.emailInput.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (!email) {
            this.showFieldError('email', 'Email is required');
            return false;
        }
        
        if (!emailRegex.test(email)) {
            this.showFieldError('email', 'Please enter a valid email address');
            return false;
        }
        
        this.clearFieldError('email');
        return true;
    }

    validatePassword() {
        const password = this.passwordInput.value;
        
        if (!password) {
            this.showFieldError('password', 'Password is required');
            return false;
        }
        
        if (password.length < 6) {
            this.showFieldError('password', 'Password must be at least 6 characters long');
            return false;
        }
        
        this.clearFieldError('password');
        return true;
    }

    handleValidationErrors(errors) {
        errors.forEach(error => {
            if (error.param === 'email') {
                this.showFieldError('email', error.msg);
            } else if (error.param === 'password') {
                this.showFieldError('password', error.msg);
            }
        });
    }

    showFieldError(fieldName, message) {
        const errorElement = document.getElementById(`${fieldName}Error`);
        const inputElement = document.getElementById(fieldName);
        
        if (errorElement) {
            errorElement.textContent = message;
        }
        
        if (inputElement) {
            inputElement.classList.add('error');
        }
    }

    clearFieldError(fieldName) {
        const errorElement = document.getElementById(`${fieldName}Error`);
        const inputElement = document.getElementById(fieldName);
        
        if (errorElement) {
            errorElement.textContent = '';
        }
        
        if (inputElement) {
            inputElement.classList.remove('error');
        }
    }

    clearAllErrors() {
        this.clearFieldError('email');
        this.clearFieldError('password');
    }

    togglePassword() {
        const type = this.passwordInput.type === 'password' ? 'text' : 'password';
        this.passwordInput.type = type;
        
        const toggleText = this.passwordToggle.querySelector('.toggle-text');
        toggleText.textContent = type === 'password' ? 'Show' : 'Hide';
    }

    setLoadingState(loading) {
        this.isLoading = loading;
        this.loginButton.disabled = loading;
        
        if (loading) {
            this.loginButton.classList.add('loading');
        } else {
            this.loginButton.classList.remove('loading');
        }
        
        // Disable form inputs during loading
        this.emailInput.disabled = loading;
        this.passwordInput.disabled = loading;
    }

    showMessage(message, type = 'info') {
        this.messageDiv.textContent = message;
        this.messageDiv.className = `login-message ${type} show`;
    }

    hideMessage() {
        this.messageDiv.classList.remove('show');
        setTimeout(() => {
            this.messageDiv.textContent = '';
            this.messageDiv.className = 'login-message';
        }, 300);
    }
}

// Utility function to copy demo credentials
function copyCredentials(email, password) {
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    
    emailInput.value = email;
    passwordInput.value = password;
    
    // Trigger validation
    emailInput.dispatchEvent(new Event('input'));
    passwordInput.dispatchEvent(new Event('input'));
    
    // Focus password field
    passwordInput.focus();
}

// Initialize login manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const loginManager = new LoginManager();
    
    // Add click handlers for demo credentials (development only)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        document.querySelectorAll('.demo-account').forEach(account => {
            account.style.cursor = 'pointer';
            account.title = 'Click to use these credentials';
            
            account.addEventListener('click', () => {
                const codes = account.querySelectorAll('code');
                if (codes.length >= 2) {
                    copyCredentials(codes[0].textContent, codes[1].textContent);
                }
            });
        });
    }
});

// Export for potential use in other scripts
window.LoginManager = LoginManager;