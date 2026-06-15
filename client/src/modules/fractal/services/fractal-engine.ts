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

// Non-highlighted tubes keep this fraction of their baked color so the
// selected entity reads unambiguously, screenshots included.
const LINE_HIGHLIGHT_DIM_FACTOR = 0.15;

// Dedicated render layer for the offscreen pick pass. The point cloud is
// flagged onto it so the pick camera can render atoms ALONE (lines, meshes,
// grid, gizmo excluded) without disturbing the main scene.
const PICK_LAYER = 7;

// Floor for the pick/highlight sprite footprint, in device pixels. Matches the
// material pipeline's DEFAULT_MIN_POINT_SIZE so the pick disc never shrinks
// below the visible atom and small atoms stay clickable at distance.
const DEFAULT_PICK_MIN_POINT_SIZE = 2.0;

// The selection overlay redraws picked atoms this much larger than the base
// sprite so the highlight ring reads clearly around the original atom.
const HIGHLIGHT_POINT_SCALE = 1.6;

// Picking vertex shader: mirrors point-cloud.vert's perspective sizing so the
// pick footprint matches the visible sprite, and forwards the per-vertex slot
// index. Honors clipping planes so clipped atoms are not pickable.
const PICK_VERTEX_SHADER = `
#include <clipping_planes_pars_vertex>
uniform float pointScale;
uniform float uMinPointSize;
attribute float aPickIndex;
varying float vPickIndex;
void main(){
    vPickIndex = aPickIndex;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vec4 mvPosition = viewMatrix * worldPosition;
    gl_Position = projectionMatrix * mvPosition;
    float modelScale = length(modelMatrix[0].xyz);
    float perspectivePointSize = pointScale * modelScale * (300.0 / -mvPosition.z);
    gl_PointSize = max(uMinPointSize, perspectivePointSize);
    #include <clipping_planes_vertex>
}
`;

// Picking fragment shader: clips to the circular sprite (matching the visible
// disc) and encodes the slot index (+1, so 0 reads as empty background) into a
// 24-bit RGB triplet.
const PICK_FRAGMENT_SHADER = `
#include <clipping_planes_pars_fragment>
varying float vPickIndex;
void main(){
    #include <clipping_planes_fragment>
    vec2 coord = gl_PointCoord - vec2(0.5);
    if(length(coord) > 0.5) discard;
    float id = vPickIndex + 1.0;
    float r = floor(id / 65536.0);
    float g = floor(mod(id, 65536.0) / 256.0);
    float b = floor(mod(id, 256.0));
    gl_FragColor = vec4(r / 255.0, g / 255.0, b / 255.0, 1.0);
}
`;

// Highlight overlay shader: redraws selected atoms slightly enlarged in a flat
// highlight color on top of the main cloud. Reads the shared `aSelected`
// attribute; unselected atoms are discarded so the overlay only paints the
// selection (the base cloud shows through everywhere else).
const HIGHLIGHT_VERTEX_SHADER = `
#include <clipping_planes_pars_vertex>
uniform float pointScale;
uniform float uMinPointSize;
uniform float uHighlightScale;
attribute float aSelected;
varying float vSelected;
void main(){
    vSelected = aSelected;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vec4 mvPosition = viewMatrix * worldPosition;
    gl_Position = projectionMatrix * mvPosition;
    float modelScale = length(modelMatrix[0].xyz);
    float perspectivePointSize = pointScale * modelScale * (300.0 / -mvPosition.z) * uHighlightScale;
    gl_PointSize = max(uMinPointSize * uHighlightScale, perspectivePointSize);
    #include <clipping_planes_vertex>
}
`;

const HIGHLIGHT_FRAGMENT_SHADER = `
#include <clipping_planes_pars_fragment>
uniform vec3 uHighlightColor;
varying float vSelected;
void main(){
    #include <clipping_planes_fragment>
    if(vSelected < 0.5) discard;
    vec2 coord = gl_PointCoord - vec2(0.5);
    float radius = length(coord);
    if(radius > 0.5) discard;
    float ring = smoothstep(0.5, 0.32, radius);
    gl_FragColor = vec4(uHighlightColor, ring);
}
`;

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

    // GPU color-ID picking: an isolated offscreen target + flat-color material.
    // Built lazily on first pick, disposed with the engine. Never shared with
    // the main render pass.
    private pickRenderTarget: THREE.WebGLRenderTarget | null = null;
    private pickMaterial: THREE.ShaderMaterial | null = null;
    private readonly pickPixelBuffer = new Uint8Array(4);

    // Selection highlight is an additive sibling THREE.Points drawn on top of the
    // primary atom cloud — it shares the cloud's (morton-sorted) geometry and
    // adds only an `aSelected` attribute, so the baked vertex colors and the main
    // material are never touched (see plan risk #1).
    private highlightOverlay: THREE.Points | null = null;
    private highlightGeometry: THREE.BufferGeometry | null = null;

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
            this.updateLineWidth(this.params.lineSettings);
            this.updateLineHighlight(this.params.lineHighlight);

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
        // Why: keep the permutation so a per-atom visibility mask applied AFTER the
        // sort (it arrives in original parquet/vertex order) can be reordered to
        // match the now-permuted vertices.
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

        // Point cloud shaders read the baked COLOR_0 attribute directly, so a
        // uniform override rewrites the attribute and stashes the original
        // values for a lossless restore when the override clears.
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

    updateLineWidth(settings?: LineSceneSettings) {
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

    // Dims every line tube except the highlighted entity by rewriting the
    // vertex-color buffer in place (originals stashed for a lossless restore).
    // The triangle ranges come from the GLB's `.ranges.json` sidecar.
    updateLineHighlight(highlight?: LineEntityHighlight) {
        if (!this.state.model || this.traversalCache.meshes.length === 0) return;
        const entityId = highlight?.entityId ?? null;
        const entityRanges = highlight?.entityRanges ?? null;
        if (entityId === this.lastLineHighlightEntityId && entityRanges === this.lastLineHighlightRanges) {
            return;
        }
        this.lastLineHighlightEntityId = entityId;
        this.lastLineHighlightRanges = entityRanges;

        // An entity hidden by the active style has no range — treat it as no
        // highlight rather than dimming the whole model.
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

    /**
     * GPU color-ID pick. Renders the primary atom cloud alone into an isolated
     * offscreen target with each vertex slot encoded as a 24-bit RGB id, reads
     * the pixel under the (canvas-relative, CSS-pixel) cursor and decodes it.
     *
     * Returns the ORIGINAL atom index (pre-morton order, == row in the fetched
     * atoms array) so callers can map it to the frame-stable `id` column, or
     * `null` when the cursor is over empty background. CPU raycasting is
     * infeasible at VOLT's atom counts; this is O(1) on the read.
     */
    readPickAtPixel(screenX: number, screenY: number): number | null {
        const cloud = this.traversalCache.pointClouds[0];
        if (!cloud) return null;
        const gl = this.surface.gl;
        const size = new THREE.Vector2();
        gl.getSize(size);
        if (screenX < 0 || screenY < 0 || screenX > size.x || screenY > size.y) return null;

        this.renderPickPass(cloud);
        const target = this.pickRenderTarget;
        if (!target) return null;

        const dpr = gl.getPixelRatio();
        const px = Math.min(target.width - 1, Math.max(0, Math.round(screenX * dpr)));
        const deviceYFromTop = Math.round(screenY * dpr);
        // WebGL framebuffer origin is bottom-left, so flip the row.
        const py = Math.min(target.height - 1, Math.max(0, target.height - 1 - deviceYFromTop));

        gl.readRenderTargetPixels(target, px, py, 1, 1, this.pickPixelBuffer);
        const encoded = (this.pickPixelBuffer[0] << 16)
            | (this.pickPixelBuffer[1] << 8)
            | this.pickPixelBuffer[2];
        if (encoded === 0) return null;

        const slot = encoded - 1;
        const permutation = this.mortonPermutation;
        if (permutation && slot < permutation.length) return permutation[slot];
        return slot;
    }

    /**
     * Projects every atom of the primary cloud to canvas CSS-pixel space for
     * screen-space lasso/box hit-testing. The returned Float32Array is indexed
     * by ORIGINAL atom index (`out[i*2]`, `out[i*2+1]`); atoms outside the view
     * frustum (or behind the camera) are written as `NaN`. Returns `null` when
     * no point cloud is loaded.
     */
    projectAtomsToScreen(): Float32Array | null {
        const cloud = this.traversalCache.pointClouds[0];
        if (!cloud) return null;
        const position = cloud.geometry.getAttribute('position');
        if (!(position instanceof THREE.BufferAttribute)) return null;

        const gl = this.surface.gl;
        const size = new THREE.Vector2();
        gl.getSize(size);
        const camera = this.surface.camera;
        camera.updateMatrixWorld();
        cloud.updateWorldMatrix(true, false);

        const count = position.count;
        const out = new Float32Array(count * 2);
        const permutation = this.mortonPermutation;
        const vertex = new THREE.Vector3();
        for (let slot = 0; slot < count; slot += 1) {
            vertex.fromBufferAttribute(position, slot).applyMatrix4(cloud.matrixWorld).project(camera);
            const original = permutation && slot < permutation.length ? permutation[slot] : slot;
            const base = original * 2;
            if (vertex.z < -1 || vertex.z > 1 || vertex.x < -1 || vertex.x > 1 || vertex.y < -1 || vertex.y > 1) {
                out[base] = NaN;
                out[base + 1] = NaN;
                continue;
            }
            out[base] = (vertex.x * 0.5 + 0.5) * size.x;
            out[base + 1] = (1 - (vertex.y * 0.5 + 0.5)) * size.y;
        }
        return out;
    }

    /**
     * Highlights the selected atoms with an additive sibling overlay drawn on
     * top of the primary cloud. `selectedOriginalIndices` are ORIGINAL atom
     * indices (the caller maps `id` → index). This never mutates the baked
     * vertex colors or the main material — the overlay shares the cloud's
     * (morton-sorted) position buffer and carries only an `aSelected` channel,
     * so it is a pure additive layer (see plan risk #1). An empty set removes
     * the overlay entirely.
     */
    updateAtomHighlight(selectedOriginalIndices: Set<number>, highlightColor?: string) {
        const cloud = this.traversalCache.pointClouds[0];
        if (!cloud) {
            this.removeHighlightOverlay();
            return;
        }
        const position = cloud.geometry.getAttribute('position');
        if (!(position instanceof THREE.BufferAttribute)) return;

        if (selectedOriginalIndices.size === 0) {
            this.removeHighlightOverlay();
            return;
        }

        this.ensureHighlightOverlay(cloud);
        const geometry = this.highlightGeometry;
        const overlay = this.highlightOverlay;
        if (!geometry || !overlay) return;

        const count = position.count;
        let selected = geometry.getAttribute('aSelected');
        if (!(selected instanceof THREE.BufferAttribute) || selected.count !== count) {
            selected = new THREE.BufferAttribute(new Float32Array(count), 1);
            geometry.setAttribute('aSelected', selected);
        }
        // Share the cloud's position buffer so the overlay tracks the spatial
        // (morton) sort without copying.
        geometry.setAttribute('position', position);
        geometry.setDrawRange(0, count);

        const array = selected.array as Float32Array;
        const permutation = this.mortonPermutation;
        for (let slot = 0; slot < count; slot += 1) {
            const original = permutation && slot < permutation.length ? permutation[slot] : slot;
            array[slot] = selectedOriginalIndices.has(original) ? 1 : 0;
        }
        selected.needsUpdate = true;

        const material = overlay.material as THREE.ShaderMaterial;
        const sourceMaterial = cloud.material;
        if (sourceMaterial instanceof THREE.ShaderMaterial && sourceMaterial.uniforms) {
            material.uniforms.pointScale.value = sourceMaterial.uniforms.pointScale?.value ?? 1;
            material.uniforms.uMinPointSize.value = sourceMaterial.uniforms.uMinPointSize?.value ?? DEFAULT_PICK_MIN_POINT_SIZE;
            const planes = sourceMaterial.clippingPlanes ?? null;
            if (material.clippingPlanes !== planes) {
                material.clippingPlanes = planes;
                material.clipping = (planes?.length ?? 0) > 0;
                material.needsUpdate = true;
            }
        }
        if (highlightColor) {
            (material.uniforms.uHighlightColor.value as THREE.Color).set(highlightColor);
        }

        this.surface.invalidate();
    }

    // Lazily builds (and keeps sized to the drawing buffer) the offscreen target
    // the pick pass renders into. RGBA8 at 1:1 device resolution so the 24-bit
    // id survives the round-trip and a CSS-pixel cursor maps to one texel.
    private ensurePickRenderTarget(): THREE.WebGLRenderTarget {
        const drawingBufferSize = this.surface.gl.getDrawingBufferSize(new THREE.Vector2());
        const width = Math.max(1, drawingBufferSize.x);
        const height = Math.max(1, drawingBufferSize.y);
        if (!this.pickRenderTarget) {
            this.pickRenderTarget = new THREE.WebGLRenderTarget(width, height, {
                minFilter: THREE.NearestFilter,
                magFilter: THREE.NearestFilter,
                format: THREE.RGBAFormat,
                type: THREE.UnsignedByteType,
                depthBuffer: true,
                stencilBuffer: false
            });
        } else if (this.pickRenderTarget.width !== width || this.pickRenderTarget.height !== height) {
            this.pickRenderTarget.setSize(width, height);
        }
        return this.pickRenderTarget;
    }

    // The flat color-ID material shared across pick passes. RawShaderMaterial so
    // three injects no lighting/fog chunks; only the slot index and the active
    // clipping planes flow in, so clipped atoms never become pickable.
    private ensurePickMaterial(): THREE.ShaderMaterial {
        if (!this.pickMaterial) {
            this.pickMaterial = new THREE.ShaderMaterial({
                vertexShader: PICK_VERTEX_SHADER,
                fragmentShader: PICK_FRAGMENT_SHADER,
                uniforms: {
                    pointScale: { value: 1 },
                    uMinPointSize: { value: DEFAULT_PICK_MIN_POINT_SIZE }
                },
                clipping: true,
                depthTest: true,
                depthWrite: true,
                transparent: false
            });
        }
        return this.pickMaterial;
    }

    /**
     * Renders the primary atom cloud ALONE into the offscreen pick target with
     * the flat color-ID material. Isolation is by render layer: the cloud is
     * flagged onto PICK_LAYER and a throwaway camera clone is masked to only
     * that layer, so lines/meshes/grid/gizmo are excluded without mutating the
     * main scene graph. The renderer's autoClear + clear color are saved and
     * restored, leaving the main pass byte-for-byte unchanged.
     */
    private renderPickPass(cloud: THREE.Points): void {
        const gl = this.surface.gl;
        const target = this.ensurePickRenderTarget();
        const material = this.ensurePickMaterial();

        // Mirror the visible sprite footprint so the pick disc lines up with the
        // atom the user sees.
        const sourceMaterial = cloud.material;
        if (sourceMaterial instanceof THREE.ShaderMaterial && sourceMaterial.uniforms) {
            material.uniforms.pointScale.value = sourceMaterial.uniforms.pointScale?.value ?? 1;
            material.uniforms.uMinPointSize.value = sourceMaterial.uniforms.uMinPointSize?.value ?? DEFAULT_PICK_MIN_POINT_SIZE;
            const planes = sourceMaterial.clippingPlanes ?? null;
            if (material.clippingPlanes !== planes) {
                material.clippingPlanes = planes;
                material.clipping = (planes?.length ?? 0) > 0;
                material.needsUpdate = true;
            }
        }

        this.ensurePickIndexAttribute(cloud);

        // Render with the live camera (not a clone) so the pick math is
        // identical to projectAtomsToScreen and survives a parented camera rig.
        // Isolation is by layer mask: restrict the camera to PICK_LAYER and flag
        // the cloud onto it, so only atoms render; the mask is restored before
        // we return, so the next main frame is unaffected.
        const camera = this.surface.camera;
        const previousCameraMask = camera.layers.mask;
        camera.layers.set(PICK_LAYER);
        cloud.layers.enable(PICK_LAYER);

        const previousTarget = gl.getRenderTarget();
        const previousAutoClear = gl.autoClear;
        const previousClearColor = gl.getClearColor(new THREE.Color());
        const previousClearAlpha = gl.getClearAlpha();
        const previousOverride = this.surface.scene.overrideMaterial;
        const previousDrawRange = cloud.geometry.drawRange;

        // Encoded id 0 is reserved for "no atom", so a black clear reads as
        // empty background. Draw every slot regardless of the LOD draw range so
        // visible-but-LOD-decimated atoms remain pickable.
        gl.setRenderTarget(target);
        gl.autoClear = true;
        gl.setClearColor(0x000000, 1);
        this.surface.scene.overrideMaterial = material;
        const pickIndex = cloud.geometry.getAttribute('aPickIndex');
        cloud.geometry.setDrawRange(0, pickIndex ? pickIndex.count : cloud.geometry.getAttribute('position').count);

        gl.clear(true, true, false);
        gl.render(this.surface.scene, camera);

        cloud.geometry.setDrawRange(previousDrawRange.start, previousDrawRange.count);
        this.surface.scene.overrideMaterial = previousOverride;
        gl.setClearColor(previousClearColor, previousClearAlpha);
        gl.autoClear = previousAutoClear;
        gl.setRenderTarget(previousTarget);
        camera.layers.mask = previousCameraMask;
        cloud.layers.disable(PICK_LAYER);
    }

    // Per-vertex slot index consumed by the pick shader. Indices follow the
    // (morton-sorted) buffer order; readPickAtPixel maps the slot back to the
    // original atom index via the permutation. Rebuilt only when the vertex
    // count changes (i.e. a new model loaded).
    private ensurePickIndexAttribute(cloud: THREE.Points): void {
        const position = cloud.geometry.getAttribute('position');
        if (!(position instanceof THREE.BufferAttribute)) return;
        const existing = cloud.geometry.getAttribute('aPickIndex');
        if (existing instanceof THREE.BufferAttribute && existing.count === position.count) return;

        const indices = new Float32Array(position.count);
        for (let slot = 0; slot < position.count; slot += 1) indices[slot] = slot;
        cloud.geometry.setAttribute('aPickIndex', new THREE.BufferAttribute(indices, 1));
    }

    // Builds the additive highlight overlay once and parents it to the cloud so
    // it inherits the model transform. Reuses the same geometry across calls;
    // attributes are refreshed in updateAtomHighlight.
    private ensureHighlightOverlay(cloud: THREE.Points): void {
        if (this.highlightOverlay && this.highlightOverlay.parent === cloud) return;
        this.removeHighlightOverlay();

        const geometry = new THREE.BufferGeometry();
        const material = new THREE.ShaderMaterial({
            vertexShader: HIGHLIGHT_VERTEX_SHADER,
            fragmentShader: HIGHLIGHT_FRAGMENT_SHADER,
            uniforms: {
                pointScale: { value: 1 },
                uMinPointSize: { value: DEFAULT_PICK_MIN_POINT_SIZE },
                uHighlightScale: { value: HIGHLIGHT_POINT_SCALE },
                uHighlightColor: { value: new THREE.Color('#ffd400') }
            },
            transparent: true,
            depthTest: true,
            depthWrite: false,
            clipping: true,
            blending: THREE.NormalBlending
        });

        const overlay = new THREE.Points(geometry, material);
        overlay.frustumCulled = false;
        // Draw after the base cloud; renderOrder keeps the ring on top.
        overlay.renderOrder = 1;
        cloud.add(overlay);

        this.highlightOverlay = overlay;
        this.highlightGeometry = geometry;
    }

    private removeHighlightOverlay(): void {
        const overlay = this.highlightOverlay;
        if (overlay) {
            overlay.removeFromParent();
            (overlay.material as THREE.Material).dispose();
        }
        // The overlay shares the cloud's position buffer, so dispose only the
        // wrapper geometry — never the cloud attributes it borrows.
        if (this.highlightGeometry) {
            this.highlightGeometry.deleteAttribute('position');
            this.highlightGeometry.dispose();
        }
        this.highlightOverlay = null;
        this.highlightGeometry = null;
        this.surface.invalidate();
    }

    dispose() {
        this.isDisposed = true;
        this.loadGeneration += 1;
        this.loadAbortController?.abort();
        this.loadAbortController = null;
        this.callbacks.onLoadingState?.({ isLoading: false, progress: 0, error: null });
        this.callbacks.onModelAvailable?.(null);
        this.removeHighlightOverlay();
        this.disposeModel();
        this.materialPipeline.dispose();
        if (this.pickRenderTarget) {
            this.pickRenderTarget.dispose();
            this.pickRenderTarget = null;
        }
        if (this.pickMaterial) {
            this.pickMaterial.dispose();
            this.pickMaterial = null;
        }
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

        // Uniform-colored line GLBs ship without COLOR_0; highlighting needs a
        // per-vertex channel, so synthesize an all-ones one (a no-op tint).
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
