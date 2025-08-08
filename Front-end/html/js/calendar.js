// Enhanced Calendar functionality with proper authentication integration
class Calendar {
    constructor() {
        this.currentDate = new Date();
        this.currentView = 'month';
        this.events = [];
        this.selectedEventId = null;
        this.isEditMode = false;
        this.API_BASE = 'https://interparents-1.onrender.com/api';
        this.isLoading = false;
        this.debugMode = true;
        this.isAuthenticated = false;
        this.currentUser = null;
        
        console.log('🗓️ Calendar initialized with API_BASE:', this.API_BASE);
        this.init();
    }

    async init() {
        console.log('🔄 Initializing calendar...');
        
        // First check authentication state
        await this.checkAuthState();
        
        this.bindEvents();
        this.updateUI();
        this.showLoading(true);
        await this.loadEvents();
        this.showLoading(false);
        this.render();
        this.updateCurrentMonth();
        console.log('✅ Calendar initialization complete');
    }

    // NEW: Check authentication state
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

    // NEW: Update UI based on authentication state
    updateUI() {
        const addEventBtn = document.getElementById('addEventBtn');
        const authNotice = document.getElementById('authNotice');
        
        if (this.isAuthenticated) {
            // User is logged in
            if (addEventBtn) addEventBtn.style.display = 'block';
            if (authNotice) authNotice.style.display = 'none';
            
            // Update navigation if AuthStateManager hasn't loaded yet
            this.updateNavigation();
        } else {
            // User is not logged in
            if (addEventBtn) addEventBtn.style.display = 'none';
            if (authNotice) authNotice.style.display = 'block';
        }
    }

    // NEW: Update navigation to show proper login/logout state
    updateNavigation() {
        const loginNavItem = document.querySelector('.login-nav-item');
        if (!loginNavItem || !this.currentUser) return;

        // Only update if it's still showing login button
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

    // NEW: Logout functionality
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

    // UPDATED: Enhanced API call method with optional authentication
    async apiCall(endpoint, options = {}) {
        const url = `${this.API_BASE}${endpoint}`;
        console.log(`🌐 API Call: ${options.method || 'GET'} ${url}`);
        
        const defaultOptions = {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const mergedOptions = { ...defaultOptions, ...options };

        try {
            const response = await fetch(url, mergedOptions);
            console.log(`📥 Response: ${response.status} ${response.statusText}`);
            
            if (!response.ok) {
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                
                try {
                    const errorData = await response.json();
                    console.error('❌ Error response data:', errorData);
                    errorMessage = errorData.message || errorMessage;
                } catch (parseError) {
                    console.error('❌ Could not parse error response as JSON');
                }
                
                // For events endpoint, if user is not authenticated, that's OK for viewing
                if (response.status === 401 && endpoint.includes('/events') && options.method !== 'POST' && options.method !== 'PUT' && options.method !== 'DELETE') {
                    console.log('ℹ️ Loading events without authentication');
                    return { success: false, needsAuth: true };
                }
                
                if (response.status === 401 && (options.method === 'POST' || options.method === 'PUT' || options.method === 'DELETE')) {
                    this.showMessage('Please log in to perform this action', 'error');
                    return null;
                }
                
                throw new Error(errorMessage);
            }

            const data = await response.json();
            console.log('✅ Response data:', data);
            return data;
            
        } catch (error) {
            console.error('💥 API call failed:', error);
            throw error;
        }
    }

    // UPDATED: Enhanced event loading that works without authentication
    async loadEvents() {
        try {
            console.log('📅 Loading events...');
            const currentYear = this.currentDate.getFullYear();
            const currentMonth = this.currentDate.getMonth() + 1;
            
            console.log(`📅 Requesting events for ${currentYear}-${currentMonth.toString().padStart(2, '0')}`);
            
            const data = await this.apiCall(`/events?year=${currentYear}&month=${currentMonth}`);
            
            if (data && data.success) {
                this.events = data.events || [];
                console.log(`✅ Loaded ${this.events.length} events from backend`);
            } else if (data && data.needsAuth) {
                // Load public events without authentication
                console.log('📅 Loading sample/public events for non-authenticated user');
                this.events = this.loadSampleEvents();
            } else {
                throw new Error(data?.message || 'Failed to load events - invalid response format');
            }
            
        } catch (error) {
            console.error('❌ Error loading events from backend:', error);
            console.log('🔄 Loading sample events as fallback');
            this.events = this.loadSampleEvents();
        }
    }

    // UPDATED: Show event creator information
    createDayElement(date, currentMonth) {
        const day = document.createElement('div');
        day.className = 'calendar-day';
        
        const today = new Date();
        const isToday = date.toDateString() === today.toDateString();
        const isCurrentMonth = date.getMonth() === currentMonth;
        
        if (isToday) day.classList.add('today');
        if (!isCurrentMonth) day.classList.add('other-month');

        const dayNumber = document.createElement('div');
        dayNumber.className = 'day-number';
        dayNumber.textContent = date.getDate();
        day.appendChild(dayNumber);

        const dayEvents = this.getEventsForDate(date);
        dayEvents.forEach(event => {
            const eventElement = document.createElement('div');
            eventElement.className = `event-item ${event.type}`;
            eventElement.textContent = event.title;
            
            // Add creator info if available
            if (event.createdBy && event.createdBy.name) {
                eventElement.title = `${event.title}\nOrganizer: ${event.organizer || event.createdBy.name}`;
            }
            
            eventElement.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showEventDetails(event);
            });
            day.appendChild(eventElement);
        });

        // Only allow creating events if authenticated
        if (this.isAuthenticated) {
            day.addEventListener('click', () => {
                this.openEventModal(date);
            });
        }

        return day;
    }

    // UPDATED: Enhanced event details with creator info
    showEventDetails(event) {
        console.log('👁️ Showing event details for:', event.title, 'ID:', event.id);
        
        const modal = document.getElementById('eventDetailsModal');
        const content = document.getElementById('eventDetailsContent');
        
        document.getElementById('eventDetailsTitle').textContent = event.title;
        
        const eventDate = new Date(event.date);
        const dateStr = eventDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        let creatorInfo = '';
        if (event.createdBy && event.createdBy.name) {
            creatorInfo = `
                <div class="event-detail-item">
                    <div class="event-detail-label">Created by</div>
                    <div class="event-detail-value">${event.createdBy.name} (${event.createdBy.school || 'Unknown School'})</div>
                </div>
            `;
        }

        content.innerHTML = `
            <div class="event-detail-item">
                <div class="event-detail-label">Date & Time</div>
                <div class="event-detail-value">${dateStr} ${event.time ? `at ${event.time}` : ''}</div>
            </div>
            <div class="event-detail-item">
                <div class="event-detail-label">Type</div>
                <div class="event-detail-value">${this.capitalizeFirst(event.type)}</div>
            </div>
            ${event.location ? `
                <div class="event-detail-item">
                    <div class="event-detail-label">Location</div>
                    <div class="event-detail-value">${event.location}</div>
                </div>
            ` : ''}
            ${event.organizer ? `
                <div class="event-detail-item">
                    <div class="event-detail-label">Organizer</div>
                    <div class="event-detail-value">${event.organizer}</div>
                </div>
            ` : ''}
            ${creatorInfo}
            ${event.description ? `
                <div class="event-detail-item">
                    <div class="event-detail-label">Description</div>
                    <div class="event-detail-value">${event.description}</div>
                </div>
            ` : ''}
        `;

        // Store the selected event ID for editing
        this.selectedEventId = event.id;
        
        // Show/hide edit button based on permissions and authentication
        const editBtn = document.getElementById('editEventBtn');
        if (this.isAuthenticated && event.canEdit !== false) {
            editBtn.style.display = 'inline-block';
        } else {
            editBtn.style.display = 'none';
        }
        
        console.log('👁️ Event details modal opened, selectedEventId set to:', this.selectedEventId);
        
        modal.classList.add('show');
    }

    // UPDATED: Only allow opening event modal if authenticated
    openEventModal(date = null) {
        if (!this.isAuthenticated) {
            this.showMessage('Please log in to create events', 'error');
            return;
        }
        
        console.log('🎯 Opening event modal for new event');
        
        const modal = document.getElementById('eventModal');
        const form = document.getElementById('eventForm');
        
        // Reset all state
        form.reset();
        this.selectedEventId = null;
        this.isEditMode = false;
        
        // Set date if provided
        if (date) {
            document.getElementById('eventDate').value = date.toISOString().split('T')[0];
        }
        
        // Update modal for new event
        document.getElementById('modalTitle').textContent = 'Add Event';
        document.getElementById('deleteEventBtn').style.display = 'none';
        document.getElementById('saveEventBtn').textContent = 'Save Event';
        
        modal.classList.add('show');
    }

    // UPDATED: Enhanced agenda rendering with creator info
    renderAgenda() {
        document.getElementById('monthView').style.display = 'none';
        document.getElementById('weekView').style.display = 'none';
        document.getElementById('agendaView').style.display = 'block';

        const agendaList = document.getElementById('agendaList');
        const filter = document.getElementById('agendaFilter').value;
        
        let filteredEvents = this.events;
        if (filter !== 'all') {
            filteredEvents = this.events.filter(event => event.type === filter);
        }

        filteredEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

        agendaList.innerHTML = '';

        if (filteredEvents.length === 0) {
            agendaList.innerHTML = '<p style="text-align: center; color: #7f8c8d; padding: 2rem;">No events found.</p>';
            return;
        }

        filteredEvents.forEach(event => {
            const agendaItem = document.createElement('div');
            agendaItem.className = `agenda-item ${event.type}`;
            
            const eventDate = new Date(event.date);
            const dateStr = eventDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            let creatorInfo = '';
            if (event.createdBy && event.createdBy.name) {
                creatorInfo = `👤 ${event.createdBy.name}`;
            }

            agendaItem.innerHTML = `
                <div class="agenda-date">${dateStr} ${event.time ? `at ${event.time}` : ''}</div>
                <div class="agenda-title">${event.title}</div>
                <div class="agenda-details">
                    ${event.location ? `📍 ${event.location}` : ''}
                    ${event.organizer ? `👥 ${event.organizer}` : ''}
                    ${creatorInfo ? `<br>${creatorInfo}` : ''}
                </div>
            `;

            agendaItem.addEventListener('click', () => this.showEventDetails(event));
            agendaList.appendChild(agendaItem);
        });
    }

    // Rest of the methods remain the same...
    bindEvents() {
        // Navigation buttons
        document.getElementById('prevBtn').addEventListener('click', () => this.navigatePrev());
        document.getElementById('nextBtn').addEventListener('click', () => this.navigateNext());
        document.getElementById('todayBtn').addEventListener('click', () => this.goToToday());

        // View controls
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchView(e.target.dataset.view));
        });

        // Add event button
        document.getElementById('addEventBtn').addEventListener('click', () => this.openEventModal());

        // Event form
        document.getElementById('eventForm').addEventListener('submit', (e) => this.saveEvent(e));

        // Agenda filter
        document.getElementById('agendaFilter').addEventListener('change', () => this.renderAgenda());

        // Edit event button in details modal
        document.getElementById('editEventBtn').addEventListener('click', () => this.editCurrentEvent());
    }

    async navigatePrev() {
        if (this.currentView === 'month') {
            this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        } else if (this.currentView === 'week') {
            this.currentDate.setDate(this.currentDate.getDate() - 7);
        }
        
        this.showLoading(true);
        await this.loadEvents();
        this.showLoading(false);
        this.render();
        this.updateCurrentMonth();
    }

    async navigateNext() {
        if (this.currentView === 'month') {
            this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        } else if (this.currentView === 'week') {
            this.currentDate.setDate(this.currentDate.getDate() + 7);
        }
        
        this.showLoading(true);
        await this.loadEvents();
        this.showLoading(false);
        this.render();
        this.updateCurrentMonth();
    }

    async goToToday() {
        this.currentDate = new Date();
        this.showLoading(true);
        await this.loadEvents();
        this.showLoading(false);
        this.render();
        this.updateCurrentMonth();
    }

    render() {
        switch (this.currentView) {
            case 'month':
                this.renderMonth();
                break;
            case 'week':
                this.renderWeek();
                break;
            case 'agenda':
                this.renderAgenda();
                break;
        }
    }

    renderMonth() {
        document.getElementById('monthView').style.display = 'block';
        document.getElementById('weekView').style.display = 'none';
        document.getElementById('agendaView').style.display = 'none';

        const grid = document.getElementById('calendarGrid');
        grid.innerHTML = '';

        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        const firstDay = new Date(year, month, 1);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());

        for (let i = 0; i < 42; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            
            const dayElement = this.createDayElement(date, month);
            grid.appendChild(dayElement);
        }
    }

    renderWeek() {
        // Implementation remains the same...
        document.getElementById('monthView').style.display = 'none';
        document.getElementById('weekView').style.display = 'block';
        document.getElementById('agendaView').style.display = 'none';

        const weekStart = new Date(this.currentDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());

        const weekDays = document.getElementById('weekDays');
        weekDays.innerHTML = '';
        
        for (let i = 0; i < 7; i++) {
            const date = new Date(weekStart);
            date.setDate(weekStart.getDate() + i);
            
            const dayElement = document.createElement('div');
            dayElement.className = 'week-day';
            
            const today = new Date();
            if (date.toDateString() === today.toDateString()) {
                dayElement.classList.add('today');
            }
            
            dayElement.innerHTML = `
                <div>${this.getDayName(i)}</div>
                <div>${date.getDate()}</div>
            `;
            weekDays.appendChild(dayElement);
        }

        this.renderWeekGrid(weekStart);
    }

    renderWeekGrid(weekStart) {
        const weekGrid = document.getElementById('weekGrid');
        weekGrid.innerHTML = '';

        const timeSlots = document.createElement('div');
        timeSlots.className = 'week-time-slots';
        
        for (let hour = 0; hour < 24; hour++) {
            const timeSlot = document.createElement('div');
            timeSlot.className = 'week-time-slot';
            timeSlot.textContent = `${hour.toString().padStart(2, '0')}:00`;
            timeSlots.appendChild(timeSlot);
        }
        weekGrid.appendChild(timeSlots);

        const eventsGrid = document.createElement('div');
        eventsGrid.className = 'week-events';
        
        for (let day = 0; day < 7; day++) {
            const date = new Date(weekStart);
            date.setDate(weekStart.getDate() + day);
            
            const dayEvents = document.createElement('div');
            dayEvents.className = 'week-day-events';
            dayEvents.style.height = '1440px';
            
            const events = this.getEventsForDate(date);
            events.forEach(event => {
                if (event.time) {
                    const [hours, minutes] = event.time.split(':');
                    const top = (parseInt(hours) * 60) + parseInt(minutes || 0);
                    
                    const eventElement = document.createElement('div');
                    eventElement.className = `week-event ${event.type}`;
                    eventElement.style.top = `${top}px`;
                    eventElement.style.height = '30px';
                    eventElement.textContent = event.title;
                    eventElement.addEventListener('click', () => this.showEventDetails(event));
                    
                    dayEvents.appendChild(eventElement);
                }
            });
            
            eventsGrid.appendChild(dayEvents);
        }
        weekGrid.appendChild(eventsGrid);
    }

    getEventsForDate(date) {
        const dateStr = date.toISOString().split('T')[0];
        return this.events.filter(event => event.date === dateStr);
    }

    switchView(view) {
        this.currentView = view;
        
        document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-view="${view}"]`).classList.add('active');
        
        this.render();
    }

    updateCurrentMonth() {
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        
        const monthYear = `${monthNames[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`;
        document.getElementById('currentMonth').textContent = monthYear;
    }

    getDayName(dayIndex) {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days[dayIndex];
    }

    editCurrentEvent() {
        if (!this.selectedEventId) {
            console.error('❌ No event selected for editing');
            return;
        }
        
        if (!this.isAuthenticated) {
            this.showMessage('Please log in to edit events', 'error');
            return;
        }
        
        const event = this.events.find(e => e.id === this.selectedEventId);
        if (!event) {
            console.error('❌ Event not found:', this.selectedEventId);
            this.showMessage('Event not found', 'error');
            return;
        }
        
        if (event.canEdit === false) {
            this.showMessage('You do not have permission to edit this event.', 'error');
            return;
        }
        
        console.log('✏️ Editing event:', event.title, 'ID:', this.selectedEventId);
        
        // Close details modal
        this.closeEventDetailsModal();
        
        // Open edit modal with proper state
        const modal = document.getElementById('eventModal');
        
        this.isEditMode = true;
        
        // Populate form with event data
        document.getElementById('eventTitle').value = event.title || '';
        document.getElementById('eventType').value = event.type || '';
        document.getElementById('eventDate').value = event.date || '';
        document.getElementById('eventTime').value = event.time || '';
        document.getElementById('eventLocation').value = event.location || '';
        document.getElementById('eventDescription').value = event.description || '';
        document.getElementById('eventOrganizer').value = event.organizer || '';
        
        // Update modal for editing
        document.getElementById('modalTitle').textContent = 'Edit Event';
        document.getElementById('deleteEventBtn').style.display = 'inline-block';
        document.getElementById('saveEventBtn').textContent = 'Update Event';
        
        // Set up delete button with proper event handler
        const deleteBtn = document.getElementById('deleteEventBtn');
        deleteBtn.onclick = (e) => {
            e.preventDefault();
            this.deleteEvent();
        };
        
        modal.classList.add('show');
    }

    async saveEvent(e) {
        e.preventDefault();
        
        if (!this.isAuthenticated) {
            this.showMessage('Please log in to save events', 'error');
            return;
        }
        
        if (this.isLoading) {
            console.log('⏳ Already saving, ignoring duplicate request');
            return;
        }
        
        const formData = new FormData(e.target);
        const eventData = {
            title: formData.get('title'),
            type: formData.get('type'),
            date: formData.get('date'),
            time: formData.get('time'),
            location: formData.get('location'),
            description: formData.get('description'),
            organizer: formData.get('organizer')
        };

        console.log('💾 Saving event...');
        console.log('💾 Event data:', eventData);

        this.setModalLoadingState(true);

        try {
            let data;
            
            if (this.isEditMode && this.selectedEventId) {
                // Update existing event
                console.log(`✏️ Updating event: ${this.selectedEventId}`);
                data = await this.apiCall(`/events/${this.selectedEventId}`, {
                    method: 'PUT',
                    body: JSON.stringify(eventData)
                });
                console.log('✅ Event updated successfully');
            } else {
                // Create new event
                console.log('➕ Creating new event');
                data = await this.apiCall('/events', {
                    method: 'POST',
                    body: JSON.stringify(eventData)
                });
                console.log('✅ Event created successfully');
            }

            if (data && data.success) {
                this.showMessage(data.message || 'Event saved successfully!', 'success');
                this.closeEventModal();
                
                // Reload events to get updated data
                await this.loadEvents();
                this.render();
            } else {
                throw new Error(data?.message || 'Failed to save event');
            }
        } catch (error) {
            console.error('❌ Error saving event:', error);
            this.showMessage(error.message || 'Failed to save event. Please try again.', 'error');
        } finally {
            this.setModalLoadingState(false);
        }
    }

    async deleteEvent() {
        if (!this.selectedEventId) {
            console.error('❌ No event selected for deletion');
            return;
        }
        
        if (!this.isAuthenticated) {
            this.showMessage('Please log in to delete events', 'error');
            return;
        }
        
        console.log(`🗑️ Attempting to delete event: ${this.selectedEventId}`);
        
        if (!confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
            console.log('🚫 Delete cancelled by user');
            return;
        }

        this.setModalLoadingState(true);

        try {
            const data = await this.apiCall(`/events/${this.selectedEventId}`, {
                method: 'DELETE'
            });

            if (data && data.success) {
                console.log('✅ Event deleted successfully');
                this.showMessage('Event deleted successfully', 'success');
                this.closeEventModal();
                
                // Reload events to get updated data
                await this.loadEvents();
                this.render();
            } else {
                throw new Error(data?.message || 'Failed to delete event');
            }
        } catch (error) {
            console.error('❌ Error deleting event:', error);
            this.showMessage(error.message || 'Failed to delete event. Please try again.', 'error');
        } finally {
            this.setModalLoadingState(false);
        }
    }

    setModalLoadingState(loading) {
        this.isLoading = loading;
        const saveBtn = document.getElementById('saveEventBtn');
        const deleteBtn = document.getElementById('deleteEventBtn');
        
        if (loading) {
            saveBtn.disabled = true;
            deleteBtn.disabled = true;
            saveBtn.innerHTML = '<span class="spinner"></span> Saving...';
        } else {
            saveBtn.disabled = false;
            deleteBtn.disabled = false;
            saveBtn.textContent = this.isEditMode ? 'Update Event' : 'Save Event';
        }
    }

    showLoading(show) {
        const calendarContainer = document.querySelector('.calendar-container');
        
        if (show) {
            if (!document.querySelector('.calendar-loading')) {
                const loadingDiv = document.createElement('div');
                loadingDiv.className = 'calendar-loading';
                loadingDiv.innerHTML = `
                    <div style="text-align: center; padding: 3rem; color: #7f8c8d;">
                        <div class="spinner" style="margin: 0 auto 1rem;"></div>
                        Loading calendar...
                    </div>
                `;
                calendarContainer.appendChild(loadingDiv);
            }
        } else {
            const loadingDiv = document.querySelector('.calendar-loading');
            if (loadingDiv) {
                loadingDiv.remove();
            }
        }
    }

    showMessage(message, type = 'info') {
        console.log(`📢 Message (${type}): ${message}`);
        
        let messageContainer = document.getElementById('calendarMessages');
        if (!messageContainer) {
            messageContainer = document.createElement('div');
            messageContainer.id = 'calendarMessages';
            messageContainer.style.cssText = 'position: fixed; top: 100px; right: 20px; z-index: 10000;';
            document.body.appendChild(messageContainer);
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `calendar-message ${type}`;
        messageDiv.style.cssText = `
            background: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : type === 'warning' ? '#f39c12' : '#3498db'};
            color: white;
            padding: 1rem 1.5rem;
            margin-bottom: 0.5rem;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideIn 0.3s ease;
            max-width: 300px;
            word-wrap: break-word;
        `;
        messageDiv.textContent = message;

        messageContainer.appendChild(messageDiv);

        setTimeout(() => {
            messageDiv.remove();
        }, 5000);
    }

    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    closeEventModal() {
        console.log('🚪 Closing event modal and resetting state');
        document.getElementById('eventModal').classList.remove('show');
        
        // Reset all state
        this.selectedEventId = null;
        this.isEditMode = false;
    }

    closeEventDetailsModal() {
        console.log('🚪 Closing event details modal');
        document.getElementById('eventDetailsModal').classList.remove('show');
    }

    // Load sample events as fallback for non-authenticated users
    loadSampleEvents() {
        console.log('📅 Loading sample events as fallback');
        return [
            {
                id: 'sample-1',
                title: 'INTERPARENTS Bureau Meeting',
                type: 'meeting',
                date: '2025-01-15',
                time: '14:00',
                location: 'Brussels, Belgium',
                description: 'Weekly Bureau meeting to discuss ongoing initiatives.',
                organizer: 'INTERPARENTS Bureau',
                createdBy: { name: 'INTERPARENTS Admin', school: 'INTERPARENTS Central' },
                canEdit: false
            },
            {
                id: 'sample-2',
                title: 'Joint Teaching Committee Meeting',
                type: 'meeting',
                date: '2025-02-12',
                time: '09:00',
                location: 'Brussels, Belgium',
                description: 'JTC meeting with inspectors from all Member States.',
                organizer: 'European Schools Office',
                createdBy: { name: 'European Schools', school: 'Office of Secretary General' },
                canEdit: false
            }
        ];
    }
}

// Global functions for modal closing
function closeEventModal() {
    if (window.calendar) {
        window.calendar.closeEventModal();
    }
}

function closeEventDetailsModal() {
    if (window.calendar) {
        window.calendar.closeEventDetailsModal();
    }
}

// Initialize calendar when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🌟 DOM loaded, initializing calendar...');
    window.calendar = new Calendar();
    
    // Close modals when clicking outside
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            e.target.classList.remove('show');
        }
    });
    
    // Add CSS for animations
    if (!document.querySelector('#calendar-animations')) {
        const style = document.createElement('style');
        style.id = 'calendar-animations';
        style.textContent = `
            @keyframes slideIn {
                from { opacity: 0; transform: translateX(100%); }
                to { opacity: 1; transform: translateX(0); }
            }
            .spinner {
                width: 20px;
                height: 20px;
                border: 2px solid #e8ecef;
                border-top: 2px solid #3498db;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                display: inline-block;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }
});