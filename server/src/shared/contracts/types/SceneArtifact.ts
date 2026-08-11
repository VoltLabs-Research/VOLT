

import { assertWireMatch } from '@shared/contracts/assert-wire-match';
import type { Equal } from '@shared/contracts/assert-wire-match';
import type {
    SceneArtifactParams,
    SceneArtifactSourceType as WireSceneArtifactSourceType
} from '@volt/contracts/modules/trajectory/domain';

/*
 * A runtime enum because the server uses the values, while `@volt/contracts`
 * declares the same set as a union. The assertion fails the build on divergence.
 */
export enum SceneArtifactSourceType {
    ColorCoding = 'color-coding',
    ParticleFilter = 'particle-filter',
    PluginExposure = 'plugin-exposure'
}

assertWireMatch<Equal<`${SceneArtifactSourceType}`, WireSceneArtifactSourceType>>();

export enum SceneArtifactStatus {
    Ready = 'ready',
    Failed = 'failed'
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