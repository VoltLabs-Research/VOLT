import 'dotenv/config';
import Redis from 'ioredis';

const dropRedis = async (): Promise<void> => {
    const host = process.env.REDIS_HOST || 'localhost';
    const port = parseInt(process.env.REDIS_PORT || '6379');
    const password = process.env.REDIS_PASSWORD || undefined;
    const db = parseInt(process.env.REDIS_DB || '0');

    console.log(`[Redis] Connecting to ${host}:${port} (db: ${db})...`);

    const redis = new Redis({ host, port, password, db });

    redis.on('error', (err) => {
        console.error('[Redis] Connection error:', err);
        process.exit(1);
    });

    await redis.flushall();
    console.log('[Redis] All databases flushed successfully.');

    await redis.quit();
};

dropRedis()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('[Redis] Error:', err);
        process.exit(1);
    });
