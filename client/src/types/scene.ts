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
    BoxGeometry 
} from 'three';

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

export type LoadingState = {
  isLoading: boolean;
  progress: number;
  error: string | null;
};

export type EdgesBox = EdgesGeometry & { boundingBox?: Box3 };

export type BoxGeo = BoxGeometry;
export type MeshBasicMat = MeshBasicMaterial;
export type ShaderMat = ShaderMaterial;
