import type React from 'react';
import type { Plane } from 'three';
import type { BoundsInfo } from '@/modules/fractal/core/model-transform';
import type { BoxBounds, Pos3D } from '@/modules/fractal/api/entities/fractal';
import type { ModelLoadingState } from '@/modules/fractal/api/entities/fractal';

export type AnalysisStatus = 'pending' | 'running' | 'completed' | 'failed';

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
    orbitControlsRef?: React.RefObject<{ enabled: boolean } | null>;
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
