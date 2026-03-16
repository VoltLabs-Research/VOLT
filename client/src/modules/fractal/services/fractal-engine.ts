import * as THREE from 'three';
import type { BoxBounds, Pos3D, ModelLoadingState } from '@/modules/fractal/api/entities/model';
import { Plane } from 'three';
import { MaterialPipeline } from '@/modules/fractal/services/material-pipeline';
import { disposeObject3DResources } from '@/modules/fractal/utilities/resource-disposal';
import type IFractalAssetLoader from '@/modules/fractal/api/entities/asset-loader';
import { ModelTransform } from '@/modules/fractal/utilities/model-transform';
import type { BoundsInfo } from '@/modules/fractal/utilities/model-transform';
import {
    PointCloudDetailLevel,
    PointCloudStyleMode
} from '@/modules/fractal/stores/contracts/editor/scene-types';

import type { PointCloudSceneSettings } from '@/modules/fractal/types/scene-config';

interface FractalSurface {
    scene: THREE.Scene;
    camera: THREE.Camera;
    gl: THREE.WebGLRenderer;
    invalidate: () => void;
};

interface FractalEngineState {
    model: THREE.Group | null;
    mesh: THREE.Mesh | THREE.Points | null;
    bounds: BoundsInfo | null;
    lastLoadedUrl: string | null;
    isLoading: boolean;
    loadProgress: number;
    loadError: string | null;
};

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
};

type EngineCallbacks = {
    onModelLoaded?: (bounds: BoundsInfo) => void;
    onLoadingState?: (state: ModelLoadingState) => void;
    onModelAvailable?: (model: THREE.Group | null) => void;
};

const getPointCloudDetailRatio = (detailLevel: PointCloudDetailLevel, pointCount: number): number => {
    if (detailLevel === PointCloudDetailLevel.Quality) {
        return 1;
    }

    if (detailLevel === PointCloudDetailLevel.Balanced) {
        return 0.7;
    }

    if (detailLevel === PointCloudDetailLevel.Performance) {
        return 0.45;
    }

    if (pointCount > 2_000_000) {
        return 0.35;
    }

    if (pointCount > 1_000_000) {
        return 0.5;
    }

    if (pointCount > 500_000) {
        return 0.7;
    }

    return 1;
};

const getPointCloudStyleUniforms = (settings: PointCloudSceneSettings) => {
    if (!settings.overridesEnabled) {
        return {
            edgeSoftness: 0,
            lightingMix: 1
        };
    }

    if (settings.style === PointCloudStyleMode.Flat) {
        return {
            edgeSoftness: 0,
            lightingMix: 0
        };
    }

    return {
        edgeSoftness: 0.18,
        lightingMix: 1
    };
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
        this.params = params;
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

    async loadIfNeeded() {
        if (this.isDisposed) return;

        const url = this.params.url ?? null;
        if (!url || url === this.state.lastLoadedUrl || this.state.isLoading) return;

        if (this.consecutiveLoadFailures >= FractalEngine.MAX_LOAD_RETRIES) {
            return;
        }

        const currentLoadGeneration = ++this.loadGeneration;
        this.loadAbortController?.abort();
        this.loadAbortController = new AbortController();
        this.state.isLoading = true;
        this.state.loadProgress = 0;
        this.state.loadError = null;
        this.callbacks.onLoadingState?.({
            isLoading: true,
            progress: 0,
            error: null
        });

        try {
            const loadedModel = await this.assetLoader.load(url, (progress) => {
                const pct = Math.round(progress * 100);
                this.state.loadProgress = pct;
                this.callbacks.onLoadingState?.({
                    isLoading: true,
                    progress: pct,
                    error: null
                });
            }, this.loadAbortController.signal);

            if (this.isDisposed || currentLoadGeneration !== this.loadGeneration) {
                loadedModel.removeFromParent();
                disposeObject3DResources(loadedModel);
                return;
            }

            if (!this.hasRenderableData(loadedModel)) {
                this.params.onEmptyData?.();
            }

            const pointClouds = this.materialPipeline.detectPointClouds(loadedModel);
            let newMesh: THREE.Mesh | THREE.Points | null = null;
            if (pointClouds.length > 0) {
                pointClouds.forEach((pointCloud) => {
                    this.materialPipeline.configurePointCloud(pointCloud);
                });
                newMesh = pointClouds[0] ?? null;
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
            this.state.lastLoadedUrl = url;
            this.consecutiveLoadFailures = 0;

            // Reset caches so the first application on the new model always runs.
            this.lastPointCloudSettings = undefined;
            this.lastPointSizeMultiplier = -1;
            this.lastOpacitySceneKey = undefined;
            this.lastOpacityValue = -1;
            this.lastPointOpacityValue = -1;

            this.updatePointCloudSettings(this.params.pointCloudSettings, this.params.pointCloudSettings?.pointSizeMultiplier ?? 1);

            this.callbacks.onModelLoaded?.(bounds);
            this.callbacks.onModelAvailable?.(loadedModel);
            this.callbacks.onLoadingState?.({
                isLoading: false,
                progress: 100,
                error: null
            });
        } catch (error: unknown) {
            if (error instanceof Error && error.name === 'AbortError') {
                this.callbacks.onLoadingState?.({
                    isLoading: false,
                    progress: 0,
                    error: null
                });
                return;
            }

            this.consecutiveLoadFailures += 1;
            let message = String(error);
            if (error instanceof Error) {
                message = error.message;
            }
            this.state.loadError = message;
            this.callbacks.onLoadingState?.({
                isLoading: false,
                progress: 0,
                error: message
            });
        } finally {
            this.loadAbortController = null;
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

    updatePointCloudSettings(settings: PointCloudSceneSettings | undefined, fallbackPointSizeMultiplier: number) {
        if (!this.state.model) {
            return;
        }

        if (settings === this.lastPointCloudSettings
            && fallbackPointSizeMultiplier === this.lastPointSizeMultiplier) {
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

        this.state.model.traverse((child) => {
            if (!(child instanceof THREE.Points) || !child.material) {
                return;
            }

            const material = child.material;
            if (!(material instanceof THREE.ShaderMaterial)) {
                return;
            }

            const baseScale = material.userData.basePointScale;
            if (typeof baseScale === 'number' && material.uniforms?.pointScale) {
                material.uniforms.pointScale.value = baseScale * pointCloudSettings.pointSizeMultiplier;
            }

            if (material.uniforms?.edgeSoftness) {
                material.uniforms.edgeSoftness.value = styleUniforms.edgeSoftness;
            }

            if (material.uniforms?.lightingMix) {
                material.uniforms.lightingMix.value = styleUniforms.lightingMix;
            }

            const positions = child.geometry.getAttribute('position');
            const pointCount = positions?.count ?? 0;
            const drawRatio = pointCloudSettings.overridesEnabled
                ? getPointCloudDetailRatio(pointCloudSettings.detailLevel, pointCount)
                : 1;

            child.geometry.setDrawRange(0, Math.max(1, Math.floor(pointCount * drawRatio)));
        });

        this.surface.invalidate();
    }

    updateOpacity(
        sceneKey: string | undefined,
        sceneOpacities: Record<string, number>,
        pointCloudSettings?: PointCloudSceneSettings
    ) {
        if (!this.state.model || !sceneKey) return;
        const opacity = sceneOpacities[sceneKey] ?? 1.0;
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

        this.state.model.traverse((child) => {
            if (child instanceof THREE.Points && child.material) {
                const mat = child.material;
                if (!(mat instanceof THREE.ShaderMaterial)) {
                    return;
                }

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

                const positions = child.geometry.getAttribute('position');
                const pointCount = positions?.count ?? 0;
                const detailRatio = pointCloudSettings?.overridesEnabled
                    ? getPointCloudDetailRatio(pointCloudSettings.detailLevel, pointCount)
                    : 1;
                child.geometry.setDrawRange(0, Math.max(1, Math.floor(pointCount * detailRatio)));
            } else if (child instanceof THREE.Mesh && child.material) {
                const mat = child.material;
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
            }
        });
        this.surface.invalidate();
    }

    updateCameraPosition(cameraPosition: THREE.Vector3) {
        if (!this.state.model) return;
        this.state.model.traverse((child) => {
            if (!(child instanceof THREE.Points) || !child.material) return;
            const mat = child.material;
            if (!(mat instanceof THREE.ShaderMaterial) || !mat.uniforms?.cameraPosition) return;
            mat.uniforms.cameraPosition.value.copy(cameraPosition);
        });
    }

    dispose() {
        this.isDisposed = true;
        this.loadGeneration += 1;
        this.loadAbortController?.abort();
        this.loadAbortController = null;
        this.callbacks.onLoadingState?.({
            isLoading: false,
            progress: 0,
            error: null
        });
        this.callbacks.onModelAvailable?.(null);
        this.disposeModel();
        this.materialPipeline.dispose();
    }

    private setLocalClippingEnabled(enabled: boolean) {
        this.surface.gl.localClippingEnabled = enabled;
    }

    private applyClippingToModel(root: THREE.Object3D, planes: Plane[]) {
        root.traverse((obj) => {
            if (!(obj instanceof THREE.Mesh || obj instanceof THREE.Points)) {
                return;
            }

            const meshOrPoints = obj;
            if (!meshOrPoints.material) return;
            let mats: THREE.Material[] = [meshOrPoints.material];
            if (Array.isArray(meshOrPoints.material)) {
                mats = meshOrPoints.material;
            }

            mats.forEach((material: THREE.Material) => {
                material.clippingPlanes = planes;
                material.needsUpdate = true;
            });
        });
        this.surface.invalidate();
    }

    private disposeModel() {
        if (!this.state.model) {
            this.state.mesh = null;
            this.state.bounds = null;
            return;
        }

        this.state.model.removeFromParent();
        disposeObject3DResources(this.state.model);
        this.state.model = null;
        this.state.mesh = null;
        this.state.bounds = null;
    }
};
