class MemoryManager{
    private static instance: MemoryManager;
    // 80% of available memory
    public memoryThreshold = 0.8;
    private cleanupCallbacks: Set<() => void> = new Set();

    static getInstance(): MemoryManager{
        if(!MemoryManager.instance){
            MemoryManager.instance = new MemoryManager();
        }

        return MemoryManager.instance;
    }

    getMemoryUsage(): number{
        if('memory' in performance){
            const memory = (performance as any).memory;
            return memory.usedJSHeapSize / memory.jsHeapSizeLimit;
        }

        // Fallback... Conservative estimate
        return 0.3;
    }

    // Check if it's safe to load a model
    canLoadModel(): boolean{
        const usage = this.getMemoryUsage();
        return usage < this.memoryThreshold;
    }

    registerCleanup(callback: () => void): void{
        this.cleanupCallbacks.add(callback);
    }

    emergencyCleanup(): void {
        console.log(`Executing ${this.cleanupCallbacks.size} cleanup callbacks`);
        this.cleanupCallbacks.forEach(callback => {
            try{
                callback();
            }catch(error){
                console.warn('Error in cleanup callback:', error);
            }
        });
    }

    // Force garbage collection if available
    forceGC(): void{
        if('gc' in window && typeof (window as any).gc === 'function'){
            (window as any).gc();
            console.log('Forced garbage collection');
        }else{
            // Try to trigger GC indirectly
            const temp = new Array(1000000).fill(0);
            temp.length = 0;
        }
    }
};

export default MemoryManager;