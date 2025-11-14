import type { SceneState } from '@/types/scene';
import { Vector3, Euler } from 'three';

export interface TrajectoryData{
    _id: string;
    name: string;
    dislocations?: DislocationData[];
    timesteps?: number[];
    metadata?: Record<string, any>;
}

export interface DislocationData {
    timestep: number;
    segments: any[];
    metadata?: Record<string, any>;
}

export interface EditorWidgetsProps {
    trajectory: TrajectoryData | null;
    currentTimestep: number | undefined;
    scene3DRef?: React.RefObject<any>;
}

export interface Scene3DContainerProps {
    trajectoryId: string | undefined;
    onTrajectoryUpload: (trajectory: TrajectoryData) => void;
}

export type UseGlbSceneParams = {
    sliceClippingPlanes: Plane[];
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: number;
    enableInstancing?: boolean;
    updateThrottle: number;
    useFixedReference?: boolean;
    referencePoint?: 'origin' | 'initial' | 'custom';
    customReference?: { x: number; y: number; z: number }; 
    preserveInitialTransform?: boolean; 
};

export interface ExtendedSceneState extends SceneState{
    referenceScaleFactor?: number;
    fixedReferencePoint?: Vector3 | null;
    useFixedReference?: boolean;
    initialTransform?: { position: Vector3; rotation: Euler; scale: number } | null;
    failedUrls?: Set<string>;
    isLoadingUrl?: boolean;
};
