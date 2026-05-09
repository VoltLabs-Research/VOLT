import type { RefObject } from 'react';
import type { Camera, Plane, Vector3 } from 'three';
import type { BoundsInfo } from '@/modules/fractal/utilities/model-transform';
import type { BoxBounds, Pos3D, ModelLoadingState } from '@/modules/fractal/api/entities/model';
import type { SceneVisualOverrides } from '@/modules/fractal/api/entities/scene';
import type { DislocationLineSceneSettings, PointCloudSceneSettings } from '@/modules/fractal/types/scene-config';

export enum AnalysisStatus {
    Pending = 'pending',
    Running = 'running',
    Completed = 'completed',
    Failed = 'failed'
}

export interface OrbitControlsHandle {
    enabled: boolean;
    update: () => void;
    target: Vector3;
    object: Camera;
    minDistance: number;
    maxDistance: number;
    addEventListener: (type: 'change' | 'start' | 'end', listener: () => void) => void;
    removeEventListener: (type: 'change' | 'start' | 'end', listener: () => void) => void;
}


export type UseGlbSceneParams = {
    url?: string | null;
    sliceClippingPlanes: Plane[];
    position: Pos3D;
    rotation: Pos3D;
    scale: number;
    enableInstancing?: boolean;
    updateThrottle: number;
    useFixedReference?: boolean;
    preserveInitialTransform?: boolean;
    onSelect?: () => void;
    orbitControlsRef?: RefObject<OrbitControlsHandle | null>;
    onEmptyData?: () => void;
    disableAutoTransform?: boolean;
    sceneKey?: string;
    boxBounds?: BoxBounds;
    pointSizeMultiplier: number;
    pointCloudSettings?: PointCloudSceneSettings;
    dislocationLineSettings?: DislocationLineSceneSettings;
    sceneVisualOverrides: SceneVisualOverrides;
    activeModelBounds?: BoundsInfo | null;
    onModelBoundsChanged?: (bounds: BoundsInfo) => void;
    onLoadingStateChanged?: (state: ModelLoadingState) => void;
    onContentTypeDetected?: (info: { hasPointClouds: boolean }) => void;
};
