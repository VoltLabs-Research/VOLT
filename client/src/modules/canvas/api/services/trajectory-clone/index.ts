import { createService, post } from '@/app/core/http/utilities/create-service';

export interface CloneTrajectoryInput {
    sourceTrajectoryId: string;
    targetClusterId?: string;
}

export interface CloneTrajectoryOutput {
    trajectoryId: string;
    jobId: string;
    sourceTrajectoryId: string;
    destinationClusterId: string;
}

export default createService({
    clients: {
        default: {
            basePath: '/trajectories',
            useRBAC: true
        }
    }
}, {
    clone: post<CloneTrajectoryInput, CloneTrajectoryOutput>('/clones')
});
