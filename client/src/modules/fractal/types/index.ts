import type { RefObject } from 'react';
import type { Camera, Plane, Vector3 } from 'three';
import type { BoundsInfo } from '@/modules/fractal/utilities/model-transform';
import type { BoxBounds, Pos3D, ModelLoadingState } from '@/modules/fractal/api/entities/model';

export enum AnalysisStatus {
    Pending = 'pending',
    Running = 'running',
    Completed = 'completed',
    Failed = 'failed'
};

export interface OrbitControlsHandle {
    enabled: boolean;
    update: () => void;
    target: Vector3;
    object: Camera;
    minDistance: number;
    maxDistance: number;
};

export type { BoxBounds, Pos3D, ModelLoadingState };

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
    sceneOpacities: Record<string, number>;
    activeModelBounds?: BoundsInfo | null;
    onModelBoundsChanged?: (bounds: BoundsInfo) => void;
    onLoadingStateChanged?: (state: ModelLoadingState) => void;
};
