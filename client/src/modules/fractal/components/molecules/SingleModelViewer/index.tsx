import usePipelineSlicePlanes from '@/modules/canvas/hooks/use-pipeline-slice-planes';
import useGlbScene from '@/modules/fractal/hooks/use-glb-scene';
import useExpressionVisibilityMask from '@/modules/canvas/hooks/use-expression-visibility-mask';
import SimulationCellBox from '@/modules/fractal/components/molecules/SimulationCellBox';
import { useCellDisplayStore } from '@/modules/fractal/store/cell-display-store';
import useSimulationCell from '@/modules/simulation-cell/hooks/use-simulation-cell';
import { areModelWorldBoundsEqual } from '@/modules/fractal/utils/model-world-bounds';
import { calculateBoxTransforms, getGroundOffset } from '@/modules/fractal/utils/box-utils';
import { debugFractal, warnFractal } from '@/modules/fractal/utils/debug-log';
import { getSceneKey, resolveLineSceneSource } from '@/modules/fractal/utils/scene-utils';
import { resolveGlbResource } from '@/modules/fractal/api/service/compute-glb-url';
import { useCanvasAccessMode } from '@/modules/canvas/api/access';
import { useLineEntityPick } from '@/modules/canvas/hooks/use-line-entity-selection';
import { fitPerspectiveCameraToBox } from '@/modules/fractal/utils/camera-fit';
import { useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useMemo, useEffect, useCallback, useRef } from 'react';
import type { SimulationCellTransforms } from '@/modules/fractal/components/molecules/SimulationCellBox';
import type { OrbitControlsHandle } from '@/modules/fractal/contracts';
import type { ModelLoadingState, Pos3D } from '@/modules/fractal/contracts/model';
import type { BoxBounds } from '@volt/contracts/modules/trajectory/domain';
import type { ModelWorldBounds } from '@/modules/fractal/contracts/model';
import type { SceneObjectType, SceneVisualOverrides } from '@/modules/fractal/contracts/scene';
import type { LineEntityHighlight, LineSceneSettings, PointCloudSceneSettings } from '@/modules/fractal/contracts/scene-config';
import type { BoundsInfo } from '@/modules/fractal/utils/model-transform';
import type { FC, RefObject } from 'react';

const buildWorldBoundsFromModel = (
    bounds: BoundsInfo,
    transforms: SimulationCellTransforms
): THREE.Box3 => {
    const groundOffset = transforms.groundOffset || 0;
    const worldOffset = new THREE.Vector3(
        transforms.position.x,
        transforms.position.y,
        transforms.position.z + groundOffset
    );
    const min = bounds.box.min.clone().multiplyScalar(transforms.scale).add(worldOffset);
    const max = bounds.box.max.clone().multiplyScalar(transforms.scale).add(worldOffset);

    return new THREE.Box3(min, max);
};

interface SingleModelViewerProps {
    teamId?: string;
    trajectoryId: string;
    currentTimestep: number | undefined;
    analysisId?: string;
    sceneConfig: SceneObjectType;
    boxBounds: BoxBounds;
    pointSizeMultiplier: number;
    pointCloudSettings?: PointCloudSceneSettings;
    lineSettings?: LineSceneSettings;
    lineHighlight?: LineEntityHighlight;
    sceneVisualOverrides: SceneVisualOverrides;
    setModelWorldBounds?: (bounds: ModelWorldBounds | null) => void;
    activeModelBounds?: BoundsInfo | null;
    onModelBoundsChanged?: (bounds: BoundsInfo) => void;
    onLoadingStateChanged?: (state: ModelLoadingState) => void;
    rotation?: Partial<Pos3D>;
    position?: Partial<Pos3D>;
    scale?: number;
    autoFit?: boolean;
    autoFitKeyOverride?: string | null;
    orbitControlsRef?: RefObject<OrbitControlsHandle | null>;
    enableSlice?: boolean;
    updateThrottle?: number;
    onSelect?: () => void;
    isSelected?: boolean;
    onContentTypeDetected?: (info: { hasPointClouds: boolean }) => void;
}

const SingleModelViewer: FC<SingleModelViewerProps> = ({
    teamId,
    trajectoryId,
    currentTimestep,
    analysisId = 'default',
    sceneConfig,
    boxBounds,
    pointSizeMultiplier,
    pointCloudSettings,
    lineSettings,
    lineHighlight,
    sceneVisualOverrides,
    setModelWorldBounds,
    activeModelBounds,
    onModelBoundsChanged,
    onLoadingStateChanged,
    rotation = {},
    position = {},
    scale = 1,
    autoFit = true,
    autoFitKeyOverride,
    orbitControlsRef,
    enableSlice = true,
    updateThrottle = 16,
    onSelect,
    isSelected = false,
    onContentTypeDetected
}) => {
    const lastEmittedModelWorldBoundsReference = useRef<ModelWorldBounds | null>(null);
    const autoFitAppliedRef = useRef(!autoFit);
    const modelContainerRef = useRef<THREE.Group>(null!);

    const cellBoxTransforms = useMemo<SimulationCellTransforms>(() => {
        const boxTransforms = calculateBoxTransforms(boxBounds);
        return {
            scale: boxTransforms.scale,
            position: boxTransforms.position,
            groundOffset: getGroundOffset(boxBounds, boxTransforms)
        };
    }, [boxBounds]);
    const autoFitKey = useMemo(() => {
        if (autoFitKeyOverride !== undefined) {
            return autoFit ? autoFitKeyOverride : null;
        }

        return autoFit
            ? [
                trajectoryId,
                currentTimestep ?? 'none',
                boxBounds.xlo,
                boxBounds.xhi,
                boxBounds.ylo,
                boxBounds.yhi,
                boxBounds.zlo,
                boxBounds.zhi
            ].join(':')
            : null;
    }, [
        autoFit,
        autoFitKeyOverride,
        boxBounds.xhi,
        boxBounds.xlo,
        boxBounds.yhi,
        boxBounds.ylo,
        boxBounds.zhi,
        boxBounds.zlo,
        currentTimestep,
        trajectoryId
    ]);

    const modelWorldBounds = useMemo<ModelWorldBounds>(() => {
        const scaleFactor = cellBoxTransforms.scale;
        const worldPosition = cellBoxTransforms.position;
        const groundZOffset = cellBoxTransforms.groundOffset || 0;
        return {
            min: {
                x: boxBounds.xlo * scaleFactor + worldPosition.x,
                y: boxBounds.ylo * scaleFactor + worldPosition.y,
                z: boxBounds.zlo * scaleFactor + worldPosition.z + groundZOffset
            },
            max: {
                x: boxBounds.xhi * scaleFactor + worldPosition.x,
                y: boxBounds.yhi * scaleFactor + worldPosition.y,
                z: boxBounds.zhi * scaleFactor + worldPosition.z + groundZOffset
            }
        };
    }, [boxBounds, cellBoxTransforms]);

    useEffect(() => {
        if (areModelWorldBoundsEqual(lastEmittedModelWorldBoundsReference.current, modelWorldBounds)) {
            return;
        }

        lastEmittedModelWorldBoundsReference.current = modelWorldBounds;
        setModelWorldBounds?.(modelWorldBounds);
    }, [modelWorldBounds, setModelWorldBounds]);

    const sliceClippingPlanes = usePipelineSlicePlanes(
        enableSlice ? trajectoryId : undefined,
        modelWorldBounds
    );

    const canvasMode = useCanvasAccessMode();
    const glbResource = useMemo(() =>
        resolveGlbResource({
            teamId: teamId || '',
            trajectoryId,
            currentTimestep,
            analysisId,
            activeScene: sceneConfig,
            mode: canvasMode
        }),
        [teamId, trajectoryId, currentTimestep, analysisId, sceneConfig, canvasMode]
    );

    const sceneKey = getSceneKey(sceneConfig);

    const canPickLineEntities = canvasMode !== 'public' && resolveLineSceneSource(sceneConfig) !== null;
    const pickLineEntity = useLineEntityPick(trajectoryId, currentTimestep);
    const handleLineEntityClick = useCallback((event: ThreeEvent<MouseEvent>) => {
        if (event.delta > 4 || typeof event.faceIndex !== 'number') return;
        void pickLineEntity(sceneConfig, event.faceIndex);
    }, [pickLineEntity, sceneConfig]);

    const {
        mask: expressionVisibilityMask,
        highlightMask: expressionHighlightMask,
        highlightColor: expressionHighlightColor
    } = useExpressionVisibilityMask({
        trajectoryId,
        analysisId: analysisId === 'default' ? undefined : analysisId,
        currentTimestep
    });

    const { simulationCell } = useSimulationCell({
        trajectoryId,
        timestep: currentTimestep,
        enabled: canvasMode !== 'public' && Boolean(trajectoryId)
    });
    const showPbcImages = useCellDisplayStore((state) => state.showPbcImages);
    const cellOverride = useCellDisplayStore(
        (state) => state.cellOverrides[trajectoryId]
    );
    const cellGeometry = useMemo(() => {
        const fetched = simulationCell?.geometry;
        const cellVectors = cellOverride?.cellVectors ?? fetched?.cell_vectors;
        const cellOrigin = cellOverride?.cellOrigin ?? fetched?.cell_origin;
        const pbc = cellOverride?.pbc ?? fetched?.periodic_boundary_conditions;
        if (!cellVectors) return undefined;
        return {
            cellVectors,
            cellOrigin,
            pbc,
            showPbcImages
        };
    }, [simulationCell, cellOverride, showPbcImages]);

    const {
        modelBounds,
        deselect,
        setSelectedObject,
        onHoverChange
    } = useGlbScene({
        url: glbResource.url,
        resourceKey: glbResource.resourceKey,
        sliceClippingPlanes,
        position: {
            x: position.x ?? 0,
            y: position.y ?? 0,
            z: position.z ?? 0
        },
        rotation: {
            x: rotation.x ?? 0,
            y: rotation.y ?? 0,
            z: rotation.z ?? 0
        },
        scale,
        updateThrottle,
        onSelect,
        orbitControlsRef,
        disableAutoTransform: true,
        sceneKey,
        boxBounds,
        pointSizeMultiplier,
        pointCloudSettings,
        lineSettings,
        lineHighlight,
        sceneVisualOverrides,
        visibilityMask: expressionVisibilityMask,
        selectionHighlightMask: expressionHighlightMask,
        selectionHighlightColor: expressionHighlightColor,
        activeModelBounds,
        onModelBoundsChanged,
        onLoadingStateChanged,
        onContentTypeDetected
    }, modelContainerRef);

    useEffect(() => {
        autoFitAppliedRef.current = !autoFit || !autoFitKey;
    }, [autoFit, autoFitKey]);

    const { invalidate } = useThree();

    useEffect(() => {
        if (autoFitAppliedRef.current || !modelBounds) {
            return;
        }

        const controls = orbitControlsRef?.current;
        if (!controls) {
            return;
        }

        const camera = controls.object;
        if (!(camera instanceof THREE.PerspectiveCamera)) {
            autoFitAppliedRef.current = true;
            warnFractal('single-model.autofit-non-perspective-camera', {
                trajectoryId,
                timestep: currentTimestep,
                sceneKey
            });
            return;
        }

        const worldBox = buildWorldBoundsFromModel(modelBounds, cellBoxTransforms);
        if (worldBox.isEmpty()) {
            autoFitAppliedRef.current = true;
            warnFractal('single-model.autofit-empty-world-box', {
                trajectoryId,
                timestep: currentTimestep,
                sceneKey
            });
            return;
        }

        fitPerspectiveCameraToBox(camera, worldBox, controls);
        autoFitAppliedRef.current = true;
        debugFractal('single-model.autofit-applied', {
            trajectoryId,
            timestep: currentTimestep,
            sceneKey,
            nextCameraPosition: camera.position.toArray(),
            nextTarget: controls.target.toArray()
        });
        invalidate();
    }, [
        autoFit,
        autoFitKey,
        cellBoxTransforms,
        currentTimestep,
        invalidate,
        modelBounds,
        orbitControlsRef,
        sceneKey,
        trajectoryId
    ]);

    useEffect(() => {
        if (!isSelected) {
            deselect();
        }
    }, [isSelected, deselect]);

    return (
        <SimulationCellBox
            sceneKey={sceneKey}
            boxBounds={boxBounds}
            cellGeometry={cellGeometry}
            transforms={cellBoxTransforms}
            orbitControlsRef={orbitControlsRef}
            onSelect={setSelectedObject}
            onHoverChange={onHoverChange}
        >
            {/* Imperative model container — the loaded 3D model is attached via
                scene.add() in useGlbScene, never through React reconciliation.
                R3F raycasts handler-bearing groups recursively, so the click
                still reaches the imperatively-added line mesh. */}
            <group
                ref={modelContainerRef}
                userData={{ isScreenshotCaptureTarget: true }}
                onClick={canPickLineEntities ? handleLineEntityClick : undefined}
            />
        </SimulationCellBox>
    );
};

export default SingleModelViewer;
