import { Queue } from 'bullmq';
const queue = new Queue('trajectory_glb_conversion', {
    connection: { host: 'compute-redis', port: 6379, username: process.env.REDIS_USERNAME!, password: process.env.REDIS_PASSWORD! }
});
const frames = [1500000, 2625000];
(async () => {
    for (const ts of frames) {
        const jobId = `trajectory-glb:69e8298ae609eeaa761b0d88:${ts}`;
        await queue.remove(jobId).catch(() => {});
        await queue.add('trajectory_glb_conversion', {
            jobId, teamId: '69e8241a6ff90b18c45e25b5',
            trajectoryId: '69e8298ae609eeaa761b0d88', timestep: ts,
            objectKey: `trajectory-69e8298ae609eeaa761b0d88/timestep-${ts}.dump.zst`,
            ownerClusterId: '69e8241a6ff90b18c45e25cd', status: 'queued',
            queueType: 'trajectory_glb_conversion', metadata: { trajectoryId: '69e8298ae609eeaa761b0d88', timestep: ts },
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        }, { jobId, attempts: 1, removeOnComplete: 100, removeOnFail: 100 });
    }
    await queue.close();
    console.log('enqueued');
})();
