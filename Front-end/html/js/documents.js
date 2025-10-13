class DocumentsManager {
    constructor() {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            this.API_BASE = 'http://localhost:3001/api';
        } else {
            this.API_BASE = 'https://interparents.eu/api';
        }
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

    updateUI() {
        const adminNotice = document.getElementById('adminNotice');

        if (this.isAuthenticated && (this.currentUser.role === 'admin' || this.currentUser.role === 'executive')) {
            adminNotice.style.display = 'block';
        } else {
            adminNotice.style.display = 'none';
        }

        this.updateNavigation();
    }

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
        const globalSearch = document.getElementById('globalSearch');
        if (globalSearch) {
            globalSearch.addEventListener('input', (e) => this.handleSearch(e.target.value));
        }

        const categoryFilter = document.getElementById('categoryFilter');
        if (categoryFilter) {
            categoryFilter.addEventListener('change', (e) => this.handleFilter(e.target.value));
        }

        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const button = e.target.closest('.view-btn');
                if (button && button.dataset.view) {
                    this.switchView(button.dataset.view);
                }
            });
        });

        const uploadDocumentBtn = document.getElementById('uploadDocumentBtn');
        const uploadWebinarBtn = document.getElementById('uploadWebinarBtn');

        if (uploadDocumentBtn) {
            uploadDocumentBtn.addEventListener('click', () => this.openUploadModal('document'));
        }

        if (uploadWebinarBtn) {
            uploadWebinarBtn.addEventListener('click', () => this.openUploadModal('webinar'));
        }

        const uploadForm = document.getElementById('uploadForm');
        const webinarForm = document.getElementById('webinarForm');

        if (uploadForm) {
            uploadForm.addEventListener('submit', (e) => this.handleDocumentUpload(e));
        }

        if (webinarForm) {
            webinarForm.addEventListener('submit', (e) => this.handleWebinarUpload(e));
        }

        const documentFile = document.getElementById('documentFile');
        if (documentFile) {
            documentFile.addEventListener('change', (e) => this.handleFileChange(e));
        }

        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                e.target.remove();
            }
        });
    }

    async loadWebinars() {
        try {
            console.log('🎥 Loading webinars...');
    
            const defaultWebinars = [
                {
                    id: 'web1',
                    title: 'Understanding European Schools Curriculum',
                    category: 'webinar',
                    description: 'Comprehensive overview of the European Schools curriculum structure and assessment methods.',
                    date: 'March 15, 2024',
                    views: '348 views',
                    duration: '45:30',
                    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
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
                    videoUrl: 'https://vimeo.com/123456789',
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
                    videoUrl: 'https://www.youtube.com/watch?v=sample123',
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
                    videoUrl: '#',
                    type: 'webinar'
                }
            ];
    
            const savedWebinars = JSON.parse(localStorage.getItem('customWebinars') || '[]');
            
            const deletedDefaults = JSON.parse(localStorage.getItem('deletedDefaultWebinars') || '[]');
            
            const activeDefaultWebinars = defaultWebinars.filter(webinar => 
                !deletedDefaults.includes(webinar.id)
            );
            
            this.webinars = [...savedWebinars, ...activeDefaultWebinars];
    
            console.log(`✅ Loaded ${this.webinars.length} webinars (${savedWebinars.length} custom + ${activeDefaultWebinars.length} default)`);
            if (deletedDefaults.length > 0) {
                console.log(`🗑️ ${deletedDefaults.length} default webinars have been deleted`);
            }
        } catch (error) {
            console.error('❌ Error loading webinars:', error);
            this.showMessage('Error loading webinars', 'error');
        }
    }
    saveCustomWebinars() {
        try {
            const defaultIds = ['web1', 'web2', 'web3', 'web4'];
            const customWebinars = this.webinars.filter(webinar => !defaultIds.includes(webinar.id));
            
            localStorage.setItem('customWebinars', JSON.stringify(customWebinars));
            console.log(`💾 Saved ${customWebinars.length} custom webinars to localStorage`);
        } catch (error) {
            console.error('❌ Error saving webinars:', error);
        }
    }

    saveDeletedDefaults(deletedIds) {
        try {
            localStorage.setItem('deletedDefaultWebinars', JSON.stringify(deletedIds));
            console.log(`💾 Saved ${deletedIds.length} deleted default webinar IDs to localStorage`);
        } catch (error) {
            console.error('❌ Error saving deleted defaults:', error);
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

        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        this.setButtonLoading(submitBtn, true, 'Adding...');

        try {
            console.log('Webinar data:', webinarData);

            await new Promise(resolve => setTimeout(resolve, 1000));

            const newWebinar = {
                id: 'custom-' + Date.now(),
                title: webinarData.title,
                category: webinarData.category,
                description: webinarData.description,
                date: webinarData.recordingDate ? new Date(webinarData.recordingDate).toLocaleDateString() : new Date().toLocaleDateString(),
                views: '0 views',
                duration: webinarData.duration || '00:00',
                videoUrl: webinarData.videoUrl || '#',
                type: 'webinar'
            };

            this.webinars.unshift(newWebinar);
            
            this.saveCustomWebinars();

            this.showMessage('Webinar added successfully!', 'success');
            this.closeWebinarModal();

            this.renderWebinars();

        } catch (error) {
            console.error('Webinar upload error:', error);
            this.showMessage('Network error. Please try again.', 'error');
        } finally {
            this.setButtonLoading(submitBtn, false);
        }
    }

    setButtonLoading(button, loading, loadingText = 'Loading...') {
        if (loading) {
            button.dataset.originalText = button.textContent;
            button.textContent = loadingText;
            button.disabled = true;
            button.classList.add('loading');
        } else {
            button.textContent = button.dataset.originalText || button.textContent;
            button.disabled = false;
            button.classList.remove('loading');
        }
    }

    switchView(view) {
        console.log('👀 Switching to view:', view);

        if (!view || (view !== 'grid' && view !== 'list')) {
            console.warn('Invalid view type:', view);
            return;
        }

        this.currentView = view;

        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.view === view) {
                btn.classList.add('active');
            }
        });

        const container = document.querySelector('.main-content');
        if (container) {
            container.classList.remove('view-grid', 'view-list');
            container.classList.add(`view-${view}`);
        }
    }

    async loadDocuments() {
        try {
            console.log('📄 Loading documents from API...');

            const response = await fetch(`${this.API_BASE}/communications`, {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.communications) {
                    this.documents = data.communications.map(comm => {
                        if (!comm.id) {
                            console.warn('⚠️ Document missing ID:', comm.title, comm);
                        }
                        return {
                            id: comm.id,
                            title: comm.title,
                            category: comm.category,
                            description: comm.description,
                            date: new Date(comm.publishDate).toLocaleDateString(),
                            size: this.formatFileSize(comm.fileSize),
                            filename: comm.filename,
                            uploadedBy: comm.uploadedBy?.name,
                            type: 'document'
                        };
                    });

                    console.log(`✅ Loaded ${this.documents.length} documents from API`);
                    console.log('📋 Sample document IDs:', this.documents.slice(0, 3).map(d => ({ title: d.title, id: d.id })));
                }
            } else {
                throw new Error('Failed to fetch communications');
            }
        } catch (error) {
            console.error('❌ Error loading documents:', error);

            console.log('📄 Falling back to DOM extraction...');
            this.documents = this.extractDocumentsFromDOM();

            this.showMessage('Using cached documents. Some updates may not be visible.', 'warning');
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

    handleSearch(searchTerm) {
        console.log('🔍 Searching for:', searchTerm);

        const allItems = [...this.documents, ...this.webinars];

        if (!searchTerm.trim()) {
            allItems.forEach(item => {
                if (item.element) item.element.style.display = 'block';
            });
            return;
        }

        const searchLower = searchTerm.toLowerCase();

        allItems.forEach(item => {
            const matchesSearch =
                item.title.toLowerCase().includes(searchLower) ||
                item.description.toLowerCase().includes(searchLower) ||
                item.category.toLowerCase().includes(searchLower);

            if (item.element) {
                item.element.style.display = matchesSearch ? 'block' : 'none';
            }
        });
    }

    handleFilter(category) {
        console.log('🏷️ Filtering by category:', category);

        const allItems = [...this.documents, ...this.webinars];

        if (category === 'all') {
            allItems.forEach(item => {
                if (item.element) item.element.style.display = 'block';
            });
            return;
        }

        allItems.forEach(item => {
            let matchesCategory = false;

            if (category === 'policy') {
                matchesCategory = item.category === 'Policy';
            } else if (category === 'guidelines') {
                matchesCategory = item.category === 'JTC' || item.category === 'BOG';
            } else if (category === 'reports') {
                matchesCategory = item.category === 'Report';
            } else if (category === 'training') {
                matchesCategory = item.category === 'Memo';
            } else if (category === 'webinar') {
                matchesCategory = item.type === 'webinar' || item.category === 'webinar';
            } else if (category === 'presentation') {
                matchesCategory = item.category === 'presentation';
            } else {
                matchesCategory = item.category === category;
            }

            if (item.element) {
                item.element.style.display = matchesCategory ? 'block' : 'none';
            }
        });
    }

    renderContent() {
        console.log('🎨 Rendering content...');

        this.renderDocuments();

        this.renderWebinars();

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

        documentsGrid.innerHTML = this.documents.map((doc, index) => `
        <div class="document-card" data-category="${doc.category.toLowerCase()}" data-doc-id="${doc.id}">
            <div class="document-icon">${this.getDocumentIcon(doc.category)}</div>
            <div class="document-info">
                <h3>${doc.title}</h3>
                <p class="document-category">${this.getCategoryDisplayName(doc.category)}</p>
                <p class="document-description">${doc.description}</p>
                <div class="document-meta">
                    <span class="document-date">📅 Updated: ${doc.date}</span>
                    <span class="document-size">📊 ${doc.size}</span>
                    ${doc.uploadedBy ? `<span class="document-author">👤 ${doc.uploadedBy}</span>` : ''}
                </div>
                <div class="document-actions">
                    <button class="action-btn primary view-doc-btn" data-filename="${doc.filename}" data-title="${doc.title}">
                        👁️ View
                    </button>
                    <button class="action-btn secondary download-doc-btn" data-filename="${doc.filename}" data-title="${doc.title}">
                        ⬇️ Download
                    </button>
                    ${this.isAuthenticated && (this.currentUser.role === 'admin' || this.currentUser.role === 'executive') ? `
                        <button class="action-btn danger delete-doc-btn" data-doc-id="${doc.id}" data-title="${doc.title}">
                            🗑️ Delete
                        </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `).join('');

        this.bindDocumentActions();

        this.documents = this.documents.map(doc => ({
            ...doc,
            element: documentsGrid.querySelector(`[data-doc-id="${doc.id}"]`)
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

        webinarsGrid.innerHTML = this.webinars.map((webinar, index) => `
        <div class="webinar-card" data-category="${webinar.category}" data-webinar-id="${webinar.id}">
            <div class="webinar-thumbnail">
                <div class="thumbnail-placeholder">
                    <div class="play-icon" data-webinar-id="${webinar.id}">▶️</div>
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
                    <button class="action-btn primary watch-webinar-btn" data-webinar-id="${webinar.id}" data-title="${webinar.title}" data-url="${webinar.videoUrl || '#'}">
                        ▶️ Watch
                    </button>
                    ${this.isAuthenticated && (this.currentUser.role === 'admin' || this.currentUser.role === 'executive') ? `
                        <button class="action-btn danger delete-webinar-btn" data-webinar-id="${webinar.id}" data-title="${webinar.title}">
                            🗑️ Delete
                        </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `).join('');

        this.bindWebinarActions();

        this.webinars = this.webinars.map(webinar => ({
            ...webinar,
            element: webinarsGrid.querySelector(`[data-webinar-id="${webinar.id}"]`)
        }));
    }

    bindDocumentActions() {
        document.querySelectorAll('.view-doc-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const button = e.target.closest('.view-doc-btn');
                const filename = button.dataset.filename;
                const title = button.dataset.title;
                this.viewDocument(filename, title);
            });
        });

        document.querySelectorAll('.download-doc-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const button = e.target.closest('.download-doc-btn');
                const filename = button.dataset.filename;
                const title = button.dataset.title;
                this.downloadDocument(filename, title);
            });
        });

        document.querySelectorAll('.delete-doc-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const button = e.target.closest('.delete-doc-btn');
                const docId = button.dataset.docId;
                const title = button.dataset.title;
                this.deleteDocument(docId, title);
            });
        });
    }

    bindWebinarActions() {
        document.querySelectorAll('.watch-webinar-btn, .play-icon').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const webinarId = e.target.dataset.webinarId;
                const webinar = this.webinars.find(w => w.id === webinarId);
                if (webinar) {
                    this.watchWebinar(webinar);
                }
            });
        });

        document.querySelectorAll('.delete-webinar-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const webinarId = e.target.dataset.webinarId;
                const title = e.target.dataset.title;
                this.deleteWebinar(webinarId, title);
            });
        });
    }

    viewDocument(filename, title) {
        console.log('👁️ Viewing document:', filename);

        const documentUrl = `${this.API_BASE}/files/${filename}`;

        const newWindow = window.open(documentUrl, '_blank');

        if (!newWindow) {
            this.showMessage('Please allow popups to view documents, or try the download button', 'warning');

            this.showDocumentModal(documentUrl, title);
        } else {
            this.showMessage(`Opening "${title}" in new tab`, 'info');
        }
    }

    downloadDocument(filename, title) {
        console.log('⬇️ Downloading document:', filename);

        const documentUrl = `${this.API_BASE}/files/${filename}?download=true`;

        const downloadLink = document.createElement('a');
        downloadLink.href = documentUrl;
        downloadLink.download = filename;
        downloadLink.style.display = 'none';

        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

        this.showMessage(`Downloading "${title}"`, 'success');
    }

    async deleteDocument(docId, title) {
        if (!confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
            return;
        }

        console.log('🗑️ Deleting document:', docId);

        try {
            const response = await fetch(`${this.API_BASE}/communications/${docId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.showMessage(`"${title}" deleted successfully`, 'success');
                await this.loadDocuments();
                this.renderContent();
            } else {
                this.showMessage(data.message || 'Failed to delete document', 'error');
            }
        } catch (error) {
            console.error('Delete error:', error);
            this.showMessage('Network error while deleting document', 'error');
        }
    }

    watchWebinar(webinar) {
        console.log('▶️ Watching webinar:', webinar.title);
        console.log('Video URL:', webinar.videoUrl);

        if (webinar.videoUrl && webinar.videoUrl !== '#' && webinar.videoUrl.trim() !== '') {
            console.log('Opening video URL:', webinar.videoUrl);
            const newWindow = window.open(webinar.videoUrl, '_blank');
            
            if (newWindow) {
                this.showMessage(`Opening "${webinar.title}"`, 'info');
            } else {
                this.showMessage('Please allow popups to open video links', 'warning');
            }
        } else {
            console.log('No valid URL, showing demo modal');
            this.showWebinarModal(webinar);
        }
    }

deleteWebinar(webinarId, title) {
    if (!confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
        return;
    }

    console.log('🗑️ Deleting webinar:', webinarId);

    const defaultIds = ['web1', 'web2', 'web3', 'web4'];
    
    if (defaultIds.includes(webinarId)) {
        const deletedDefaults = JSON.parse(localStorage.getItem('deletedDefaultWebinars') || '[]');
        if (!deletedDefaults.includes(webinarId)) {
            deletedDefaults.push(webinarId);
            this.saveDeletedDefaults(deletedDefaults);
        }
    }

    this.webinars = this.webinars.filter(w => w.id !== webinarId);
    
    this.saveCustomWebinars();

    this.showMessage(`"${title}" deleted successfully`, 'success');
    this.renderWebinars();
}

    showDocumentModal(url, title) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay show';
        modal.innerHTML = `
        <div class="modal document-viewer-modal">
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">✕</button>
            </div>
            <div class="modal-content">
                <iframe src="${url}" style="width: 100%; height: 70vh; border: none;"></iframe>
            </div>
            <div class="modal-buttons">
                <button class="btn-confirm" onclick="window.open('${url}', '_blank')">Open in New Tab</button>
                <button class="btn-cancel" onclick="this.closest('.modal-overlay').remove()">Close</button>
            </div>
        </div>
    `;

        document.body.appendChild(modal);
    }

    showWebinarModal(webinar) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay show';
        modal.innerHTML = `
        <div class="modal webinar-player-modal">
            <div class="modal-header">
                <h3>${webinar.title}</h3>
                <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">✕</button>
            </div>
            <div class="modal-content">
                <div class="demo-video-placeholder">
                    <div class="demo-video-content">
                        <div class="play-icon-large">▶️</div>
                        <h4>Demo Webinar</h4>
                        <p>${webinar.description}</p>
                        <p><strong>Duration:</strong> ${webinar.duration}</p>
                        <p><strong>Category:</strong> ${this.getCategoryDisplayName(webinar.category)}</p>
                        <p><em>This is a demo. In a real implementation, the video would play here.</em></p>
                    </div>
                </div>
            </div>
            <div class="modal-buttons">
                <button class="btn-cancel" onclick="this.closest('.modal-overlay').remove()">Close</button>
            </div>
        </div>
    `;

        document.body.appendChild(modal);
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

        if (file.type !== 'application/pdf') {
            status.textContent = 'Please select a PDF file only';
            status.className = 'file-status error';
            return;
        }

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

            if (response.ok && data.success) {
                this.showMessage('Document uploaded successfully!', 'success');
                this.closeUploadModal();

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
            uploadBtn.disabled = false;
            uploadBtn.textContent = originalText;
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

        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 5000);
    }
}

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

document.addEventListener('DOMContentLoaded', () => {
    console.log('🌟 DOM loaded, initializing documents manager...');
    window.documentsManager = new DocumentsManager();

    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            e.target.classList.remove('show');
        }
    });

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