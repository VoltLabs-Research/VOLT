import type { Trajectory } from '@/types/models';
import type { TimestepData } from '@/types/stores/editor/timesteps';
import { TimestepDataService } from '../../domain/services/TimestepDataService';

export class ComputeTimestepDataUseCase {
    private readonly service = new TimestepDataService();

    execute(trajectory: Trajectory | null): TimestepData {
        if (!trajectory?.frames || trajectory.frames.length === 0) {
            return this.service.createTimestepData([]);
        }

        return this.service.buildFromFrames(trajectory.frames);
    }
}
