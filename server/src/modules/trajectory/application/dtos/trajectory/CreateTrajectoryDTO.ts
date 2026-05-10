import { TrajectoryProps } from '@modules/trajectory/domain/entities/trajectory/Trajectory';

export interface TrajectoryUploadFile {
    path: string;
    size: number;
    originalname?: string;
    mimetype?: string;
}

export interface CreateTrajectoryInputDTO {
    name: string;
    files: TrajectoryUploadFile[];
    userId: string;
    teamId: string;
    teamClusterId?: string;
    folderId?: string | null;
}

export interface CreateTrajectoryOutputDTO extends TrajectoryProps {
    _id: string;
}
