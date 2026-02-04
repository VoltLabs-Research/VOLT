import type { ExtendedSceneState } from '@/features/canvas/types';
import { Mesh, Points, Scene, Object3D } from 'three';
import ResourceManager from '@/features/canvas/utilities/scene/resource-manager';
import ModelSetupManager from '@/features/canvas/utilities/scene/model-setup-manager';
import loadGLB from '@/features/canvas/utilities/loader';
import { useUIStore } from '@/stores/slices/ui';

export default class ModelLoader {
    constructor(
        private state: ExtendedSceneState,
        private scene: Scene,
        private resourceManager: ResourceManager,
        private modelSetupManager: ModelSetupManager,
        private setIsModelLoading: (loading: boolean) => void,
        private invalidate: () => void,
        private logger: any,
        private onLoadingStateChange: (state: any) => void,
        private setModel: (model: Object3D) => void
    ){}



    async load(url: string, onEmptyData?: () => void): Promise<void> {

        if (this.state.lastLoadedUrl === url || this.state.isLoadingUrl) return;

        this.state.isLoadingUrl = true;
        this.setIsModelLoading(true);
        this.onLoadingStateChange({ isLoading: true, progress: 0, error: null });
        try {
            const loadedModel = await loadGLB(url, (progress) => {
                this.onLoadingStateChange((prev: any) => ({
                    ...prev,
                    progress: Math.round(progress * 100)
                }));
            });

            // Check if model has any *actually renderable* content
            let hasData = false;

            loadedModel.traverse((child) => {
                if (hasData) return; // avoid extra work (can't truly break traverse)

                // POINTS: renderable if it has positions
                if (child instanceof Points) {
                    const geom = child.geometry;
                    const pos = geom?.getAttribute('position');
                    if (pos && pos.count > 0) {
                        hasData = true;
                    }
                    return;
                }

                // MESH: renderable only if it has triangles
                if (child instanceof Mesh) {
                    const geom = child.geometry;
                    const pos = geom?.getAttribute('position');

                    // no vertices => not renderable
                    if (!pos || pos.count < 3) return;

                    // with index: need at least 3 indices (1 triangle)
                    if (geom.index) {
                        if (geom.index.count >= 3) {
                            hasData = true;
                        } else {
                            console.warn('[non-renderable mesh] index empty', child.name || '(no-name)', child.uuid);
                        }
                        return;
                    }

                    // without index: Three uses every 3 vertices as a triangle
                    if (pos.count >= 3) {
                        hasData = true;
                    }
                }
            });


            if (!hasData) {
                useUIStore.getState().addToast('No results found to build 3D model', 'warning');
                if (onEmptyData) onEmptyData();
            }

            const newModel = this.modelSetupManager.setup(loadedModel);
            newModel.userData.glbUrl = url;

            if (this.state.model) {
                newModel.position.copy(this.state.model.position);
                newModel.rotation.copy(this.state.model.rotation);
                newModel.scale.copy(this.state.model.scale);
                newModel.updateMatrixWorld(true);
            }

            // Seamless swap
            this.resourceManager.swapModel(this.state.model, newModel);
            this.setModel(newModel);

            this.state.lastLoadedUrl = url;
            this.state.failedUrls?.delete(url);

            this.onLoadingStateChange({ isLoading: false, progress: 100, error: null });
        } catch (error: any) {
            const message = error instanceof Error ? error.message : String(error);
            this.state.failedUrls?.add(url);
            this.onLoadingStateChange({ isLoading: false, progress: 0, error: message });
            this.logger.error('Model loading failed:', message);
        } finally {
            this.state.isLoadingUrl = false;
            this.setIsModelLoading(false);
            this.invalidate();
        }
    }

    isLoading(): boolean {
        return !!this.state.isLoadingUrl;
    }
};
