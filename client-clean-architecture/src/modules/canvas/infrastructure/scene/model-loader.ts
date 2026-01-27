/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import type { ExtendedSceneState } from '@/types/scene';
import { Mesh, Points, Scene, Object3D } from 'three';
import ResourceManager from '@/modules/canvas/infrastructure/scene/resource-manager';
import ModelSetupManager from '@/modules/canvas/infrastructure/scene/model-setup-manager';
import loadGLB from '@/modules/canvas/infrastructure/loaders/GlbLoader';

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
        private setModel: (model: Object3D) => void,
        private notifyEmptyData?: (message: string) => void
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
                        console.log('[renderable points]', child.name || '(no-name)', child.uuid, 'points=', pos.count);
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
                            console.log('[renderable mesh]', child.name || '(no-name)', child.uuid, 'triIndices=', geom.index.count);
                        } else {
                            console.warn('[non-renderable mesh] index empty', child.name || '(no-name)', child.uuid);
                        }
                        return;
                    }

                    // without index: Three uses every 3 vertices as a triangle
                    if (pos.count >= 3) {
                        hasData = true;
                        console.log('[renderable mesh]', child.name || '(no-name)', child.uuid, 'verts=', pos.count);
                    }
                }
            });


            console.log(hasData)
            if (!hasData) {
                this.notifyEmptyData?.('No results found to build 3D model');
                if (onEmptyData) onEmptyData();
            }

            const newModel = this.modelSetupManager.setup(loadedModel);
            newModel.userData.glbUrl = url;

            if (this.state.model) {
                console.log(`[ModelLoader] Syncing transforms from ${this.state.model.uuid} to new model ${newModel.uuid}`);
                console.log(`[ModelLoader] Old Pos: ${JSON.stringify(this.state.model.position)}, Scale: ${this.state.model.scale.x}`); // Scale is uniform

                newModel.position.copy(this.state.model.position);
                newModel.rotation.copy(this.state.model.rotation);
                newModel.scale.copy(this.state.model.scale);
                newModel.updateMatrixWorld(true);

                console.log(`[ModelLoader] New Pos (Synced): ${JSON.stringify(newModel.position)}, Scale: ${newModel.scale.x}`);
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
