import { createService, post } from '@/app/core/http/utilities/create-service';
import type { CloneTrajectoryInput, CloneTrajectoryOutput } from '@/modules/canvas/api/dtos/clone';

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
