import Redis from 'ioredis';
import { createRedisClient } from '@/config/redis';

const CHANNEL = 'job_updates';
let pub: Redis | null = null;

export const initJobUpdatesPublisher = async () => {
    if (pub) return pub;
    pub = createRedisClient();  
    pub.on('error', (e) => console.error('[pub] redis error:', e));
    return pub;
};

export const publishJobUpdate = async (teamId: string, payload: any) => {
    if (!pub) await initJobUpdatesPublisher();
    await pub!.publish(CHANNEL, JSON.stringify({ teamId, payload }));
};
