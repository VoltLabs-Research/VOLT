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
