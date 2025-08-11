// Admin Panel JavaScript - Enhanced with Password Validation
class AdminPanel {
    constructor() {
        this.API_BASE = 'https://interparents-1.onrender.com/api';
        this.user = null;
        this.communications = [];
        this.users = [];
        this.currentDeleteId = null;
        this.currentDeleteUserId = null;
        
        // Password validation state
        this.passwordValidation = {
            strength: false,
            match: false,
            requirements: {
                length: false,
                lowercase: false,
                uppercase: false,
                number: false
            }
        };
        
        this.init();
    }

    async init() {
        await this.loadUserInfo();
        this.bindEvents();
        this.initializePasswordValidation();
        await this.loadCommunications();
        await this.loadUsers();
        this.setupTabs();
    }

    async loadUserInfo() {
        try {
            const response = await fetch(`${this.API_BASE}/auth/me`, {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.user = data.user;
                    this.updateUI();
                    this.checkAdminAccess();
                } else {
                    this.redirectToLogin();
                }
            } else {
                this.redirectToLogin();
            }
        } catch (error) {
            console.error('Error loading user info:', error);
            this.redirectToLogin();
        }
    }

    checkAdminAccess() {
        if (this.user.role !== 'admin' && this.user.role !== 'executive') {
            this.showMessage('Access denied. Admin or Executive privileges required.', 'error');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 2000);
            return;
        }
    }

    updateUI() {
        const greeting = document.getElementById('userGreeting');
        greeting.textContent = `Welcome to the admin panel, ${this.user.name}!`;
    }

    bindEvents() {
        document.getElementById('logoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
        });

        document.getElementById('pdfFile').addEventListener('change', (e) => {
            this.handleFileChange(e);
        });

        document.querySelector('.file-input').addEventListener('click', () => {
            document.getElementById('pdfFile').click();
        });

        document.getElementById('uploadForm').addEventListener('submit', (e) => {
            this.handleUpload(e);
        });

        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.filterCommunications(e.target.value);
        });

        document.getElementById('userSearchInput').addEventListener('input', (e) => {
            this.filterUsers(e.target.value);
        });

        document.getElementById('userForm').addEventListener('submit', (e) => {
            this.handleUserCreate(e);
        });
        
        // Set default publish date to today
        document.getElementById('publishDate').valueAsDate = new Date();
    }

    // NEW: Initialize password validation for user creation
    initializePasswordValidation() {
        const passwordInput = document.getElementById('userPassword');
        const confirmPasswordInput = document.getElementById('userConfirmPassword');

        if (passwordInput) {
            passwordInput.addEventListener('input', () => {
                this.validateUserPasswordStrength();
                this.validateUserPasswordMatch();
                this.updateFormValidationState();
            });
        }

        if (confirmPasswordInput) {
            confirmPasswordInput.addEventListener('input', () => {
                this.validateUserPasswordMatch();
                this.updateFormValidationState();
            });
        }

        // Password toggle functionality
        document.querySelectorAll('.admin-password-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => this.togglePasswordVisibility(e));
        });
    }

    // NEW: Toggle password visibility
    togglePasswordVisibility(e) {
        const button = e.target.closest('.admin-password-toggle');
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

    // NEW: Validate password strength for user creation
    validateUserPasswordStrength() {
        const password = document.getElementById('userPassword').value;
        const strengthDiv = document.getElementById('userPasswordStrength');
        
        const requirements = {
            length: password.length >= 6,
            lowercase: /[a-z]/.test(password),
            uppercase: /[A-Z]/.test(password),
            number: /\d/.test(password)
        };

        // Update requirement indicators with animation
        Object.keys(requirements).forEach(req => {
            const element = document.getElementById(`admin-req-${req}`);
            if (element) {
                const wasMet = element.classList.contains('met');
                const isNowMet = requirements[req];
                
                element.classList.toggle('met', isNowMet);
                
                // Add animation for newly met requirements
                if (!wasMet && isNowMet) {
                    element.classList.add('newly-met');
                    setTimeout(() => element.classList.remove('newly-met'), 300);
                }
            }
        });

        // Store requirements state
        this.passwordValidation.requirements = requirements;

        // Calculate strength
        const metRequirements = Object.values(requirements).filter(Boolean).length;
        let strength = '';
        let strengthClass = '';

        if (password.length === 0) {
            strength = '';
            strengthClass = '';
        } else if (metRequirements <= 1) {
            strength = 'Weak password - needs improvement';
            strengthClass = 'weak';
        } else if (metRequirements <= 3) {
            strength = 'Medium strength - almost there';
            strengthClass = 'medium';
        } else {
            strength = 'Strong password - excellent!';
            strengthClass = 'strong';
        }

        strengthDiv.textContent = strength;
        strengthDiv.className = `admin-password-strength ${strengthClass}`;

        // Update validation state
        this.passwordValidation.strength = metRequirements >= 2;

        return this.passwordValidation.strength;
    }

    // NEW: Validate password confirmation match
    validateUserPasswordMatch() {
        const password = document.getElementById('userPassword').value;
        const confirmPassword = document.getElementById('userConfirmPassword').value;
        const matchDiv = document.getElementById('userPasswordMatch');

        if (confirmPassword.length === 0) {
            matchDiv.textContent = '';
            matchDiv.className = 'admin-password-match';
            this.passwordValidation.match = false;
            return false;
        }

        const isMatch = password === confirmPassword;
        matchDiv.textContent = isMatch ? 'Passwords match ✓' : 'Passwords do not match ✗';
        matchDiv.className = `admin-password-match ${isMatch ? 'match' : 'no-match'}`;

        this.passwordValidation.match = isMatch;
        return isMatch;
    }

    // NEW: Update form validation state
    updateFormValidationState() {
        const submitBtn = document.getElementById('userSubmitBtn');
        const passwordInput = document.getElementById('userPassword');
        const confirmInput = document.getElementById('userConfirmPassword');

        const isValid = this.passwordValidation.strength && this.passwordValidation.match;

        // Update input styling
        if (passwordInput.value.length > 0) {
            passwordInput.classList.toggle('password-success', this.passwordValidation.strength);
            passwordInput.classList.toggle('password-error', !this.passwordValidation.strength);
        }

        if (confirmInput.value.length > 0) {
            confirmInput.classList.toggle('password-success', this.passwordValidation.match);
            confirmInput.classList.toggle('password-error', !this.passwordValidation.match);
        }

        // Update submit button styling
        if (passwordInput.value.length > 0 || confirmInput.value.length > 0) {
            submitBtn.classList.toggle('validation-passed', isValid);
            submitBtn.classList.toggle('validation-failed', !isValid);
        }
    }

    // NEW: Clear password validation
    clearPasswordValidation() {
        document.getElementById('userPasswordStrength').textContent = '';
        document.getElementById('userPasswordMatch').textContent = '';
        
        // Reset requirement indicators
        document.querySelectorAll('.requirement-item').forEach(item => {
            item.classList.remove('met', 'newly-met');
        });

        // Reset validation state
        this.passwordValidation = {
            strength: false,
            match: false,
            requirements: {
                length: false,
                lowercase: false,
                uppercase: false,
                number: false
            }
        };

        // Reset input styling
        document.getElementById('userPassword').classList.remove('password-success', 'password-error');
        document.getElementById('userConfirmPassword').classList.remove('password-success', 'password-error');
        
        // Reset submit button styling
        const submitBtn = document.getElementById('userSubmitBtn');
        submitBtn.classList.remove('validation-passed', 'validation-failed');
    }

    setupTabs() {
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                this.switchTab(tabName);
            });
        });
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');
    }

    handleFileChange(e) {
        const file = e.target.files[0];
        const status = document.getElementById('fileStatus');

        if (!file) {
            status.style.display = 'none';
            return;
        }

        status.style.display = 'block';

        if (file.type !== 'application/pdf') {
            status.textContent = 'Please select a PDF file';
            status.className = 'file-status error';
            return;
        }

        if (file.size > 10 * 1024 * 1024) { // 10MB
            status.textContent = 'File size must be less than 10MB';
            status.className = 'file-status error';
            return;
        }

        status.textContent = `Selected: ${file.name} (${this.formatFileSize(file.size)})`;
        status.className = 'file-status success';
    }

    async handleUpload(e) {
        e.preventDefault();

        const formData = new FormData(e.target);
        const uploadBtn = document.getElementById('uploadBtn');
        const uploadBtnText = document.getElementById('uploadBtnText');
        const uploadSpinner = document.getElementById('uploadSpinner');

        uploadBtn.disabled = true;
        uploadBtnText.style.display = 'none';
        uploadSpinner.style.display = 'inline-flex';

        try {
            const response = await fetch(`${this.API_BASE}/communications`, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.showMessage('Communication uploaded successfully!', 'success');
                e.target.reset();
                document.getElementById('fileStatus').style.display = 'none';
                document.getElementById('publishDate').valueAsDate = new Date();
                await this.loadCommunications();
            } else {
                this.showMessage(data.message || 'Upload failed', 'error');
            }

        } catch (error) {
            console.error('Upload error:', error);
            this.showMessage('Network error. Please try again.', 'error');
        } finally {
            uploadBtn.disabled = false;
            uploadBtnText.style.display = 'inline';
            uploadSpinner.style.display = 'none';
        }
    }

    async loadCommunications() {
        try {
            const response = await fetch(`${this.API_BASE}/communications`, {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.communications = data.communications;
                    this.renderCommunications();
                }
            }
        } catch (error) {
            console.error('Error loading communications:', error);
            this.showMessage('Error loading communications', 'error');
        }
    }

    renderCommunications(filteredData = null) {
        const tbody = document.getElementById('communicationsTableBody');
        const communications = filteredData || this.communications;

        if (communications.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="loading">
                        ${filteredData ? 'No communications match your search' : 'No communications found'}
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = communications.map(comm => `
            <tr>
                <td>
                    <strong>${comm.title}</strong><br>
                    <small style="color: #666;">${comm.description}</small>
                </td>
                <td>
                    <span class="category-badge category-${comm.category.toLowerCase()}">
                        ${comm.category}
                    </span>
                </td>
                <td>${new Date(comm.publishDate).toLocaleDateString()}</td>
                <td>${comm.uploadedBy?.name || 'Unknown'}</td>
                <td>${this.formatFileSize(comm.fileSize)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-edit" onclick="window.open('https://interparents-1.onrender.com/pdf/${comm.filename}', '_blank')">
                            View
                        </button>
                        <button class="btn-delete" onclick="adminPanel.showDeleteModal('${comm._id}', '${comm.title}')">
                            Delete
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    filterCommunications(searchTerm) {
        if (!searchTerm.trim()) {
            this.renderCommunications();
            return;
        }

        const filtered = this.communications.filter(comm =>
            comm.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            comm.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            comm.category.toLowerCase().includes(searchTerm.toLowerCase())
        );

        this.renderCommunications(filtered);
    }

    showDeleteModal(id, title) {
        this.currentDeleteId = id;
        document.getElementById('deleteModal').classList.add('show');

        const modal = document.querySelector('#deleteModal .modal p');
        modal.innerHTML = `Are you sure you want to delete "<strong>${title}</strong>"? This action cannot be undone.`;

        document.getElementById('confirmDeleteBtn').onclick = () => this.confirmDelete();
    }

    hideDeleteModal() {
        document.getElementById('deleteModal').classList.remove('show');
        this.currentDeleteId = null;
    }

    async confirmDelete() {
        if (!this.currentDeleteId) return;

        try {
            const response = await fetch(`${this.API_BASE}/communications/${this.currentDeleteId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.showMessage('Communication deleted successfully', 'success');
                await this.loadCommunications();
            } else {
                this.showMessage(data.message || 'Delete failed', 'error');
            }

        } catch (error) {
            console.error('Delete error:', error);
            this.showMessage('Network error. Please try again.', 'error');
        } finally {
            this.hideDeleteModal();
        }
    }

    // ========== USER MANAGEMENT METHODS ==========

    async loadUsers() {
        try {
            const response = await fetch(`${this.API_BASE}/users`, {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.users = data.users;
                    this.renderUsers();
                }
            }
        } catch (error) {
            console.error('Error loading users:', error);
            this.showMessage('Error loading users', 'error');
        }
    }

    // UPDATED: Enhanced user creation with password validation
    async handleUserCreate(e) {
        e.preventDefault();

        // Validate password requirements before submission
        if (!this.validateUserForm()) {
            return;
        }

        const formData = new FormData(e.target);
        const userData = Object.fromEntries(formData.entries());

        const submitBtn = document.getElementById('userSubmitBtn');
        const submitBtnText = document.getElementById('userSubmitBtnText');
        const submitSpinner = document.getElementById('userSubmitSpinner');

        submitBtn.disabled = true;
        submitBtnText.style.display = 'none';
        submitSpinner.style.display = 'inline-flex';

        try {
            const response = await fetch(`${this.API_BASE}/users`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData)
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.showMessage('User created successfully!', 'success');
                e.target.reset();
                this.clearPasswordValidation();
                await this.loadUsers();
            } else {
                this.showMessage(data.message || 'User creation failed', 'error');
            }

        } catch (error) {
            console.error('User creation error:', error);
            this.showMessage('Network error. Please try again.', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtnText.style.display = 'inline';
            submitSpinner.style.display = 'none';
        }
    }

    // NEW: Validate user creation form
    validateUserForm() {
        const password = document.getElementById('userPassword').value;
        const confirmPassword = document.getElementById('userConfirmPassword').value;

        if (!password || password.length < 6) {
            this.showMessage('Password must be at least 6 characters long', 'error');
            return false;
        }

        if (!this.passwordValidation.strength) {
            this.showMessage('Password does not meet minimum strength requirements', 'error');
            return false;
        }

        if (password !== confirmPassword) {
            this.showMessage('Passwords do not match', 'error');
            return false;
        }

        return true;
    }

    renderUsers(filteredData = null) {
        const tbody = document.getElementById('usersTableBody');
        const users = filteredData || this.users;

        if (users.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="loading">
                        ${filteredData ? 'No users match your search' : 'No users found'}
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = users.map(user => `
            <tr>
                <td><strong>${user.name}</strong></td>
                <td>${user.email}</td>
                <td>
                    <span class="category-badge ${this.getRoleClass(user.role)}">
                        ${this.capitalizeRole(user.role)}
                    </span>
                </td>
                <td>${user.school}</td>
                <td>${user.position}</td>
                <td>
                    <div class="action-buttons">
                        ${user._id !== this.user.id ? `
                            <button class="btn-delete" onclick="adminPanel.showDeleteUserModal('${user._id}', '${user.name}')">
                                Delete
                            </button>
                        ` : `
                            <span style="color: #666; font-size: 0.9rem;">You</span>
                        `}
                    </div>
                </td>
            </tr>
        `).join('');
    }

    filterUsers(searchTerm) {
        if (!searchTerm.trim()) {
            this.renderUsers();
            return;
        }

        const filtered = this.users.filter(user =>
            user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.school.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.role.toLowerCase().includes(searchTerm.toLowerCase())
        );

        this.renderUsers(filtered);
    }

    getRoleClass(role) {
        const roleClasses = {
            'admin': 'category-memo',
            'executive': 'category-report',
            'member': 'category-policy'
        };
        return roleClasses[role] || 'category-other';
    }

    capitalizeRole(role) {
        if (role === 'admin') return 'Administrator';
        if (role === 'executive') return 'Executive';
        return 'Member';
    }

    showDeleteUserModal(id, name) {
        this.currentDeleteUserId = id;
        document.getElementById('deleteUserModal').classList.add('show');

        const modal = document.querySelector('#deleteUserModal .modal p');
        modal.innerHTML = `Are you sure you want to delete user "<strong>${name}</strong>"? This action cannot be undone and will permanently remove their access.`;

        document.getElementById('confirmDeleteUserBtn').onclick = () => this.confirmDeleteUser();
    }

    hideDeleteUserModal() {
        document.getElementById('deleteUserModal').classList.remove('show');
        this.currentDeleteUserId = null;
    }

    async confirmDeleteUser() {
        if (!this.currentDeleteUserId) return;

        try {
            const response = await fetch(`${this.API_BASE}/users/${this.currentDeleteUserId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.showMessage('User deleted successfully', 'success');
                await this.loadUsers();
            } else {
                this.showMessage(data.message || 'Delete failed', 'error');
            }

        } catch (error) {
            console.error('Delete user error:', error);
            this.showMessage('Network error. Please try again.', 'error');
        } finally {
            this.hideDeleteUserModal();
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showMessage(message, type) {
        const container = document.getElementById('messageContainer');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = message;

        container.appendChild(messageDiv);

        setTimeout(() => {
            messageDiv.remove();
        }, 5000);
    }

    async logout() {
        try {
            await fetch(`${this.API_BASE}/auth/logout`, {
                method: 'POST',
                credentials: 'include'
            });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            sessionStorage.clear();
            window.location.href = 'login.html';
        }
    }

    redirectToLogin() {
        sessionStorage.clear();
        window.location.href = 'login.html';
    }
}

function hideDeleteModal() {
    document.getElementById('deleteModal').classList.remove('show');
}

function hideDeleteUserModal() {
    document.getElementById('deleteUserModal').classList.remove('show');
}

let adminPanel;
document.addEventListener('DOMContentLoaded', () => {
    adminPanel = new AdminPanel();
    window.adminPanel = adminPanel;
});