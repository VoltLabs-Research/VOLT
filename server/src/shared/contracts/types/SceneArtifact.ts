/**
 * Neutral, standalone STRUCTURAL contract for scene-artifact data.
 *
 * Part of the `shared/contracts` layer (detachable-modules migration). These are
 * STANDALONE copies of the shapes owned by
 * `@modules/trajectory/domain/entities/scene-artifacts/SceneArtifact`, exported
 * here so cross-module consumers (cluster / plugin / analysis / raster /
 * dashboard / jobs) can depend on the shapes without importing the trajectory
 * module. Field shapes match the owner exactly; enums are duplicated as runtime
 * values because consumers use them as values, not just types.
 *
 * No `@modules/*` imports — pure data/types only.
 */

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

/**
 * Structural stand-in for the SceneArtifact entity (a class with methods in the
 * owner module). Consumers that only need the data shape can use this instead of
 * importing the concrete class.
 */
export interface SceneArtifactLike {
    _id: string;
    props: SceneArtifactProps;
}
