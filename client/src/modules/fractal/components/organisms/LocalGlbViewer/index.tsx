import { FractalAssetLoader } from '@/modules/fractal/api/service/asset-loader';
import { useLocalGlbStore } from '@/modules/canvas/stores/use-local-glb-store';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import { MaterialPipeline } from '@/modules/fractal/services/material-pipeline';
import { disposeObject3DResources } from '@/modules/fractal/utilities/resource-disposal';
import { fitPerspectiveCameraToBox } from '@/modules/fractal/utilities/camera-fit';
import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { sileo } from 'sileo';
import * as THREE from 'three';
import type { ModelWorldBounds } from '@/modules/fractal/api/entities/model';

interface LocalGlbViewerProps {
    url: string;
    onContentTypeDetected?: (info: { hasPointClouds: boolean }) => void;
}

const AUTO_SIMULATION_CELL_PADDING_RATIO = 0.05;
const AUTO_SIMULATION_CELL_MIN_PADDING = 0.01;
type OrbitControlsLike = {
    target: THREE.Vector3;
    minDistance: number;
    maxDistance: number;
    update?: () => void;
} | null;

const isAbortLike = (error: unknown): boolean => {
    if (error instanceof DOMException && error.name === 'AbortError') {
        return true;
    }

    if (!(error instanceof Error)) {
        return false;
    }

    return error.name === 'AbortError' || error.name === 'CanceledError';
};

const fitCameraToObject = (
    camera: THREE.Camera,
    controls: OrbitControlsLike,
    object: THREE.Object3D
) => {
    if (!(camera instanceof THREE.PerspectiveCamera)) {
        return;
    }

    const worldBounds = new THREE.Box3().setFromObject(object);
    if (worldBounds.isEmpty()) {
        return;
    }

    fitPerspectiveCameraToBox(camera, worldBounds, controls, {
        updateClipping: true,
        fallbackTarget: new THREE.Vector3(0, 0, 0)
    });
};

const toModelWorldBounds = (box: THREE.Box3): ModelWorldBounds => ({
    min: {
        x: box.min.x,
        y: box.min.y,
        z: box.min.z
    },
    max: {
        x: box.max.x,
        y: box.max.y,
        z: box.max.z
    }
});

const buildAutoSimulationCellBounds = (box: THREE.Box3): ModelWorldBounds => {
    const size = box.getSize(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z);
    const padding = Math.max(
        maxDimension * AUTO_SIMULATION_CELL_PADDING_RATIO,
        AUTO_SIMULATION_CELL_MIN_PADDING
    );

    return {
        min: {
            x: box.min.x - padding,
            y: box.min.y - padding,
            z: box.min.z - padding
        },
        max: {
            x: box.max.x + padding,
            y: box.max.y + padding,
            z: box.max.z + padding
        }
    };
};

const applyPointSizeMultiplier = (root: THREE.Object3D, multiplier: number) => {
    root.traverse((child) => {
        if (!(child instanceof THREE.Points) || !child.material) {
            return;
        }

        const material = child.material;
        if (material instanceof THREE.ShaderMaterial && material.uniforms?.pointScale) {
            const basePointScale = material.userData.basePointScale;
            if (typeof basePointScale === 'number') {
                material.uniforms.pointScale.value = basePointScale * multiplier;
                material.needsUpdate = true;
            }
            return;
        }

        if (material instanceof THREE.PointsMaterial) {
            const currentBaseSize = (material.userData.basePointSize as number | undefined) ?? material.size;
            material.userData.basePointSize = currentBaseSize;
            material.size = currentBaseSize * multiplier;
            material.needsUpdate = true;
        }
    });
};

const LocalGlbViewer = ({ url, onContentTypeDetected }: LocalGlbViewerProps) => {
    const containerRef = useRef<THREE.Group>(null);
    const modelRef = useRef<THREE.Group | null>(null);
    const materialPipelineRef = useRef(new MaterialPipeline());
    const { camera, invalidate } = useThree();
    const pointSizeMultiplier = useEditorStore((s) => s.pointSizeMultiplier);
    const setLocalModelWorldBounds = useLocalGlbStore((s) => s.setLocalModelWorldBounds);
    const setLocalAutoSimulationCellWorldBounds = useLocalGlbStore((s) => s.setLocalAutoSimulationCellWorldBounds);
    const controls = useThree((state) => (state as typeof state & {
        controls?: {
            target: THREE.Vector3;
            minDistance: number;
            maxDistance: number;
            update?: () => void;
        } | null;
    }).controls ?? null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) {
            return;
        }

        const abortController = new AbortController();
        let cancelled = false;

        if (modelRef.current) {
            modelRef.current.removeFromParent();
            disposeObject3DResources(modelRef.current);
            modelRef.current = null;
        }
        setLocalModelWorldBounds(null);
        setLocalAutoSimulationCellWorldBounds(null);

        const load = async () => {
            try {
                const loader = new FractalAssetLoader();
                const model = await loader.load(url, undefined, abortController.signal);

                if (cancelled) {
                    disposeObject3DResources(model);
                    return;
                }

                container.add(model);
                modelRef.current = model;

                const pointClouds = materialPipelineRef.current.detectPointClouds(model);
                pointClouds.forEach((points) => {
                    materialPipelineRef.current.configurePointCloud(points);
                });
                const hasPointClouds = pointClouds.length > 0;
                onContentTypeDetected?.({ hasPointClouds });
                applyPointSizeMultiplier(model, useEditorStore.getState().pointSizeMultiplier);

                const originalBounds = new THREE.Box3().setFromObject(model);
                if (!originalBounds.isEmpty()) {
                    const center = originalBounds.getCenter(new THREE.Vector3());
                    model.position.sub(center);
                    model.updateMatrixWorld(true);
                }

                const centeredWorldBounds = new THREE.Box3().setFromObject(model);
                if (!centeredWorldBounds.isEmpty()) {
                    setLocalModelWorldBounds(toModelWorldBounds(centeredWorldBounds));
                    setLocalAutoSimulationCellWorldBounds(
                        buildAutoSimulationCellBounds(centeredWorldBounds)
                    );
                }

                fitCameraToObject(camera, controls, model);

                invalidate();
            } catch (error: unknown) {
                if (isAbortLike(error)) {
                    return;
                }

                sileo.error({
                    title: 'Failed to load GLB',
                    description: error instanceof Error ? error.message : 'Unexpected loader error.'
                });
                setLocalModelWorldBounds(null);
                setLocalAutoSimulationCellWorldBounds(null);
            }
        };

        load().catch(() => undefined);

        return () => {
            cancelled = true;
            abortController.abort();

            if (modelRef.current) {
                modelRef.current.removeFromParent();
                disposeObject3DResources(modelRef.current);
                modelRef.current = null;
            }
            setLocalModelWorldBounds(null);
            setLocalAutoSimulationCellWorldBounds(null);
            materialPipelineRef.current.dispose();
            materialPipelineRef.current = new MaterialPipeline();
        };
    }, [
        camera,
        invalidate,
        onContentTypeDetected,
        setLocalAutoSimulationCellWorldBounds,
        setLocalModelWorldBounds,
        url
    ]);

    useEffect(() => {
        if (!modelRef.current) {
            return;
        }

        applyPointSizeMultiplier(modelRef.current, pointSizeMultiplier);
        invalidate();
    }, [invalidate, pointSizeMultiplier]);

    useEffect(() => {
        if (!modelRef.current) {
            return;
        }

        fitCameraToObject(camera, controls, modelRef.current);
        invalidate();
    }, [camera, controls, invalidate, url]);

    return (
        <group ref={containerRef} userData={{ isScreenshotCaptureTarget: true }} />
    );
};

export default LocalGlbViewer;
