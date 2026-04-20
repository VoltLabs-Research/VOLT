import { post } from '@/app/core/http/utilities/create-service';
import { defineServiceModule } from '@/shared/api/service-module';
import type { CloneTrajectoryInput, CloneTrajectoryOutput } from '@/modules/canvas/api/dtos/clone';

export default defineServiceModule({
    clients: {
        default: {
            basePath: '/trajectories',
            useRBAC: true
        }
    },
    endpoints: {
        clone: post<CloneTrajectoryInput, CloneTrajectoryOutput>('/clones')
    }
});
