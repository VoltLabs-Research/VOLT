// Wire request bodies the CLIENT sends. Server-derived context (the
// authenticated userId, the `:teamId` / `:trajectoryId` / `:analysisId` /
// `:exposureId` path params) is NOT here — the service augments those on its own
// input from the route params + `@CurrentUser`.

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

export type ParticleFilterCombinator = 'and' | 'or';

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
