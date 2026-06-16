
export type PersistenceId = { toString(): string };

export type TrajectoryUploadSessionStatus = 'pending' | 'committed' | 'cancelled' | 'failed';

export interface TrajectoryUploadSessionPartProps {
    partNumber: number;
    objectKey: string;
    offset: number;
    size: number;
}

export interface TrajectoryUploadSessionFileProps {
    index: number;
    originalName: string;
    contentType?: string;
    size: number;
    finalObjectKey: string;
    parts: TrajectoryUploadSessionPartProps[];
}

export interface TrajectoryUploadSession {
    id: string;
    team: PersistenceId;
    user: PersistenceId;
    ownerClusterId: PersistenceId;
    bucket: string;
    resourceKind: string;
    resourceId: PersistenceId;
    status: TrajectoryUploadSessionStatus;
    files: TrajectoryUploadSessionFileProps[];
    expiresAt: Date;
    committedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateTrajectoryUploadSessionInput {
    team: string;
    user: string;
    ownerClusterId: string;
    bucket: string;
    resourceKind: string;
    resourceId: string;
    files: TrajectoryUploadSessionFileProps[];
    expiresAt: Date;
}
