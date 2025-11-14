/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
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
**/

import type { ExtendedSceneState } from '@/types/canvas';
import { Scene } from 'three';
import ResourceManager from '@/utilities/glb/scene/resource-manager';
import ModelSetupManager from '@/utilities/glb/scene/model-setup-manager';
import loadGLB from '@/utilities/glb/loader';

export default class ModelLoader{
    constructor(
        private state: ExtendedSceneState,
        private scene: Scene,
        private resourceManager: ResourceManager,
        private modelSetupManager: ModelSetupManager,
        private setIsModelLoading: (loading: boolean) => void,
        private invalidate: () => void,
        private logger: any,
        private onLoadingStateChange: (state: any) => void
    ){}

    async load(url: string): Promise<void>{
        if(this.state.lastLoadedUrl === url || this.state.isLoadingUrl) return;
        
        this.state.isLoadingUrl = true;
        this.setIsModelLoading(true);
        this.onLoadingStateChange({ isLoading: true, progress: 0, error: null });

        try{
            const loadedModel = await loadGLB(url, (progress) => {
                this.onLoadingStateChange((prev: any) => ({
                    ...prev,
                    progress: Math.round(progress * 100)
                }));
            });

            this.resourceManager.cleanup();
            const newModel = this.modelSetupManager.setup(loadedModel);
            newModel.userData.glbUrl = url;
            this.scene.add(newModel);

            this.state.model = newModel;
            this.state.lastLoadedUrl = url;
            this.state.failedUrls?.delete(url);

            this.onLoadingStateChange({ isLoading: false, progress: 100, error: null });
        }catch(error: any){
            const message = error instanceof Error ? error.message : String(error);
            this.state.failedUrls?.add(url);
            this.onLoadingStateChange({ isLoading: false, progress: 0, error: message });
            this.logger.error('Model loading failed:', message);
        }finally{
            this.state.isLoadingUrl = false;
            this.setIsModelLoading(false);
            this.invalidate();
        }
    }

    isLoading(): boolean{
        return !!this.state.isLoadingUrl;
    }
};