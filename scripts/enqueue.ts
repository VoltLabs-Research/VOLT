import { Queue } from 'bullmq';

const TEAM_ID = '69e8241a6ff90b18c45e25b5';
const TRAJECTORY_ID = '69e8298ae609eeaa761b0d88';
const OWNER_CLUSTER_ID = '69e8241a6ff90b18c45e25cd';

const timesteps = process.argv.slice(2).map(Number).filter((n) => Number.isFinite(n));
if (timesteps.length === 0) timesteps.push(75000);

const queue = new Queue('trajectory_glb_conversion', {
    connection: {
        host: 'compute-redis',
        port: 6379,
        username: process.env.REDIS_USERNAME!,
        password: process.env.REDIS_PASSWORD!
    }
});

(async () => {
    const now = new Date().toISOString();
    for (const timestep of timesteps) {
        const jobId = `trajectory-glb:${TRAJECTORY_ID}:${timestep}`;
        await queue.remove(jobId).catch(() => {});
        await queue.add('trajectory_glb_conversion', {
            jobId,
            teamId: TEAM_ID,
            trajectoryId: TRAJECTORY_ID,
            timestep,
            objectKey: `trajectory-${TRAJECTORY_ID}/timestep-${timestep}.dump.zst`,
            ownerClusterId: OWNER_CLUSTER_ID,
            status: 'queued',
            queueType: 'trajectory_glb_conversion',
            metadata: { trajectoryId: TRAJECTORY_ID, timestep },
            createdAt: now,
            updatedAt: now
        }, { jobId, attempts: 1, removeOnComplete: 100, removeOnFail: 100 });
        console.log(`Enqueued ${jobId}`);
    }
    await queue.close();
})().catch((e) => { console.error(e); process.exit(1); });
