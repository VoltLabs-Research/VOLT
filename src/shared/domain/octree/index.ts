export interface BoundsCell {
    minX: number;
    minY: number;
    minZ: number;
    maxX: number;
    maxY: number;
    maxZ: number;
}

export interface LODCell {
    bounds: BoundsCell;
    level: number;
    childIndices?: number[] | null;
    atomCount: number;
    firstAtomIndex: number;
}

export interface FeatureBudget {
    maxGeometry: number;
    decimation?: number;
}

export interface GeometryBudget {
    maxTriangles: number;
    maxDrawCalls: number;
    perFeature: Record<string, FeatureBudget>;
}

export interface OctreeMetadata {
    version: 1;
    rootBounds: BoundsCell;
    maxDepth: number;
    cells: LODCell[];
    geometryBudget?: GeometryBudget;
}

export interface OctreeBuildOptions {
    leafCellMaxAtoms: number;
    maxDepth: number;
    geometryBudget?: GeometryBudget;
}

export const DEFAULT_GEOMETRY_BUDGET: GeometryBudget = {
    maxTriangles: 1_000_000,
    maxDrawCalls: 100,
    perFeature: {
        points: { maxGeometry: 100_000_000 },
        vectors: {
            maxGeometry: 2_000_000,
            decimation: 10
        },
        bonds: {
            maxGeometry: 10_000_000,
            decimation: 5
        },
        meshes: { maxGeometry: 1_000_000 }
    }
};

interface BuildNode {
    bounds: BoundsCell;
    level: number;
    children: BuildNode[];
    atomCount: number;
}

const emptyBounds = (): BoundsCell => ({
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    minZ: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
    maxZ: Number.NEGATIVE_INFINITY
});

const boundsOf = (positions: Float32Array, indices: number[]): BoundsCell => {
    const b = emptyBounds();
    for (const i of indices) {
        const base = i * 3;
        const x = positions[base];
        const y = positions[base + 1];
        const z = positions[base + 2];
        if (x < b.minX) b.minX = x;
        if (x > b.maxX) b.maxX = x;
        if (y < b.minY) b.minY = y;
        if (y > b.maxY) b.maxY = y;
        if (z < b.minZ) b.minZ = z;
        if (z > b.maxZ) b.maxZ = z;
    }
    return b;
};

const centerX = (b: BoundsCell): number => 0.5 * (b.minX + b.maxX);
const centerY = (b: BoundsCell): number => 0.5 * (b.minY + b.maxY);
const centerZ = (b: BoundsCell): number => 0.5 * (b.minZ + b.maxZ);

const octantOf = (b: BoundsCell, x: number, y: number, z: number): number => {
    const ox = x >= centerX(b) ? 1 : 0;
    const oy = y >= centerY(b) ? 1 : 0;
    const oz = z >= centerZ(b) ? 1 : 0;
    return ox | (oy << 1) | (oz << 2);
};

const octantBounds = (parent: BoundsCell, o: number): BoundsCell => {
    const cx = centerX(parent);
    const cy = centerY(parent);
    const cz = centerZ(parent);
    return {
        minX: o & 1 ? cx : parent.minX,
        maxX: o & 1 ? parent.maxX : cx,
        minY: o & 2 ? cy : parent.minY,
        maxY: o & 2 ? parent.maxY : cy,
        minZ: o & 4 ? cz : parent.minZ,
        maxZ: o & 4 ? parent.maxZ : cz
    };
};

const buildTree = (positions: Float32Array, atomCount: number, options: OctreeBuildOptions): BuildNode | null => {
    if (atomCount === 0) return null;
    const leafMax = Math.max(1, options.leafCellMaxAtoms);
    const maxDepth = Math.max(0, options.maxDepth);

    const rootIndices: number[] = new Array(atomCount);
    for (let i = 0; i < atomCount; i += 1) rootIndices[i] = i;

    const root: BuildNode = {
        bounds: boundsOf(positions, rootIndices),
        level: 0,
        children: [],
        atomCount
    };

    const stack: { node: BuildNode; indices: number[] }[] = [{
        node: root,
        indices: rootIndices
    }];

    while (stack.length > 0) {
        const { node, indices } = stack.pop()!;
        if (indices.length <= leafMax || node.level >= maxDepth) {
            continue;
        }

        const buckets: number[][] = [[], [], [], [], [], [], [], []];
        for (const i of indices) {
            const base = i * 3;
            buckets[octantOf(node.bounds, positions[base], positions[base + 1], positions[base + 2])].push(i);
        }

        node.children = new Array(8);
        for (let o = 0; o < 8; o += 1) {
            const bucket = buckets[o];
            const child: BuildNode = {
                bounds: bucket.length > 0 ? boundsOf(positions, bucket) : octantBounds(node.bounds, o),
                level: node.level + 1,
                children: [],
                atomCount: bucket.length
            };
            node.children[o] = child;
            if (bucket.length > 0) stack.push({
                node: child,
                indices: bucket
            });
        }
    }

    return root;
};

/**
 * Breadth-first flatten. `firstAtomIndex` is the running count of leaf atoms emitted
 * before this cell, so it only needs the per-node counts, not the atom ids themselves.
 */
const flattenOctree = (root: BuildNode | null): LODCell[] => {
    const cells: LODCell[] = [];
    if (!root) return cells;

    const pushCell = (node: BuildNode): number => {
        cells.push({
            bounds: node.bounds,
            level: node.level,
            atomCount: node.atomCount,
            firstAtomIndex: 0,
            childIndices: null
        });
        return cells.length - 1;
    };

    const queue: { node: BuildNode; cellIndex: number }[] = [{
        node: root,
        cellIndex: pushCell(root)
    }];

    let head = 0;
    let atomCursor = 0;
    while (head < queue.length) {
        const { node, cellIndex } = queue[head];
        head += 1;
        cells[cellIndex].firstAtomIndex = atomCursor;
        if (node.children.length === 0) {
            atomCursor += node.atomCount;
            continue;
        }
        const childIndices: number[] = [];
        for (const child of node.children) {
            const childIndex = pushCell(child);
            childIndices.push(childIndex);
            queue.push({
                node: child,
                cellIndex: childIndex
            });
        }
        cells[cellIndex].childIndices = childIndices;
    }

    for (let i = cells.length - 1; i >= 0; i -= 1) {
        const cell = cells[i];
        if (!cell.childIndices || cell.childIndices.length === 0) continue;
        let first = Number.POSITIVE_INFINITY;
        for (const c of cell.childIndices) first = Math.min(first, cells[c].firstAtomIndex);
        if (Number.isFinite(first)) cell.firstAtomIndex = first;
    }

    return cells;
};

export const buildOctreeMetadata = (
    positions: Float32Array,
    atomCount: number,
    options: OctreeBuildOptions
): OctreeMetadata => {
    const root = buildTree(positions, atomCount, options);
    const cells = flattenOctree(root);
    let maxLevel = 0;
    for (const cell of cells) if (cell.level > maxLevel) maxLevel = cell.level;
    const metadata: OctreeMetadata = {
        version: 1,
        rootBounds: root ? root.bounds : {
            minX: 0,
            minY: 0,
            minZ: 0,
            maxX: 0,
            maxY: 0,
            maxZ: 0
        },
        maxDepth: maxLevel,
        cells
    };
    if (options.geometryBudget) metadata.geometryBudget = options.geometryBudget;
    return metadata;
};
