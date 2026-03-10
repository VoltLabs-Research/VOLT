import { SceneArtifactModel, type SceneArtifactDocument } from '../models/SceneArtifactModel';

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
