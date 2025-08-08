// server/backend/scripts/seedEvents.js
const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://mongodb:27017/interparents', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('MongoDB connected successfully');
    } catch (error) {
        console.error('MongoDB connection failed:', error);
        process.exit(1);
    }
};

// Event Schema (duplicated from server.js for this script)
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
        required: false
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
        required: false
    },
    isPublic: {
        type: Boolean,
        default: true
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
    }]
}, {
    timestamps: true
});

eventSchema.virtual('formattedDate').get(function() {
    return this.date.toISOString().split('T')[0];
});

// User Schema (simplified for this script)
const userSchema = new mongoose.Schema({
    email: String,
    name: String,
    role: String,
    school: String
});

const Event = mongoose.model('Event', eventSchema);
const User = mongoose.model('User', userSchema);

const seedEvents = async () => {
    try {
        await connectDB();

        // Find an admin user to assign as creator
        let adminUser = await User.findOne({ role: { $in: ['admin', 'executive'] } });
        
        if (!adminUser) {
            console.log('No admin user found. Creating a default admin user...');
            adminUser = new User({
                email: 'admin@interparents.eu',
                name: 'System Admin',
                role: 'admin',
                school: 'INTERPARENTS Central'
            });
            await adminUser.save();
        }

        // Clear existing events (optional)
        const existingEventCount = await Event.countDocuments();
        if (existingEventCount > 0) {
            console.log(`Found ${existingEventCount} existing events. Clearing...`);
            await Event.deleteMany({});
        }

        // Sample events data
        const sampleEvents = [
            {
                title: 'INTERPARENTS Bureau Meeting',
                type: 'meeting',
                date: new Date('2025-01-15'),
                time: '14:00',
                location: 'Brussels, Belgium',
                description: 'Weekly Bureau meeting to discuss ongoing initiatives and upcoming Board of Governors meeting. Agenda includes review of recent communications, preparation for JTC meeting, and strategic planning for Q1 2025.',
                organizer: 'INTERPARENTS Bureau',
                createdBy: adminUser._id,
                school: 'INTERPARENTS Central',
                isPublic: true
            },
            {
                title: 'Joint Teaching Committee Meeting',
                type: 'meeting',
                date: new Date('2025-02-12'),
                time: '09:00',
                location: 'Brussels, Belgium',
                description: 'JTC meeting with inspectors from all Member States and representatives of all stakeholders. Topics include curriculum updates, assessment policies, and educational standards review.',
                organizer: 'European Schools Office',
                createdBy: adminUser._id,
                school: 'INTERPARENTS Central',
                isPublic: true
            },
            {
                title: 'Parent Engagement Webinar',
                type: 'webinar',
                date: new Date('2025-01-22'),
                time: '16:00',
                location: 'Online (Zoom)',
                description: 'Interactive webinar on improving parent-school communication strategies. Featuring best practices from various European Schools and Q&A session with education experts.',
                organizer: 'Parent Engagement Committee',
                createdBy: adminUser._id,
                school: 'INTERPARENTS Central',
                isPublic: true
            },
            {
                title: 'Board of Governors Meeting',
                type: 'meeting',
                date: new Date('2025-04-15'),
                time: '10:00',
                location: 'Host Country TBD',
                description: 'Semi-annual BoG meeting with EU member states delegations and stakeholder representatives. Key decisions on budget, policy changes, and strategic initiatives.',
                organizer: 'European Schools Office',
                createdBy: adminUser._id,
                school: 'INTERPARENTS Central',
                isPublic: true
            },
            {
                title: 'BAC Exams Period Starts',
                type: 'deadline',
                date: new Date('2025-05-01'),
                time: '',
                location: 'All European Schools',
                description: 'Beginning of BAC examination period across all European Schools. Final preparations and support resources available for students and families.',
                organizer: 'European Schools Office',
                createdBy: adminUser._id,
                school: 'INTERPARENTS Central',
                isPublic: true
            },
            {
                title: 'Digital Learning Conference',
                type: 'conference',
                date: new Date('2025-03-08'),
                time: '09:00',
                location: 'Luxembourg Convention Center',
                description: 'Annual two-day conference on technology integration in European Schools. Keynote speakers, workshops, and networking opportunities for educators and parents.',
                organizer: 'Digital Learning Committee',
                createdBy: adminUser._id,
                school: 'INTERPARENTS Central',
                isPublic: true
            },
            {
                title: 'INTERPARENTS Annual General Meeting',
                type: 'meeting',
                date: new Date('2025-02-08'),
                time: '10:00',
                location: 'Brussels, Belgium',
                description: 'Annual General Meeting on the second morning of the INTERPARENTS pre-JTC meeting. Election of officers, annual report, and strategic planning for the year ahead.',
                organizer: 'INTERPARENTS Bureau',
                createdBy: adminUser._id,
                school: 'INTERPARENTS Central',
                isPublic: true
            },
            {
                title: 'Student Well-being Workshop',
                type: 'webinar',
                date: new Date('2025-01-29'),
                time: '15:00',
                location: 'Online (Teams)',
                description: 'Workshop focused on student mental health and well-being initiatives across European Schools. Sharing best practices and developing support frameworks.',
                organizer: 'Well-being IPWG',
                createdBy: adminUser._id,
                school: 'INTERPARENTS Central',
                isPublic: true
            },
            {
                title: 'Budget Committee Meeting',
                type: 'meeting',
                date: new Date('2025-03-15'),
                time: '14:00',
                location: 'Brussels, Belgium',
                description: 'Quarterly budget review and financial planning session. Analysis of expenditures, revenue projections, and resource allocation for upcoming initiatives.',
                organizer: 'Budgetary Committee',
                createdBy: adminUser._id,
                school: 'INTERPARENTS Central',
                isPublic: false // Internal meeting
            },
            {
                title: 'New School Year Preparation',
                type: 'deadline',
                date: new Date('2025-08-15'),
                time: '',
                location: 'All European Schools',
                description: 'Deadline for completion of new school year preparations including curriculum updates, staff assignments, and facility readiness across all European Schools.',
                organizer: 'European Schools Office',
                createdBy: adminUser._id,
                school: 'INTERPARENTS Central',
                isPublic: true
            },
            {
                title: 'Sustainability Initiative Planning',
                type: 'webinar',
                date: new Date('2025-02-26'),
                time: '13:00',
                location: 'Online (Teams)',
                description: 'Collaborative session on implementing sustainability initiatives across European Schools. Focus on green energy, waste reduction, and environmental education.',
                organizer: 'Sustainability IPWG',
                createdBy: adminUser._id,
                school: 'INTERPARENTS Central',
                isPublic: true
            },
            {
                title: 'Educational Technology Summit',
                type: 'conference',
                date: new Date('2025-05-20'),
                time: '09:00',
                location: 'Munich, Germany',
                description: 'Three-day summit on the future of educational technology in European Schools. International speakers, innovation showcases, and hands-on workshops.',
                organizer: 'IT PEDA IPWG',
                createdBy: adminUser._id,
                school: 'INTERPARENTS Central',
                isPublic: true
            }
        ];

        // Insert events
        const createdEvents = await Event.insertMany(sampleEvents);
        console.log(`✅ Successfully created ${createdEvents.length} sample events:`);
        
        createdEvents.forEach(event => {
            console.log(`   - ${event.title} (${event.type}) - ${event.date.toDateString()}`);
        });

        console.log('\n🎉 Database seeded successfully!');
        console.log('You can now use the calendar with real data from MongoDB.');
        console.log(`\nAdmin user: ${adminUser.email} (${adminUser.name})`);

    } catch (error) {
        console.error('❌ Error seeding database:', error);
    } finally {
        await mongoose.connection.close();
        console.log('Database connection closed');
    }
};

// Run the seed function
if (require.main === module) {
    seedEvents();
}

module.exports = seedEvents;