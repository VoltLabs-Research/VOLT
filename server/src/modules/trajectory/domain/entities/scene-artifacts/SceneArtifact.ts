export enum SceneArtifactSourceType {
    ColorCoding = 'color-coding',
    ParticleFilter = 'particle-filter',
    PluginExposure = 'plugin-exposure'
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
    value?: number;
    action?: 'delete' | 'highlight';
    exposureId?: string;
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

export default class SceneArtifact {
    constructor(
        public readonly _id: string,
        public props: SceneArtifactProps
    ) {}

    get id(): string {
        return this._id;
    }
}
