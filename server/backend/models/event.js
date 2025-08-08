// models/Event.js
const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        required: true,
        enum: ['meeting', 'webinar', 'conference', 'deadline'],
        default: 'meeting'
    },
    date: {
        type: Date,
        required: true
    },
    time: {
        type: String,
        required: false // Optional field for time (HH:MM format)
    },
    location: {
        type: String,
        required: false,
        trim: true
    },
    description: {
        type: String,
        required: false,
        trim: true
    },
    organizer: {
        type: String,
        required: false,
        trim: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    school: {
        type: String,
        required: false // School associated with the event
    },
    isPublic: {
        type: Boolean,
        default: true // Whether the event is visible to all users
    },
    attendees: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        status: {
            type: String,
            enum: ['attending', 'not_attending', 'maybe'],
            default: 'attending'
        }
    }],
    attachments: [{
        filename: String,
        originalName: String,
        path: String,
        uploadDate: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true // Adds createdAt and updatedAt fields
});

// Index for efficient querying by date
eventSchema.index({ date: 1 });
eventSchema.index({ type: 1 });
eventSchema.index({ createdBy: 1 });

// Virtual for formatted date
eventSchema.virtual('formattedDate').get(function() {
    return this.date.toISOString().split('T')[0];
});

// Method to check if user can edit this event
eventSchema.methods.canEdit = function(userId, userRole) {
    // Admins and executives can edit any event
    if (userRole === 'admin' || userRole === 'executive') {
        return true;
    }
    // Users can edit their own events
    return this.createdBy.toString() === userId.toString();
};

// Static method to get events for a date range
eventSchema.statics.getEventsInRange = function(startDate, endDate, userRole = 'member') {
    const query = {
        date: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
        }
    };

    // Non-admin users only see public events
    if (userRole === 'member') {
        query.isPublic = true;
    }

    return this.find(query)
        .populate('createdBy', 'name email school')
        .sort({ date: 1, time: 1 });
};

module.exports = mongoose.model('Event', eventSchema);