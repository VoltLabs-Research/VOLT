export type SceneArtifactSourceType = 'color-coding' | 'particle-filter' | 'plugin-exposure';
export type SceneArtifactStatus = 'ready' | 'failed';

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
    analysis?: string;
    plugin?: string;
    sourceType: SceneArtifactSourceType;
    timestep: number;
    objectName: string;
    storageBucket: string;
    params: SceneArtifactParams;
    displayName: string;
    status: SceneArtifactStatus;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

export default class SceneArtifact {
    constructor(
        public id: string,
        public props: SceneArtifactProps
    ) {}
}
