const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    role: {
        type: String,
        enum: ['member', 'admin', 'executive'],
        default: 'member'
    },
    school: {
        type: String,
        required: true
    },
    position: {
        type: String,
        default: 'Parent Representative'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

const User = mongoose.model('User', userSchema);

const initialUsers = [
    {
        email: 'admin@interparents.eu',
        password: 'admin123',
        name: 'System Administrator',
        role: 'admin',
        school: 'INTERPARENTS Central',
        position: 'System Administrator'
    },
    {
        email: 'president@interparents.eu',
        password: 'president123',
        name: 'Dr. Maria González',
        role: 'executive',
        school: 'Brussels I (Uccle)',
        position: 'President'
    },
    {
        email: 'vicepresident@interparents.eu',
        password: 'vicepresident123',
        name: 'Klaus Müller',
        role: 'executive',
        school: 'Frankfurt',
        position: 'Vice President'
    },
    {
        email: 'secretary@interparents.eu',
        password: 'secretary123',
        name: 'Sophie Dubois',
        role: 'executive',
        school: 'Brussels II (Woluwe)',
        position: 'Secretary General'
    },
    {
        email: 'treasurer@interparents.eu',
        password: 'treasurer123',
        name: 'Anna Rossi',
        role: 'executive',
        school: 'Varese',
        position: 'Treasurer'
    },
    {
        email: 'communications@interparents.eu',
        password: 'communications123',
        name: 'Emma Thompson',
        role: 'executive',
        school: 'Bergen',
        position: 'Communications Director'
    },
    {
        email: 'policy@interparents.eu',
        password: 'policy123',
        name: 'Jean-Pierre Laurent',
        role: 'executive',
        school: 'Luxembourg I',
        position: 'Policy Coordinator'
    },
    {
        email: 'brussels1@interparents.eu',
        password: 'member123',
        name: 'Catherine Martin',
        role: 'member',
        school: 'Brussels I (Uccle)',
        position: 'Parent Representative'
    },
    {
        email: 'brussels2@interparents.eu',
        password: 'member123',
        name: 'Pierre Dubois',
        role: 'member',
        school: 'Brussels II (Woluwe)',
        position: 'Parent Representative'
    },
    {
        email: 'frankfurt@interparents.eu',
        password: 'member123',
        name: 'Hans Schmidt',
        role: 'member',
        school: 'Frankfurt',
        position: 'Parent Representative'
    },
    {
        email: 'munich@interparents.eu',
        password: 'member123',
        name: 'Dr. Petra Schmidt',
        role: 'member',
        school: 'Munich',
        position: 'Academic Standards Committee Chair'
    },
    {
        email: 'alicante@interparents.eu',
        password: 'member123',
        name: 'Marco Silva',
        role: 'member',
        school: 'Alicante',
        position: 'Student Welfare Committee Chair'
    },
    {
        email: 'bergen@interparents.eu',
        password: 'member123',
        name: 'Lisa van der Berg',
        role: 'member',
        school: 'Bergen',
        position: 'Digital Learning Committee Chair'
    }
];

const seedUsers = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://mongodb:27017/interparents', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        
        console.log('Connected to MongoDB');

        await User.deleteMany({});
        console.log('Cleared existing users');

        for (const userData of initialUsers) {
            const user = new User(userData);
            await user.save();
            console.log(`Created user: ${userData.email} (${userData.role})`);
        }

        console.log('\n✅ User seeding completed successfully!');
        console.log('\n📋 Login Credentials:');
        console.log('='.repeat(50));
        
        const adminUsers = initialUsers.filter(u => u.role === 'admin');
        const executiveUsers = initialUsers.filter(u => u.role === 'executive');
        const memberUsers = initialUsers.filter(u => u.role === 'member');

        console.log('\n👑 ADMIN ACCOUNTS:');
        adminUsers.forEach(user => {
            console.log(`   Email: ${user.email}`);
            console.log(`   Password: ${user.password}`);
            console.log(`   Role: ${user.role.toUpperCase()}\n`);
        });

        console.log('🏛️  EXECUTIVE ACCOUNTS:');
        executiveUsers.forEach(user => {
            console.log(`   Email: ${user.email}`);
            console.log(`   Password: ${user.password}`);
            console.log(`   Position: ${user.position}\n`);
        });

        console.log('👥 MEMBER ACCOUNTS:');
        memberUsers.forEach(user => {
            console.log(`   Email: ${user.email}`);
            console.log(`   Password: ${user.password}`);
            console.log(`   School: ${user.school}\n`);
        });

        console.log('='.repeat(50));
        console.log('🔐 All passwords are temporary and should be changed after first login');
        console.log('🌐 Access the login page at: http://localhost:8080/html/login.html');
        
    } catch (error) {
        console.error('Error seeding users:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
        process.exit(0);
    }
};

seedUsers();