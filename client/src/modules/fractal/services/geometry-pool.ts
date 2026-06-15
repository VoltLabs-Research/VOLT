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

// Above this atom count the per-type sphere InstancedMesh path is too heavy; the
// renderer falls back to the existing GPU point-cloud/impostor path (plan 12 LOD).
// Tunable: real spheres stay smooth for hundreds of thousands of atoms, while
// large cells need the point path to keep interactive frame rates.
export const SPHERE_RENDER_ATOM_THRESHOLD = 200_000;

/**
 * Whether per-type sphere geometry (InstancedMesh) should render for a model of
 * `atomCount` atoms, or the point/impostor fallback should take over. The full
 * InstancedMesh bridge lands with plan 12 (LOD); this gate is the shared
 * decision both paths read so the threshold lives in one place.
 */
export const shouldRenderSpheres = (atomCount: number): boolean =>
    atomCount > 0 && atomCount <= SPHERE_RENDER_ATOM_THRESHOLD;

// Sphere tessellation: 16 segments is OVITO's default-quality particle sphere —
// smooth at interactive sizes without exploding vertex counts under instancing.
const SPHERE_SEGMENTS = 16;

/**
 * Per-LAMMPS-type sphere-geometry cache. The radius comes from the trajectory's
 * element table (covalent/vdW radius per type, plan 04); identical type+radius
 * pairs across scenes share one `THREE.SphereGeometry`. Disposed geometries are
 * dropped so a re-cache rebuilds them.
 */
class SphereGeometryPool {
    private byKey = new Map<string, THREE.SphereGeometry>();

    private keyFor(type: number, radius: number): string {
        // Round the radius into the key so float jitter from different element
        // sources still collapses to one cached sphere.
        return `${type}:${radius.toFixed(4)}`;
    }

    get(type: number, radius: number): THREE.SphereGeometry {
        const key = this.keyFor(type, radius);
        const existing = this.byKey.get(key);
        if (existing) return existing;

        const geometry = new THREE.SphereGeometry(radius, SPHERE_SEGMENTS, SPHERE_SEGMENTS);
        this.byKey.set(key, geometry);
        return geometry;
    }

    clear(): void {
        this.byKey.forEach((geometry) => geometry.dispose());
        this.byKey.clear();
    }
}

export const sphereGeometryPool = new SphereGeometryPool();
