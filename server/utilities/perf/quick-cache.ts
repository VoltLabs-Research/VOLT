export default class QuickCache<T>{
    private cache = new Map<string, { value: T; expiry: number }>();

    constructor(
        private ttlMs: number = 1000 * 60 * 5
    ){}

    get(key: string): T | undefined{
        const item = this.cache.get(key);
        if(!item) return undefined;

        if(Date.now() > item.expiry){
            this.cache.delete(key);
            return undefined;
        }

        return item.value;
    }

    set(key: string, value: T): void{
        this.cache.set(key, { value, expiry: Date.now() + this.ttlMs });
    }
};