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

import type { LineEntityHighlight, LineEntityRange, LineSceneSettings, PointCloudSceneSettings } from '@/modules/fractal/types/scene-config';

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
    lastLoadedResourceKey: string | null;
    isLoading: boolean;
    loadProgress: number;
    loadError: string | null;
}

interface TraversalCache {
    pointClouds: THREE.Points[];
    meshes: THREE.Mesh[];
}

interface LineGeometryUserData {
    basePositionArray?: Float32Array;
    lineWidthOffset?: number;
    baseColorArray?: Float32Array | Uint8Array;
    syntheticColorAttribute?: boolean;
}

interface MortonAttributePayload {
    name: string;
    itemSize: number;
    array: Float32Array;
}

interface MortonSortResult {
    type: 'morton-sort-result';
    id: number;
    permutation: Uint32Array;
    positions: Float32Array;
    attributes: MortonAttributePayload[];
}

const LINE_HIGHLIGHT_DIM_FACTOR = 0.15;

export type FractalParams = {
    url?: string | null;
    resourceKey?: string | null;
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
    lineSettings?: LineSceneSettings;
    lineHighlight?: LineEntityHighlight;
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
        lastLoadedResourceKey: null,
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
    private lastColorSceneKey: string | undefined = undefined;
    private lastColorValue: string | undefined = undefined;
    private lastBaseLineWidth: number | undefined = undefined;
    private lastLineWidth: number | undefined = undefined;
    private lastLineHighlightEntityId: number | null | undefined = undefined;
    private lastLineHighlightRanges: LineEntityRange[] | null | undefined = undefined;
    private mortonPermutation: Uint32Array | null = null;
    private traversalCache: TraversalCache = { pointClouds: [], meshes: [] };

    private mortonWorker: Worker | null = null;
    private currentSortRequestId = 0;

    private lineUpdateRafHandle: number | null = null;
    private pendingLineWidthSettings: LineSceneSettings | undefined = undefined;
    private hasPendingLineWidth = false;
    private pendingLineHighlight: LineEntityHighlight | undefined = undefined;
    private hasPendingLineHighlight = false;

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
        const nextResourceKey = params.resourceKey ?? params.url ?? null;
        const previousResourceKey = this.params.resourceKey ?? this.params.url ?? null;
        const didResourceChange = nextResourceKey !== previousResourceKey;
        this.params = params;
        if (didResourceChange) {
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
        const resourceKey = this.params.resourceKey ?? url;
        if (!url || !resourceKey || resourceKey === this.state.lastLoadedResourceKey || this.state.isLoading) return;
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
            resourceKey,
            sceneKey: this.params.sceneKey,
            clippingPlanes: this.params.sliceClippingPlanes.length
        });
        this.callbacks.onLoadingState?.({ isLoading: true, progress: 0, error: null });

        try {
            const loadedModel = await this.assetLoader.load(url, (progress) => {
                const pct = Math.round(progress * 100);
                this.state.loadProgress = pct;
                this.callbacks.onLoadingState?.({ isLoading: true, progress: pct, error: null });
            }, currentAbortController.signal, resourceKey);

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

            this.disposeModel();
            this.state.model = loadedModel;
            this.state.mesh = newMesh;
            this.state.bounds = bounds;
            this.state.lastLoadedResourceKey = resourceKey;
            this.traversalCache = this.buildTraversalCache(loadedModel);
            this.consecutiveLoadFailures = 0;

            this.kickoffMortonSort();

            debugFractal('engine.load-success', {
                url,
                resourceKey,
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
            this.lastColorSceneKey = undefined;
            this.lastColorValue = undefined;
            this.lastBaseLineWidth = undefined;
            this.lastLineWidth = undefined;
            this.lastLineHighlightEntityId = undefined;
            this.lastLineHighlightRanges = undefined;
            this.mortonPermutation = null;

            this.updatePointCloudSettings(this.params.pointCloudSettings, this.params.pointCloudSettings?.pointSizeMultiplier ?? 1);
            this.applyLineWidth(this.params.lineSettings);
            this.applyLineHighlight(this.params.lineHighlight);

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
            this.state.isLoading = false;
            if (!this.isDisposed) {
                this.surface.invalidate();
            }
            const latestUrl = this.params.url ?? null;
            const latestResourceKey = this.params.resourceKey ?? latestUrl;
            if (!this.isDisposed && latestUrl && latestResourceKey && latestResourceKey !== this.state.lastLoadedResourceKey
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
        const vertexCount = position.count;

        const positionsCopy = new Float32Array(positionsSource);

        const reorderableAttributeNames = ['iRadius', '_color_index'];
        const attributePayloads: MortonAttributePayload[] = [];
        for (const name of reorderableAttributeNames) {
            const attribute = points.geometry.getAttribute(name);
            if (attribute instanceof THREE.BufferAttribute && attribute.count === vertexCount) {
                attributePayloads.push({
                    name,
                    itemSize: attribute.itemSize,
                    array: new Float32Array(attribute.array as Float32Array)
                });
            }
        }

        const requestId = ++this.currentSortRequestId;
        const worker = this.getOrCreateMortonWorker();

        const handleMessage = (event: MessageEvent<MortonSortResult>) => {
            if (!event.data || event.data.type !== 'morton-sort-result') return;
            if (event.data.id !== requestId) return;
            worker.removeEventListener('message', handleMessage);
            if (this.isDisposed || this.currentSortRequestId !== requestId) return;
            this.applyMortonPermutation(points, event.data);
        };

        worker.addEventListener('message', handleMessage);
        const transfer: Transferable[] = [
            positionsCopy.buffer,
            ...attributePayloads.map((attribute) => attribute.array.buffer)
        ];
        worker.postMessage({
            type: 'morton-sort',
            id: requestId,
            positions: positionsCopy,
            attributes: attributePayloads
        }, transfer);
    }

    private applyMortonPermutation(points: THREE.Points, result: MortonSortResult): void {
        const permutation = result.permutation;

        const positionAttribute = points.geometry.getAttribute('position');
        if (positionAttribute instanceof THREE.BufferAttribute && positionAttribute.count === permutation.length) {
            positionAttribute.array = result.positions;
            positionAttribute.needsUpdate = true;
        }

        for (const attribute of result.attributes) {
            const target = points.geometry.getAttribute(attribute.name);
            if (target instanceof THREE.BufferAttribute && target.count === permutation.length) {
                target.array = attribute.array;
                target.needsUpdate = true;
            }
        }

        const colorAttribute = points.geometry.getAttribute('color');
        if (colorAttribute instanceof THREE.BufferAttribute && colorAttribute.count === permutation.length) {
            applyPermutationToAttribute(colorAttribute, permutation);
        }

        this.mortonPermutation = permutation;
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

    updateSceneColor(
        sceneKey: string | undefined,
        sceneVisualOverrides: SceneVisualOverrides
    ) {
        if (!this.state.model || !sceneKey) return;
        const color = sceneVisualOverrides[sceneKey]?.color;

        if (sceneKey === this.lastColorSceneKey && color === this.lastColorValue) {
            return;
        }
        this.lastColorSceneKey = sceneKey;
        this.lastColorValue = color;

        const override = color ? new THREE.Color(color) : null;

        this.traversalCache.pointClouds.forEach((pointCloud) => {
            const attribute = pointCloud.geometry.getAttribute('color');
            if (!attribute) return;
            const userData = pointCloud.userData as { originalVertexColors?: Float32Array | Uint8Array };
            const array = attribute.array as Float32Array | Uint8Array;

            if (override) {
                if (!userData.originalVertexColors) {
                    userData.originalVertexColors = array.slice() as Float32Array | Uint8Array;
                }
                const isByteColor = !(array instanceof Float32Array);
                const red = isByteColor ? Math.round(override.r * 255) : override.r;
                const green = isByteColor ? Math.round(override.g * 255) : override.g;
                const blue = isByteColor ? Math.round(override.b * 255) : override.b;
                for (let index = 0; index < attribute.count; index += 1) {
                    const offset = index * attribute.itemSize;
                    array[offset] = red;
                    array[offset + 1] = green;
                    array[offset + 2] = blue;
                }
                attribute.needsUpdate = true;
            } else if (userData.originalVertexColors) {
                (array as Float32Array).set(userData.originalVertexColors as Float32Array);
                delete userData.originalVertexColors;
                attribute.needsUpdate = true;
            }
        });

        this.traversalCache.meshes.forEach((mesh) => {
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            materials.forEach((material) => {
                if (!material || !('color' in material)) return;
                const colorMaterial = material as THREE.MeshStandardMaterial;
                const userData = colorMaterial.userData as {
                    originalColorHex?: number;
                    originalVertexColors?: boolean;
                };

                if (override) {
                    if (userData.originalColorHex === undefined) {
                        userData.originalColorHex = colorMaterial.color.getHex();
                        userData.originalVertexColors = colorMaterial.vertexColors;
                    }
                    colorMaterial.vertexColors = false;
                    colorMaterial.color.copy(override);
                    colorMaterial.needsUpdate = true;
                } else if (userData.originalColorHex !== undefined) {
                    colorMaterial.color.setHex(userData.originalColorHex);
                    colorMaterial.vertexColors = userData.originalVertexColors ?? false;
                    delete userData.originalColorHex;
                    delete userData.originalVertexColors;
                    colorMaterial.needsUpdate = true;
                }
            });
        });

        this.surface.invalidate();
    }

    /**
     * Writes the per-atom visibility mask (in original GLB-vertex order) into the
     * `aVisible` attribute the point-cloud fragment shader discards on. A null
     * mask resets every atom to visible (1.0). When a morton sort has permuted
     * the vertices, the mask is reordered to match the permutation.
     */
    setVisibilityMask(mask: Uint8Array | null) {
        if (this.traversalCache.pointClouds.length === 0) return;

        this.traversalCache.pointClouds.forEach((pointCloud) => {
            const attribute = pointCloud.geometry.getAttribute('aVisible');
            if (!(attribute instanceof THREE.BufferAttribute)) return;
            const target = attribute.array as Float32Array;
            if (mask === null) {
                target.fill(1);
                attribute.needsUpdate = true;
                return;
            }
            if (target.length !== mask.length) {
                warnFractal('engine.visibility-mask-mismatch', {
                    maskCount: mask.length,
                    attributeCount: target.length,
                    vertexCount: pointCloud.geometry.getAttribute('position')?.count ?? 0
                });
                return;
            }
            const permutation = this.mortonPermutation;
            if (permutation && permutation.length === mask.length) {
                for (let i = 0; i < permutation.length; i += 1) {
                    target[i] = mask[permutation[i]] ? 1 : 0;
                }
            } else {
                for (let i = 0; i < mask.length; i += 1) {
                    target[i] = mask[i] ? 1 : 0;
                }
            }
            attribute.needsUpdate = true;
        });

        this.surface.invalidate();
    }

    /**
     * Tints the atoms in `mask` (original GLB-vertex order, 1 = selected) with
     * `color`, leaving the rest at their baked color. A null mask/color restores
     * the original per-vertex colors. Mirrors `updateSceneColor`'s backup/restore
     * (own `preHighlightColors` key) and `setVisibilityMask`'s morton reordering.
     *
     * ponytail: if a scene-wide color override is also active they share the
     * `color` buffer; last writer wins. Combine both only if a user reports it.
     */
    setSelectionHighlight(mask: Uint8Array | null, color: string | null) {
        if (this.traversalCache.pointClouds.length === 0) return;

        const override = mask && color ? new THREE.Color(color) : null;

        this.traversalCache.pointClouds.forEach((pointCloud) => {
            const attribute = pointCloud.geometry.getAttribute('color');
            if (!(attribute instanceof THREE.BufferAttribute)) return;
            const userData = pointCloud.userData as { preHighlightColors?: Float32Array | Uint8Array };
            const array = attribute.array as Float32Array | Uint8Array;

            if (!override) {
                if (userData.preHighlightColors) {
                    array.set(userData.preHighlightColors);
                    delete userData.preHighlightColors;
                    attribute.needsUpdate = true;
                }
                return;
            }

            if (mask && mask.length !== attribute.count) {
                warnFractal('engine.selection-highlight-mismatch', {
                    maskCount: mask.length,
                    attributeCount: attribute.count
                });
                return;
            }

            // Always restore from the pristine snapshot first so changing the
            // selection/color doesn't compound onto a previous highlight.
            if (userData.preHighlightColors) {
                array.set(userData.preHighlightColors);
            } else {
                userData.preHighlightColors = array.slice() as Float32Array | Uint8Array;
            }

            const isByteColor = !(array instanceof Float32Array);
            const red = isByteColor ? Math.round(override.r * 255) : override.r;
            const green = isByteColor ? Math.round(override.g * 255) : override.g;
            const blue = isByteColor ? Math.round(override.b * 255) : override.b;
            const stride = attribute.itemSize;
            const permutation = this.mortonPermutation;
            const permuted = permutation && permutation.length === attribute.count;

            for (let i = 0; i < attribute.count; i += 1) {
                const originalIndex = permuted ? permutation![i] : i;
                if (!mask![originalIndex]) continue;
                const offset = i * stride;
                array[offset] = red;
                array[offset + 1] = green;
                array[offset + 2] = blue;
            }
            attribute.needsUpdate = true;
        });

        this.surface.invalidate();
    }

    updateLineWidth(settings?: LineSceneSettings) {
        this.pendingLineWidthSettings = settings;
        this.hasPendingLineWidth = true;
        this.scheduleLineUpdate();
    }

    private applyLineWidth(settings?: LineSceneSettings) {
        if (!this.state.model || this.traversalCache.meshes.length === 0) return;
        const baseLineWidth = settings?.baseLineWidth;
        const lineWidth = settings?.lineWidth;

        if (baseLineWidth === this.lastBaseLineWidth && lineWidth === this.lastLineWidth) {
            return;
        }
        this.lastBaseLineWidth = baseLineWidth;
        this.lastLineWidth = lineWidth;

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
            this.applyLineWidthToGeometry(mesh.geometry, lineWidthOffset);
        });

        this.surface.invalidate();
    }

    updateLineHighlight(highlight?: LineEntityHighlight) {
        this.pendingLineHighlight = highlight;
        this.hasPendingLineHighlight = true;
        this.scheduleLineUpdate();
    }

    private applyLineHighlight(highlight?: LineEntityHighlight) {
        if (!this.state.model || this.traversalCache.meshes.length === 0) return;
        const entityId = highlight?.entityId ?? null;
        const entityRanges = highlight?.entityRanges ?? null;
        if (entityId === this.lastLineHighlightEntityId && entityRanges === this.lastLineHighlightRanges) {
            return;
        }
        this.lastLineHighlightEntityId = entityId;
        this.lastLineHighlightRanges = entityRanges;

        const range = entityRanges?.find((candidate) => candidate.id === entityId) ?? null;

        const processedGeometries = new Set<THREE.BufferGeometry>();
        this.traversalCache.meshes.forEach((mesh) => {
            if (!(mesh.geometry instanceof THREE.BufferGeometry) || processedGeometries.has(mesh.geometry)) {
                return;
            }
            processedGeometries.add(mesh.geometry);
            this.applyLineHighlightToGeometry(mesh, range);
        });

        this.surface.invalidate();
    }

    private scheduleLineUpdate() {
        if (this.lineUpdateRafHandle !== null) return;
        this.lineUpdateRafHandle = requestAnimationFrame(() => {
            this.lineUpdateRafHandle = null;
            this.flushLineUpdates();
        });
    }

    private flushLineUpdates() {
        if (this.isDisposed) return;
        if (this.hasPendingLineWidth) {
            this.hasPendingLineWidth = false;
            this.applyLineWidth(this.pendingLineWidthSettings);
        }
        if (this.hasPendingLineHighlight) {
            this.hasPendingLineHighlight = false;
            this.applyLineHighlight(this.pendingLineHighlight);
        }
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
        if (this.lineUpdateRafHandle !== null) {
            cancelAnimationFrame(this.lineUpdateRafHandle);
            this.lineUpdateRafHandle = null;
        }
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

    private applyLineWidthToGeometry(geometry: THREE.BufferGeometry, lineWidthOffset: number) {
        const positionAttribute = geometry.getAttribute('position');
        const normalAttribute = geometry.getAttribute('normal');

        if (!(positionAttribute instanceof THREE.BufferAttribute) || !(normalAttribute instanceof THREE.BufferAttribute)) {
            warnFractal('engine.line-width-missing-attributes', {
                sceneKey: this.params.sceneKey,
                hasPositionAttribute: positionAttribute instanceof THREE.BufferAttribute,
                hasNormalAttribute: normalAttribute instanceof THREE.BufferAttribute,
                attributeKeys: Object.keys(geometry.attributes)
            });
            return;
        }

        if (positionAttribute.itemSize < 3 || normalAttribute.itemSize < 3) {
            warnFractal('engine.line-width-invalid-item-size', {
                sceneKey: this.params.sceneKey,
                positionItemSize: positionAttribute.itemSize,
                normalItemSize: normalAttribute.itemSize
            });
            return;
        }

        const userData = geometry.userData as THREE.BufferGeometry['userData'] & LineGeometryUserData;
        if (!userData.basePositionArray || userData.basePositionArray.length !== positionAttribute.array.length) {
            userData.basePositionArray = Float32Array.from(positionAttribute.array as ArrayLike<number>);
        }
        if (userData.lineWidthOffset === lineWidthOffset) return;

        const basePositions = userData.basePositionArray;
        const positions = positionAttribute.array as Float32Array;
        const normals = normalAttribute.array as ArrayLike<number>;
        for (let index = 0; index < positions.length; index += 1) {
            positions[index] = basePositions[index] + (Number(normals[index]) * lineWidthOffset);
        }
        positionAttribute.needsUpdate = true;
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        userData.lineWidthOffset = lineWidthOffset;
    }

    private setMeshVertexColors(mesh: THREE.Mesh, enabled: boolean) {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((material) => {
            material.vertexColors = enabled;
            material.needsUpdate = true;
        });
    }

    private applyLineHighlightToGeometry(mesh: THREE.Mesh, range: LineEntityRange | null) {
        const geometry = mesh.geometry;
        const index = geometry.getIndex();
        if (!index) return;
        const userData = geometry.userData as THREE.BufferGeometry['userData'] & LineGeometryUserData;

        if (!range) {
            if (!userData.baseColorArray) return;
            if (userData.syntheticColorAttribute) {
                geometry.deleteAttribute('color');
                this.setMeshVertexColors(mesh, false);
            } else {
                const attribute = geometry.getAttribute('color') as THREE.BufferAttribute;
                (attribute.array as Float32Array).set(userData.baseColorArray as Float32Array);
                attribute.needsUpdate = true;
            }
            delete userData.baseColorArray;
            delete userData.syntheticColorAttribute;
            return;
        }

        let colorAttribute = geometry.getAttribute('color');
        if (!(colorAttribute instanceof THREE.BufferAttribute)) {
            const vertexCount = geometry.getAttribute('position').count;
            colorAttribute = new THREE.BufferAttribute(new Float32Array(vertexCount * 3).fill(1), 3);
            geometry.setAttribute('color', colorAttribute);
            userData.syntheticColorAttribute = true;
            this.setMeshVertexColors(mesh, true);
        }

        const colors = colorAttribute.array as Float32Array | Uint8Array;
        if (!userData.baseColorArray) {
            userData.baseColorArray = colors.slice() as Float32Array | Uint8Array;
        }

        const base = userData.baseColorArray;
        const itemSize = colorAttribute.itemSize;
        for (let vertex = 0; vertex < colorAttribute.count; vertex += 1) {
            const offset = vertex * itemSize;
            colors[offset] = base[offset] * LINE_HIGHLIGHT_DIM_FACTOR;
            colors[offset + 1] = base[offset + 1] * LINE_HIGHLIGHT_DIM_FACTOR;
            colors[offset + 2] = base[offset + 2] * LINE_HIGHLIGHT_DIM_FACTOR;
        }

        const indices = index.array;
        const start = range.triangleStart * 3;
        const end = Math.min(start + (range.triangleCount * 3), indices.length);
        for (let entry = start; entry < end; entry += 1) {
            const offset = indices[entry] * itemSize;
            colors[offset] = base[offset];
            colors[offset + 1] = base[offset + 1];
            colors[offset + 2] = base[offset + 2];
        }

        colorAttribute.needsUpdate = true;
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
