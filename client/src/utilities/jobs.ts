import type { Job } from '@/types/jobs';

export const sortJobsByTimestamp = (jobs: Job[]) => {
    return jobs.sort((a, b) => {
        if(!a.timestamp && !b.timestamp) return 0;
        if(!a.timestamp) return 1;
        if(!b.timestamp) return -1;
        
        const timestampA = new Date(a.timestamp);
        const timestampB = new Date(b.timestamp);
        
        return timestampB.getTime() - timestampA.getTime();  
    });
};