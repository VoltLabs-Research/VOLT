/**
 * Atoms are drawn in blocks of neighbouring atoms, so the blocks that cannot reach the screen
 * (outside the view, cut away by a slice, or hidden by a mask) are skipped. Positions keep their
 * order, which masks and colours use: a block is a range of an index buffer that lists the atoms
 * grouped by grid cell. This module only computes; it runs in a worker.
 */

export interface PointCloudBlocks {
    /** Atom indices, grouped block after block. */
    index: Uint32Array;
    /** First entry of each block in `index`. */
    starts: Uint32Array;
    /** Number of atoms in each block. */
    counts: Uint32Array;
    /** Per block, the bounding sphere of its atoms in the geometry's space: x, y, z, radius. */
    spheres: Float64Array;
}

// 64 cells along the longest side, numbered along a Morton curve so that a run of cells is a cube
// of space; the octree over those numbers gives the blocks.
const GRID_BITS = 6;
const GRID_SIZE = 1 << GRID_BITS;
const CELL_COUNT = GRID_SIZE ** 3;
const MAX_BLOCK_ATOMS = 8192;

const spreadBits = (value: number): number => {
    let v = value & 0x3ff;
    v = (v | (v << 16)) & 0x030000ff;
    v = (v | (v << 8)) & 0x0300f00f;
    v = (v | (v << 4)) & 0x030c30c3;
    v = (v | (v << 2)) & 0x09249249;
    return v;
};

export const buildPointCloudBlocks = (positions: Float32Array): PointCloudBlocks => {
    const atomCount = Math.floor(positions.length / 3);
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let atom = 0; atom < atomCount; atom += 1) {
        const x = positions[atom * 3], y = positions[atom * 3 + 1], z = positions[atom * 3 + 2];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
    }

    const extent = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
    const scale = extent > 0 ? GRID_SIZE / extent : 0;
    const cellOf = (value: number, min: number): number => Math.min(GRID_SIZE - 1, Math.floor((value - min) * scale));

    // Counting sort of the atoms by cell; offsets[cell] is where the cell's atoms start.
    const cells = new Uint32Array(atomCount);
    const offsets = new Uint32Array(CELL_COUNT + 1);
    for (let atom = 0; atom < atomCount; atom += 1) {
        const cell = spreadBits(cellOf(positions[atom * 3], minX))
            | (spreadBits(cellOf(positions[atom * 3 + 1], minY)) << 1)
            | (spreadBits(cellOf(positions[atom * 3 + 2], minZ)) << 2);
        cells[atom] = cell;
        offsets[cell + 1] += 1;
    }
    for (let cell = 1; cell <= CELL_COUNT; cell += 1) {
        offsets[cell] += offsets[cell - 1];
    }
    const index = new Uint32Array(atomCount);
    const cursor = offsets.slice(0, CELL_COUNT);
    for (let atom = 0; atom < atomCount; atom += 1) {
        index[cursor[cells[atom]]++] = atom;
    }

    // An octree node is a range of cell numbers; a node with few enough atoms is a block.
    const starts: number[] = [];
    const counts: number[] = [];
    const visit = (firstCell: number, cellSpan: number): void => {
        const begin = offsets[firstCell];
        const count = offsets[firstCell + cellSpan] - begin;
        if (count === 0) return;
        if (count <= MAX_BLOCK_ATOMS || cellSpan === 1) {
            starts.push(begin);
            counts.push(count);
            return;
        }
        const childSpan = cellSpan / 8;
        for (let child = 0; child < 8; child += 1) {
            visit(firstCell + child * childSpan, childSpan);
        }
    };
    visit(0, CELL_COUNT);

    const spheres = new Float64Array(starts.length * 4);
    for (let block = 0; block < starts.length; block += 1) {
        let bMinX = Infinity, bMinY = Infinity, bMinZ = Infinity;
        let bMaxX = -Infinity, bMaxY = -Infinity, bMaxZ = -Infinity;
        const end = starts[block] + counts[block];
        for (let entry = starts[block]; entry < end; entry += 1) {
            const atom = index[entry];
            const x = positions[atom * 3], y = positions[atom * 3 + 1], z = positions[atom * 3 + 2];
            if (x < bMinX) bMinX = x;
            if (x > bMaxX) bMaxX = x;
            if (y < bMinY) bMinY = y;
            if (y > bMaxY) bMaxY = y;
            if (z < bMinZ) bMinZ = z;
            if (z > bMaxZ) bMaxZ = z;
        }
        const halfX = (bMaxX - bMinX) / 2, halfY = (bMaxY - bMinY) / 2, halfZ = (bMaxZ - bMinZ) / 2;
        spheres[block * 4] = bMinX + halfX;
        spheres[block * 4 + 1] = bMinY + halfY;
        spheres[block * 4 + 2] = bMinZ + halfZ;
        spheres[block * 4 + 3] = Math.hypot(halfX, halfY, halfZ);
    }

    return {
        index,
        starts: Uint32Array.from(starts),
        counts: Uint32Array.from(counts),
        spheres
    };
};
