import { Queue } from 'bullmq';

const queue = new Queue('trajectory_glb_conversion', {
    connection: {
        host: 'compute-redis',
        port: 6379,
        username: process.env.REDIS_USERNAME!,
        password: process.env.REDIS_PASSWORD!
    }
});

async function main() {
    const jobId = `trajectory-glb:69e8298ae609eeaa761b0d88:75000`;
    await queue.remove(jobId).catch(() => {});
    await queue.add('trajectory_glb_conversion', {
        jobId,
        teamId: '69e8241a6ff90b18c45e25b5',
        trajectoryId: '69e8298ae609eeaa761b0d88',
        timestep: 75000,
        objectKey: 'trajectory-69e8298ae609eeaa761b0d88/timestep-75000.dump.zst',
        ownerClusterId: '69e8241a6ff90b18c45e25cd',
        status: 'queued',
        queueType: 'trajectory_glb_conversion',
        metadata: { trajectoryId: '69e8298ae609eeaa761b0d88', timestep: 75000 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    }, {
        jobId,
        attempts: 1,
        removeOnComplete: 100,
        removeOnFail: 100
    });
    console.log(`Enqueued job ${jobId}`);
    await queue.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
