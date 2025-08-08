// Calendar functionality for INTERPARENTS
class Calendar {
    constructor() {
        this.currentDate = new Date();
        this.currentView = 'month';
        this.events = this.loadSampleEvents(); // In production, this would load from backend
        this.selectedEventId = null;
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.render();
        this.updateCurrentMonth();
    }

    // Load sample events for demonstration
    loadSampleEvents() {
        const today = new Date();
        const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        
        return [
            {
                id: '1',
                title: 'INTERPARENTS Bureau Meeting',
                type: 'meeting',
                date: '2025-01-15',
                time: '14:00',
                location: 'Brussels, Belgium',
                description: 'Weekly Bureau meeting to discuss ongoing initiatives and upcoming Board of Governors meeting.',
                organizer: 'INTERPARENTS Bureau'
            },
            {
                id: '2',
                title: 'Joint Teaching Committee Meeting',
                type: 'meeting',
                date: '2025-02-12',
                time: '09:00',
                location: 'Brussels, Belgium',
                description: 'JTC meeting with inspectors from all Member States and representatives of all stakeholders.',
                organizer: 'European Schools Office'
            },
            {
                id: '3',
                title: 'Parent Engagement Webinar',
                type: 'webinar',
                date: '2025-01-22',
                time: '16:00',
                location: 'Online',
                description: 'Webinar on improving parent-school communication strategies.',
                organizer: 'Parent Engagement Committee'
            },
            {
                id: '4',
                title: 'Board of Governors Meeting',
                type: 'meeting',
                date: '2025-04-15',
                time: '10:00',
                location: 'Host Country TBD',
                description: 'BoG meeting with EU member states delegations and stakeholder representatives.',
                organizer: 'European Schools Office'
            },
            {
                id: '5',
                title: 'BAC Exams Period Starts',
                type: 'deadline',
                date: '2025-05-01',
                time: '',
                location: 'All European Schools',
                description: 'Beginning of BAC examination period across all European Schools.',
                organizer: 'European Schools Office'
            },
            {
                id: '6',
                title: 'Digital Learning Conference',
                type: 'conference',
                date: '2025-03-08',
                time: '09:00',
                location: 'Luxembourg',
                description: 'Annual conference on technology integration in European Schools.',
                organizer: 'Digital Learning Committee'
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
        const lastDay = new Date(year, month + 1, 0);
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

    navigatePrev() {
        if (this.currentView === 'month') {
            this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        } else if (this.currentView === 'week') {
            this.currentDate.setDate(this.currentDate.getDate() - 7);
        }
        this.render();
        this.updateCurrentMonth();
    }

    navigateNext() {
        if (this.currentView === 'month') {
            this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        } else if (this.currentView === 'week') {
            this.currentDate.setDate(this.currentDate.getDate() + 7);
        }
        this.render();
        this.updateCurrentMonth();
    }

    goToToday() {
        this.currentDate = new Date();
        this.render();
        this.updateCurrentMonth();
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
        modal.classList.add('show');
    }

    editCurrentEvent() {
        if (!this.selectedEventId) return;
        
        const event = this.events.find(e => e.id === this.selectedEventId);
        if (!event) return;
        
        // Close details modal
        this.closeEventDetailsModal();
        
        // Open edit modal
        const modal = document.getElementById('eventModal');
        const form = document.getElementById('eventForm');
        
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

    saveEvent(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const eventData = {
            id: this.selectedEventId || Date.now().toString(),
            title: formData.get('title'),
            type: formData.get('type'),
            date: formData.get('date'),
            time: formData.get('time'),
            location: formData.get('location'),
            description: formData.get('description'),
            organizer: formData.get('organizer')
        };

        if (this.selectedEventId) {
            // Update existing event
            const index = this.events.findIndex(e => e.id === this.selectedEventId);
            if (index !== -1) {
                this.events[index] = eventData;
            }
        } else {
            // Add new event
            this.events.push(eventData);
        }

        this.closeEventModal();
        this.render();
        
        // In production, you would save to backend here
        // await this.saveToBackend(eventData);
    }

    deleteEvent() {
        if (!this.selectedEventId) return;
        
        if (confirm('Are you sure you want to delete this event?')) {
            this.events = this.events.filter(e => e.id !== this.selectedEventId);
            this.closeEventModal();
            this.render();
            
            // In production, you would delete from backend here
            // await this.deleteFromBackend(this.selectedEventId);
        }
    }

    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    closeEventModal() {
        document.getElementById('eventModal').classList.remove('show');
    }

    closeEventDetailsModal() {
        document.getElementById('eventDetailsModal').classList.remove('show');
    }
}

// Global functions for modal closing
function closeEventModal() {
    document.getElementById('eventModal').classList.remove('show');
}

function closeEventDetailsModal() {
    document.getElementById('eventDetailsModal').classList.remove('show');
}

// Initialize calendar when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.calendar = new Calendar();
    
    // Close modals when clicking outside
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            e.target.classList.remove('show');
        }
    });
});