import { SceneArtifactModel, type SceneArtifactDocument } from '../models/SceneArtifactModel';

export interface SceneArtifactFilter {
    trajectoryId?: string;
    analysisId?: string;
    sourceType?: string;
    timestep?: number;
    page: number;
    limit: number;
};

export interface PaginatedSceneArtifactResult {
    data: SceneArtifactDocument[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
};

export interface UpsertSceneArtifactInput {
    trajectory: string;
    teamCluster?: string;
    analysis?: string;
    plugin?: string;
    sourceType: string;
    timestep: number;
    objectName: string;
    storageBucket: string;
    params: Record<string, unknown>;
    displayName: string;
    status: string;
    metadata?: Record<string, unknown>;
};

export const upsertSceneArtifactByObjectName = (
    objectName: string,
    data: UpsertSceneArtifactInput
): Promise<SceneArtifactDocument> => {
    return SceneArtifactModel.findOneAndUpdate(
        { objectName },
        {
            $set: {
                ...data,
                objectName
            }
        },
        {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
        }
    ).exec() as Promise<SceneArtifactDocument>;
};

const toSceneArtifactDocument = (value: unknown): SceneArtifactDocument => {
    const record = typeof value === 'object' && value !== null && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};

    return {
        _id: typeof record._id === 'string' ? record._id : '',
        trajectory: typeof record.trajectory === 'string' ? record.trajectory : '',
        teamCluster: typeof record.teamCluster === 'string' ? record.teamCluster : undefined,
        analysis: typeof record.analysis === 'string' ? record.analysis : undefined,
        plugin: typeof record.plugin === 'string' ? record.plugin : undefined,
        sourceType: typeof record.sourceType === 'string' ? record.sourceType : '',
        timestep: typeof record.timestep === 'number' ? record.timestep : 0,
        objectName: typeof record.objectName === 'string' ? record.objectName : '',
        storageBucket: typeof record.storageBucket === 'string' ? record.storageBucket : '',
        params: typeof record.params === 'object' && record.params !== null && !Array.isArray(record.params)
            ? record.params as Record<string, unknown>
            : {},
        displayName: typeof record.displayName === 'string' ? record.displayName : '',
        status: typeof record.status === 'string' ? record.status : '',
        metadata: typeof record.metadata === 'object' && record.metadata !== null && !Array.isArray(record.metadata)
            ? record.metadata as Record<string, unknown>
            : undefined,
        createdAt: record.createdAt instanceof Date ? record.createdAt : new Date(0),
        updatedAt: record.updatedAt instanceof Date ? record.updatedAt : new Date(0)
    };
};

export const listSceneArtifacts = async (filter: SceneArtifactFilter): Promise<PaginatedSceneArtifactResult> => {
    const query = {
        ...(filter.trajectoryId ? { trajectory: filter.trajectoryId } : {}),
        ...(filter.analysisId ? { analysis: filter.analysisId } : {}),
        ...(filter.sourceType ? { sourceType: filter.sourceType } : {}),
        ...(typeof filter.timestep === 'number' ? { timestep: filter.timestep } : {})
    };
    const skip = (filter.page - 1) * filter.limit;
    const total = await SceneArtifactModel.countDocuments(query);
    const data = await SceneArtifactModel.find(query)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(filter.limit)
        .lean();

    return {
        data: data.map(toSceneArtifactDocument),
        page: filter.page,
        limit: filter.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / filter.limit))
    };
};

export type SceneArtifactRepository = {
    upsertSceneArtifactByObjectName: typeof upsertSceneArtifactByObjectName;
    listSceneArtifacts: typeof listSceneArtifacts;
};

export const sceneArtifactRepository: SceneArtifactRepository = {
    upsertSceneArtifactByObjectName,
    listSceneArtifacts
};
