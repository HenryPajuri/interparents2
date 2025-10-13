class StatutesManager {
    constructor() {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            this.API_BASE = 'http://localhost:3001/api';
        } else {
            this.API_BASE = 'https://interparents.eu/api';
        }
        this.statutes = [];
        this.isAuthenticated = false;
        this.currentUser = null;

        console.log('📜 StatutesManager initialized');
        this.init();
    }

    async init() {
        await this.checkAuthState();
        await this.loadStatutes();
        this.bindEvents();
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

                    if (this.currentUser.role === 'admin' || this.currentUser.role === 'executive') {
                        document.getElementById('editStatutesBtn').style.display = 'block';
                    }
                }
            }
        } catch (error) {
            console.log('ℹ️ User not authenticated');
        }
    }

    async loadStatutes() {
        try {
            console.log('📜 Loading statutes from API...');

            const response = await fetch(`${this.API_BASE}/communications`, {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.communications) {
                    this.statutes = data.communications
                        .filter(comm =>
                            comm.category === 'Policy' &&
                            (comm.title.includes('Statutes') || comm.title.includes('Rules'))
                        )
                        .sort((a, b) => {
                            const yearA = a.title.match(/\d{4}/)?.[0] || '0';
                            const yearB = b.title.match(/\d{4}/)?.[0] || '0';
                            if (yearB !== yearA) return yearB - yearA;

                            if (a.title.includes('Statutes') && b.title.includes('Rules')) return -1;
                            if (a.title.includes('Rules') && b.title.includes('Statutes')) return 1;

                            if (a.title.includes('EN') || a.title.includes('English')) return -1;
                            if (b.title.includes('EN') || b.title.includes('English')) return 1;
                            return 0;
                        });

                    console.log(`✅ Loaded ${this.statutes.length} statutes`);
                    this.renderStatutes();
                }
            }
        } catch (error) {
            console.error('❌ Error loading statutes:', error);
            document.getElementById('statutesList').innerHTML = `
                <li style="color: #e74c3c;">Failed to load statutes. Please refresh the page.</li>
            `;
        }
    }

    renderStatutes() {
        const statutesList = document.getElementById('statutesList');

        if (this.statutes.length === 0) {
            statutesList.innerHTML = `
                <li style="color: #95a5a6;">No statutes available.</li>
            `;
            return;
        }

        statutesList.innerHTML = this.statutes.map(statute => `
            <li style="margin-bottom: 0.5rem;">
                📄 <a href="${this.API_BASE}/files/${statute.filename}" target="_blank" style="color: #3498db; text-decoration: none;">${statute.title}</a>
            </li>
        `).join('');
    }

    bindEvents() {
        const editBtn = document.getElementById('editStatutesBtn');
        const modal = document.getElementById('editStatutesModal');
        const cancelBtn = document.getElementById('cancelEditStatutes');
        const saveBtn = document.getElementById('saveStatutes');

        if (editBtn) {
            editBtn.addEventListener('click', () => this.openEditModal());
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closeEditModal());
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveStatutes());
        }

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeEditModal();
                }
            });
        }
    }

    openEditModal() {
        const modal = document.getElementById('editStatutesModal');
        const editor = document.getElementById('statutesEditor');

        editor.innerHTML = `
            <div style="margin-bottom: 1.5rem; padding: 1rem; background: #f8f9fa; border-radius: 4px;">
                <h3 style="margin-top: 0; font-size: 1.1rem;">➕ Add New Statute/Rule</h3>
                <div style="margin-bottom: 0.75rem;">
                    <label style="display: block; margin-bottom: 0.25rem; font-weight: 500;">Title:</label>
                    <input type="text"
                           id="new-statute-title"
                           placeholder="e.g., InterParents Statutes 2026 (English)"
                           style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                <div style="margin-bottom: 0.75rem;">
                    <label style="display: block; margin-bottom: 0.25rem; font-weight: 500;">Description:</label>
                    <textarea id="new-statute-desc"
                              rows="2"
                              placeholder="Description of the document"
                              style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;"></textarea>
                </div>
                <div style="margin-bottom: 0.75rem;">
                    <label style="display: block; margin-bottom: 0.25rem; font-weight: 500;">PDF File:</label>
                    <input type="file"
                           id="new-statute-file"
                           accept=".pdf"
                           style="width: 100%; padding: 0.5rem;">
                </div>
                <button id="uploadNewStatute" style="padding: 0.5rem 1rem; background: #27ae60; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    📤 Upload New Document
                </button>
            </div>
            <hr style="margin: 2rem 0; border: none; border-top: 2px solid #ddd;">
            <h3 style="margin-bottom: 1rem;">Existing Documents:</h3>
        ` + this.statutes.map((statute, index) => `
            <div style="margin-bottom: 1.5rem; padding: 1rem; border: 1px solid #ddd; border-radius: 4px; position: relative;">
                <button class="delete-statute-btn" data-index="${index}" style="position: absolute; top: 0.5rem; right: 0.5rem; padding: 0.5rem; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">
                    🗑️ Delete
                </button>
                <h3 style="margin-top: 0; font-size: 1.1rem; padding-right: 5rem;">${statute.title}</h3>
                <div style="margin-bottom: 0.75rem;">
                    <label style="display: block; margin-bottom: 0.25rem; font-weight: 500;">Title:</label>
                    <input type="text"
                           id="statute-title-${index}"
                           value="${statute.title}"
                           style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                <div style="margin-bottom: 0.75rem;">
                    <label style="display: block; margin-bottom: 0.25rem; font-weight: 500;">Description:</label>
                    <textarea id="statute-desc-${index}"
                              rows="2"
                              style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">${statute.description}</textarea>
                </div>
                <div style="font-size: 0.9rem; color: #7f8c8d;">
                    <strong>File:</strong> ${statute.filename}
                </div>
                <input type="hidden" id="statute-id-${index}" value="${statute.id}">
            </div>
        `).join('');

        document.getElementById('uploadNewStatute')?.addEventListener('click', () => this.uploadNewStatute());

        document.querySelectorAll('.delete-statute-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.closest('.delete-statute-btn').dataset.index);
                this.deleteStatute(index);
            });
        });

        modal.style.display = 'flex';
    }

    closeEditModal() {
        document.getElementById('editStatutesModal').style.display = 'none';
    }

    async saveStatutes() {
        const updates = [];

        for (let i = 0; i < this.statutes.length; i++) {
            const id = document.getElementById(`statute-id-${i}`).value;
            const title = document.getElementById(`statute-title-${i}`).value;
            const description = document.getElementById(`statute-desc-${i}`).value;

            if (title !== this.statutes[i].title || description !== this.statutes[i].description) {
                updates.push({ id, title, description });
            }
        }

        if (updates.length === 0) {
            this.closeEditModal();
            return;
        }

        try {
            const saveBtn = document.getElementById('saveStatutes');
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';

            for (const update of updates) {
                const response = await fetch(`${this.API_BASE}/communications/${update.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        title: update.title,
                        description: update.description
                    })
                });

                if (!response.ok) {
                    throw new Error(`Failed to update ${update.title}`);
                }
            }

            console.log('✅ Statutes updated successfully');
            await this.loadStatutes();
            this.closeEditModal();

        } catch (error) {
            console.error('❌ Error saving statutes:', error);
            alert('Failed to save changes: ' + error.message);
        } finally {
            const saveBtn = document.getElementById('saveStatutes');
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Changes';
        }
    }

    async uploadNewStatute() {
        const title = document.getElementById('new-statute-title').value.trim();
        const description = document.getElementById('new-statute-desc').value.trim();
        const fileInput = document.getElementById('new-statute-file');
        const file = fileInput.files[0];

        if (!title || !description || !file) {
            alert('Please fill in all fields and select a PDF file');
            return;
        }

        if (title.length < 3) {
            alert('Title must be at least 3 characters long');
            return;
        }

        if (description.length < 10) {
            alert('Description must be at least 10 characters long');
            return;
        }

        if (!file.name.toLowerCase().endsWith('.pdf')) {
            alert('Please select a PDF file');
            return;
        }

        try {
            const uploadBtn = document.getElementById('uploadNewStatute');
            uploadBtn.disabled = true;
            uploadBtn.textContent = '⏳ Uploading...';

            const formData = new FormData();
            formData.append('pdf', file);
            formData.append('title', title);
            formData.append('description', description);
            formData.append('category', 'Policy');
            formData.append('publishDate', new Date().toISOString());

            const response = await fetch(`${this.API_BASE}/communications`, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            if (!response.ok) {
                const data = await response.json();
                if (data.errors && Array.isArray(data.errors)) {
                    const errorMessages = data.errors.map(e => e.msg).join('\n');
                    throw new Error(errorMessages);
                } else {
                    throw new Error(data.message || 'Failed to upload document');
                }
            }

            console.log('✅ Statute uploaded successfully');
            await this.loadStatutes();
            this.openEditModal();

        } catch (error) {
            console.error('❌ Error uploading statute:', error);
            alert('Failed to upload document: ' + error.message);
            const uploadBtn = document.getElementById('uploadNewStatute');
            if (uploadBtn) {
                uploadBtn.disabled = false;
                uploadBtn.textContent = '📤 Upload New Document';
            }
        }
    }

    async deleteStatute(index) {
        const statute = this.statutes[index];

        if (!confirm(`Remove "${statute.title}" from the home page Statutes & Rules section?\n\nNote: The document will remain available in the Documents page.`)) {
            return;
        }

        try {
            const response = await fetch(`${this.API_BASE}/communications/${statute.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    category: 'Other'
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Failed to remove document from home page');
            }

            console.log('✅ Statute removed from home page');
            await this.loadStatutes();
            this.openEditModal();

        } catch (error) {
            console.error('❌ Error removing statute:', error);
            alert('Failed to remove document: ' + error.message);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new StatutesManager();
});
