
import type { TrajectoryProps } from '@shared/contracts/types/Trajectory';

export interface TrajectoryRecord extends Omit<TrajectoryProps, 'status'> {
    _id: string;
    status: string;
}
