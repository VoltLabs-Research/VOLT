import { logger } from '@shared/infrastructure/logger';
import type { MeshDomain } from '@shared/contracts/types/workflow-exposure';

export interface ClippedMesh {
    positions: Float32Array;
    indices: Uint32Array;
    surfaceTriangleCount: number;
    capTriangleCount: number;
}

interface ReducedFrame {
    matrix: number[];
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

const VERTEX_KEY_STRIDE = 0x4000000;

const MAX_KEYABLE_VERTICES = VERTEX_KEY_STRIDE;

const vertexPairKey = (from: number, to: number): number => from * VERTEX_KEY_STRIDE + to;

const MAX_CAP_LOOP_VERTICES = 4096;

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
                unclosedLoops += 1;
                continue;
            }
            if (loops.length > 1) {
                nestedLoops += loops.length - 1;
            }

            for (const loop of loops) {
                if (loop.length > MAX_CAP_LOOP_VERTICES) {
                    unclosedLoops += 1;
                    continue;
                }

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
    generateCaps?: boolean;
}

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
