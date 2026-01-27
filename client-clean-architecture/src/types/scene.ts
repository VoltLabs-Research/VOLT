import {
    Group,
    Mesh,
    Points,
    ShaderMaterial,
    Box3,
    Vector3,
    MeshBasicMaterial,
    Euler,
    LineSegments,
    EdgesGeometry,
    BoxGeometry,
    Plane
} from 'three';
import type { BoxBounds } from '@/types/models';

export type SelectionRefs = {
    group: Group;
    base: LineSegments;
};

export type SceneState = {
    model: Group | null;
    mesh: Mesh | Points | null;
    isSetup: boolean;
    lastLoadedUrl: string | null;
    failedUrls: Set<string>;
    isLoadingUrl: boolean;

    dragging: boolean;
    selected: Group | null;
    selection: SelectionRefs | null;
    isSelectedPersistent: boolean;
    targetPosition: Vector3 | null;
    showSelection: boolean;
    isHovered: boolean;

    targetRotation: Euler | null;
    currentRotation: Euler;
    targetScale: number;
    currentScale: number;

    modelBounds: Box3 | null;
    lastInteractionTime: number;

    simBoxMesh: Mesh | null;
    simBoxSize: Vector3 | null;
    simBoxBaseSize: Vector3 | null;

    isRotating: boolean;
    rotationFreezeSize: Vector3 | null;
    lastRotationActiveMs: number;

    sizeAnimActive: boolean;
    sizeAnimFrom: Vector3 | null;
    sizeAnimTo: Vector3 | null;
    sizeAnimStartMs: number;

    referenceScaleFactor?: number;
    fixedReferencePoint: Vector3 | null;
    useFixedReference: boolean;
    initialTransform: {
        position: Vector3;
        rotation: Euler;
        scale: Vector3;
        matrix?: any;
    } | null;
};

export type Pos3D = {
    x: number;
    y: number;
    z: number;
};

export type OrbitControlsRef = {
    current?: { enabled: boolean } | null;
} | null;

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
    orbitControlsRef?: OrbitControlsRef;
    onEmptyData?: () => void;
    disableAutoTransform?: boolean;
    sceneKey?: string;
    boxBounds?: BoxBounds;
    normalizationScale?: number;
};

export type ExtendedSceneState = SceneState;
