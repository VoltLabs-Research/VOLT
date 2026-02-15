export type SceneArtifactSourceType = 'color-coding' | 'particle-filter' | 'plugin-exposure';

export interface SceneArtifactParams {
    property?: string;
    startValue?: number;
    endValue?: number;
    gradient?: string;
    operator?: string;
    value?: number;
    action?: 'delete' | 'highlight';
    exposureId?: string;
}

export interface SceneArtifact {
    _id: string;
    trajectory: string;
    analysis?: string;
    plugin?: string;
    sourceType: SceneArtifactSourceType;
    timestep: number;
    objectName: string;
    storageBucket: string;
    params: SceneArtifactParams;
    displayName: string;
    status: 'ready' | 'failed';
    metadata?: Record<string, any>;
    createdAt: string;
    updatedAt: string;
}
