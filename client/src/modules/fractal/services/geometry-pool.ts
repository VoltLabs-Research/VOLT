import * as THREE from 'three';

// Cache of parsed BufferGeometry keyed by a stable GLB resource identity. The
// transport URL may change without the underlying model changing, so the cache
// key is deliberately decoupled from the fetch URL.

interface PoolEntry {
    geometry: THREE.BufferGeometry;
    accessedAt: number;
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
    // Allocate 20% of estimated RAM, capped at 2 GB.
    return Math.min(2 * 1024 * 1024 * 1024, Math.floor(memoryGb * 1024 * 1024 * 1024 * 0.2));
};

const OPFS_DIR_NAME = 'volt-glb-cache';

const getOpfsRoot = async (): Promise<FileSystemDirectoryHandle | null> => {
    const storage = navigator.storage;
    if (!storage || typeof storage.getDirectory !== 'function') return null;
    try {
        const root = await storage.getDirectory();
        return root.getDirectoryHandle(OPFS_DIR_NAME, { create: true });
    } catch {
        return null;
    }
};

const resourceKeyToFileName = (resourceKey: string): string => {
    let hash = 2166136261;
    for (let i = 0; i < resourceKey.length; i += 1) {
        hash ^= resourceKey.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return `glb-${(hash >>> 0).toString(36)}.bin`;
};

class GeometryPool {
    private pool = new Map<string, PoolEntry>();
    private capacityBytes = computeCapacityBytes();
    private currentBytes = 0;

    get(resourceKey: string): THREE.BufferGeometry | null {
        const entry = this.pool.get(resourceKey);
        if (!entry) return null;
        entry.accessedAt = Date.now();
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
            accessedAt: Date.now(),
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

    async readFromOpfs(resourceKey: string): Promise<ArrayBuffer | null> {
        const root = await getOpfsRoot();
        if (!root) return null;
        try {
            const handle = await root.getFileHandle(resourceKeyToFileName(resourceKey));
            const file = await handle.getFile();
            return await file.arrayBuffer();
        } catch {
            return null;
        }
    }

    async writeToOpfs(resourceKey: string, buffer: ArrayBuffer): Promise<void> {
        const root = await getOpfsRoot();
        if (!root) return;
        try {
            const handle = await root.getFileHandle(resourceKeyToFileName(resourceKey), { create: true });
            const writable = await handle.createWritable();
            await writable.write(buffer);
            await writable.close();
        } catch {
            // OPFS write failures are non-fatal.
        }
    }
}

export const geometryPool = new GeometryPool();
