import * as THREE from 'three';
import type { BoxBounds, Pos3D, ModelLoadingState } from '@/modules/fractal/api/entities/model';
import { Plane } from 'three';
import { MaterialPipeline } from '@/modules/fractal/services/material-pipeline';
import { disposeObject3DResources } from '@/modules/fractal/utilities/resource-disposal';
import { debugFractal, warnFractal } from '@/modules/fractal/utilities/debug-log';
import type IFractalAssetLoader from '@/modules/fractal/api/entities/asset-loader';
import type { SceneVisualOverrides } from '@/modules/fractal/api/entities/scene';
import { ModelTransform } from '@/modules/fractal/utilities/model-transform';
import type { BoundsInfo } from '@/modules/fractal/utilities/model-transform';
import {
    PointCloudDetailLevel,
    PointCloudStyleMode
} from '@/modules/fractal/stores/contracts/editor/scene-types';
import MortonSortWorker from '@/modules/fractal/workers/morton-sort.worker?worker';
import { computeBoundingBox } from '@/modules/fractal/utilities/morton-sort';

import type { DislocationLineSceneSettings, PointCloudSceneSettings } from '@/modules/fractal/types/scene-config';

interface FractalSurface {
    scene: THREE.Scene;
    camera: THREE.Camera;
    gl: THREE.WebGLRenderer;
    invalidate: () => void;
}

interface FractalEngineState {
    model: THREE.Group | null;
    mesh: THREE.Mesh | THREE.Points | null;
    bounds: BoundsInfo | null;
    lastLoadedUrl: string | null;
    isLoading: boolean;
    loadProgress: number;
    loadError: string | null;
}

interface TraversalCache {
    pointClouds: THREE.Points[];
    meshes: THREE.Mesh[];
}

interface DislocationGeometryUserData {
    basePositionArray?: Float32Array;
    dislocationLineWidthOffset?: number;
}

export type FractalParams = {
    url?: string | null;
    sliceClippingPlanes: Plane[];
    position: Pos3D;
    rotation: Pos3D;
    scale: number;
    updateThrottle: number;
    disableAutoTransform?: boolean;
    useFixedReference?: boolean;
    onEmptyData?: () => void;
    sceneKey?: string;
    boxBounds?: BoxBounds;
    pointCloudSettings?: PointCloudSceneSettings;
    dislocationLineSettings?: DislocationLineSceneSettings;
};

type EngineCallbacks = {
    onModelLoaded?: (bounds: BoundsInfo) => void;
    onLoadingState?: (state: ModelLoadingState) => void;
    onModelAvailable?: (model: THREE.Group | null) => void;
    onContentTypeDetected?: (info: { hasPointClouds: boolean }) => void;
};

const getPointCloudDetailRatio = (detailLevel: PointCloudDetailLevel, pointCount: number): number => {
    if (detailLevel === PointCloudDetailLevel.Quality) return 1;
    if (detailLevel === PointCloudDetailLevel.Balanced) return 0.7;
    if (detailLevel === PointCloudDetailLevel.Performance) return 0.45;
    if (pointCount > 2_000_000) return 0.35;
    if (pointCount > 1_000_000) return 0.5;
    if (pointCount > 500_000) return 0.7;
    return 1;
};

const getPointCloudStyleUniforms = (settings: PointCloudSceneSettings) => {
    if (!settings.overridesEnabled) {
        return { edgeSoftness: 0, lightingMix: 1 };
    }
    if (settings.style === PointCloudStyleMode.Flat) {
        return { edgeSoftness: 0, lightingMix: 0 };
    }
    return { edgeSoftness: 0.18, lightingMix: 1 };
};

const summarizeBounds = (bounds: BoundsInfo | null) => {
    if (!bounds) return null;
    return {
        center: bounds.center.toArray(),
        size: bounds.size.toArray(),
        radius: bounds.boundingSphere.radius,
        maxDimension: bounds.maxDimension
    };
};

const isAbortLikeError = (error: unknown): boolean => {
    if (error instanceof DOMException && error.name === 'AbortError') return true;
    if (!(error instanceof Error)) return false;
    const maybeAbortError = error as Error & { code?: string; __CANCEL__?: boolean };
    const message = error.message.trim().toLowerCase();
    return error.name === 'AbortError'
        || error.name === 'CanceledError'
        || maybeAbortError.code === 'ERR_CANCELED'
        || maybeAbortError.__CANCEL__ === true
        || message === 'canceled'
        || message === 'cancelled';
};

const applyPermutationToAttribute = (attribute: THREE.BufferAttribute, permutation: Uint32Array): void => {
    const source = attribute.array as Float32Array;
    const itemSize = attribute.itemSize;
    const count = permutation.length;
    const reordered = new Float32Array(count * itemSize);
    for (let i = 0; i < count; i += 1) {
        const src = permutation[i] * itemSize;
        const dst = i * itemSize;
        for (let k = 0; k < itemSize; k += 1) {
            reordered[dst + k] = source[src + k];
        }
    }
    attribute.array = reordered;
    attribute.needsUpdate = true;
};

export class FractalEngine {
    private state: FractalEngineState = {
        model: null,
        mesh: null,
        bounds: null,
        lastLoadedUrl: null,
        isLoading: false,
        loadProgress: 0,
        loadError: null
    };

    private params: FractalParams;
    private callbacks: EngineCallbacks;
    private materialPipeline = new MaterialPipeline();
    private modelTransform = new ModelTransform();

    private loadGeneration = 0;
    private loadAbortController: AbortController | null = null;
    private isDisposed = false;
    private consecutiveLoadFailures = 0;
    private static readonly MAX_LOAD_RETRIES = 3;

    private lastPointCloudSettings: PointCloudSceneSettings | undefined = undefined;
    private lastPointSizeMultiplier: number = 1;
    private lastOpacitySceneKey: string | undefined = undefined;
    private lastOpacityValue: number = 1;
    private lastPointOpacityValue: number = 1;
    private lastDislocationBaseLineWidth: number | undefined = undefined;
    private lastDislocationLineWidth: number | undefined = undefined;
    private traversalCache: TraversalCache = { pointClouds: [], meshes: [] };

    private mortonWorker: Worker | null = null;
    private currentSortRequestId = 0;

    constructor(
        private surface: FractalSurface,
        params: FractalParams,
        private assetLoader: IFractalAssetLoader,
        callbacks: EngineCallbacks = {}
    ) {
        this.params = params;
        this.callbacks = callbacks;
    }

    configure(params: FractalParams) {
        const didUrlChange = params.url !== this.params.url;
        this.params = params;
        if (didUrlChange) {
            this.consecutiveLoadFailures = 0;
            this.state.loadError = null;
        }
        this.setLocalClippingEnabled((params.sliceClippingPlanes?.length ?? 0) > 0);
        if (this.state.model) {
            this.applyClippingToModel(this.state.model, params.sliceClippingPlanes);
        }
    }

    setCallbacks(callbacks: EngineCallbacks) {
        this.callbacks = callbacks;
    }

    setCamera(camera: THREE.Camera) {
        this.surface.camera = camera;
    }

    getModel(): THREE.Group | null {
        return this.state.model;
    }

    getBounds(): BoundsInfo | null {
        return this.state.bounds;
    }

    getPointClouds(): ReadonlyArray<THREE.Points> {
        return this.traversalCache.pointClouds;
    }

    async loadIfNeeded() {
        if (this.isDisposed) return;
        const url = this.params.url ?? null;
        if (!url || url === this.state.lastLoadedUrl || this.state.isLoading) return;
        if (this.consecutiveLoadFailures >= FractalEngine.MAX_LOAD_RETRIES) return;

        const currentLoadGeneration = ++this.loadGeneration;
        this.loadAbortController?.abort();
        const currentAbortController = new AbortController();
        this.loadAbortController = currentAbortController;
        this.state.isLoading = true;
        this.state.loadProgress = 0;
        this.state.loadError = null;
        debugFractal('engine.load-start', {
            url,
            sceneKey: this.params.sceneKey,
            clippingPlanes: this.params.sliceClippingPlanes.length
        });
        this.callbacks.onLoadingState?.({ isLoading: true, progress: 0, error: null });

        try {
            const loadedModel = await this.assetLoader.load(url, (progress) => {
                const pct = Math.round(progress * 100);
                this.state.loadProgress = pct;
                this.callbacks.onLoadingState?.({ isLoading: true, progress: pct, error: null });
            }, currentAbortController.signal);

            if (this.isDisposed || currentLoadGeneration !== this.loadGeneration) {
                loadedModel.removeFromParent();
                disposeObject3DResources(loadedModel);
                return;
            }

            if (!this.hasRenderableData(loadedModel)) {
                warnFractal('engine.load-empty', { url, sceneKey: this.params.sceneKey });
                this.params.onEmptyData?.();
            }

            const pointClouds = this.materialPipeline.detectPointClouds(loadedModel);
            const hasPointClouds = pointClouds.length > 0;
            this.callbacks.onContentTypeDetected?.({ hasPointClouds });

            let newMesh: THREE.Mesh | THREE.Points | null = null;
            if (hasPointClouds) {
                pointClouds.forEach((pointCloud) => {
                    this.materialPipeline.configurePointCloud(pointCloud);
                });
                // Why: the sphere-impostor promotion chops the silhouette at
                // close zoom and misbehaves with large simulation cells. Keep
                // the point-sprite representation that the GLB pipeline has
                // shipped since the initial commit.
                newMesh = this.pickPrimaryAtomNode(loadedModel);
            } else {
                newMesh = this.materialPipeline.configureGeometry(loadedModel, this.params.sliceClippingPlanes);
            }

            this.applyClippingToModel(loadedModel, this.params.sliceClippingPlanes);
            const bounds = this.modelTransform.apply(loadedModel, {
                position: this.params.position,
                rotation: this.params.rotation,
                scale: this.params.scale,
                disableAutoTransform: this.params.disableAutoTransform,
                useFixedReference: this.params.useFixedReference
            });

            // Double-buffer swap: Why: only dispose the previous model once the
            // new one is fully wired up, so the renderer never sees an empty
            // scene.
            this.disposeModel();
            this.state.model = loadedModel;
            this.state.mesh = newMesh;
            this.state.bounds = bounds;
            this.state.lastLoadedUrl = url;
            this.traversalCache = this.buildTraversalCache(loadedModel);
            this.consecutiveLoadFailures = 0;

            this.kickoffMortonSort();

            debugFractal('engine.load-success', {
                url,
                sceneKey: this.params.sceneKey,
                hasPointClouds,
                pointCloudCount: this.traversalCache.pointClouds.length,
                meshCount: this.traversalCache.meshes.length,
                bounds: summarizeBounds(bounds)
            });

            this.lastPointCloudSettings = undefined;
            this.lastPointSizeMultiplier = -1;
            this.lastOpacitySceneKey = undefined;
            this.lastOpacityValue = -1;
            this.lastPointOpacityValue = -1;
            this.lastDislocationBaseLineWidth = undefined;
            this.lastDislocationLineWidth = undefined;

            this.updatePointCloudSettings(this.params.pointCloudSettings, this.params.pointCloudSettings?.pointSizeMultiplier ?? 1);
            this.updateDislocationLineWidth(this.params.dislocationLineSettings);

            this.callbacks.onModelLoaded?.(bounds);
            this.callbacks.onModelAvailable?.(loadedModel);
            this.callbacks.onLoadingState?.({ isLoading: false, progress: 100, error: null });
        } catch (error: unknown) {
            if (isAbortLikeError(error)) {
                this.callbacks.onLoadingState?.({ isLoading: false, progress: 0, error: null });
                return;
            }
            this.consecutiveLoadFailures += 1;
            let message = String(error);
            if (error instanceof Error) message = error.message;
            this.state.loadError = message;
            warnFractal('engine.load-failed', {
                url,
                sceneKey: this.params.sceneKey,
                attempts: this.consecutiveLoadFailures,
                message
            });
            this.callbacks.onLoadingState?.({ isLoading: false, progress: 0, error: message });
        } finally {
            if (this.loadAbortController === currentAbortController) {
                this.loadAbortController = null;
            }
            this.state.isLoading = false;
            if (!this.isDisposed) {
                this.surface.invalidate();
            }
            const latestUrl = this.params.url ?? null;
            if (!this.isDisposed && latestUrl && latestUrl !== this.state.lastLoadedUrl
                && this.consecutiveLoadFailures < FractalEngine.MAX_LOAD_RETRIES) {
                this.loadIfNeeded();
            }
        }
    }

    private hasRenderableData(model: THREE.Object3D) {
        let hasData = false;
        model.traverse((child) => {
            if (hasData) return;
            if (child instanceof THREE.Points) {
                const geom = child.geometry;
                const pos = geom?.getAttribute('position');
                if (pos && pos.count > 0) hasData = true;
                return;
            }
            if (child instanceof THREE.Mesh) {
                const geom = child.geometry;
                const pos = geom?.getAttribute('position');
                if (!pos || pos.count < 3) return;
                if (geom.index) {
                    if (geom.index.count >= 3) hasData = true;
                    return;
                }
                if (pos.count >= 3) hasData = true;
            }
        });
        return hasData;
    }

    private getOrCreateMortonWorker(): Worker {
        if (!this.mortonWorker) {
            this.mortonWorker = new MortonSortWorker();
        }
        return this.mortonWorker;
    }

    private kickoffMortonSort(): void {
        const points = this.traversalCache.pointClouds[0];
        if (!points) return;

        const position = points.geometry.getAttribute('position');
        if (!(position instanceof THREE.BufferAttribute)) return;
        const positionsSource = position.array as Float32Array;

        const positionsCopy = new Float32Array(positionsSource);
        const requestId = ++this.currentSortRequestId;
        const worker = this.getOrCreateMortonWorker();

        const handleMessage = (event: MessageEvent<{ type: string; id: number; permutation: Uint32Array }>) => {
            if (!event.data || event.data.type !== 'morton-sort-result') return;
            if (event.data.id !== requestId) return;
            worker.removeEventListener('message', handleMessage);
            if (this.isDisposed || this.currentSortRequestId !== requestId) return;
            this.applyMortonPermutation(points, event.data.permutation);
        };

        worker.addEventListener('message', handleMessage);
        worker.postMessage({
            type: 'morton-sort',
            id: requestId,
            positions: positionsCopy
        }, [positionsCopy.buffer]);
    }

    private applyMortonPermutation(points: THREE.Points, permutation: Uint32Array): void {
        const attributeNames: string[] = ['position', 'color', 'iRadius', '_color_index'];
        for (const name of attributeNames) {
            const attribute = points.geometry.getAttribute(name);
            if (attribute instanceof THREE.BufferAttribute && attribute.count === permutation.length) {
                applyPermutationToAttribute(attribute, permutation);
            }
        }
        points.geometry.computeBoundingBox();
        points.geometry.computeBoundingSphere();
        this.surface.invalidate();
    }

    updatePointCloudSettings(settings: PointCloudSceneSettings | undefined, fallbackPointSizeMultiplier: number) {
        if (!this.state.model) return;
        if (this.traversalCache.pointClouds.length === 0) return;
        if (settings === this.lastPointCloudSettings && fallbackPointSizeMultiplier === this.lastPointSizeMultiplier) {
            return;
        }
        this.lastPointCloudSettings = settings;
        this.lastPointSizeMultiplier = fallbackPointSizeMultiplier;

        const pointCloudSettings: PointCloudSceneSettings = settings ?? {
            overridesEnabled: false,
            detailLevel: PointCloudDetailLevel.Auto,
            useSceneOpacity: true,
            style: PointCloudStyleMode.Softened,
            pointSizeMultiplier: fallbackPointSizeMultiplier
        };
        const styleUniforms = getPointCloudStyleUniforms(pointCloudSettings);

        this.traversalCache.pointClouds.forEach((pointCloud) => {
            if (!pointCloud.material) return;
            const material = pointCloud.material;
            if (!(material instanceof THREE.ShaderMaterial)) return;

            // Why: `basePointScale` is written on the `THREE.Points` userData
            // by the material pipeline, not on the material's userData — so the
            // previous read was always `undefined` and the user's point-size
            // slider had no effect at runtime.
            const baseScale = (pointCloud.userData as { basePointScale?: number }).basePointScale;
            if (typeof baseScale === 'number' && material.uniforms?.pointScale) {
                material.uniforms.pointScale.value = baseScale * pointCloudSettings.pointSizeMultiplier;
            }
            if (material.uniforms?.edgeSoftness) {
                material.uniforms.edgeSoftness.value = styleUniforms.edgeSoftness;
            }
            if (material.uniforms?.lightingMix) {
                material.uniforms.lightingMix.value = styleUniforms.lightingMix;
            }

            const positions = pointCloud.geometry.getAttribute('position');
            const pointCount = positions?.count ?? 0;
            const drawRatio = pointCloudSettings.overridesEnabled
                ? getPointCloudDetailRatio(pointCloudSettings.detailLevel, pointCount)
                : 1;
            pointCloud.geometry.setDrawRange(0, Math.max(1, Math.floor(pointCount * drawRatio)));
        });

        this.surface.invalidate();
    }

    updateOpacity(
        sceneKey: string | undefined,
        sceneVisualOverrides: SceneVisualOverrides,
        pointCloudSettings?: PointCloudSceneSettings
    ) {
        if (!this.state.model || !sceneKey) return;
        const opacity = sceneVisualOverrides[sceneKey]?.opacity ?? 1.0;
        const pointOpacity = pointCloudSettings?.overridesEnabled && !pointCloudSettings.useSceneOpacity
            ? 1
            : opacity;

        if (sceneKey === this.lastOpacitySceneKey
            && opacity === this.lastOpacityValue
            && pointOpacity === this.lastPointOpacityValue) {
            return;
        }
        this.lastOpacitySceneKey = sceneKey;
        this.lastOpacityValue = opacity;
        this.lastPointOpacityValue = pointOpacity;

        this.traversalCache.pointClouds.forEach((pointCloud) => {
            if (!pointCloud.material) return;
            const mat = pointCloud.material;
            if (!(mat instanceof THREE.ShaderMaterial)) return;

            if (mat.uniforms?.opacity) {
                mat.uniforms.opacity.value = pointOpacity;
            }
            if (pointOpacity < 1) {
                mat.depthWrite = false;
                mat.alphaTest = Math.max(0.01, 0.5 * pointOpacity);
            } else {
                mat.depthWrite = true;
                mat.alphaTest = 0.5;
            }
            mat.needsUpdate = true;

            const positions = pointCloud.geometry.getAttribute('position');
            const pointCount = positions?.count ?? 0;
            const detailRatio = pointCloudSettings?.overridesEnabled
                ? getPointCloudDetailRatio(pointCloudSettings.detailLevel, pointCount)
                : 1;
            pointCloud.geometry.setDrawRange(0, Math.max(1, Math.floor(pointCount * detailRatio)));
        });

        this.traversalCache.meshes.forEach((mesh) => {
            if (!mesh.material) return;
            const mat = mesh.material;
            if (Array.isArray(mat)) {
                mat.forEach((material) => {
                    material.transparent = opacity < 1.0;
                    material.opacity = opacity;
                    material.needsUpdate = true;
                });
                return;
            }
            mat.transparent = opacity < 1.0;
            mat.opacity = opacity;
            mat.needsUpdate = true;
        });
        this.surface.invalidate();
    }

    updateDislocationLineWidth(settings?: DislocationLineSceneSettings) {
        if (!this.state.model || this.traversalCache.meshes.length === 0) return;
        const baseLineWidth = settings?.baseLineWidth;
        const lineWidth = settings?.lineWidth;

        if (baseLineWidth === this.lastDislocationBaseLineWidth && lineWidth === this.lastDislocationLineWidth) {
            return;
        }
        this.lastDislocationBaseLineWidth = baseLineWidth;
        this.lastDislocationLineWidth = lineWidth;

        const hasValidSettings = Number.isFinite(baseLineWidth)
            && Number.isFinite(lineWidth)
            && Number(baseLineWidth) > 0
            && Number(lineWidth) > 0;
        const lineWidthOffset = hasValidSettings
            ? (Number(lineWidth) - Number(baseLineWidth)) * 0.5
            : 0;

        const processedGeometries = new Set<THREE.BufferGeometry>();
        this.traversalCache.meshes.forEach((mesh) => {
            if (!(mesh.geometry instanceof THREE.BufferGeometry) || processedGeometries.has(mesh.geometry)) {
                return;
            }
            processedGeometries.add(mesh.geometry);
            this.applyDislocationLineWidthToGeometry(mesh.geometry, lineWidthOffset);
        });

        this.surface.invalidate();
    }

    updateCameraPosition(cameraPosition: THREE.Vector3) {
        if (!this.state.model) return;
        if (this.traversalCache.pointClouds.length === 0) return;

        const pokeCamera = (mat: THREE.Material) => {
            if (!(mat instanceof THREE.ShaderMaterial) || !mat.uniforms?.cameraPosition) return;
            (mat.uniforms.cameraPosition.value as THREE.Vector3).copy(cameraPosition);
        };

        this.traversalCache.pointClouds.forEach((pointCloud) => {
            if (pointCloud.material) pokeCamera(pointCloud.material as THREE.Material);
        });
    }

    getPositionsBoundingBox() {
        const points = this.traversalCache.pointClouds[0];
        if (points) {
            const attribute = points.geometry.getAttribute('position');
            if (attribute instanceof THREE.BufferAttribute) {
                return computeBoundingBox(attribute.array as Float32Array);
            }
        }
        return null;
    }

    dispose() {
        this.isDisposed = true;
        this.loadGeneration += 1;
        this.loadAbortController?.abort();
        this.loadAbortController = null;
        this.callbacks.onLoadingState?.({ isLoading: false, progress: 0, error: null });
        this.callbacks.onModelAvailable?.(null);
        this.disposeModel();
        this.materialPipeline.dispose();
        if (this.mortonWorker) {
            this.mortonWorker.terminate();
            this.mortonWorker = null;
        }
    }

    private setLocalClippingEnabled(enabled: boolean) {
        this.surface.gl.localClippingEnabled = enabled;
    }

    private applyDislocationLineWidthToGeometry(geometry: THREE.BufferGeometry, lineWidthOffset: number) {
        const positionAttribute = geometry.getAttribute('position');
        const normalAttribute = geometry.getAttribute('normal');

        if (!(positionAttribute instanceof THREE.BufferAttribute) || !(normalAttribute instanceof THREE.BufferAttribute)) {
            warnFractal('engine.dislocation-line-width-missing-attributes', {
                sceneKey: this.params.sceneKey,
                hasPositionAttribute: positionAttribute instanceof THREE.BufferAttribute,
                hasNormalAttribute: normalAttribute instanceof THREE.BufferAttribute,
                attributeKeys: Object.keys(geometry.attributes)
            });
            return;
        }

        if (positionAttribute.itemSize < 3 || normalAttribute.itemSize < 3) {
            warnFractal('engine.dislocation-line-width-invalid-item-size', {
                sceneKey: this.params.sceneKey,
                positionItemSize: positionAttribute.itemSize,
                normalItemSize: normalAttribute.itemSize
            });
            return;
        }

        const userData = geometry.userData as THREE.BufferGeometry['userData'] & DislocationGeometryUserData;
        if (!userData.basePositionArray || userData.basePositionArray.length !== positionAttribute.array.length) {
            userData.basePositionArray = Float32Array.from(positionAttribute.array as ArrayLike<number>);
        }
        if (userData.dislocationLineWidthOffset === lineWidthOffset) return;

        const basePositions = userData.basePositionArray;
        const positions = positionAttribute.array as Float32Array;
        const normals = normalAttribute.array as ArrayLike<number>;
        for (let index = 0; index < positions.length; index += 1) {
            positions[index] = basePositions[index] + (Number(normals[index]) * lineWidthOffset);
        }
        positionAttribute.needsUpdate = true;
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        userData.dislocationLineWidthOffset = lineWidthOffset;
    }

    private applyClippingToModel(root: THREE.Object3D, planes: Plane[]) {
        const traversalCache = root === this.state.model
            ? this.traversalCache
            : this.buildTraversalCache(root);

        [
            ...traversalCache.pointClouds,
            ...traversalCache.meshes
        ].forEach((meshOrPoints) => {
            if (!meshOrPoints.material) return;
            const materials = Array.isArray(meshOrPoints.material)
                ? meshOrPoints.material
                : [meshOrPoints.material];
            materials.forEach((material: THREE.Material) => {
                const previousPlanes = material.clippingPlanes;
                const previousCount = previousPlanes?.length ?? 0;
                const nextCount = planes.length;
                material.clippingPlanes = planes;
                if (previousPlanes !== planes || previousCount !== nextCount) {
                    material.needsUpdate = true;
                }
            });
        });
        this.surface.invalidate();
    }

    private disposeModel() {
        if (!this.state.model) {
            this.state.mesh = null;
            this.state.bounds = null;
            this.traversalCache = { pointClouds: [], meshes: [] };
            return;
        }
        this.state.model.removeFromParent();
        disposeObject3DResources(this.state.model);
        this.state.model = null;
        this.state.mesh = null;
        this.state.bounds = null;
        this.traversalCache = { pointClouds: [], meshes: [] };
    }

    private buildTraversalCache(root: THREE.Object3D): TraversalCache {
        const traversalCache: TraversalCache = { pointClouds: [], meshes: [] };
        root.traverse((child) => {
            if (child instanceof THREE.Points) {
                traversalCache.pointClouds.push(child);
                return;
            }
            if (child instanceof THREE.Mesh) {
                traversalCache.meshes.push(child);
            }
        });
        return traversalCache;
    }

    private pickPrimaryAtomNode(root: THREE.Object3D): THREE.Mesh | THREE.Points | null {
        let points: THREE.Points | null = null;
        root.traverse((child) => {
            if (!points && child instanceof THREE.Points) points = child;
        });
        return points;
    }

}
