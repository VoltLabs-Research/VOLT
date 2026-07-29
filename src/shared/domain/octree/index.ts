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
    glbKey?: string;
    screenSpaceBudget?: number;
    valueMin?: number;
    valueMax?: number;
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
    scalar?: Float32Array | Float64Array | number[];
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

const MORTON_GRID = (1 << 10) - 1;

const splitBy3 = (a: number): number => {
    let x = a & MORTON_GRID;
    x = (x | (x << 16)) & 0x030000ff;
    x = (x | (x << 8)) & 0x0300f00f;
    x = (x | (x << 4)) & 0x030c30c3;
    x = (x | (x << 2)) & 0x09249249;
    return x;
};

const mortonEncode = (x: number, y: number, z: number): number => (
    splitBy3(x) | (splitBy3(y) << 1) | (splitBy3(z) << 2)
);

interface BuildNode {
    bounds: BoundsCell;
    level: number;
    children: BuildNode[];
    atomIndices: number[];
    atomCount: number;
    valueMin: number;
    valueMax: number;
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

const mortonSortLeaf = (positions: Float32Array, bounds: BoundsCell, indices: number[]): void => {
    if (indices.length < 2) return;
    const ex = bounds.maxX - bounds.minX;
    const ey = bounds.maxY - bounds.minY;
    const ez = bounds.maxZ - bounds.minZ;
    const quant = (v: number, lo: number, extent: number): number => {
        if (extent <= 0) return 0;
        let t = (v - lo) / extent;
        if (t < 0) t = 0;
        else if (t > 1) t = 1;
        return Math.floor(t * MORTON_GRID);
    };
    const keyOf = (i: number): number => {
        const base = i * 3;
        return mortonEncode(
            quant(positions[base], bounds.minX, ex),
            quant(positions[base + 1], bounds.minY, ey),
            quant(positions[base + 2], bounds.minZ, ez)
        );
    };
    const keyed = indices.map((i) => ({
        i,
        k: keyOf(i)
    }));
    keyed.sort((a, b) => a.k - b.k);
    for (let n = 0; n < keyed.length; n += 1) indices[n] = keyed[n].i;
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
        atomIndices: [],
        atomCount,
        valueMin: NaN,
        valueMax: NaN
    };

    const stack: { node: BuildNode; indices: number[] }[] = [{
        node: root,
        indices: rootIndices
    }];

    while (stack.length > 0) {
        const { node, indices } = stack.pop()!;
        const subdivide = indices.length > leafMax && node.level < maxDepth;
        if (!subdivide) {
            node.atomIndices = indices;
            mortonSortLeaf(positions, node.bounds, node.atomIndices);
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
                atomIndices: [],
                atomCount: bucket.length,
                valueMin: NaN,
                valueMax: NaN
            };
            node.children[o] = child;
            if (bucket.length > 0) stack.push({
                node: child,
                indices: bucket
            });
        }
    }

    const scalar = options.scalar;
    if (scalar && scalar.length === atomCount) {
        const reduce = (node: BuildNode): void => {
            if (node.children.length === 0) {
                if (node.atomIndices.length === 0) return;
                let lo = Number.POSITIVE_INFINITY;
                let hi = Number.NEGATIVE_INFINITY;
                for (const i of node.atomIndices) {
                    const v = scalar[i];
                    if (v < lo) lo = v;
                    if (v > hi) hi = v;
                }
                node.valueMin = lo;
                node.valueMax = hi;
                return;
            }
            let lo = Number.POSITIVE_INFINITY;
            let hi = Number.NEGATIVE_INFINITY;
            let any = false;
            for (const child of node.children) {
                reduce(child);
                if (!Number.isNaN(child.valueMin)) {
                    if (child.valueMin < lo) lo = child.valueMin;
                    if (child.valueMax > hi) hi = child.valueMax;
                    any = true;
                }
            }
            if (any) {
                node.valueMin = lo;
                node.valueMax = hi;
            }
        };
        reduce(root);
    }

    return root;
};

const flattenOctree = (root: BuildNode | null): { cells: LODCell[]; atomOrder: number[] } => {
    const cells: LODCell[] = [];
    const atomOrder: number[] = [];
    if (!root) return {
        cells,
        atomOrder
    };

    const pushCell = (node: BuildNode): number => {
        const cell: LODCell = {
            bounds: node.bounds,
            level: node.level,
            atomCount: node.atomCount,
            firstAtomIndex: 0,
            childIndices: null
        };
        if (!Number.isNaN(node.valueMin)) {
            cell.valueMin = node.valueMin;
            cell.valueMax = node.valueMax;
        }
        cells.push(cell);
        return cells.length - 1;
    };

    const queue: { node: BuildNode; cellIndex: number }[] = [{
        node: root,
        cellIndex: pushCell(root)
    }];

    let head = 0;
    while (head < queue.length) {
        const { node, cellIndex } = queue[head];
        head += 1;
        cells[cellIndex].firstAtomIndex = atomOrder.length;
        if (node.children.length === 0) {
            for (const idx of node.atomIndices) atomOrder.push(idx);
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

    return {
        cells,
        atomOrder
    };
};

interface BuiltOctree {
    metadata: OctreeMetadata;
    atomOrder: number[];
}

export const buildOctree = (
    positions: Float32Array,
    atomCount: number,
    options: OctreeBuildOptions
): BuiltOctree => {
    const root = buildTree(positions, atomCount, options);
    const { cells, atomOrder } = flattenOctree(root);
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
    return {
        metadata,
        atomOrder
    };
};

export const buildOctreeMetadata = (
    positions: Float32Array,
    atomCount: number,
    options: OctreeBuildOptions
): OctreeMetadata => buildOctree(positions, atomCount, options).metadata;
