// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Add animation classes when elements come into view
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('fade-in');
        }
    });
}, observerOptions);

// Observe all communication cards and member cards
document.querySelectorAll('.communication-card, .member-card').forEach(card => {
    observer.observe(card);
});

// Add hover effects to communication cards
document.addEventListener('DOMContentLoaded', function() {
    // Use event delegation for dynamically loaded communication cards
    document.addEventListener('mouseenter', function(e) {
        if (e.target.classList.contains('communication-card')) {
            e.target.style.borderColor = '#3498db';
        }
    }, true);
    
    document.addEventListener('mouseleave', function(e) {
        if (e.target.classList.contains('communication-card')) {
            e.target.style.borderColor = '#e9ecef';
        }
    }, true);
});

// Add hover effects to member cards (now as links)
document.querySelectorAll('.member-card').forEach(card => {
    card.addEventListener('mouseenter', function() {
        this.style.borderColor = '#3498db';
    });
    
    card.addEventListener('mouseleave', function() {
        this.style.borderColor = '#dee2e6';
    });
    
    // Add keyboard navigation support for accessibility
    card.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            window.open(this.href, '_blank', 'noopener');
        }
    });
});

// Function to redirect to historical website with credentials info
function showCredentialAlert() {
    // Show alert with credentials, then redirect to the historical site
    const shouldContinue = confirm('This will take you to the historical data website.\n\nCredentials needed:\nUsername: a\nPassword: b\n\nClick OK to continue or Cancel to stay here.');
    
    if (shouldContinue) {
        // Redirect to the historical website
        window.open('http://www.interparents.eu:8888/', '_blank', 'noopener');
    }
}

// Dynamic year in footer
document.addEventListener('DOMContentLoaded', function() {
    const footerText = document.querySelector('footer p');
    if (footerText) {
        footerText.innerHTML = footerText.innerHTML.replace('2025', new Date().getFullYear());
    }
});

// Optional: Add scroll effect to header
window.addEventListener('scroll', function() {
    const header = document.querySelector('header');
    if (window.scrollY > 100) {
        header.classList.add('header-scrolled');
    } else {
        header.classList.remove('header-scrolled');
    }
});

// ========== DYNAMIC COMMUNICATIONS MANAGER ==========

// Communications Manager for Homepage
class CommunicationsManager {
    constructor() {
        this.API_BASE = '/api';
        this.communications = [];
        this.init();
    }

    async init() {
        await this.loadCommunications();
    }

    async loadCommunications() {
        try {
            // Show loading state
            this.showLoading();

            const response = await fetch(`${this.API_BASE}/communications`);
            
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.communications = data.communications;
                    this.renderCommunications();
                } else {
                    this.showError('Failed to load communications');
                }
            } else {
                // If API fails, fall back to hardcoded data
                console.warn('API failed, using fallback data');
                this.loadFallbackData();
            }
        } catch (error) {
            console.error('Error loading communications:', error);
            // If API fails, fall back to hardcoded data
            this.loadFallbackData();
        }
    }

    loadFallbackData() {
        // Fallback to the original hardcoded communications
        this.communications = [
            {
                title: "Joint Teaching Committee Report",
                description: "Comprehensive report on the February 2022 Joint Teaching Committee meeting covering curriculum updates and policy changes.",
                filename: "JTC-2022-FebIP-ReportforPAs.pdf",
                category: "JTC",
                publishDate: "2022-03-15T00:00:00Z"
            },
            {
                title: "Joint Teaching Committee Memo",
                description: "Important updates and decisions from the June 2020 Joint Teaching Committee meeting.",
                filename: "jtc-2020-jun.pdf",
                category: "JTC",
                publishDate: "2020-07-06T00:00:00Z"
            },
            {
                title: "Board of Governors Report",
                description: "Key outcomes and decisions from the April 2020 Board of Governors meeting.",
                filename: "bog-2020-apr.pdf",
                category: "BOG",
                publishDate: "2020-06-11T00:00:00Z"
            },
            {
                title: "Joint Teaching Committee Update",
                description: "Summary of discussions and decisions from the February 2020 Joint Teaching Committee.",
                filename: "jtc-2020-feb.pdf",
                category: "JTC",
                publishDate: "2020-05-25T00:00:00Z"
            },
            {
                title: "Board of Governors Memo",
                description: "Report covering the December 2019 Board of Governors meeting and its implications.",
                filename: "bog-2019-dec.pdf",
                category: "BOG",
                publishDate: "2020-05-25T00:00:00Z"
            },
            {
                title: "Teaching Committee Report",
                description: "Detailed report from the October 2019 Joint Teaching Committee session.",
                filename: "jtc-2019-oct.pdf",
                category: "JTC",
                publishDate: "2020-05-25T00:00:00Z"
            }
        ];
        this.renderCommunications();
    }

    showLoading() {
        const container = document.querySelector('.communications-grid');
        if (container) {
            container.innerHTML = `
                <div class="communication-card" style="grid-column: 1/-1; text-align: center;">
                    <div style="padding: 2rem;">
                        <div style="display: inline-block; width: 20px; height: 20px; border: 2px solid #e8ecef; border-top: 2px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite; margin-right: 1rem;"></div>
                        Loading communications...
                    </div>
                </div>
            `;
        }
    }

    showError(message) {
        const container = document.querySelector('.communications-grid');
        if (container) {
            container.innerHTML = `
                <div class="communication-card" style="grid-column: 1/-1; text-align: center; background: rgba(231, 76, 60, 0.1); border: 1px solid rgba(231, 76, 60, 0.2);">
                    <h3 style="color: #e74c3c; margin-bottom: 1rem;">Error Loading Communications</h3>
                    <p style="color: #c0392b;">${message}</p>
                </div>
            `;
        }
    }

    renderCommunications() {
        const container = document.querySelector('.communications-grid');
        if (!container) {
            console.warn('Communications grid container not found');
            return;
        }

        if (this.communications.length === 0) {
            container.innerHTML = `
                <div class="communication-card" style="grid-column: 1/-1; text-align: center;">
                    <h3>No Communications Available</h3>
                    <p>Check back soon for new reports and updates.</p>
                </div>
            `;
            return;
        }

        // Sort communications by publish date (newest first)
        const sortedComms = [...this.communications].sort((a, b) => 
            new Date(b.publishDate) - new Date(a.publishDate)
        );

        container.innerHTML = sortedComms.map(comm => {
            const publishDate = new Date(comm.publishDate);
            const formattedDate = publishDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            // Get category display name
            const categoryName = this.getCategoryDisplayName(comm.category);

            return `
                <div class="communication-card">
                    <h3>${comm.title}</h3>
                    <div class="date">Published: ${formattedDate}</div>
                    ${comm.category ? `<div class="category" style="margin-bottom: 1rem;">
                        <span style="background: ${this.getCategoryColor(comm.category)}; color: white; padding: 0.2rem 0.5rem; border-radius: 3px; font-size: 0.8rem; font-weight: 500;">${categoryName}</span>
                    </div>` : ''}
                    <p>${comm.description}</p>
                    <a href="/pdf/${comm.filename}" class="download-link" target="_blank" rel="noopener">Download (PDF)</a>
                </div>
            `;
        }).join('');

        // Add fade-in animation to new cards
        const cards = container.querySelectorAll('.communication-card');
        cards.forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            setTimeout(() => {
                card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, index * 100);
        });
    }

    getCategoryDisplayName(category) {
        const categoryMap = {
            'JTC': 'Joint Teaching Committee',
            'BOG': 'Board of Governors', 
            'Policy': 'Policy Document',
            'Report': 'Report',
            'Memo': 'Memo',
            'Other': 'Other'
        };
        return categoryMap[category] || category;
    }

    getCategoryColor(category) {
        const colorMap = {
            'JTC': '#3498db',
            'BOG': '#9b59b6',
            'Policy': '#27ae60',
            'Report': '#f39c12',
            'Memo': '#e74c3c',
            'Other': '#95a5a6'
        };
        return colorMap[category] || '#95a5a6';
    }

    // Method to refresh communications (can be called externally)
    async refresh() {
        await this.loadCommunications();
    }
}

// ========== AUTHENTICATION STATE MANAGER ==========

class AuthStateManager {
    constructor() {
        this.API_BASE = '/api';
        this.user = null;
        this.init();
    }

    async init() {
        await this.checkAuthState();
        this.updateNavigation();
    }

    async checkAuthState() {
        try {
            const response = await fetch(`${this.API_BASE}/auth/me`, {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.user = data.user;
                }
            }
        } catch (error) {
            // User not logged in, which is fine for public pages
            console.log('User not authenticated');
        }
    }

    updateNavigation() {
        const loginNavItem = document.querySelector('.login-nav-item');
        if (!loginNavItem) return;

        if (this.user) {
            // User is logged in - show dashboard link and logout
            loginNavItem.innerHTML = `
                <a href="/html/dashboard.html" style="margin-right: 1rem; color: white; text-decoration: none;">Dashboard</a>
                <a href="#" class="login-button-nav" id="logoutBtn">Logout</a>
            `;

            // Bind logout event
            document.getElementById('logoutBtn').addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        } else {
            // User not logged in - show login button
            loginNavItem.innerHTML = `
                <a href="/html/login.html" class="login-button-nav">Login</a>
            `;
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
            this.user = null;
            this.updateNavigation();
            // Show logout message
            this.showMessage('You have been logged out successfully.');
        }
    }

    showMessage(message) {
        // Simple notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: #27ae60;
            color: white;
            padding: 1rem 2rem;
            border-radius: 6px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Auto-initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize authentication state manager on all pages
    window.authStateManager = new AuthStateManager();

    // Only initialize communications manager if we're on a page with communications
    if (document.querySelector('.communications-grid')) {
        window.communicationsManager = new CommunicationsManager();
    }
});

// Export for potential use in other scripts
window.CommunicationsManager = CommunicationsManager;