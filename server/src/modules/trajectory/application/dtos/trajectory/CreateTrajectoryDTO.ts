import { TrajectoryProps } from '@modules/trajectory/domain/entities/trajectory/Trajectory';

import type { TrajectoryUploadFile } from '@modules/trajectory/domain/port/trajectory/ITrajectoryBackgroundProcessor';

export interface CreateTrajectoryInputDTO {
    name: string;
    files: TrajectoryUploadFile[];
    userId: string;
    teamId: string;
    teamClusterId?: string;
    folderId?: string | null;
};

export interface CreateTrajectoryOutputDTO extends TrajectoryProps {
    _id: string;
};
