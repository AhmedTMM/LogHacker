import mongoose from 'mongoose';
import Aircraft from '../lib/models/Aircraft';
import Pilot from '../lib/models/Pilot';
import Flight from '../lib/models/Flight';

// Load .env file manually for scripts
import { config } from 'dotenv';
config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/aviation-intelligence';

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await Aircraft.deleteMany({});
    await Pilot.deleteMany({});
    await Flight.deleteMany({});
    console.log('Cleared existing data');

    // Create sample aircraft
    const aircraft1 = await Aircraft.create({
      tailNumber: 'N12345',
      model: '172S',
      serial: '172S-10234',
      manufacturer: 'Cessna',
      year: 2019,
      imageUrl: 'https://images.unsplash.com/photo-1474302770737-173ee21bab63?w=800',
      maintenanceDates: {
        annual: new Date('2024-08-15'),
        transponder: new Date('2024-02-01'),
        staticSystem: new Date('2024-02-01'),
      },
      currentHours: {
        hobbs: 1245.6,
        tach: 1198.2,
      },
      owner: {
        name: 'Blue Sky Aviation',
        email: 'ops@blueskyaviation.com',
      },
    });

    const aircraft2 = await Aircraft.create({
      tailNumber: 'N67890',
      model: 'PA-28-181',
      serial: '28-8290001',
      manufacturer: 'Piper',
      year: 2015,
      maintenanceDates: {
        annual: new Date('2025-01-20'), // Due soon
        transponder: new Date('2023-06-01'), // Overdue
        staticSystem: new Date('2024-01-15'),
      },
      currentHours: {
        hobbs: 3456.8,
        tach: 3201.4,
      },
    });

    const aircraft3 = await Aircraft.create({
      tailNumber: 'N24680',
      model: 'SR22',
      serial: '5001',
      manufacturer: 'Cirrus',
      year: 2021,
      imageUrl: 'https://images.unsplash.com/photo-1559128010-7c1ad6e1b6a5?w=800',
      maintenanceDates: {
        annual: new Date('2025-03-01'),
        transponder: new Date('2024-09-15'),
        staticSystem: new Date('2024-09-15'),
      },
      currentHours: {
        hobbs: 456.2,
        tach: 432.1,
      },
    });

    console.log('Created sample aircraft');

    // Create sample pilots
    const pilot1 = await Pilot.create({
      name: 'John Smith',
      email: 'john.smith@example.com',
      certificates: {
        type: 'PPL',
        instrumentRated: true,
        multiEngineRated: false,
      },
      endorsements: [
        {
          type: 'High Performance',
          date: new Date('2023-05-10'),
          instructor: 'CFI Mike Johnson',
        },
        {
          type: 'Complex',
          date: new Date('2023-06-15'),
          instructor: 'CFI Mike Johnson',
        },
      ],
      experience: {
        totalHours: 245,
        picHours: 180,
        nightHours: 35,
        ifrHours: 52,
        last90DaysHours: 18,
        last30DaysHours: 6,
      },
      medicalExpiration: new Date('2025-09-30'),
      flightReviewExpiration: new Date('2025-11-15'),
    });

    const pilot2 = await Pilot.create({
      name: 'Sarah Johnson',
      email: 'sarah.j@example.com',
      certificates: {
        type: 'CPL',
        instrumentRated: true,
        multiEngineRated: true,
      },
      endorsements: [
        {
          type: 'High Performance',
          date: new Date('2022-03-20'),
          instructor: 'CFI Tom Wilson',
        },
        {
          type: 'Complex',
          date: new Date('2022-03-20'),
          instructor: 'CFI Tom Wilson',
        },
        {
          type: 'High Altitude',
          date: new Date('2023-01-10'),
          instructor: 'CFI Tom Wilson',
        },
      ],
      experience: {
        totalHours: 1250,
        picHours: 980,
        nightHours: 156,
        ifrHours: 320,
        last90DaysHours: 45,
        last30DaysHours: 15,
      },
      medicalExpiration: new Date('2025-06-15'),
      flightReviewExpiration: new Date('2026-02-28'),
    });

    const pilot3 = await Pilot.create({
      name: 'Mike Davis',
      email: 'mike.d@example.com',
      certificates: {
        type: 'PPL',
        instrumentRated: false,
        multiEngineRated: false,
      },
      endorsements: [],
      experience: {
        totalHours: 78,
        picHours: 45,
        nightHours: 8,
        ifrHours: 0,
        last90DaysHours: 2, // Low recent experience
        last30DaysHours: 0,
      },
      medicalExpiration: new Date('2025-03-01'), // Expiring soon
      flightReviewExpiration: new Date('2025-04-15'),
    });

    console.log('Created sample pilots');

    // Create sample flights
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    nextWeek.setHours(14, 30, 0, 0);

    await Flight.create({
      pilot: pilot1._id,
      aircraft: aircraft1._id,
      scheduledDate: tomorrow,
      departureAirport: 'KJFK',
      arrivalAirport: 'KBOS',
      status: 'planned',
      overallStatus: 'no-go',
      notes: 'Business trip to Boston',
    });

    await Flight.create({
      pilot: pilot2._id,
      aircraft: aircraft3._id,
      scheduledDate: nextWeek,
      departureAirport: 'KLAX',
      status: 'planned',
      overallStatus: 'no-go',
      notes: 'Local practice flight',
    });

    await Flight.create({
      pilot: pilot3._id,
      aircraft: aircraft2._id,
      scheduledDate: new Date(tomorrow.getTime() + 2 * 24 * 60 * 60 * 1000),
      departureAirport: 'KSFO',
      arrivalAirport: 'KOAK',
      status: 'planned',
      overallStatus: 'no-go',
      notes: 'Currency flight with instructor',
    });

    console.log('Created sample flights');

    console.log('\n=== Seed Data Summary ===');
    console.log(`Aircraft: ${await Aircraft.countDocuments()}`);
    console.log(`Pilots: ${await Pilot.countDocuments()}`);
    console.log(`Flights: ${await Flight.countDocuments()}`);
    console.log('========================\n');

    console.log('Seed completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
}

seed();
