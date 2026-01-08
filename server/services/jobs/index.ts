export { JobManager, JobManagerConfig, JobContext } from './job-manager';
export { jobScanner, ScanOptions } from './job-scanner';
export { lockManager } from './lock-manager';

import { JobManager } from './job-manager';
import { Queues } from '@/constants/queues';
import tempFileManager from '@/services/temp-file-manager';

export const trajectoryJobManager = new JobManager({
    entityType: 'trajectory',
    entityField: 'trajectoryId',
    queues: [
        Queues.TRAJECTORY_PROCESSING,
        Queues.ANALYSIS_PROCESSING,
        Queues.RASTERIZER,
        Queues.CLOUD_UPLOAD,
    ],
    onCleanup: async (entityId) => {
        const { Analysis } = await import('@/models');
        if (await Analysis.exists({ trajectory: entityId, finishedAt: { $exists: false } })) {
            throw new Error('Active analyses exist');
        }

        // Dumps should persist after trajectory processing so plugins can run on them.
        // Auto-deletion here is causing Plugin::ForEach::NoItems errors because the data is gone
        // before the user can even start an analysis.
        // const DumpStorage = (await import('@/services/trajectory/dump-storage')).default;
        // await DumpStorage.deleteDumps(entityId);
    },
});

export default trajectoryJobManager;
