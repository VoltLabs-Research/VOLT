import type { TeamCluster } from '@/modules/cluster/api/types/team-cluster';
import type { BaseEntity } from '@/shared/types/BaseEntity';

export type SceneArtifactSourceType = 'color-coding' | 'particle-filter' | 'plugin-exposure' | 'line-style';

export interface SceneArtifactParticleFilterPropertyCondition {
    kind?: 'property';
    property: string;
    operator: string;
    value: number | string;
    exposureId?: string;
}
export type SceneArtifactParticleFilterCondition = SceneArtifactParticleFilterPropertyCondition;

export interface SceneArtifactParams {
    property?: string;
    startValue?: number;
    endValue?: number;
    gradient?: string;
    operator?: string;
    value?: number | string;
    action?: 'delete' | 'highlight';
    exposureId?: string;
    combinator?: 'AND' | 'OR';
    conditions?: SceneArtifactParticleFilterCondition[];
    style?: Record<string, unknown>;
}

export interface SceneArtifactTrajectory {
    _id: string;
    name?: string;
    storageClusterId?: TeamCluster | string | null;
}

export interface SceneArtifactAnalysis {
    _id: string;
}

export interface SceneArtifactPlugin {
    _id: string;
    name?: string;
}

export interface SceneArtifact extends BaseEntity {
    trajectory: SceneArtifactTrajectory | string;
    analysis?: SceneArtifactAnalysis | string;
    plugin?: SceneArtifactPlugin | string;
    storageClusterId?: TeamCluster | string | null;
    sourceType: SceneArtifactSourceType;
    timestep: number;
    objectName: string;
    storageBucket: string;
    params: SceneArtifactParams;
    displayName: string;
    status: 'ready' | 'failed';
    metadata?: Record<string, unknown>;
}
