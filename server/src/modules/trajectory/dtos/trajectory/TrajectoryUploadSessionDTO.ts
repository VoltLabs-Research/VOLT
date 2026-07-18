import type { CreateTrajectoryOutputDTO } from './CreateTrajectoryDTO';

export interface TrajectoryUploadSessionFileInput {
    name: string;
    size: number;
    type?: string;
}

export interface CreateTrajectoryUploadSessionInputDTO {
    name: string;
    files: TrajectoryUploadSessionFileInput[];
    userId: string;
    teamId: string;
    teamClusterId?: string;
    folderId?: string | null;
}

export interface TrajectoryUploadPartDTO {
    partNumber: number;
    offset: number;
    size: number;
    url: string;
    expiresAt: string;
}

export interface TrajectoryUploadSessionFileDTO {
    index: number;
    originalName: string;
    size: number;
    contentType?: string;
    finalObjectKey: string;
    parts: TrajectoryUploadPartDTO[];
}

export interface CreateTrajectoryUploadSessionOutputDTO {
    trajectory: CreateTrajectoryOutputDTO;
    uploadSession: {
        id: string;
        chunkSize: number;
        expiresAt: string;
        files: TrajectoryUploadSessionFileDTO[];
    };
}

export interface CommitTrajectoryUploadSessionInputDTO {
    teamId: string;
    userId: string;
    uploadSessionId: string;
}

export interface CommitTrajectoryUploadSessionOutputDTO {
    trajectoryId: string;
}

export interface CancelTrajectoryUploadSessionInputDTO {
    teamId: string;
    userId: string;
    uploadSessionId: string;
}
