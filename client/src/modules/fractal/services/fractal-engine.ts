import * as THREE from 'three';
import { Plane } from 'three';
import { MaterialPipeline } from '@/modules/fractal/core/material-pipeline';
import { ModelTransform, type BoundsInfo } from '@/modules/fractal/core/model-transform';
import { disposeObject3DResources } from '@/modules/fractal/core/resource-disposal';
import type IFractalAssetLoader from '@/modules/fractal/api/entities/fractal';
import type { ModelLoadingState } from '@/modules/fractal/api/entities/fractal';

export type FractalParams = {
    url?: string | null;
    sliceClippingPlanes: Plane[];
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: number;
    updateThrottle: number;
    disableAutoTransform?: boolean;
    useFixedReference?: boolean;
    onEmptyData?: () => void;
    sceneKey?: string;
    boxBounds?: { xlo: number; xhi: number; ylo: number; yhi: number; zlo: number; zhi: number };
};

type EngineCallbacks = {
    onModelLoaded?: (bounds: BoundsInfo) => void;
    onLoadingState?: (state: ModelLoadingState) => void;
    onModelAvailable?: (model: THREE.Group | null) => void;
};

export class FractalEngine {
    private state = {
        model: null as THREE.Group | null,
        mesh: null as THREE.Mesh | THREE.Points | null,
        bounds: null as BoundsInfo | null,
        lastLoadedUrl: null as string | null,
        isLoading: false,
        loadProgress: 0,
        loadError: null as string | null
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

    constructor(
        private surface: {
            scene: THREE.Scene;
            camera: THREE.Camera;
            gl: THREE.WebGLRenderer;
            invalidate: () => void;
        },
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
        this.callbacks.onLoadingState?.({ isLoading: true, progress: 0, error: null });

        try {
            const loadedModel = await this.assetLoader.load(url, (progress) => {
                const pct = Math.round(progress * 100);
                this.state.loadProgress = pct;
                this.callbacks.onLoadingState?.({ isLoading: true, progress: pct, error: null });
            }, this.loadAbortController.signal);

            if (this.isDisposed || currentLoadGeneration !== this.loadGeneration) {
                loadedModel.removeFromParent();
                disposeObject3DResources(loadedModel);
                return;
            }

            if (!this.hasRenderableData(loadedModel)) {
                this.params.onEmptyData?.();
            }

            const pointCloud = this.materialPipeline.detectPointCloud(loadedModel);
            let newMesh: THREE.Mesh | THREE.Points | null = null;
            if (pointCloud) {
                this.materialPipeline.configurePointCloud(pointCloud);
                newMesh = pointCloud;
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

            this.callbacks.onModelLoaded?.(bounds);
            this.callbacks.onModelAvailable?.(loadedModel);
            this.callbacks.onLoadingState?.({ isLoading: false, progress: 100, error: null });
        } catch (error: unknown) {
            if (error instanceof Error && error.name === 'AbortError') {
                this.callbacks.onLoadingState?.({ isLoading: false, progress: 0, error: null });
                return;
            }

            this.consecutiveLoadFailures += 1;
            const message = error instanceof Error ? error.message : String(error);
            this.state.loadError = message;
            this.callbacks.onLoadingState?.({ isLoading: false, progress: 0, error: message });
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

    updatePointSize(multiplier: number) {
        const mesh = this.state.mesh;
        if (!mesh || !(mesh instanceof THREE.Points) || !mesh.material) return;

        const mat = mesh.material as THREE.ShaderMaterial;
        const baseScale = mat.userData.basePointScale;
        if (typeof baseScale !== 'number') return;

        mat.uniforms.pointScale.value = baseScale * multiplier;
        this.surface.invalidate();
    }

    updateOpacity(sceneKey: string | undefined, sceneOpacities: Record<string, number>) {
        if (!this.state.model || !sceneKey) return;
        const opacity = sceneOpacities[sceneKey] ?? 1.0;
        this.state.model.traverse((child) => {
            if (child instanceof THREE.Points && child.material) {
                const mat = child.material as THREE.ShaderMaterial;
                if (mat.uniforms?.opacity) {
                    mat.uniforms.opacity.value = opacity;
                }
            } else if (child instanceof THREE.Mesh && child.material) {
                const mat = child.material as THREE.Material;
                mat.transparent = opacity < 1.0;
                mat.opacity = opacity;
                mat.needsUpdate = true;
            }
        });
        this.surface.invalidate();
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
    }

    private setLocalClippingEnabled(enabled: boolean) {
        this.surface.gl.localClippingEnabled = enabled;
    }

    private applyClippingToModel(root: THREE.Object3D, planes: Plane[]) {
        root.traverse((obj) => {
            const meshOrPoints = obj as THREE.Mesh | THREE.Points;
            if (!meshOrPoints.material) return;
            const mats = Array.isArray(meshOrPoints.material)
                ? meshOrPoints.material
                : [meshOrPoints.material];
            mats.forEach((material: THREE.Material) => {
                (material as THREE.MeshStandardMaterial).clippingPlanes = planes;
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
}
