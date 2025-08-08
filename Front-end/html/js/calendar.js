// Enhanced Calendar functionality with better error handling and debugging
class Calendar {
    constructor() {
        this.currentDate = new Date();
        this.currentView = 'month';
        this.events = [];
        this.selectedEventId = null;
        this.API_BASE = 'https://interparents-1.onrender.com/api';
        this.isLoading = false;
        this.debugMode = true; // Enable detailed logging
        
        console.log('🗓️ Calendar initialized with API_BASE:', this.API_BASE);
        this.init();
    }

    async init() {
        console.log('🔄 Initializing calendar...');
        this.bindEvents();
        this.showLoading(true);
        await this.loadEvents();
        this.showLoading(false);
        this.render();
        this.updateCurrentMonth();
        console.log('✅ Calendar initialization complete');
    }

    // Enhanced API call method with better error handling
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
            console.log('📤 Request options:', {
                method: mergedOptions.method || 'GET',
                headers: mergedOptions.headers,
                body: mergedOptions.body ? 'Present' : 'None'
            });
            
            const response = await fetch(url, mergedOptions);
            
            console.log(`📥 Response: ${response.status} ${response.statusText}`);
            console.log('Response headers:', [...response.headers.entries()]);
            
            if (!response.ok) {
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                
                try {
                    const errorData = await response.json();
                    console.error('❌ Error response data:', errorData);
                    errorMessage = errorData.message || errorMessage;
                } catch (parseError) {
                    console.error('❌ Could not parse error response as JSON');
                    const errorText = await response.text();
                    console.error('❌ Error response text:', errorText);
                }
                
                if (response.status === 401) {
                    console.warn('🔒 Authentication failed - redirecting to login');
                    this.redirectToLogin();
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

    // Enhanced event loading with better error handling
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
                
                if (this.debugMode && this.events.length > 0) {
                    console.log('📅 Sample event:', this.events[0]);
                }
            } else {
                throw new Error(data?.message || 'Failed to load events - invalid response format');
            }
            
        } catch (error) {
            console.error('❌ Error loading events from backend:', error);
            
            // More specific error messages
            if (error.message.includes('404')) {
                this.showMessage('Backend API not found. Please check if the server is running correctly.', 'error');
            } else if (error.message.includes('401')) {
                this.showMessage('Authentication required. Please login to view events.', 'error');
            } else if (error.message.includes('500')) {
                this.showMessage('Server error. Please try again later.', 'error');
            } else if (error.message.includes('Failed to fetch')) {
                this.showMessage('Cannot connect to server. Please check your internet connection.', 'error');
            } else {
                this.showMessage(`Failed to load events: ${error.message}`, 'error');
            }
            
            console.log('🔄 Loading sample events as fallback');
            this.events = this.loadSampleEvents();
        }
    }

    // Load sample events as fallback
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
                description: 'Weekly Bureau meeting to discuss ongoing initiatives and upcoming Board of Governors meeting.',
                organizer: 'INTERPARENTS Bureau',
                canEdit: false
            },
            {
                id: 'sample-2',
                title: 'Joint Teaching Committee Meeting',
                type: 'meeting',
                date: '2025-02-12',
                time: '09:00',
                location: 'Brussels, Belgium',
                description: 'JTC meeting with inspectors from all Member States and representatives of all stakeholders.',
                organizer: 'European Schools Office',
                canEdit: false
            },
            {
                id: 'sample-3',
                title: 'Parent Engagement Webinar',
                type: 'webinar',
                date: '2025-01-22',
                time: '16:00',
                location: 'Online',
                description: 'Webinar on improving parent-school communication strategies.',
                organizer: 'Parent Engagement Committee',
                canEdit: false
            }
        ];
    }

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
        
        // Get first day of month and calculate starting date
        const firstDay = new Date(year, month, 1);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());

        // Generate 42 days (6 weeks)
        for (let i = 0; i < 42; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            
            const dayElement = this.createDayElement(date, month);
            grid.appendChild(dayElement);
        }
    }

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

        // Add events for this day
        const dayEvents = this.getEventsForDate(date);
        dayEvents.forEach(event => {
            const eventElement = document.createElement('div');
            eventElement.className = `event-item ${event.type}`;
            eventElement.textContent = event.title;
            eventElement.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showEventDetails(event);
            });
            day.appendChild(eventElement);
        });

        // Add click handler to add events
        day.addEventListener('click', () => {
            this.openEventModal(date);
        });

        return day;
    }

    renderWeek() {
        document.getElementById('monthView').style.display = 'none';
        document.getElementById('weekView').style.display = 'block';
        document.getElementById('agendaView').style.display = 'none';

        // Get week start (Sunday)
        const weekStart = new Date(this.currentDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());

        // Render week days header
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

        // Render time slots and events
        this.renderWeekGrid(weekStart);
    }

    renderWeekGrid(weekStart) {
        const weekGrid = document.getElementById('weekGrid');
        weekGrid.innerHTML = '';

        // Time slots
        const timeSlots = document.createElement('div');
        timeSlots.className = 'week-time-slots';
        
        for (let hour = 0; hour < 24; hour++) {
            const timeSlot = document.createElement('div');
            timeSlot.className = 'week-time-slot';
            timeSlot.textContent = `${hour.toString().padStart(2, '0')}:00`;
            timeSlots.appendChild(timeSlot);
        }
        weekGrid.appendChild(timeSlots);

        // Events grid
        const eventsGrid = document.createElement('div');
        eventsGrid.className = 'week-events';
        
        for (let day = 0; day < 7; day++) {
            const date = new Date(weekStart);
            date.setDate(weekStart.getDate() + day);
            
            const dayEvents = document.createElement('div');
            dayEvents.className = 'week-day-events';
            dayEvents.style.height = '1440px'; // 24 hours * 60px
            
            // Add events for this day
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

        // Sort events by date
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

            agendaItem.innerHTML = `
                <div class="agenda-date">${dateStr} ${event.time ? `at ${event.time}` : ''}</div>
                <div class="agenda-title">${event.title}</div>
                <div class="agenda-details">
                    ${event.location ? `📍 ${event.location}` : ''}
                    ${event.organizer ? `👥 ${event.organizer}` : ''}
                </div>
            `;

            agendaItem.addEventListener('click', () => this.showEventDetails(event));
            agendaList.appendChild(agendaItem);
        });
    }

    getEventsForDate(date) {
        const dateStr = date.toISOString().split('T')[0];
        return this.events.filter(event => event.date === dateStr);
    }

    switchView(view) {
        this.currentView = view;
        
        // Update active button
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

    openEventModal(date = null) {
        const modal = document.getElementById('eventModal');
        const form = document.getElementById('eventForm');
        
        // Reset form
        form.reset();
        this.selectedEventId = null;
        
        // Set date if provided
        if (date) {
            document.getElementById('eventDate').value = date.toISOString().split('T')[0];
        }
        
        // Update modal title
        document.getElementById('modalTitle').textContent = 'Add Event';
        document.getElementById('deleteEventBtn').style.display = 'none';
        document.getElementById('saveEventBtn').textContent = 'Save Event';
        
        modal.classList.add('show');
    }

    showEventDetails(event) {
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
            ${event.description ? `
                <div class="event-detail-item">
                    <div class="event-detail-label">Description</div>
                    <div class="event-detail-value">${event.description}</div>
                </div>
            ` : ''}
        `;

        this.selectedEventId = event.id;
        
        // Show/hide edit button based on permissions
        const editBtn = document.getElementById('editEventBtn');
        if (event.canEdit !== false) {
            editBtn.style.display = 'inline-block';
        } else {
            editBtn.style.display = 'none';
        }
        
        modal.classList.add('show');
    }

    editCurrentEvent() {
        if (!this.selectedEventId) return;
        
        const event = this.events.find(e => e.id === this.selectedEventId);
        if (!event || event.canEdit === false) {
            this.showMessage('You do not have permission to edit this event.', 'error');
            return;
        }
        
        // Close details modal
        this.closeEventDetailsModal();
        
        // Open edit modal
        const modal = document.getElementById('eventModal');
        
        // Populate form with event data
        document.getElementById('eventTitle').value = event.title;
        document.getElementById('eventType').value = event.type;
        document.getElementById('eventDate').value = event.date;
        document.getElementById('eventTime').value = event.time || '';
        document.getElementById('eventLocation').value = event.location || '';
        document.getElementById('eventDescription').value = event.description || '';
        document.getElementById('eventOrganizer').value = event.organizer || '';
        
        // Update modal title and buttons
        document.getElementById('modalTitle').textContent = 'Edit Event';
        document.getElementById('deleteEventBtn').style.display = 'inline-block';
        document.getElementById('saveEventBtn').textContent = 'Update Event';
        
        // Set up delete button
        document.getElementById('deleteEventBtn').onclick = () => this.deleteEvent();
        
        modal.classList.add('show');
    }

    async saveEvent(e) {
        e.preventDefault();
        
        if (this.isLoading) return;
        
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

        console.log('💾 Saving event:', eventData);

        // Set loading state
        this.setModalLoadingState(true);

        try {
            let data;
            
            if (this.selectedEventId) {
                // Update existing event
                console.log(`✏️ Updating event: ${this.selectedEventId}`);
                data = await this.apiCall(`/events/${this.selectedEventId}`, {
                    method: 'PUT',
                    body: JSON.stringify(eventData)
                });
            } else {
                // Create new event
                console.log('➕ Creating new event');
                data = await this.apiCall('/events', {
                    method: 'POST',
                    body: JSON.stringify(eventData)
                });
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
        if (!this.selectedEventId) return;
        
        if (!confirm('Are you sure you want to delete this event?')) {
            return;
        }

        console.log(`🗑️ Deleting event: ${this.selectedEventId}`);
        this.setModalLoadingState(true);

        try {
            const data = await this.apiCall(`/events/${this.selectedEventId}`, {
                method: 'DELETE'
            });

            if (data && data.success) {
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
            saveBtn.textContent = this.selectedEventId ? 'Update Event' : 'Save Event';
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
        
        // Create or get message container
        let messageContainer = document.getElementById('calendarMessages');
        if (!messageContainer) {
            messageContainer = document.createElement('div');
            messageContainer.id = 'calendarMessages';
            messageContainer.style.cssText = 'position: fixed; top: 100px; right: 20px; z-index: 10000;';
            document.body.appendChild(messageContainer);
        }

        // Create message element
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

        // Remove message after 5 seconds
        setTimeout(() => {
            messageDiv.remove();
        }, 5000);
    }

    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    closeEventModal() {
        document.getElementById('eventModal').classList.remove('show');
        this.selectedEventId = null;
    }

    closeEventDetailsModal() {
        document.getElementById('eventDetailsModal').classList.remove('show');
        this.selectedEventId = null;
    }

    redirectToLogin() {
        sessionStorage.clear();
        window.location.href = 'login.html';
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