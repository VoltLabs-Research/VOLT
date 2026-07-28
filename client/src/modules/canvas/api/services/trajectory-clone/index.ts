import { createService, post } from '@/app/core/http/utils/create-service';
import type { CloneTrajectoryInput } from '@volt/contracts/modules/trajectory/http';
import type { CloneTrajectoryResponse } from '@volt/contracts/modules/trajectory/domain';


export type CloneTrajectoryOutput = CloneTrajectoryResponse;

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
