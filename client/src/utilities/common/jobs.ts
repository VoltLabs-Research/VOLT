import type { Job } from '@/types/jobs';

export const sortJobsByTimestamp = (jobs: Job[]) => {
    return jobs.sort((a, b) => {
        if (!a.timestamp && !b.timestamp) return 0;
        if (!a.timestamp) return 1;
        if (!b.timestamp) return -1;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
};
