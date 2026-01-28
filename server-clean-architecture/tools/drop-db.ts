import 'dotenv/config';
import mongoose from 'mongoose';

const dropDatabase = async (): Promise<void> => {
    const {
        NODE_ENV,
        PRODUCTION_DATABASE,
        DEVELOPMENT_DATABASE,
        MONGO_URI
    } = process.env;

    if (!MONGO_URI) {
        console.error('[MongoDB] MONGO_URI not in .env');
        process.exit(1);
    }

    const databaseName = NODE_ENV === 'production' ? PRODUCTION_DATABASE : DEVELOPMENT_DATABASE;

    if (!databaseName) {
        console.error('[MongoDB] Database name not configured (PRODUCTION_DATABASE or DEVELOPMENT_DATABASE)');
        process.exit(1);
    }

    const uri = `${MONGO_URI}/${databaseName}`;

    console.log(`[MongoDB] Connecting to ${databaseName}...`);

    await mongoose.connect(uri, { authSource: 'admin' });

    console.log(`[MongoDB] Connected. Dropping database: ${databaseName}...`);

    await mongoose.connection.dropDatabase();

    console.log(`[MongoDB] Database ${databaseName} dropped successfully.`);

    await mongoose.disconnect();
};

dropDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('[MongoDB] Error:', err);
        process.exit(1);
    });
