// Documents and Webinars Page JavaScript
class DocumentsManager {
    constructor() {
        this.API_BASE = 'https://interparents-1.onrender.com/api';
        this.documents = [];
        this.webinars = [];
        this.currentView = 'grid';
        this.isAuthenticated = false;
        this.currentUser = null;
        
        console.log('📁 DocumentsManager initialized');
        this.init();
    }

    async init() {
        await this.checkAuthState();
        this.bindEvents();
        this.updateUI();
        await this.loadDocuments();
        await this.loadWebinars();
        this.renderContent();
    }

    // Check authentication state
    async checkAuthState() {
        try {
            const response = await fetch(`${this.API_BASE}/auth/me`, {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.isAuthenticated = true;
                    this.currentUser = data.user;
                    console.log('✅ User authenticated:', this.currentUser.name);
                } else {
                    this.isAuthenticated = false;
                    this.currentUser = null;
                }
            } else {
                this.isAuthenticated = false;
                this.currentUser = null;
            }
        } catch (error) {
            console.log('ℹ️ User not authenticated');
            this.isAuthenticated = false;
            this.currentUser = null;
        }
    }

    // Update UI based on authentication state
    updateUI() {
        const adminNotice = document.getElementById('adminNotice');
        
        if (this.isAuthenticated && (this.currentUser.role === 'admin' || this.currentUser.role === 'executive')) {
            adminNotice.style.display = 'block';
        } else {
            adminNotice.style.display = 'none';
        }

        // Update navigation if needed
        this.updateNavigation();
    }

    // Update navigation to show proper login/logout state
    updateNavigation() {
        const loginNavItem = document.querySelector('.login-nav-item');
        if (!loginNavItem || !this.currentUser) return;

        const loginButton = loginNavItem.querySelector('a[href="login.html"]');
        if (loginButton) {
            loginNavItem.innerHTML = `
                <a href="dashboard.html" style="margin-right: 1rem; color: white; text-decoration: none;">Dashboard</a>
                <a href="#" class="login-button-nav" id="logoutBtn">Logout</a>
            `;

            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.logout();
                });
            }
        }
    }

    // Logout functionality
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
            this.isAuthenticated = false;
            this.currentUser = null;
            window.location.href = 'login.html';
        }
    }

    // Updated bindEvents method - replace the view controls section in your documents.js

bindEvents() {
    // Search functionality
    const globalSearch = document.getElementById('globalSearch');
    if (globalSearch) {
        globalSearch.addEventListener('input', (e) => this.handleSearch(e.target.value));
    }

    // Category filter
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', (e) => this.handleFilter(e.target.value));
    }

    // View controls - Updated to be more robust
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Make sure we get the button element, not a child element
            const button = e.target.closest('.view-btn');
            if (button && button.dataset.view) {
                this.switchView(button.dataset.view);
            }
        });
    });

    // Upload buttons
    const uploadDocumentBtn = document.getElementById('uploadDocumentBtn');
    const uploadWebinarBtn = document.getElementById('uploadWebinarBtn');
    
    if (uploadDocumentBtn) {
        uploadDocumentBtn.addEventListener('click', () => this.openUploadModal('document'));
    }
    
    if (uploadWebinarBtn) {
        uploadWebinarBtn.addEventListener('click', () => this.openUploadModal('webinar'));
    }

    // Form submissions
    const uploadForm = document.getElementById('uploadForm');
    const webinarForm = document.getElementById('webinarForm');
    
    if (uploadForm) {
        uploadForm.addEventListener('submit', (e) => this.handleDocumentUpload(e));
    }
    
    if (webinarForm) {
        webinarForm.addEventListener('submit', (e) => this.handleWebinarUpload(e));
    }

    // File input change
    const documentFile = document.getElementById('documentFile');
    if (documentFile) {
        documentFile.addEventListener('change', (e) => this.handleFileChange(e));
    }
}

// Updated switchView method to be more robust
switchView(view) {
    console.log('👀 Switching to view:', view);
    
    if (!view || (view !== 'grid' && view !== 'list')) {
        console.warn('Invalid view type:', view);
        return;
    }
    
    this.currentView = view;
    
    // Update button states
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.view === view) {
            btn.classList.add('active');
        }
    });
    
    // Update container classes
    const container = document.querySelector('.main-content');
    if (container) {
        container.classList.remove('view-grid', 'view-list');
        container.classList.add(`view-${view}`);
    }
}
    async loadDocuments() {
        try {
            console.log('📄 Loading documents...');
            
            // In a real implementation, this would call your API
            // For now, we'll use the sample data that's already in the HTML
            this.documents = this.extractDocumentsFromDOM();
            
            console.log(`✅ Loaded ${this.documents.length} documents`);
        } catch (error) {
            console.error('❌ Error loading documents:', error);
            this.showMessage('Error loading documents', 'error');
        }
    }

    async loadWebinars() {
        try {
            console.log('🎥 Loading webinars...');
            
            // In a real implementation, this would call your API
            // For now, we'll use the sample data that's already in the HTML
            this.webinars = this.extractWebinarsFromDOM();
            
            console.log(`✅ Loaded ${this.webinars.length} webinars`);
        } catch (error) {
            console.error('❌ Error loading webinars:', error);
            this.showMessage('Error loading webinars', 'error');
        }
    }

    extractDocumentsFromDOM() {
        const documentCards = document.querySelectorAll('.document-card');
        return Array.from(documentCards).map(card => ({
            id: Math.random().toString(36).substr(2, 9),
            title: card.querySelector('h3').textContent,
            category: card.dataset.category,
            description: card.querySelector('.document-description').textContent,
            date: card.querySelector('.document-date').textContent.replace('📅 Updated: ', ''),
            size: card.querySelector('.document-size').textContent.replace('📊 ', ''),
            type: 'document',
            element: card
        }));
    }

    extractWebinarsFromDOM() {
        const webinarCards = document.querySelectorAll('.webinar-card');
        return Array.from(webinarCards).map(card => ({
            id: Math.random().toString(36).substr(2, 9),
            title: card.querySelector('h3').textContent,
            category: card.dataset.category,
            description: card.querySelector('.webinar-description').textContent,
            date: card.querySelector('.webinar-date').textContent.replace('📅 Recorded: ', ''),
            views: card.querySelector('.webinar-views').textContent.replace('👥 ', ''),
            duration: card.querySelector('.duration').textContent,
            type: 'webinar',
            element: card
        }));
    }

    handleSearch(searchTerm) {
        console.log('🔍 Searching for:', searchTerm);
        
        const allItems = [...this.documents, ...this.webinars];
        
        if (!searchTerm.trim()) {
            // Show all items
            allItems.forEach(item => {
                item.element.style.display = 'block';
            });
            return;
        }

        const searchLower = searchTerm.toLowerCase();
        
        allItems.forEach(item => {
            const matchesSearch = 
                item.title.toLowerCase().includes(searchLower) ||
                item.description.toLowerCase().includes(searchLower) ||
                item.category.toLowerCase().includes(searchLower);
            
            item.element.style.display = matchesSearch ? 'block' : 'none';
        });
    }

    handleFilter(category) {
        console.log('🏷️ Filtering by category:', category);
        
        const allItems = [...this.documents, ...this.webinars];
        
        if (category === 'all') {
            // Show all items
            allItems.forEach(item => {
                item.element.style.display = 'block';
            });
            return;
        }

        allItems.forEach(item => {
            const matchesCategory = item.category === category || 
                                  (category === 'webinar' && item.type === 'webinar') ||
                                  (category === 'presentation' && item.category === 'presentation');
            
            item.element.style.display = matchesCategory ? 'block' : 'none';
        });
    }

    switchView(view) {
        console.log('👀 Switching to view:', view);
        
        this.currentView = view;
        
        // Update button states
        document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-view="${view}"]`).classList.add('active');
        
        // Update container classes
        const container = document.querySelector('.main-content');
        container.classList.remove('view-grid', 'view-list');
        container.classList.add(`view-${view}`);
    }

    renderContent() {
        // Content is already rendered in HTML, this method can be used for dynamic updates
        console.log('🎨 Content rendered');
        
        // Add any dynamic enhancements here
        this.addCardAnimations();
    }

    addCardAnimations() {
        // Add staggered animation to cards
        const cards = document.querySelectorAll('.document-card, .webinar-card');
        cards.forEach((card, index) => {
            card.style.animationDelay = `${index * 0.1}s`;
        });
    }

    openUploadModal(type) {
        console.log('📤 Opening upload modal for:', type);
        
        if (!this.isAuthenticated) {
            this.showMessage('Please log in to upload content', 'error');
            return;
        }

        if (type === 'document') {
            document.getElementById('uploadModal').classList.add('show');
            document.getElementById('modalTitle').textContent = 'Upload Document';
        } else if (type === 'webinar') {
            document.getElementById('webinarModal').classList.add('show');
        }
    }

    closeUploadModal() {
        document.getElementById('uploadModal').classList.remove('show');
        document.getElementById('uploadForm').reset();
        document.getElementById('fileStatus').style.display = 'none';
    }

    closeWebinarModal() {
        document.getElementById('webinarModal').classList.remove('show');
        document.getElementById('webinarForm').reset();
    }

    handleFileChange(e) {
        const file = e.target.files[0];
        const status = document.getElementById('fileStatus');

        if (!file) {
            status.style.display = 'none';
            return;
        }

        status.style.display = 'block';

        // Check file type
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        ];

        if (!allowedTypes.includes(file.type)) {
            status.textContent = 'Please select a valid file (PDF, DOC, DOCX, PPT, PPTX)';
            status.className = 'file-status error';
            return;
        }

        // Check file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
            status.textContent = 'File size must be less than 10MB';
            status.className = 'file-status error';
            return;
        }

        status.textContent = `Selected: ${file.name} (${this.formatFileSize(file.size)})`;
        status.className = 'file-status success';
    }

    async handleDocumentUpload(e) {
        e.preventDefault();
        
        if (!this.isAuthenticated) {
            this.showMessage('Please log in to upload documents', 'error');
            return;
        }

        console.log('📤 Uploading document...');
        
        const formData = new FormData(e.target);
        
        try {
            // This would integrate with your existing communications API
            const response = await fetch(`${this.API_BASE}/communications`, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.showMessage('Document uploaded successfully!', 'success');
                this.closeUploadModal();
                await this.loadDocuments();
                this.renderContent();
            } else {
                this.showMessage(data.message || 'Upload failed', 'error');
            }

        } catch (error) {
            console.error('Upload error:', error);
            this.showMessage('Network error. Please try again.', 'error');
        }
    }

    async handleWebinarUpload(e) {
        e.preventDefault();
        
        if (!this.isAuthenticated) {
            this.showMessage('Please log in to add webinars', 'error');
            return;
        }

        console.log('🎥 Adding webinar...');
        
        const formData = new FormData(e.target);
        const webinarData = Object.fromEntries(formData.entries());

        try {
            // This would be a separate API endpoint for webinars
            // For now, we'll simulate the upload
            console.log('Webinar data:', webinarData);
            
            this.showMessage('Webinar added successfully!', 'success');
            this.closeWebinarModal();
            
            // In a real implementation, reload webinars from API
            await this.loadWebinars();
            this.renderContent();

        } catch (error) {
            console.error('Webinar upload error:', error);
            this.showMessage('Network error. Please try again.', 'error');
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showMessage(message, type = 'info') {
        console.log(`📢 Message (${type}): ${message}`);
        
        let messageContainer = document.getElementById('documentsMessages');
        if (!messageContainer) {
            messageContainer = document.createElement('div');
            messageContainer.id = 'documentsMessages';
            messageContainer.style.cssText = 'position: fixed; top: 100px; right: 20px; z-index: 10000;';
            document.body.appendChild(messageContainer);
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `documents-message ${type}`;
        
        const bgColor = type === 'success' ? '#27ae60' : 
                       type === 'error' ? '#e74c3c' : 
                       type === 'warning' ? '#f39c12' : '#3498db';
                       
        messageDiv.style.cssText = `
            background: ${bgColor};
            color: white;
            padding: 1rem 1.5rem;
            margin-bottom: 0.5rem;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideIn 0.3s ease;
            max-width: 350px;
            word-wrap: break-word;
            line-height: 1.4;
        `;
        messageDiv.textContent = message;

        messageContainer.appendChild(messageDiv);

        // Auto-remove after delay
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 5000);
    }
}

// Sample data loader - in production this would come from your API
class DocumentsSampleDataLoader {
    static loadSampleDocuments() {
        return [
            {
                id: 'doc1',
                title: 'INTERPARENTS Statutes 2024',
                category: 'policy',
                description: 'Updated organizational statutes and governance framework for INTERPARENTS operations.',
                date: 'March 2024',
                size: '2.3 MB',
                type: 'document'
            },
            {
                id: 'doc2',
                title: 'Parent Representative Guidelines',
                category: 'guidelines',
                description: 'Comprehensive guide for parent representatives in European Schools governance.',
                date: 'January 2024',
                size: '1.8 MB',
                type: 'document'
            },
            {
                id: 'doc3',
                title: 'Committee Participation Handbook',
                category: 'training',
                description: 'Training materials for effective participation in JTC and BOG committees.',
                date: 'February 2024',
                size: '3.1 MB',
                type: 'document'
            }
        ];
    }

    static loadSampleWebinars() {
        return [
            {
                id: 'web1',
                title: 'Understanding European Schools Curriculum',
                category: 'webinar',
                description: 'Comprehensive overview of the European Schools curriculum structure and assessment methods.',
                date: 'March 15, 2024',
                views: '348 views',
                duration: '45:30',
                type: 'webinar'
            },
            {
                id: 'web2',
                title: 'Effective Parent Representation',
                category: 'webinar',
                description: 'Training session on effective advocacy and representation techniques for parent associations.',
                date: 'February 28, 2024',
                views: '267 views',
                duration: '32:15',
                type: 'webinar'
            }
        ];
    }
}

// Global functions for modal management
function closeUploadModal() {
    if (window.documentsManager) {
        window.documentsManager.closeUploadModal();
    }
}

function closeWebinarModal() {
    if (window.documentsManager) {
        window.documentsManager.closeWebinarModal();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🌟 DOM loaded, initializing documents manager...');
    window.documentsManager = new DocumentsManager();
    
    // Close modals when clicking outside
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            e.target.classList.remove('show');
        }
    });
    
    // Add CSS for animations if not already present
    if (!document.querySelector('#documents-animations')) {
        const style = document.createElement('style');
        style.id = 'documents-animations';
        style.textContent = `
            @keyframes slideIn {
                from { opacity: 0; transform: translateX(100%); }
                to { opacity: 1; transform: translateX(0); }
            }
        `;
        document.head.appendChild(style);
    }
});