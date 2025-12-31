import type { SceneState } from '@/types/scene';
import { Vector3, Euler, Plane } from 'three';

export type Pos3D = {
    x: number;
    y: number;
    z: number;
};

export type UseGlbSceneParams = {
    url?: string | null;
    sliceClippingPlanes: Plane[];
    position: Pos3D; 
    rotation: Pos3D;
    scale: number;
    enableInstancing?: boolean;
    updateThrottle: number;
    useFixedReference?: boolean;
    referencePoint?: 'origin' | 'initial' | 'custom';
    customReference?: Pos3D;
    preserveInitialTransform?: boolean;
    onSelect?: () => void;
    orbitControlsRef?: React.RefObject<any>;
};

export interface ExtendedSceneState extends SceneState {
    referenceScaleFactor?: number;
    fixedReferencePoint?: Vector3 | null;
    useFixedReference?: boolean;
    initialTransform?: { position: Vector3; rotation: Euler; scale: number } | null;
    failedUrls?: Set<string>;
    isLoadingUrl?: boolean;
};
