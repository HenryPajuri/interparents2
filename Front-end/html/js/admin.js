// Admin Panel JavaScript
class AdminPanel {
    constructor() {
        this.API_BASE = '/api';
        this.user = null;
        this.communications = [];
        this.users = [];
        this.currentDeleteId = null;
        this.currentDeleteUserId = null;
        this.init();
    }

    async init() {
        await this.loadUserInfo();
        this.bindEvents();
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
        // Logout
        document.getElementById('logoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
        });

        // Change password button (add this to admin header)
        const changePasswordBtn = document.getElementById('changePasswordBtn');
        if (changePasswordBtn) {
            changePasswordBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.openPasswordModal();
            });
        }

        // Password form
        const passwordForm = document.getElementById('passwordChangeForm');
        if (passwordForm) {
            passwordForm.addEventListener('submit', (e) => {
                this.handlePasswordChange(e);
            });
        }

        // File input change
        document.getElementById('pdfFile').addEventListener('change', (e) => {
            this.handleFileChange(e);
        });

        // Make file input clickable
        document.querySelector('.file-input').addEventListener('click', () => {
            document.getElementById('pdfFile').click();
        });

        // Upload form
        document.getElementById('uploadForm').addEventListener('submit', (e) => {
            this.handleUpload(e);
        });

        // Search
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.filterCommunications(e.target.value);
        });

        // User search
        document.getElementById('userSearchInput').addEventListener('input', (e) => {
            this.filterUsers(e.target.value);
        });

        // User form
        document.getElementById('userForm').addEventListener('submit', (e) => {
            this.handleUserCreate(e);
        });

        // Set default publish date to today
        document.getElementById('publishDate').valueAsDate = new Date();
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

        // Disable button and show spinner
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
            // Re-enable button and hide spinner
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
                        <button class="btn-edit" onclick="window.open('/pdf/${comm.filename}', '_blank')">
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
        
        // Update modal content
        const modal = document.querySelector('#deleteModal .modal p');
        modal.innerHTML = `Are you sure you want to delete "<strong>${title}</strong>"? This action cannot be undone.`;
        
        // Bind confirm button
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

    async handleUserCreate(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const userData = Object.fromEntries(formData.entries());
        
        const submitBtn = document.getElementById('userSubmitBtn');
        const submitBtnText = document.getElementById('userSubmitBtnText');
        const submitSpinner = document.getElementById('userSubmitSpinner');

        // Disable button and show spinner
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
                await this.loadUsers();
            } else {
                this.showMessage(data.message || 'User creation failed', 'error');
            }

        } catch (error) {
            console.error('User creation error:', error);
            this.showMessage('Network error. Please try again.', 'error');
        } finally {
            // Re-enable button and hide spinner
            submitBtn.disabled = false;
            submitBtnText.style.display = 'inline';
            submitSpinner.style.display = 'none';
        }
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
        
        // Update modal content
        const modal = document.querySelector('#deleteUserModal .modal p');
        modal.innerHTML = `Are you sure you want to delete user "<strong>${name}</strong>"? This action cannot be undone and will permanently remove their access.`;
        
        // Bind confirm button
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
        
        // Auto-remove after 5 seconds
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

    // Password Change Methods
    openPasswordModal() {
        const modal = document.getElementById('passwordModal');
        if (modal) {
            modal.classList.add('show');
            document.getElementById('currentPassword').focus();
        }
    }

    async handlePasswordChange(e) {
        e.preventDefault();

        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        // Validate passwords match
        if (data.newPassword !== data.confirmPassword) {
            this.showMessage('New passwords do not match', 'error');
            return;
        }

        const saveBtn = document.getElementById('savePasswordBtn');
        const saveText = document.getElementById('savePasswordText');
        const saveSpinner = document.getElementById('savePasswordSpinner');

        // Show loading state
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
                this.showMessage('Password changed successfully!', 'success');
                this.closePasswordModal();
                form.reset();
            } else {
                this.showMessage(result.message || 'Failed to change password', 'error');
            }

        } catch (error) {
            console.error('Password change error:', error);
            this.showMessage('Network error. Please try again.', 'error');
        } finally {
            // Reset button state
            saveBtn.disabled = false;
            saveText.style.display = 'inline';
            saveSpinner.style.display = 'none';
        }
    }

    closePasswordModal() {
        const modal = document.getElementById('passwordModal');
        if (modal) {
            modal.classList.remove('show');
            document.getElementById('passwordChangeForm').reset();
        }
    }
}

// Global functions for modal
function hideDeleteModal() {
    document.getElementById('deleteModal').classList.remove('show');
}

function hideDeleteUserModal() {
    document.getElementById('deleteUserModal').classList.remove('show');
}

function closePasswordModal() {
    if (window.adminPanel) {
        window.adminPanel.closePasswordModal();
    } else {
        document.getElementById('passwordModal').classList.remove('show');
    }
}

// Initialize admin panel
let adminPanel;
document.addEventListener('DOMContentLoaded', () => {
    adminPanel = new AdminPanel();
    window.adminPanel = adminPanel;
});