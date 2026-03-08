import { BaseEntity } from '@/shared/domain/entities/BaseEntity';

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
};

export interface SceneArtifact extends BaseEntity {
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
    metadata?: Record<string, unknown>;
};
