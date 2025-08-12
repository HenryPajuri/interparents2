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
    
        // View controls
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
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
    
        // File input change - CORRECTED field name
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
        console.log('📄 Loading documents from API...');
        
        // Fetch from your existing communications API
        const response = await fetch(`${this.API_BASE}/communications`, {
            credentials: 'include'
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success && data.communications) {
                // Convert API data to our format
                this.documents = data.communications.map(comm => ({
                    id: comm._id,
                    title: comm.title,
                    category: comm.category,
                    description: comm.description,
                    date: new Date(comm.publishDate).toLocaleDateString(),
                    size: this.formatFileSize(comm.fileSize),
                    filename: comm.filename,
                    uploadedBy: comm.uploadedBy?.name,
                    type: 'document'
                }));
                
                console.log(`✅ Loaded ${this.documents.length} documents from API`);
            }
        } else {
            throw new Error('Failed to fetch communications');
        }
    } catch (error) {
        console.error('❌ Error loading documents:', error);
        
        // Fall back to DOM extraction if API fails
        console.log('📄 Falling back to DOM extraction...');
        this.documents = this.extractDocumentsFromDOM();
        
        this.showMessage('Using cached documents. Some updates may not be visible.', 'warning');
    }
}

async loadWebinars() {
    try {
        console.log('🎥 Loading webinars...');
        
        // For now, since you don't have a separate webinars API endpoint,
        // we'll use sample data. In the future, you can create a separate webinars endpoint.
        this.webinars = [
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
            },
            {
                id: 'web3',
                title: 'Digital Learning Initiatives 2024',
                category: 'presentation',
                description: 'Presentation on new digital learning policies and technology integration across European Schools.',
                date: 'January 20, 2024',
                views: '412 views',
                duration: '28:45',
                type: 'webinar'
            },
            {
                id: 'web4',
                title: 'Student Well-being and Support Systems',
                category: 'webinar',
                description: 'Discussion on mental health support, counseling services, and well-being initiatives in European Schools.',
                date: 'December 12, 2023',
                views: '589 views',
                duration: '52:10',
                type: 'webinar'
            }
        ];
        
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
        console.log('🎨 Rendering content...');
        
        // Render documents
        this.renderDocuments();
        
        // Render webinars
        this.renderWebinars();
        
        // Add animations
        this.addCardAnimations();
    }
    
    renderDocuments() {
        const documentsGrid = document.getElementById('documentsGrid');
        if (!documentsGrid) return;
        
        console.log(`📄 Rendering ${this.documents.length} documents`);
        
        if (this.documents.length === 0) {
            documentsGrid.innerHTML = `
                <div class="no-content">
                    <h3>No documents available</h3>
                    <p>Documents will appear here once uploaded.</p>
                </div>
            `;
            return;
        }
        
        documentsGrid.innerHTML = this.documents.map(doc => `
            <div class="document-card" data-category="${doc.category.toLowerCase()}">
                <div class="document-icon">${this.getDocumentIcon(doc.category)}</div>
                <div class="document-info">
                    <h3>${doc.title}</h3>
                    <p class="document-category">${this.getCategoryDisplayName(doc.category)}</p>
                    <p class="document-description">${doc.description}</p>
                    <div class="document-meta">
                        <span class="document-date">📅 Updated: ${doc.date}</span>
                        <span class="document-size">📊 ${doc.size}</span>
                    </div>
                    <div class="document-actions">
                        <a href="${this.API_BASE.replace('/api', '')}/pdf/${doc.filename}" 
                           target="_blank" 
                           class="action-btn primary">📖 View</a>
                        <a href="${this.API_BASE.replace('/api', '')}/pdf/${doc.filename}" 
                           download 
                           class="action-btn secondary">⬇️ Download</a>
                    </div>
                </div>
            </div>
        `).join('');
        
        // Re-extract documents for search/filter functionality
        this.documents = this.documents.map(doc => ({
            ...doc,
            element: documentsGrid.querySelector(`[data-category="${doc.category.toLowerCase()}"]`)
        }));
    }
    
    renderWebinars() {
        const webinarsGrid = document.getElementById('webinarsGrid');
        if (!webinarsGrid) return;
        
        console.log(`🎥 Rendering ${this.webinars.length} webinars`);
        
        if (this.webinars.length === 0) {
            webinarsGrid.innerHTML = `
                <div class="no-content">
                    <h3>No webinars available</h3>
                    <p>Webinars will appear here once added.</p>
                </div>
            `;
            return;
        }
        
        webinarsGrid.innerHTML = this.webinars.map(webinar => `
            <div class="webinar-card" data-category="${webinar.category}">
                <div class="webinar-thumbnail">
                    <div class="thumbnail-placeholder">
                        <div class="play-icon">▶️</div>
                        <span class="duration">${webinar.duration}</span>
                    </div>
                </div>
                <div class="webinar-info">
                    <h3>${webinar.title}</h3>
                    <p class="webinar-category">${this.getCategoryDisplayName(webinar.category)}</p>
                    <p class="webinar-description">${webinar.description}</p>
                    <div class="webinar-meta">
                        <span class="webinar-date">📅 Recorded: ${webinar.date}</span>
                        <span class="webinar-views">👥 ${webinar.views}</span>
                    </div>
                    <div class="webinar-actions">
                        <a href="#" class="action-btn primary">▶️ Watch</a>
                        <a href="#" class="action-btn secondary">📝 Transcript</a>
                    </div>
                </div>
            </div>
        `).join('');
        
        // Re-extract webinars for search/filter functionality
        this.webinars = this.webinars.map(webinar => ({
            ...webinar,
            element: webinarsGrid.querySelector(`[data-category="${webinar.category}"]`)
        }));
    }
    
    getDocumentIcon(category) {
        const icons = {
            'JTC': '📋',
            'BOG': '🏛️',
            'Policy': '📜',
            'Report': '📊',
            'Memo': '📝',
            'Other': '📄'
        };
        return icons[category] || '📄';
    }
    
    getCategoryDisplayName(category) {
        const displayNames = {
            'JTC': 'Joint Teaching Committee',
            'BOG': 'Board of Governors',
            'Policy': 'Policy Document',
            'Report': 'Report',
            'Memo': 'Memo',
            'Other': 'Other Document',
            'webinar': 'Educational Webinar',
            'training': 'Training Session',
            'presentation': 'Presentation'
        };
        return displayNames[category] || category;
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
    
        // Backend only accepts PDF files for communications
        if (file.type !== 'application/pdf') {
            status.textContent = 'Please select a PDF file only';
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
        
        // Debug logging
        console.log('=== FORM DATA DEBUG ===');
        console.log('Title:', formData.get('title'));
        console.log('Description:', formData.get('description'));
        console.log('Category:', formData.get('category'));
        console.log('Publish Date:', formData.get('publishDate'));
        const file = formData.get('pdf');
        if (file) {
            console.log('File:', file.name, file.type, file.size);
        } else {
            console.log('No file found!');
        }
        console.log('=== END DEBUG ===');
        
        // Show uploading state
        const uploadBtn = document.getElementById('uploadBtn');
        const originalText = uploadBtn.textContent;
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Uploading...';
        
        try {
            const response = await fetch(`${this.API_BASE}/communications`, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });
    
            const data = await response.json();
            console.log('📋 Server response:', data);
    
            if (response.ok && data.success) {
                this.showMessage('Document uploaded successfully!', 'success');
                this.closeUploadModal();
                
                // IMPORTANT: Reload documents from API and re-render
                console.log('🔄 Refreshing documents list...');
                await this.loadDocuments();
                this.renderContent();
                
            } else {
                if (data.errors && Array.isArray(data.errors)) {
                    const errorMessages = data.errors.map(err => err.msg).join(', ');
                    this.showMessage(`Validation errors: ${errorMessages}`, 'error');
                } else {
                    this.showMessage(data.message || 'Upload failed', 'error');
                }
            }
    
        } catch (error) {
            console.error('❌ Upload error:', error);
            this.showMessage('Network error. Please try again.', 'error');
        } finally {
            // Reset button state
            uploadBtn.disabled = false;
            uploadBtn.textContent = originalText;
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
        
        // Show uploading state
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Adding...';
    
        try {
            // For now, simulate the webinar upload since you don't have a webinars API yet
            console.log('Webinar data:', webinarData);
            
            // Simulate API delay
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Add to local webinars array (temporary solution)
            const newWebinar = {
                id: 'web-' + Date.now(),
                title: webinarData.title,
                category: webinarData.category,
                description: webinarData.description,
                date: webinarData.recordingDate ? new Date(webinarData.recordingDate).toLocaleDateString() : new Date().toLocaleDateString(),
                views: '0 views',
                duration: webinarData.duration || '00:00',
                type: 'webinar'
            };
            
            this.webinars.unshift(newWebinar); // Add to beginning of array
            
            this.showMessage('Webinar added successfully!', 'success');
            this.closeWebinarModal();
            
            // Re-render webinars
            this.renderWebinars();
    
        } catch (error) {
            console.error('Webinar upload error:', error);
            this.showMessage('Network error. Please try again.', 'error');
        } finally {
            // Reset button state
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
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

    async testAPIConnection() {
        console.log('🧪 Testing API connection...');
        
        try {
            const response = await fetch(`${this.API_BASE}/communications`, {
                credentials: 'include'
            });
            
            console.log('Response status:', response.status);
            console.log('Response ok:', response.ok);
            
            const data = await response.json();
            console.log('Response data:', data);
            
            if (data.success && data.communications) {
                console.log(`✅ Found ${data.communications.length} communications in database`);
                data.communications.forEach((comm, index) => {
                    console.log(`${index + 1}. ${comm.title} (${comm.category}) - ${comm.filename}`);
                });
            }
            
            return data;
        } catch (error) {
            console.error('❌ API test failed:', error);
            return null;
        }
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

