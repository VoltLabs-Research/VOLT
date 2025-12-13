import { api } from '@/api';
import Logger from '@/services/logger';

class PreviewCacheService{
    private cache = new Map<string, string>();
    private loadingSet = new Set<string>();
    private readonly maxSize: number;
    private readonly ttl: number;
    private readonly timestamps = new Map<string, number>();
    private readonly logger: Logger = new Logger('preview-cache-service');

    constructor(maxSize: number = 50, ttlMinutes: number = 30){
        this.maxSize = maxSize;
        this.ttl = ttlMinutes * 60 * 1000;
    }

    has(id: string): boolean{
        if(!this.cache.has(id)){
            return false;
        }

        // Check if entry has expired
        if(this.isExpired(id)){
            this.delete(id);
            return false;
        }

        return true;
    }

    get(id: string): string | null{
        if(!this.has(id)){
            return null;
        }

        // Update access time
        this.timestamps.set(id, Date.now());
        return this.cache.get(id) || null;
    }

    set(id: string, url: string): void{
        if(this.cache.size >= this.maxSize){
            this.evictOldest();
        }

        this.cache.set(id, url);
        this.timestamps.set(id, Date.now());
    }

    delete(id: string): void{
        const url = this.cache.get(id);
        if(url){
            URL.revokeObjectURL(url);
            this.cache.delete(id);
        }

        this.timestamps.delete(id);
        this.loadingSet.delete(id);
    }

    clear(id?: string): void{
        if(id){
            this.delete(id);
        }else{
            this.cache.forEach((url) => URL.revokeObjectURL(url));
            this.cache.clear();
            this.timestamps.clear();
            this.loadingSet.clear();
        }
    }

    isLoading(id: string): boolean{
        return this.loadingSet.has(id);
    }

    async loadPreview(id: string): Promise<string | null>{
        // Return cached version if available
        if(this.has(id)){
            return this.get(id);
        }

        // Return promise if already loading
        if(this.isLoading(id)){
            return this.waitForLoad(id);
        }

        // Start loading
        this.loadingSet.add(id);

        try{
            const response = await api.get(`/trajectories/${id}/preview`, {
                responseType: 'blob'
            });

            const imageUrl = URL.createObjectURL(response.data);
            this.set(id, imageUrl);
            this.loadingSet.delete(id);

            return imageUrl;
        }catch(error){
            this.logger.error('Error loading authenticated preview:', error);
            this.loadingSet.delete(id);
            return null;
        }
    }

    private isExpired(id: string): boolean{
        const timestamp = this.timestamps.get(id);
        if(!timestamp){
            return true;
        }
        return Date.now() - timestamp > this.ttl;
    }

    private evictOldest(): void{
        let oldestId: string | null = null;
        let oldestTimestamp = Date.now();

        for(const [id, timestamp] of this.timestamps.entries()){
            if(timestamp < oldestTimestamp){
                oldestTimestamp = timestamp;
                oldestId = id;
            }
        }

        if(oldestId){
            this.delete(oldestId);
        }
    }

    private waitForLoad(id: string): Promise<string | null>{
        return new Promise((resolve) => {
            const checkCache = () => {
                if(this.has(id)){
                    resolve(this.get(id));
                }else if(!this.isLoading(id)){
                    resolve(null);
                }else{
                    setTimeout(checkCache, 100);
                }
            };
            checkCache();
        });
    }

    getCacheSize(): number{
        return this.cache.size;
    }

    getCacheInfo(): { size: number; maxSize: number; loadingCount: number } {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            loadingCount: this.loadingSet.size,
        };
    }

    cleanup(): void{
        const now = Date.now();
        for(const [id, timestamp] of this.timestamps.entries()){
            if(now - timestamp > this.ttl){
                this.delete(id);
            }
        }
    }
}

export default PreviewCacheService;
