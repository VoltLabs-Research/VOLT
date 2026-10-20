export enum TrajectoryUploadSessionStatus{
    Pending = 'pending',
    Committed = 'committed',
    Cancelled = 'cancelled',
    Failed = 'failed'
}

export interface TrajectoryUploadSessionPartProps{
    partNumber: number;
    objectKey: string;
    offset: number;
    size: number;
}

export interface TrajectoryUploadSessionFileProps{
    index: number;
    originalName: string;
    contentType?: string;
    size: number;
    finalObjectKey: string;
    parts: TrajectoryUploadSessionPartProps[];
}
