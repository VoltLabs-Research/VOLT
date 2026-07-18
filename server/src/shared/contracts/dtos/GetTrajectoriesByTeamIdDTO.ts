
import type { TrajectoryProps } from '@shared/contracts/types/Trajectory';

export interface TrajectoryPersistedDTO extends Omit<TrajectoryProps, 'status'> {
    _id: string;
    status: string;
}
