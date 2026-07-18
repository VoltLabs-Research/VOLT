

export enum SceneArtifactSourceType {
    ColorCoding = 'color-coding',
    ParticleFilter = 'particle-filter',
    PluginExposure = 'plugin-exposure',
    LineStyle = 'line-style'
}

export enum SceneArtifactStatus {
    Ready = 'ready',
    Failed = 'failed'
}

export interface SceneArtifactParams {
    property?: string;
    startValue?: number;
    endValue?: number;
    gradient?: string;
    operator?: string;
    value?: number | string;
    action?: 'delete' | 'highlight';
    exposureId?: string;
    style?: Record<string, unknown>;
}

export interface SceneArtifactProps {
    trajectory: string;
    storageClusterId?: string;
    analysis?: string;
    plugin?: string;
    sourceType: SceneArtifactSourceType;
    timestep: number;
    objectName: string;
    storageBucket: string;
    params: SceneArtifactParams;
    displayName: string;
    status: SceneArtifactStatus;
    metadata?: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}

export interface SceneArtifactLike {
    _id: string;
    props: SceneArtifactProps;
}
