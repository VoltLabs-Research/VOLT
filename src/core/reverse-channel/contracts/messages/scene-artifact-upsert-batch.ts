export interface SceneArtifactUpsertBatchItemMessage {
    analysis?: string;
    displayName: string;
    metadata?: object;
    objectName: string;
    params: object;
    plugin?: string;
    sourceType: 'color-coding' | 'particle-filter' | 'plugin-exposure';
    status: 'ready' | 'failed';
    storageBucket: string;
    storageClusterId: string;
    timestep: number;
    trajectory: string;
}

export interface SceneArtifactUpsertBatchContext {
    daemonPassword: string;
    teamClusterId: string;
}

export interface SceneArtifactUpsertBatchPayload {
    items: SceneArtifactUpsertBatchItemMessage[];
}

export interface SceneArtifactUpsertBatchMessage extends SceneArtifactUpsertBatchContext, SceneArtifactUpsertBatchPayload {
    type: 'trajectory-scene-artifact-upsert-batch';
}

export const createSceneArtifactUpsertBatchMessage = (
    context: SceneArtifactUpsertBatchContext,
    payload: SceneArtifactUpsertBatchPayload
): SceneArtifactUpsertBatchMessage => ({
    type: 'trajectory-scene-artifact-upsert-batch',
    ...context,
    ...payload
});
