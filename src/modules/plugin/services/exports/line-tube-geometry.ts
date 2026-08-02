import type { LineEntity } from '@modules/plugin/services/exports/export-node-processor-types';

/** Meshes polylines into triangulated tubes. Pure geometry: no I/O, no glTF encoding. */

export const MAX_LINE_VERTICES = 5_000_000;

export const createLineGeometry = (
    points: [number, number, number][],
    lineWidth: number,
    tubularSegments: number,
    vertexOffset: number
): { positions: Float32Array; normals: Float32Array; indices: Uint32Array } => {
    if (points.length < 2) {
        return {
            positions: new Float32Array(0),
            normals: new Float32Array(0),
            indices: new Uint32Array(0)
        };
    }

    const maxEdges = points.length - 1;
    const positions = new Float32Array(maxEdges * (tubularSegments + 1) * 2 * 3);
    const normals = new Float32Array(positions.length);
    const indices = new Uint32Array(maxEdges * tubularSegments * 6);

    let positionCursor = 0;
    let indexCursor = 0;

    for (let index = 0; index < points.length - 1; index += 1) {
        const pointOne = points[index];
        const pointTwo = points[index + 1];
        const direction = [
            pointTwo[0] - pointOne[0],
            pointTwo[1] - pointOne[1],
            pointTwo[2] - pointOne[2]
        ];
        const length = Math.sqrt(direction[0] ** 2 + direction[1] ** 2 + direction[2] ** 2);
        if (length < 1e-10) {
            continue;
        }

        direction[0] /= length;
        direction[1] /= length;
        direction[2] /= length;

        let up = Math.abs(direction[1]) > 0.99 ? [1, 0, 0] : [0, 1, 0];
        const right = [
            direction[1] * up[2] - direction[2] * up[1],
            direction[2] * up[0] - direction[0] * up[2],
            direction[0] * up[1] - direction[1] * up[0]
        ];
        const rightLength = Math.sqrt(right[0] ** 2 + right[1] ** 2 + right[2] ** 2);
        right[0] /= rightLength;
        right[1] /= rightLength;
        right[2] /= rightLength;

        up = [
            direction[1] * right[2] - direction[2] * right[1],
            direction[2] * right[0] - direction[0] * right[2],
            direction[0] * right[1] - direction[1] * right[0]
        ];

        const baseVertexIndex = vertexOffset + positionCursor / 3;
        const radius = lineWidth * 0.5;

        for (let segmentIndex = 0; segmentIndex <= tubularSegments; segmentIndex += 1) {
            const angle = (segmentIndex / tubularSegments) * Math.PI * 2;
            const cosine = Math.cos(angle);
            const sine = Math.sin(angle);
            const offset = [
                (right[0] * cosine + up[0] * sine) * radius,
                (right[1] * cosine + up[1] * sine) * radius,
                (right[2] * cosine + up[2] * sine) * radius
            ];

            positions[positionCursor] = pointOne[0] + offset[0];
            positions[positionCursor + 1] = pointOne[1] + offset[1];
            positions[positionCursor + 2] = pointOne[2] + offset[2];
            positions[positionCursor + 3] = pointTwo[0] + offset[0];
            positions[positionCursor + 4] = pointTwo[1] + offset[1];
            positions[positionCursor + 5] = pointTwo[2] + offset[2];

            const normalLength = Math.sqrt(offset[0] ** 2 + offset[1] ** 2 + offset[2] ** 2);
            if (normalLength > 1e-6) {
                const nx = offset[0] / normalLength;
                const ny = offset[1] / normalLength;
                const nz = offset[2] / normalLength;
                normals[positionCursor] = nx;
                normals[positionCursor + 1] = ny;
                normals[positionCursor + 2] = nz;
                normals[positionCursor + 3] = nx;
                normals[positionCursor + 4] = ny;
                normals[positionCursor + 5] = nz;
            } else {
                normals[positionCursor + 1] = 1;
                normals[positionCursor + 4] = 1;
            }

            positionCursor += 6;
        }

        for (let segmentIndex = 0; segmentIndex < tubularSegments; segmentIndex += 1) {
            const v1 = baseVertexIndex + segmentIndex * 2;
            const v2 = baseVertexIndex + segmentIndex * 2 + 1;
            const v3 = baseVertexIndex + (segmentIndex + 1) * 2;
            const v4 = baseVertexIndex + (segmentIndex + 1) * 2 + 1;
            indices[indexCursor] = v1;
            indices[indexCursor + 1] = v2;
            indices[indexCursor + 2] = v3;
            indices[indexCursor + 3] = v3;
            indices[indexCursor + 4] = v2;
            indices[indexCursor + 5] = v4;
            indexCursor += 6;
        }
    }

    return {
        positions: positionCursor < positions.length ? positions.subarray(0, positionCursor) : positions,
        normals: positionCursor < normals.length ? normals.subarray(0, positionCursor) : normals,
        indices: indexCursor < indices.length ? indices.subarray(0, indexCursor) : indices
    };
};

export const estimateLineGeometry = (
    lines: LineEntity[],
    tubularSegments: number,
    minSegmentPoints: number
): { vertexCount: number; indexCount: number } => {
    let totalVertices = 0;
    let totalIndices = 0;

    for (const line of lines) {
        if (line.points.length < minSegmentPoints) {
            continue;
        }

        const edges = line.points.length - 1;
        totalVertices += edges * (tubularSegments + 1) * 2;
        totalIndices += edges * tubularSegments * 6;

        if (totalVertices > MAX_LINE_VERTICES) {
            return {
                vertexCount: MAX_LINE_VERTICES,
                indexCount: totalIndices
            };
        }
    }

    return {
        vertexCount: totalVertices,
        indexCount: totalIndices
    };
};
