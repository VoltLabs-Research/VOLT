import * as THREE from 'three';
import type { Pos3D, ModelLoadingState } from '@/modules/fractal/contracts/model';
import { MaterialPipeline } from '@/modules/fractal/services/material-pipeline';
import { MortonSortScheduler } from '@/modules/fractal/services/morton-sort-scheduler';
import { disposeObject3DResources } from '@/modules/fractal/utils/resource-disposal';
import { debugFractal, warnFractal } from '@/modules/fractal/utils/debug-log';
import { ModelTransform } from '@/modules/fractal/utils/model-transform';
import { forEachMaterial } from '@/modules/fractal/utils/renderable-materials';
import {
    applyPointCloudCameraPosition,
    applyPointCloudOpacity,
    applyPointCloudStyle
} from '@/modules/fractal/utils/point-cloud-styling';
import {
    applyPointCloudColorOverride,
    applyPointCloudSelectionHighlight,
    applyPointCloudVisibilityMask
} from '@/modules/fractal/utils/point-cloud-vertex-overrides';
import { applyMeshColorOverride, applyMeshOpacity } from '@/modules/fractal/utils/mesh-visual-overrides';
import { applyLineWidth } from '@/modules/fractal/utils/line-geometry-styling';
import type IFractalAssetLoader from '@/modules/fractal/contracts/asset-loader';
import type { SceneVisualOverrides } from '@/modules/fractal/contracts/scene';
import type { BoundsInfo } from '@/modules/fractal/utils/model-transform';
import type { LineSceneSettings, PointCloudSceneSettings } from '@/modules/fractal/contracts/scene-config';
import type { FractalSurface } from '@/modules/fractal/contracts/engine';

interface TraversalCache {
    pointClouds: THREE.Points[];
    meshes: THREE.Mesh[];
}

export type FractalParams = {
    url?: string | null;
    resourceKey?: string | null;
    sliceClippingPlanes: THREE.Plane[];
    position: Pos3D;
    rotation: Pos3D;
    scale: number;
    disableAutoTransform?: boolean;
    useFixedReference?: boolean;
    onEmptyData?: () => void;
    sceneKey?: string;
    pointCloudSettings?: PointCloudSceneSettings;
    lineSettings?: LineSceneSettings;
};

export type EngineCallbacks = {
    onModelLoaded?: (bounds: BoundsInfo) => void;
    onLoadingState?: (state: ModelLoadingState) => void;
    onModelAvailable?: (model: THREE.Group | null) => void;
    onContentTypeDetected?: (info: { hasPointClouds: boolean }) => void;
};

const createEmptyTraversalCache = (): TraversalCache => ({ pointClouds: [], meshes: [] });

const buildTraversalCache = (root: THREE.Object3D): TraversalCache => {
    const traversalCache = createEmptyTraversalCache();
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
};

const hasRenderableData = (traversalCache: TraversalCache): boolean => {
    const hasRenderablePoints = traversalCache.pointClouds.some((pointCloud) => (
        (pointCloud.geometry.getAttribute('position')?.count ?? 0) > 0
    ));
    if (hasRenderablePoints) return true;
    return traversalCache.meshes.some((mesh) => {
        const position = mesh.geometry.getAttribute('position');
        if (!position || position.count < 3) return false;
        const index = mesh.geometry.index;
        return index ? index.count >= 3 : true;
    });
};

const summarizeBounds = (bounds: BoundsInfo) => ({
    center: bounds.center.toArray(),
    size: bounds.size.toArray(),
    radius: bounds.boundingSphere.radius,
    maxDimension: bounds.maxDimension
});

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

export class FractalEngine {
    private materialPipeline = new MaterialPipeline();
    private modelTransform = new ModelTransform();
    private mortonSorter = new MortonSortScheduler();

    private model: THREE.Group | null = null;
    private traversalCache: TraversalCache = createEmptyTraversalCache();
    private mortonPermutation: Uint32Array | null = null;
    private lastLoadedResourceKey: string | null = null;
    private isLoading = false;

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
    private lastColorSceneKey: string | undefined = undefined;
    private lastColorValue: string | undefined = undefined;
    private lastBaseLineWidth: number | undefined = undefined;
    private lastLineWidth: number | undefined = undefined;

    private lineUpdateRafHandle: number | null = null;
    private pendingLineWidthSettings: LineSceneSettings | undefined = undefined;
    private hasPendingLineWidth = false;

    constructor(
        private surface: FractalSurface,
        private params: FractalParams,
        private assetLoader: IFractalAssetLoader,
        private callbacks: EngineCallbacks = {}
    ) {}

    configure(params: FractalParams) {
        const nextResourceKey = params.resourceKey ?? params.url ?? null;
        const previousResourceKey = this.params.resourceKey ?? this.params.url ?? null;
        this.params = params;
        if (nextResourceKey !== previousResourceKey) {
            this.consecutiveLoadFailures = 0;
        }
        this.surface.gl.localClippingEnabled = params.sliceClippingPlanes.length > 0;
        if (this.model) {
            this.applyClipping(this.traversalCache, params.sliceClippingPlanes);
        }
    }

    setCamera(camera: THREE.Camera) {
        this.surface.camera = camera;
    }

    async loadIfNeeded() {
        if (this.isDisposed) return;
        const url = this.params.url ?? null;
        const resourceKey = this.params.resourceKey ?? url;
        if (!url || !resourceKey || resourceKey === this.lastLoadedResourceKey || this.isLoading) return;
        if (this.consecutiveLoadFailures >= FractalEngine.MAX_LOAD_RETRIES) return;

        const currentLoadGeneration = ++this.loadGeneration;
        this.loadAbortController?.abort();
        const currentAbortController = new AbortController();
        this.loadAbortController = currentAbortController;
        this.isLoading = true;
        debugFractal('engine.load-start', {
            url,
            resourceKey,
            sceneKey: this.params.sceneKey,
            clippingPlanes: this.params.sliceClippingPlanes.length
        });
        this.callbacks.onLoadingState?.({ isLoading: true, progress: 0, error: null });

        try {
            const loadedModel = await this.assetLoader.load(url, (progress) => {
                this.callbacks.onLoadingState?.({
                    isLoading: true,
                    progress: Math.round(progress * 100),
                    error: null
                });
            }, currentAbortController.signal, resourceKey);

            if (this.isDisposed || currentLoadGeneration !== this.loadGeneration) {
                loadedModel.removeFromParent();
                disposeObject3DResources(loadedModel);
                return;
            }

            const nextTraversalCache = buildTraversalCache(loadedModel);
            if (!hasRenderableData(nextTraversalCache)) {
                warnFractal('engine.load-empty', {
                    url,
                    sceneKey: this.params.sceneKey
                });
                this.params.onEmptyData?.();
            }

            const hasPointClouds = nextTraversalCache.pointClouds.length > 0;
            this.callbacks.onContentTypeDetected?.({ hasPointClouds });
            if (hasPointClouds) {
                nextTraversalCache.pointClouds.forEach((pointCloud) => {
                    this.materialPipeline.configurePointCloud(pointCloud);
                });
            } else {
                this.materialPipeline.configureGeometry(loadedModel, this.params.sliceClippingPlanes);
            }

            this.applyClipping(nextTraversalCache, this.params.sliceClippingPlanes);
            const bounds = this.modelTransform.apply(loadedModel, {
                position: this.params.position,
                rotation: this.params.rotation,
                scale: this.params.scale,
                disableAutoTransform: this.params.disableAutoTransform,
                useFixedReference: this.params.useFixedReference
            });

            this.disposeModel();
            this.model = loadedModel;
            this.lastLoadedResourceKey = resourceKey;
            this.traversalCache = nextTraversalCache;
            this.consecutiveLoadFailures = 0;

            const [primaryPointCloud] = nextTraversalCache.pointClouds;
            if (primaryPointCloud) {
                this.mortonSorter.schedule(primaryPointCloud, (permutation) => {
                    this.mortonPermutation = permutation;
                    this.surface.invalidate();
                });
            }

            debugFractal('engine.load-success', {
                url,
                resourceKey,
                sceneKey: this.params.sceneKey,
                hasPointClouds,
                pointCloudCount: nextTraversalCache.pointClouds.length,
                meshCount: nextTraversalCache.meshes.length,
                bounds: summarizeBounds(bounds)
            });

            this.lastPointCloudSettings = undefined;
            this.lastPointSizeMultiplier = -1;
            this.lastOpacitySceneKey = undefined;
            this.lastOpacityValue = -1;
            this.lastPointOpacityValue = -1;
            this.lastColorSceneKey = undefined;
            this.lastColorValue = undefined;
            this.lastBaseLineWidth = undefined;
            this.lastLineWidth = undefined;
            this.mortonPermutation = null;

            this.updatePointCloudSettings(this.params.pointCloudSettings, this.params.pointCloudSettings?.pointSizeMultiplier ?? 1);
            this.syncLineWidth(this.params.lineSettings);

            this.callbacks.onModelLoaded?.(bounds);
            this.callbacks.onModelAvailable?.(loadedModel);
            this.callbacks.onLoadingState?.({ isLoading: false, progress: 100, error: null });
        } catch (error: unknown) {
            if (isAbortLikeError(error)) {
                this.callbacks.onLoadingState?.({ isLoading: false, progress: 0, error: null });
                return;
            }
            this.consecutiveLoadFailures += 1;
            const message = error instanceof Error ? error.message : String(error);
            warnFractal('engine.load-failed', {
                url,
                resourceKey,
                sceneKey: this.params.sceneKey,
                attempts: this.consecutiveLoadFailures,
                message
            });
            this.callbacks.onLoadingState?.({ isLoading: false, progress: 0, error: message });
        } finally {
            if (this.loadAbortController === currentAbortController) {
                this.loadAbortController = null;
            }
            this.isLoading = false;
            if (!this.isDisposed) {
                this.surface.invalidate();
            }
            const latestUrl = this.params.url ?? null;
            const latestResourceKey = this.params.resourceKey ?? latestUrl;
            if (!this.isDisposed && latestUrl && latestResourceKey && latestResourceKey !== this.lastLoadedResourceKey
                && this.consecutiveLoadFailures < FractalEngine.MAX_LOAD_RETRIES) {
                this.loadIfNeeded();
            }
        }
    }

    updatePointCloudSettings(settings: PointCloudSceneSettings | undefined, fallbackPointSizeMultiplier: number) {
        if (this.traversalCache.pointClouds.length === 0) return;
        if (settings === this.lastPointCloudSettings && fallbackPointSizeMultiplier === this.lastPointSizeMultiplier) {
            return;
        }
        this.lastPointCloudSettings = settings;
        this.lastPointSizeMultiplier = fallbackPointSizeMultiplier;

        applyPointCloudStyle(this.traversalCache.pointClouds, settings, fallbackPointSizeMultiplier);
        this.surface.invalidate();
    }

    updateOpacity(
        sceneKey: string | undefined,
        sceneVisualOverrides: SceneVisualOverrides,
        pointCloudSettings?: PointCloudSceneSettings
    ) {
        if (!this.model || !sceneKey) return;
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

        applyPointCloudOpacity(this.traversalCache.pointClouds, pointOpacity, pointCloudSettings);
        applyMeshOpacity(this.traversalCache.meshes, opacity);
        this.surface.invalidate();
    }

    updateSceneColor(
        sceneKey: string | undefined,
        sceneVisualOverrides: SceneVisualOverrides
    ) {
        if (!this.model || !sceneKey) return;
        const color = sceneVisualOverrides[sceneKey]?.color;

        if (sceneKey === this.lastColorSceneKey && color === this.lastColorValue) {
            return;
        }
        this.lastColorSceneKey = sceneKey;
        this.lastColorValue = color;

        const override = color ? new THREE.Color(color) : null;
        applyPointCloudColorOverride(this.traversalCache.pointClouds, override);
        applyMeshColorOverride(this.traversalCache.meshes, override);
        this.surface.invalidate();
    }

    setVisibilityMask(mask: Uint8Array | null) {
        if (this.traversalCache.pointClouds.length === 0) return;
        applyPointCloudVisibilityMask(this.traversalCache.pointClouds, mask, this.mortonPermutation);
        this.surface.invalidate();
    }

    setSelectionHighlight(mask: Uint8Array | null, color: string | null) {
        if (this.traversalCache.pointClouds.length === 0) return;
        applyPointCloudSelectionHighlight(this.traversalCache.pointClouds, mask, color, this.mortonPermutation);
        this.surface.invalidate();
    }

    updateLineWidth(settings?: LineSceneSettings) {
        this.pendingLineWidthSettings = settings;
        this.hasPendingLineWidth = true;
        this.scheduleLineUpdate();
    }


    updateCameraPosition(cameraPosition: THREE.Vector3) {
        if (this.traversalCache.pointClouds.length === 0) return;
        applyPointCloudCameraPosition(this.traversalCache.pointClouds, cameraPosition);
    }

    dispose() {
        this.isDisposed = true;
        this.loadGeneration += 1;
        this.loadAbortController?.abort();
        this.loadAbortController = null;
        if (this.lineUpdateRafHandle !== null) {
            cancelAnimationFrame(this.lineUpdateRafHandle);
            this.lineUpdateRafHandle = null;
        }
        this.callbacks.onLoadingState?.({ isLoading: false, progress: 0, error: null });
        this.callbacks.onModelAvailable?.(null);
        this.disposeModel();
        this.materialPipeline.dispose();
        this.mortonSorter.dispose();
    }

    private syncLineWidth(settings?: LineSceneSettings) {
        if (this.traversalCache.meshes.length === 0) return;
        const baseLineWidth = settings?.baseLineWidth;
        const lineWidth = settings?.lineWidth;
        if (baseLineWidth === this.lastBaseLineWidth && lineWidth === this.lastLineWidth) {
            return;
        }
        this.lastBaseLineWidth = baseLineWidth;
        this.lastLineWidth = lineWidth;

        applyLineWidth(this.traversalCache.meshes, settings);
        this.surface.invalidate();
    }


    private scheduleLineUpdate() {
        if (this.lineUpdateRafHandle !== null) return;
        this.lineUpdateRafHandle = requestAnimationFrame(() => {
            this.lineUpdateRafHandle = null;
            if (this.hasPendingLineWidth) {
                this.hasPendingLineWidth = false;
                this.syncLineWidth(this.pendingLineWidthSettings);
            }
        });
    }

    private applyClipping(traversalCache: TraversalCache, planes: THREE.Plane[]) {
        [
            ...traversalCache.pointClouds,
            ...traversalCache.meshes
        ].forEach((meshOrPoints) => {
            forEachMaterial(meshOrPoints, (material) => {
                if (material.clippingPlanes === planes) return;
                material.clippingPlanes = planes;
                material.needsUpdate = true;
            });
        });
        this.surface.invalidate();
    }

    private disposeModel() {
        if (this.model) {
            this.model.removeFromParent();
            disposeObject3DResources(this.model);
            this.model = null;
        }
        this.traversalCache = createEmptyTraversalCache();
    }
}
