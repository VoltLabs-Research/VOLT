import { logger } from '@shared/infrastructure/logger';

/**
 * Drops the connected component of a surface mesh that encloses all the others --
 * the sample's outer shell.
 *
 * A DXA defect mesh classifies free surfaces as bad crystal, so for any non-periodic
 * sample (a nanoparticle, a slab, a nanowire) it contains a closed shell wrapping the
 * whole model, and that shell hides every interior defect behind it. OVITO has no
 * equivalent filter -- it expects you to make the surface transparent, hide it, or
 * slice through it -- so this is a VOLT addition and has to stay opt-in: it removes
 * geometry that is really in the data.
 *
 * The interior defects (voids, grain-boundary patches) are separate connected
 * components from the free surface, which is what makes the split well defined.
 *
 * Run this BEFORE the periodic clipping. Clipping cuts a wrapped surface at the cell
 * boundary, which splits one physical shell into several components and would leave
 * the containment test comparing pieces instead of bodies.
 */

export interface ComponentFilterResult {
    positions: Float32Array;
    indices: Uint32Array;
    droppedTriangles: number;
    componentCount: number;
}

interface Bounds {
    min: [number, number, number];
    max: [number, number, number];
}

/** Union-find over vertex indices, joined through the triangles that share them. */
const labelComponents = (positions: Float32Array, indices: Uint32Array): Int32Array => {
    const vertexCount = positions.length / 3;
    const parent = new Int32Array(vertexCount);
    for (let vertex = 0; vertex < vertexCount; vertex += 1) {
        parent[vertex] = vertex;
    }

    const find = (vertex: number): number => {
        let root = vertex;
        while (parent[root] !== root) {
            root = parent[root];
        }
        // Path compression, iterative so a long chain cannot blow the stack.
        let cursor = vertex;
        while (parent[cursor] !== root) {
            const next = parent[cursor];
            parent[cursor] = root;
            cursor = next;
        }
        return root;
    };

    const union = (left: number, right: number): void => {
        const leftRoot = find(left);
        const rightRoot = find(right);
        if (leftRoot !== rightRoot) {
            parent[Math.max(leftRoot, rightRoot)] = Math.min(leftRoot, rightRoot);
        }
    };

    for (let offset = 0; offset + 2 < indices.length; offset += 3) {
        union(indices[offset], indices[offset + 1]);
        union(indices[offset + 1], indices[offset + 2]);
    }

    const labels = new Int32Array(vertexCount);
    for (let vertex = 0; vertex < vertexCount; vertex += 1) {
        labels[vertex] = find(vertex);
    }
    return labels;
};

const EPSILON = 1e-6;

const contains = (outer: Bounds, inner: Bounds): boolean => {
    for (let axis = 0; axis < 3; axis += 1) {
        if (outer.min[axis] > inner.min[axis] + EPSILON) return false;
        if (outer.max[axis] < inner.max[axis] - EPSILON) return false;
    }
    return true;
};

const isStrictlyLarger = (outer: Bounds, inner: Bounds): boolean => {
    for (let axis = 0; axis < 3; axis += 1) {
        if (outer.max[axis] - outer.min[axis] > inner.max[axis] - inner.min[axis] + EPSILON) {
            return true;
        }
    }
    return false;
};

/**
 * Removes the enclosing component, if there is one, and compacts the vertex list so
 * the shell's vertices do not ride along unreferenced -- on a nanoparticle the shell
 * is most of the mesh, so leaving them would defeat the point.
 *
 * Returns the input untouched when nothing qualifies: a single component, or several
 * where none contains the rest. That second case is the one worth being careful
 * about -- in a fully periodic bulk cell the components are voids sitting side by
 * side, and dropping "the biggest" would silently delete a real void.
 */
export const dropEnclosingComponent = (
    positions: Float32Array,
    indices: Uint32Array
): ComponentFilterResult => {
    const unchanged: ComponentFilterResult = {
        positions,
        indices,
        droppedTriangles: 0,
        componentCount: 0
    };

    if (indices.length < 3) {
        return unchanged;
    }

    const labels = labelComponents(positions, indices);
    const bounds = new Map<number, Bounds>();

    for (let offset = 0; offset + 2 < indices.length; offset += 3) {
        const label = labels[indices[offset]];
        let box = bounds.get(label);
        if (!box) {
            box = {
                min: [Infinity, Infinity, Infinity],
                max: [-Infinity, -Infinity, -Infinity]
            };
            bounds.set(label, box);
        }
        for (let corner = 0; corner < 3; corner += 1) {
            const base = indices[offset + corner] * 3;
            for (let axis = 0; axis < 3; axis += 1) {
                const value = positions[base + axis];
                if (value < box.min[axis]) box.min[axis] = value;
                if (value > box.max[axis]) box.max[axis] = value;
            }
        }
    }

    const componentCount = bounds.size;
    if (componentCount < 2) {
        return {
            ...unchanged,
            componentCount
        };
    }

    let enclosing: number | null = null;
    for (const [label, box] of bounds) {
        let enclosesEverything = true;
        for (const [otherLabel, otherBox] of bounds) {
            if (otherLabel === label) continue;
            if (!contains(box, otherBox) || !isStrictlyLarger(box, otherBox)) {
                enclosesEverything = false;
                break;
            }
        }
        if (enclosesEverything) {
            enclosing = label;
            break;
        }
    }

    if (enclosing === null) {
        logger.info(
            { componentCount },
            'Interior-only defect mesh: no component encloses the others, keeping all of them'
        );
        return {
            ...unchanged,
            componentCount
        };
    }

    const keptTriangles: number[] = [];
    let droppedTriangles = 0;
    for (let offset = 0; offset + 2 < indices.length; offset += 3) {
        if (labels[indices[offset]] === enclosing) {
            droppedTriangles += 1;
            continue;
        }
        keptTriangles.push(offset);
    }

    if (keptTriangles.length === 0) {
        logger.info(
            {
                componentCount,
                droppedTriangles
            },
            'Interior-only defect mesh would be empty, keeping the enclosing component'
        );
        return {
            ...unchanged,
            componentCount
        };
    }

    // Compact: remap only the vertices the surviving triangles still reference.
    const remap = new Int32Array(positions.length / 3).fill(-1);
    const nextIndices = new Uint32Array(keptTriangles.length * 3);
    const keptPositions: number[] = [];
    let write = 0;

    for (const offset of keptTriangles) {
        for (let corner = 0; corner < 3; corner += 1) {
            const vertex = indices[offset + corner];
            let mapped = remap[vertex];
            if (mapped === -1) {
                mapped = keptPositions.length / 3;
                keptPositions.push(
                    positions[vertex * 3],
                    positions[vertex * 3 + 1],
                    positions[vertex * 3 + 2]
                );
                remap[vertex] = mapped;
            }
            nextIndices[write] = mapped;
            write += 1;
        }
    }

    logger.info(
        {
            componentCount,
            droppedTriangles,
            keptTriangles: keptTriangles.length
        },
        'Interior-only defect mesh: dropped the enclosing component'
    );

    return {
        positions: new Float32Array(keptPositions),
        indices: nextIndices,
        droppedTriangles,
        componentCount
    };
};
