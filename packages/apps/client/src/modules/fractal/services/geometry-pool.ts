import * as THREE from 'three';

interface PoolEntry {
    geometry: THREE.BufferGeometry;
    byteSize: number;
}

const estimateGeometryBytes = (geometry: THREE.BufferGeometry): number => {
    let bytes = 0;
    for (const key in geometry.attributes) {
        const attribute = geometry.attributes[key];
        if (attribute && attribute.array) {
            bytes += attribute.array.byteLength;
        }
    }
    if (geometry.index && geometry.index.array) {
        bytes += geometry.index.array.byteLength;
    }
    return bytes;
};

const computeCapacityBytes = (): number => {
    const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    const defaultMemoryGb = 4;
    const memoryGb = typeof deviceMemory === 'number' && deviceMemory > 0 ? deviceMemory : defaultMemoryGb;
    return Math.min(2 * 1024 * 1024 * 1024, Math.floor(memoryGb * 1024 * 1024 * 1024 * 0.2));
};

// Models were once kept decompressed in the origin private file system, a copy per frame that
// nothing evicted; the browser's HTTP cache holds them now, so that directory only takes space.
const RETIRED_OPFS_DIRECTORY = 'volt-glb-cache';
void (async () => {
    try {
        const root = await navigator.storage?.getDirectory?.();
        await root?.removeEntry(RETIRED_OPFS_DIRECTORY, { recursive: true });
    } catch {
        // Nothing to remove, or no origin private file system.
    }
})();

class GeometryPool {
    private pool = new Map<string, PoolEntry>();
    private capacityBytes = computeCapacityBytes();
    private currentBytes = 0;

    get(resourceKey: string): THREE.BufferGeometry | null {
        const entry = this.pool.get(resourceKey);
        if (!entry) return null;
        this.pool.delete(resourceKey);
        this.pool.set(resourceKey, entry);
        return entry.geometry;
    }

    insert(resourceKey: string, geometry: THREE.BufferGeometry): void {
        const existing = this.pool.get(resourceKey);
        if (existing) {
            this.currentBytes = Math.max(0, this.currentBytes - existing.byteSize);
            this.pool.delete(resourceKey);
        }

        const byteSize = estimateGeometryBytes(geometry);
        this.pool.set(resourceKey, {
            geometry,
            byteSize
        });
        this.currentBytes += byteSize;
        this.evict();
    }

    private evict(): void {
        while (this.currentBytes > this.capacityBytes) {
            const oldestKey = this.pool.keys().next().value;
            if (oldestKey === undefined) break;
            const entry = this.pool.get(oldestKey);
            if (entry) {
                entry.geometry.dispose();
                this.currentBytes -= entry.byteSize;
            }
            this.pool.delete(oldestKey);
        }
    }

    clear(): void {
        this.pool.forEach((entry) => entry.geometry.dispose());
        this.pool.clear();
        this.currentBytes = 0;
    }
}

export const geometryPool = new GeometryPool();
