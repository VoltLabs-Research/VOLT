

export interface TrajectoryUploadFileInput{
    name: string;
    size: number;
    type?: string;
}

export interface CreateTrajectoryUploadSessionInput{
    name?: string;
    files: TrajectoryUploadFileInput[];
    teamClusterId?: string;
    folderId?: string | null;
}

export interface CloneTrajectoryInput{
    sourceTrajectoryId: string;
    targetClusterId?: string;
}

export interface UpdateTrajectoryInput{
    name?: string;
    isPublic?: boolean;
}

export interface MoveTrajectoryInput{
    folderId: string | null;
}

export interface CreateTrajectoryFolderInput{
    title: string;
    parentId?: string | null;
}

export interface UpdateTrajectoryFolderInput{
    title: string;
}

export interface CreateColoredModelInput{
    timestep: string;
    exposureId?: string;
    property: string;
    startValue: number;
    endValue: number;
    gradient: string;
}

export enum ParticleFilterCombinator{
    And = 'AND',
    Or = 'OR'
}

export interface ParticleFilterConditionInput{
    property: string;
    operator: string;
    value: number | string;
}

export interface ApplyParticleFilterActionInput{
    timestep: string;
    action: 'delete' | 'highlight';
    combinator: ParticleFilterCombinator;
    conditions: ParticleFilterConditionInput[];
}

export interface CreateLineStyledModelInput{
    timestep: string;
    style?: Record<string, unknown>;
}
