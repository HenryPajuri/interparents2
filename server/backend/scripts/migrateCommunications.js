const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const communicationSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    filename: {
        type: String,
        required: true,
        unique: true
    },
    originalName: {
        type: String,
        required: true
    },
    fileSize: {
        type: Number,
        required: true
    },
    category: {
        type: String,
        enum: ['JTC', 'BOG', 'Policy', 'Report', 'Memo', 'Other'],
        default: 'Other'
    },
    publishDate: {
        type: Date,
        default: Date.now
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const userSchema = new mongoose.Schema({
    email: String,
    name: String,
    role: String
});

const Communication = mongoose.model('Communication', communicationSchema);
const User = mongoose.model('User', userSchema);

const existingCommunications = [
    {
        title: "Joint Teaching Committee Report",
        description: "Comprehensive report on the February 2022 Joint Teaching Committee meeting covering curriculum updates and policy changes.",
        filename: "JTC-2022-FebIP-ReportforPAs.pdf",
        originalName: "JTC-2022-FebIP-ReportforPAs.pdf",
        category: "JTC",
        publishDate: new Date("2022-03-15")
    },
    {
        title: "Joint Teaching Committee Memo",
        description: "Important updates and decisions from the June 2020 Joint Teaching Committee meeting.",
        filename: "jtc-2020-jun.pdf",
        originalName: "jtc-2020-jun.pdf", 
        category: "JTC",
        publishDate: new Date("2020-07-06")
    },
    {
        title: "Board of Governors Report",
        description: "Key outcomes and decisions from the April 2020 Board of Governors meeting.",
        filename: "bog-2020-apr.pdf",
        originalName: "bog-2020-apr.pdf",
        category: "BOG",
        publishDate: new Date("2020-06-11")
    },
    {
        title: "Joint Teaching Committee Update",
        description: "Summary of discussions and decisions from the February 2020 Joint Teaching Committee.",
        filename: "jtc-2020-feb.pdf",
        originalName: "jtc-2020-feb.pdf",
        category: "JTC",
        publishDate: new Date("2020-05-25")
    },
    {
        title: "Board of Governors Memo",
        description: "Report covering the December 2019 Board of Governors meeting and its implications.",
        filename: "bog-2019-dec.pdf",
        originalName: "bog-2019-dec.pdf",
        category: "BOG",
        publishDate: new Date("2020-05-25")
    },
    {
        title: "Teaching Committee Report",
        description: "Detailed report from the October 2019 Joint Teaching Committee session.",
        filename: "jtc-2019-oct.pdf",
        originalName: "jtc-2019-oct.pdf",
        category: "JTC",
        publishDate: new Date("2020-05-25")
    }
];

function getFileSize(filename) {
    const pdfPath = path.join(__dirname, '..', 'pdf', filename);
    try {
        const stats = fs.statSync(pdfPath);
        return stats.size;
    } catch (error) {
        console.warn(`File ${filename} not found, using estimated size`);
        return Math.floor(Math.random() * (2000000 - 500000) + 500000); // 500KB to 2MB
    }
}

const migrateCommunications = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://mongodb:27017/interparents', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        
        console.log('Connected to MongoDB');

        const adminUser = await User.findOne({ role: 'admin' });
        if (!adminUser) {
            console.error('No admin user found. Please run the user seeding script first.');
            process.exit(1);
        }

        console.log(`Using admin user: ${adminUser.name} (${adminUser.email})`);

        const existingCount = await Communication.countDocuments();
        if (existingCount > 0) {
            console.log(`Found ${existingCount} existing communications`);
            const shouldClear = process.argv.includes('--force') || process.argv.includes('-f');
            
            if (!shouldClear) {
                console.log('Use --force or -f flag to clear existing communications and re-migrate');
                process.exit(0);
            }
            
            await Communication.deleteMany({});
            console.log('Cleared existing communications');
        }

        console.log('\n📄 Migrating Communications:');
        console.log('='.repeat(50));

        for (const commData of existingCommunications) {
            try {
                const fileSize = getFileSize(commData.filename);
                
                const communication = new Communication({
                    ...commData,
                    fileSize,
                    uploadedBy: adminUser._id,
                    createdAt: commData.publishDate // Use publish date as creation date
                });

                await communication.save();
                
                console.log(`✅ ${commData.title}`);
                console.log(`   File: ${commData.filename} (${Math.round(fileSize/1024)}KB)`);
                console.log(`   Category: ${commData.category}`);
                console.log(`   Published: ${commData.publishDate.toDateString()}\n`);
                
            } catch (error) {
                console.error(`❌ Failed to migrate: ${commData.title}`);
                console.error(`   Error: ${error.message}\n`);
            }
        }


        const finalCount = await Communication.countDocuments();
        console.log('='.repeat(50));
        console.log(`✅ Migration completed successfully!`);
        console.log(`📊 Total communications in database: ${finalCount}`);

        console.log('\n📋 Communications Summary:');
        const allComms = await Communication.find().populate('uploadedBy', 'name email').sort({ publishDate: -1 });
        
        allComms.forEach((comm, index) => {
            console.log(`${index + 1}. ${comm.title}`);
            console.log(`   Category: ${comm.category} | Size: ${Math.round(comm.fileSize/1024)}KB`);
            console.log(`   Published: ${comm.publishDate.toDateString()}`);
            console.log(`   Uploaded by: ${comm.uploadedBy.name}\n`);
        });

        console.log('🌐 Communications are now available via API at: /api/communications');
        console.log('📱 The homepage will now load communications dynamically');
        
    } catch (error) {
        console.error('Migration error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
        process.exit(0);
    }
};

console.log('🚀 Starting Communications Migration...\n');
migrateCommunications();