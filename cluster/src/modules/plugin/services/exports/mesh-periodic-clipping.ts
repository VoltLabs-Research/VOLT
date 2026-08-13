import { logger } from '@shared/infrastructure/logger';
import type { MeshDomain } from '@shared/contracts/types/workflow-exposure';

/**
 * Rewrites a surface mesh so it sits entirely inside its periodic cell, the way
 * OVITO's SurfaceMeshVis does before handing a mesh to the renderer
 * (ovito/src/ovito/mesh/surface/SurfaceMeshVis.cpp).
 *
 * Analysis plugins export facets with PBC-unwrapped vertices: each triangle is
 * made contiguous by shifting whichever corners crossed the boundary, which pushes
 * that triangle outside the cell and leaves a matching hole on the opposite face.
 * Rendered as-is the surface pokes through the cell wireframe into whatever else
 * shares the viewport, and you can see into its interior through the holes.
 *
 * The fix is OVITO's: wrap every vertex back into the cell, cut the straddling
 * triangles on the boundary plane, and close the openings with cap polygons.
 *
 * Everything happens in reduced coordinates (cell vectors as the basis, so the
 * cell is the unit cube) because that is what makes the "does this edge cross the
 * boundary" test a comparison against 0.5 regardless of cell shape or triclinicity.
 */

export interface ClippedMesh {
    positions: Float32Array;
    indices: Uint32Array;
    /** Triangle count at the head of `indices` that belongs to the surface itself. */
    surfaceTriangleCount: number;
    /** Triangles after `surfaceTriangleCount` that close the cuts at the boundary. */
    capTriangleCount: number;
}

interface ReducedFrame {
    /** Column-major 3x3: reduced -> absolute. */
    matrix: number[];
    /** Column-major 3x3: absolute -> reduced (without the origin shift). */
    inverse: number[];
    origin: [number, number, number];
    pbc: [boolean, boolean, boolean];
}

const determinant3 = (m: number[]): number =>
    m[0] * (m[4] * m[8] - m[5] * m[7])
    - m[3] * (m[1] * m[8] - m[2] * m[7])
    + m[6] * (m[1] * m[5] - m[2] * m[4]);

const invert3 = (m: number[]): number[] | null => {
    const determinant = determinant3(m);
    if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-20) {
        return null;
    }
    const inverseDeterminant = 1 / determinant;

    return [
        (m[4] * m[8] - m[5] * m[7]) * inverseDeterminant,
        (m[2] * m[7] - m[1] * m[8]) * inverseDeterminant,
        (m[1] * m[5] - m[2] * m[4]) * inverseDeterminant,
        (m[5] * m[6] - m[3] * m[8]) * inverseDeterminant,
        (m[0] * m[8] - m[2] * m[6]) * inverseDeterminant,
        (m[2] * m[3] - m[0] * m[5]) * inverseDeterminant,
        (m[3] * m[7] - m[4] * m[6]) * inverseDeterminant,
        (m[1] * m[6] - m[0] * m[7]) * inverseDeterminant,
        (m[0] * m[4] - m[1] * m[3]) * inverseDeterminant
    ];
};

const buildReducedFrame = (cell: MeshDomain): ReducedFrame | null => {
    const matrix = [
        cell.matrix[0][0], cell.matrix[0][1], cell.matrix[0][2],
        cell.matrix[1][0], cell.matrix[1][1], cell.matrix[1][2],
        cell.matrix[2][0], cell.matrix[2][1], cell.matrix[2][2]
    ];
    const inverse = invert3(matrix);
    if (!inverse) {
        return null;
    }

    return {
        matrix,
        inverse,
        origin: cell.origin,
        pbc: cell.pbc
    };
};

const applyColumnMajor3 = (
    m: number[],
    x: number,
    y: number,
    z: number
): [number, number, number] => [
    m[0] * x + m[3] * y + m[6] * z,
    m[1] * x + m[4] * y + m[7] * z,
    m[2] * x + m[5] * y + m[8] * z
];

/**
 * Absolute -> reduced, wrapping each periodic component into [0, 1). Matches
 * OVITO's SimulationCellData::absoluteToReducedAndWrap.
 */
const toReducedAndWrap = (frame: ReducedFrame, positions: Float32Array): Float64Array => {
    const reduced = new Float64Array(positions.length);

    for (let offset = 0; offset < positions.length; offset += 3) {
        const [u, v, w] = applyColumnMajor3(
            frame.inverse,
            positions[offset] - frame.origin[0],
            positions[offset + 1] - frame.origin[1],
            positions[offset + 2] - frame.origin[2]
        );
        const components = [u, v, w];
        for (let dim = 0; dim < 3; dim += 1) {
            let component = components[dim];
            if (frame.pbc[dim]) {
                component -= Math.floor(component);
                // Guard the boundary case where floor() of a value a hair under 1
                // still returns 0 after subtraction rounds back up to exactly 1.
                if (component >= 1) component = 0;
            }
            reduced[offset + dim] = component;
        }
    }

    return reduced;
};

const toAbsolute = (frame: ReducedFrame, reduced: Float64Array, count: number): Float32Array => {
    const positions = new Float32Array(count * 3);

    for (let offset = 0; offset < count * 3; offset += 3) {
        const [x, y, z] = applyColumnMajor3(
            frame.matrix,
            reduced[offset],
            reduced[offset + 1],
            reduced[offset + 2]
        );
        positions[offset] = x + frame.origin[0];
        positions[offset + 1] = y + frame.origin[1];
        positions[offset + 2] = z + frame.origin[2];
    }

    return positions;
};

/**
 * A growable flat triangle-index list.
 *
 * Deliberately not `number[][]`: a defect mesh from a multi-million-atom cell carries
 * millions of facets, and one small JS array per triangle -- rebuilt once per periodic
 * direction -- costs hundreds of megabytes for nothing.
 */
class TriangleBuffer {
    private data: Uint32Array;

    private length = 0;

    constructor(capacity: number) {
        this.data = new Uint32Array(Math.max(capacity, 3));
    }

    get count(): number {
        return this.length / 3;
    }

    get(triangle: number, corner: number): number {
        return this.data[triangle * 3 + corner];
    }

    push(a: number, b: number, c: number): void {
        if (this.length + 3 > this.data.length) {
            const grown = new Uint32Array(Math.max(this.data.length * 2, this.length + 3));
            grown.set(this.data.subarray(0, this.length));
            this.data = grown;
        }
        this.data[this.length] = a;
        this.data[this.length + 1] = b;
        this.data[this.length + 2] = c;
        this.length += 3;
    }

    reset(): void {
        this.length = 0;
    }

    indices(): Uint32Array {
        return this.data.subarray(0, this.length);
    }
}

/** A growable reduced-coordinate vertex list; the split appends to it. */
class ReducedVertexBuffer {
    private data: Float64Array;

    private length: number;

    constructor(initial: Float64Array) {
        this.data = initial;
        this.length = initial.length / 3;
    }

    get count(): number {
        return this.length;
    }

    get(index: number, dim: number): number {
        return this.data[index * 3 + dim];
    }

    push(x: number, y: number, z: number): number {
        if ((this.length + 1) * 3 > this.data.length) {
            const grown = new Float64Array(Math.max(this.data.length * 2, (this.length + 1) * 3));
            grown.set(this.data);
            this.data = grown;
        }
        const index = this.length;
        const offset = index * 3;
        this.data[offset] = x;
        this.data[offset + 1] = y;
        this.data[offset + 2] = z;
        this.length += 1;
        return index;
    }

    view(): Float64Array {
        return this.data.subarray(0, this.length * 3);
    }
}

const SPLIT_EPSILON = 1e-9;

/**
 * Vertex-pair keys are packed into one number as `a * VERTEX_KEY_STRIDE + b`, which
 * only stays exact while the product fits a double's 53-bit mantissa. 2^26 leaves
 * 2^52 of headroom and allows 67M vertices, far past anything a defect mesh reaches;
 * a stride of 2^32 would have started colliding at 2M, which such a mesh does reach.
 */
const VERTEX_KEY_STRIDE = 0x4000000;

const MAX_KEYABLE_VERTICES = VERTEX_KEY_STRIDE;

const vertexPairKey = (from: number, to: number): number => from * VERTEX_KEY_STRIDE + to;

/**
 * Rings larger than this are left uncapped. Ear clipping is quadratic in the ring
 * size in the common case and worse on strongly concave rings, so an unbounded ring
 * could stall an export; an opening this large is also well past the small
 * cross-sections caps exist for.
 */
const MAX_CAP_LOOP_VERTICES = 4096;

/**
 * Port of OVITO's SurfaceMeshVis::RenderableSurfaceBuilder::splitFace.
 *
 * A triangle whose vertices were wrapped independently shows up as an edge jumping
 * more than half the cell along `dim`. A validly split triangle has exactly two
 * such edges; anything else means the cell is too small for the geometry, and OVITO
 * fails the whole build there. Here the triangle is dropped instead: one unusable
 * facet is not worth discarding the mesh.
 *
 * Returns false only when the triangle was rejected.
 */
const splitTriangle = (
    vertices: ReducedVertexBuffer,
    triangle: [number, number, number],
    dim: number,
    pbc: [boolean, boolean, boolean],
    vertexPairCache: Map<number, [number, number]>,
    emitted: TriangleBuffer
): boolean => {
    const z = [
        vertices.get(triangle[0], dim),
        vertices.get(triangle[1], dim),
        vertices.get(triangle[2], dim)
    ];
    const zd = [z[1] - z[0], z[2] - z[1], z[0] - z[2]];

    if (Math.abs(zd[0]) < 0.5 && Math.abs(zd[1]) < 0.5 && Math.abs(zd[2]) < 0.5) {
        emitted.push(triangle[0], triangle[1], triangle[2]);
        return true;
    }

    let shortEdge = -1;
    for (let edge = 0; edge < 3; edge += 1) {
        if (Math.abs(zd[edge]) < 0.5) {
            if (shortEdge !== -1) {
                return false;
            }
            shortEdge = edge;
        }
    }
    if (shortEdge === -1) {
        return false;
    }

    // splitVertices[e][0] is the cut point on the same side of the boundary as
    // triangle[e]; [1] the one on the same side as triangle[(e+1) % 3]. Keeping the
    // slots relative to the edge's own traversal direction is what lets the two
    // triangles sharing an edge reuse the cached pair regardless of direction.
    const splitVertices: Array<[number, number] | null> = [null, null, null];

    for (let edge = 0; edge < 3; edge += 1) {
        if (edge === shortEdge) continue;

        let first = triangle[edge];
        let second = triangle[(edge + 1) % 3];
        let lowSlot = 0;
        let highSlot = 1;
        if (zd[edge] <= -0.5) {
            const swap = first;
            first = second;
            second = swap;
            lowSlot = 1;
            highSlot = 0;
        }

        const cacheKey = vertexPairKey(first, second);
        const cached = vertexPairCache.get(cacheKey);
        const pair: [number, number] = [0, 0];

        if (cached) {
            pair[lowSlot] = cached[0];
            pair[highSlot] = cached[1];
        } else {
            const delta = [
                vertices.get(second, 0) - vertices.get(first, 0),
                vertices.get(second, 1) - vertices.get(first, 1),
                vertices.get(second, 2) - vertices.get(first, 2)
            ];
            delta[dim] -= 1;
            // Dimensions already split are settled; later ones may still wrap, so
            // take the shortest image for those before interpolating.
            for (let other = dim + 1; other < 3; other += 1) {
                if (pbc[other]) {
                    delta[other] -= Math.round(delta[other]);
                }
            }

            const t = Math.abs(delta[dim]) > SPLIT_EPSILON
                ? vertices.get(first, dim) / -delta[dim]
                : 0.5;

            const point = [
                delta[0] * t + vertices.get(first, 0),
                delta[1] * t + vertices.get(first, 1),
                delta[2] * t + vertices.get(first, 2)
            ];
            point[dim] = 0;
            for (let other = dim + 1; other < 3; other += 1) {
                if (pbc[other]) {
                    point[other] -= Math.floor(point[other]);
                }
            }

            const atZero = vertices.push(point[0], point[1], point[2]);
            point[dim] = 1;
            const atOne = vertices.push(point[0], point[1], point[2]);

            vertexPairCache.set(cacheKey, [atZero, atOne]);
            pair[lowSlot] = atZero;
            pair[highSlot] = atOne;
        }

        splitVertices[edge] = pair;
    }

    const previousEdge = (shortEdge + 1) % 3;
    const nextEdge = (shortEdge + 2) % 3;
    const previousSplit = splitVertices[previousEdge];
    const nextSplit = splitVertices[nextEdge];
    if (!previousSplit || !nextSplit) {
        return false;
    }

    // The short edge's two corners stay together on one side; the third corner and
    // its two cut points form the piece on the other side.
    emitted.push(triangle[shortEdge], triangle[previousEdge], nextSplit[1]);
    emitted.push(triangle[previousEdge], previousSplit[0], nextSplit[1]);
    emitted.push(previousSplit[1], triangle[nextEdge], nextSplit[0]);

    return true;
};

const PLANE_EPSILON = 1e-6;

interface BoundaryEdge {
    from: number;
    to: number;
}

/**
 * Collects the directed edges that only one triangle claims -- the rim of every
 * opening -- restricted to edges lying flat on the cell face `(dim, plane)`.
 *
 * Deriving the openings from the finished mesh rather than recording them during the
 * split is what makes this correct for a surface that crosses more than one boundary:
 * a cut made while splitting along x can itself be subdivided when splitting along y,
 * at which point any segment list captured earlier no longer describes real edges.
 *
 * The plane test is applied before indexing, not after. A defect mesh from a large
 * cell has millions of interior edges and only a rim's worth on any cell face, so
 * filtering first keeps this map proportional to the opening rather than to the mesh.
 */
const collectBoundaryEdgesOnPlane = (
    triangles: TriangleBuffer,
    triangleCount: number,
    vertices: ReducedVertexBuffer,
    dim: number,
    plane: 0 | 1
): BoundaryEdge[] => {
    const onPlane = (vertex: number): boolean =>
        Math.abs(vertices.get(vertex, dim) - plane) < PLANE_EPSILON;

    const seen = new Map<number, BoundaryEdge>();

    for (let triangle = 0; triangle < triangleCount; triangle += 1) {
        for (let corner = 0; corner < 3; corner += 1) {
            const from = triangles.get(triangle, corner);
            const to = triangles.get(triangle, (corner + 1) % 3);
            if (!onPlane(from) || !onPlane(to)) continue;
            if (seen.delete(vertexPairKey(to, from))) continue;
            seen.set(vertexPairKey(from, to), {
                from,
                to
            });
        }
    }

    return [...seen.values()];
};

interface LoopBuildResult {
    loops: number[][];
    danglingEdges: number;
}

/**
 * Chains directed boundary edges into closed rings by following `to -> from`.
 *
 * Rings that fail to close are counted, not guessed at: a defect mesh can carry
 * genuine holes (the rims DXA leaves where a dislocation line passes through), and
 * inventing a ring there would fabricate surface that is not in the data.
 */
const buildLoops = (edges: BoundaryEdge[]): LoopBuildResult => {
    const outgoing = new Map<number, number[]>();
    edges.forEach((edge, index) => {
        const bucket = outgoing.get(edge.from);
        if (bucket) {
            bucket.push(index);
            return;
        }
        outgoing.set(edge.from, [index]);
    });

    const consumed = new Uint8Array(edges.length);
    const loops: number[][] = [];
    let danglingEdges = 0;

    for (let start = 0; start < edges.length; start += 1) {
        if (consumed[start]) continue;

        const loop: number[] = [edges[start].from];
        consumed[start] = 1;
        let cursor = edges[start].to;
        let closed = false;

        for (let guard = 0; guard <= edges.length; guard += 1) {
            if (cursor === loop[0]) {
                closed = true;
                break;
            }
            const candidates = outgoing.get(cursor);
            const nextIndex = candidates?.find((index) => !consumed[index]);
            if (nextIndex === undefined) break;
            consumed[nextIndex] = 1;
            loop.push(edges[nextIndex].from);
            cursor = edges[nextIndex].to;
        }

        if (closed && loop.length >= 3) {
            loops.push(loop);
            continue;
        }
        danglingEdges += loop.length;
    }

    return {
        loops,
        danglingEdges
    };
};

/**
 * Ear clipping over a loop projected onto the boundary plane. The rings coming off
 * a cell face are cross-sections of the enclosed body: small, and convex or mildly
 * concave, which is well within what ear clipping handles.
 *
 * Returns triangles as index triples into `loop`, wound to follow the loop's own
 * order around its perimeter. That guarantee is the point -- the caller relies on it
 * to make the patch close the surface instead of duplicating its orientation.
 * Null means the loop is degenerate (zero area) or clipping stalled.
 */
const earClip = (loop: number[], u: Float64Array, v: Float64Array): number[][] | null => {
    const remaining = loop.map((_, index) => index);

    const signedArea = (): number => {
        let total = 0;
        for (let i = 0; i < remaining.length; i += 1) {
            const current = remaining[i];
            const next = remaining[(i + 1) % remaining.length];
            total += u[current] * v[next] - u[next] * v[current];
        }
        return total / 2;
    };

    const area = signedArea();
    if (!Number.isFinite(area) || Math.abs(area) < 1e-18) {
        return null;
    }
    // The convexity test below assumes counter-clockwise, so clockwise loops get
    // reversed here and their triangles flipped back on the way out.
    const reversed = area < 0;
    if (reversed) {
        remaining.reverse();
    }

    const cross = (a: number, b: number, c: number): number =>
        (u[b] - u[a]) * (v[c] - v[a]) - (v[b] - v[a]) * (u[c] - u[a]);

    const insideTriangle = (a: number, b: number, c: number, point: number): boolean => {
        const d1 = cross(a, b, point);
        const d2 = cross(b, c, point);
        const d3 = cross(c, a, point);
        return d1 >= 0 && d2 >= 0 && d3 >= 0;
    };

    const triangles: number[][] = [];
    let guard = remaining.length * remaining.length + 8;

    while (remaining.length > 3 && guard > 0) {
        let clipped = false;

        for (let i = 0; i < remaining.length; i += 1) {
            const previous = remaining[(i + remaining.length - 1) % remaining.length];
            const current = remaining[i];
            const next = remaining[(i + 1) % remaining.length];

            if (cross(previous, current, next) <= 0) continue;

            let blocked = false;
            for (const candidate of remaining) {
                if (candidate === previous || candidate === current || candidate === next) continue;
                if (insideTriangle(previous, current, next, candidate)) {
                    blocked = true;
                    break;
                }
            }
            if (blocked) continue;

            triangles.push([previous, current, next]);
            remaining.splice(i, 1);
            clipped = true;
            break;
        }

        guard -= 1;
        if (!clipped) {
            return null;
        }
    }

    if (remaining.length !== 3) {
        return null;
    }
    triangles.push([remaining[0], remaining[1], remaining[2]]);

    return reversed
        ? triangles.map(([a, b, c]) => [a, c, b])
        : triangles;
};

interface CapStats {
    capTriangleCount: number;
    unclosedLoops: number;
    nestedLoops: number;
}

/**
 * Closes the openings the split left on the cell faces and appends the cap triangles
 * to `emitted`.
 *
 * Only rings that lie flat on a periodic cell face are filled. Any other open rim is
 * a hole that belongs to the data -- DXA leaves one wherever a dislocation line exits
 * the defect mesh -- and OVITO does not cap those either.
 *
 * Orientation needs no outwardness test. A closed oriented mesh requires every edge
 * to appear once in each direction, so the patch simply has to run the rim backwards
 * from the surface. Walking the rim in reverse and keeping earClip's winding aligned
 * with that order makes the caps consistent with whichever way the surface itself
 * faces, which is also what makes the result watertight by construction.
 *
 * Known limitation: a body that crosses two periodic boundaries at once has an
 * opening that bends around the cell edge, so it is not planar and no single cell
 * face holds a closed ring. OVITO reaches those by tracing the contour on the
 * original periodic mesh and re-closing it against the cell corners
 * (SurfaceMeshVis.cpp -> traceContour / sliceContourAtPeriodicBoundaries), machinery
 * this does not carry. Such a face is detected -- its rim leaves dangling edges --
 * and skipped whole, so the opening stays open rather than being filled with surface
 * that is not there. The containment half of the rewrite still applies.
 */
const appendCaps = (
    frame: ReducedFrame,
    vertices: ReducedVertexBuffer,
    emitted: TriangleBuffer,
    surfaceTriangleCount: number
): CapStats => {
    let capTriangleCount = 0;
    let unclosedLoops = 0;
    let nestedLoops = 0;

    for (let dim = 0; dim < 3; dim += 1) {
        if (!frame.pbc[dim]) continue;

        const axisU = (dim + 1) % 3;
        const axisV = (dim + 2) % 3;

        for (const plane of [0, 1] as const) {
            // Only the surface is scanned, never the caps appended for an earlier
            // face. A cap laid on the x face can have edges sitting on a y face, and
            // treating those as part of the y opening's rim would close the y cap
            // against the x cap instead of against the surface.
            const edgesOnPlane = collectBoundaryEdgesOnPlane(
                emitted,
                surfaceTriangleCount,
                vertices,
                dim,
                plane
            );
            if (edgesOnPlane.length === 0) continue;

            const { loops, danglingEdges } = buildLoops(edgesOnPlane);
            if (danglingEdges > 0) {
                // The rim runs off this face, so the opening is not planar and the
                // rings found here are fragments. Filling a fragment invents surface
                // and breaks the orientation; leave the whole face alone.
                unclosedLoops += 1;
                continue;
            }
            if (loops.length > 1) {
                // Nested rings (an annular cross-section) would need each inner ring
                // treated as a hole in the outer one. Filling them independently
                // over-fills, so report it instead of passing it off as correct.
                nestedLoops += loops.length - 1;
            }

            for (const loop of loops) {
                if (loop.length > MAX_CAP_LOOP_VERTICES) {
                    unclosedLoops += 1;
                    continue;
                }

                // Reverse the rim: the cap has to traverse it the other way round.
                const capLoop = [...loop].reverse();
                const u = new Float64Array(capLoop.length);
                const v = new Float64Array(capLoop.length);
                for (let i = 0; i < capLoop.length; i += 1) {
                    u[i] = vertices.get(capLoop[i], axisU);
                    v[i] = vertices.get(capLoop[i], axisV);
                }

                const triangles = earClip(capLoop, u, v);
                if (!triangles) {
                    unclosedLoops += 1;
                    continue;
                }

                for (const [a, b, c] of triangles) {
                    emitted.push(capLoop[a], capLoop[b], capLoop[c]);
                    capTriangleCount += 1;
                }
            }
        }
    }

    return {
        capTriangleCount,
        unclosedLoops,
        nestedLoops
    };
};

export interface PeriodicClipOptions {
    /** Skip cap generation and only contain the surface inside the cell. */
    generateCaps?: boolean;
}

/**
 * Contains `positions`/`indices` inside `cell` and, unless disabled, closes the
 * resulting openings. Returns null when there is nothing to do (no periodic
 * directions, or a degenerate cell), so callers can keep the input untouched.
 */
export const clipMeshToPeriodicCell = (
    positions: Float32Array,
    indices: Uint32Array,
    cell: MeshDomain,
    options: PeriodicClipOptions = {}
): ClippedMesh | null => {
    if (!cell.pbc.some(Boolean)) {
        return null;
    }

    const frame = buildReducedFrame(cell);
    if (!frame) {
        logger.warn('Mesh domain is degenerate; leaving the surface unclipped');
        return null;
    }

    // The split only adds vertices, so bounding the input bounds the whole run.
    const inputVertexCount = positions.length / 3;
    if (inputVertexCount * 2 >= MAX_KEYABLE_VERTICES) {
        logger.warn(
            {
                vertexCount: inputVertexCount,
                limit: MAX_KEYABLE_VERTICES
            },
            'Surface mesh is too large to index for periodic clipping; leaving it unclipped'
        );
        return null;
    }

    const vertices = new ReducedVertexBuffer(toReducedAndWrap(frame, positions));

    // Two buffers swapped between directions, so at most one extra copy of the index
    // data is alive at a time instead of one per direction.
    let triangles = new TriangleBuffer(indices.length);
    for (let offset = 0; offset + 2 < indices.length; offset += 3) {
        triangles.push(indices[offset], indices[offset + 1], indices[offset + 2]);
    }
    let scratch = new TriangleBuffer(indices.length);

    const triangle: [number, number, number] = [0, 0, 0];
    let rejectedTriangles = 0;

    for (let dim = 0; dim < 3; dim += 1) {
        if (!frame.pbc[dim]) continue;

        const vertexPairCache = new Map<number, [number, number]>();
        scratch.reset();
        const triangleCount = triangles.count;
        for (let index = 0; index < triangleCount; index += 1) {
            triangle[0] = triangles.get(index, 0);
            triangle[1] = triangles.get(index, 1);
            triangle[2] = triangles.get(index, 2);
            if (!splitTriangle(vertices, triangle, dim, frame.pbc, vertexPairCache, scratch)) {
                rejectedTriangles += 1;
            }
        }
        const swap = triangles;
        triangles = scratch;
        scratch = swap;
    }

    const surfaceTriangleCount = triangles.count;
    let capStats: CapStats = {
        capTriangleCount: 0,
        unclosedLoops: 0,
        nestedLoops: 0
    };
    if (options.generateCaps !== false) {
        capStats = appendCaps(frame, vertices, triangles, surfaceTriangleCount);
    }

    if (rejectedTriangles > 0 || capStats.unclosedLoops > 0 || capStats.nestedLoops > 0) {
        logger.warn(
            {
                rejectedTriangles,
                unclosedLoops: capStats.unclosedLoops,
                nestedLoops: capStats.nestedLoops
            },
            'Periodic mesh clipping finished with gaps: some boundary openings were left uncapped'
        );
    }

    return {
        positions: toAbsolute(frame, vertices.view(), vertices.count),
        indices: triangles.indices().slice(),
        surfaceTriangleCount,
        capTriangleCount: capStats.capTriangleCount
    };
};
