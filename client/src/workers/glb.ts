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

interface WorkerMessage {
    id: string;
    type: 'load' | 'preload' | 'cleanup';
    url?: string;
    token?: string;
    urls?: string[];
}

class GLBWorkerLoader{
    private readonly MAX_CACHE_SIZE = 5;
    private cache = new Map<string, ArrayBuffer>();
    private lruQueue: string[] = [];
    private requestQueue: WorkerMessage[] = [];
    private isProcessing = false;

    public addTask(task: WorkerMessage): void{
        if(task.type === 'load'){
            this.requestQueue = this.requestQueue.filter((t) => !(t.type === 'load' && t.url === task.url));
            this.requestQueue.unshift(task);
        }else{
            this.requestQueue.push(task);
        }

        this.processNext();
    }

    private async processNext(): Promise<void>{
        if(this.isProcessing || this.requestQueue.length === 0){
            return;
        }

        this.isProcessing = true;
        const task = this.requestQueue.shift()!;

        try{
            switch(task.type){
                case 'load':
                    const buffer = await this.fetchAndCache(task.url!, task.token);
                    self.postMessage({ id: task.id, type: 'success', data: buffer }, [buffer]);
                    break;

                case 'preload':
                    await this.preloadGLBs(task.urls!, task.token);
                    self.postMessage({ id: task.id, type: 'success' });
                    break;

                case 'cleanup':
                    this.cleanup();
                    self.postMessage({ id: task.id, type: 'success' });
                    break;
            }
        }catch(error){
            const errorMessage = error instanceof Error ? error.message : 'Unknown worker error';
            self.postMessage({ id: task.id, type: 'error', error: errorMessage });
        }finally{
            this.isProcessing = false;
            this.processNext();
        }
    }

    private manageCache(url: string, buffer: ArrayBuffer): void{
        const index = this.lruQueue.indexOf(url);
        if(index > -1){
            this.lruQueue.splice(index, 1);
        }

        this.lruQueue.push(url);
        this.cache.set(url, buffer);

        if(this.lruQueue.length > this.MAX_CACHE_SIZE){
            const urlToRemove = this.lruQueue.shift()!;
            this.cache.delete(urlToRemove);
        }
    }

    private async fetchAndCache(url: string, token?: string): Promise<ArrayBuffer>{
        if(this.cache.has(url)){
            const cachedBuffer = this.cache.get(url)!.slice(0);
            this.manageCache(url, cachedBuffer);
            return cachedBuffer;
        }

        const headers: HeadersInit = { 'Accept': 'model/gltf-binary' };
        if(token){
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(url, { headers });
        if(!response.ok){
            throw new Error(`Failed to fetch GLB: ${response.status} ${response.statusText}`);
        }

        const buffer = await response.arrayBuffer();
        this.manageCache(url, buffer.slice(0));
        return buffer;
    }

    private async preloadGLBs(urls: string[], token?: string): Promise<void>{
        for(const url of urls){
            try{
                if(!this.cache.has(url)){
                    await this.fetchAndCache(url, token);
                }
            }catch(error){
                console.warn(`Preloading failed for ${url}:`, error);
            }
        }
    }

    public cleanup(): void{
        this.cache.clear();
        this.lruQueue = [];
        this.requestQueue = [];
    }
}

const workerLoader = new GLBWorkerLoader();

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
    workerLoader.addTask(event.data);
};