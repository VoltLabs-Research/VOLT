/*
 * Checks the periodic rewrite the MeshExporter applies to surface meshes, which
 * replaces the plugin's PBC-unwrapped facets with OVITO's behaviour: every vertex
 * wrapped back into the cell, straddling triangles cut on the boundary plane, and
 * the resulting openings closed with cap polygons.
 *
 * The invariants worth pinning are geometric rather than structural, because they
 * are what "looks like OVITO" reduces to:
 *
 *   1. nothing escapes the cell;
 *   2. the enclosed volume survives the cut (divergence theorem over the triangles),
 *      which only holds if the caps are present, complete and wound outward;
 *   3. the result is a closed oriented manifold -- every directed edge paired once.
 *
 * Run: npx tsx scripts/mesh-periodic-clipping-check.ts
 */

import { clipMeshToPeriodicCell } from '@modules/plugin/services/exports/mesh-periodic-clipping';
import { separateCapVertices } from '@modules/plugin/services/exports/mesh-exporter';
import type { MeshDomain } from '@shared/contracts/types/workflow-exposure';

interface CheckResult {
    label: string;
    passed: boolean;
    detail: string;
}

const results: CheckResult[] = [];

const check = (label: string, passed: boolean, detail: string): void => {
    results.push({
        label,
        passed,
        detail
    });
};

const approximately = (actual: number, expected: number, tolerance = 1e-4): boolean =>
    Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected));

/** Axis-aligned box as a closed, outward-wound triangle mesh. */
const buildBox = (
    min: [number, number, number],
    max: [number, number, number]
): { positions: Float32Array; indices: Uint32Array } => {
    const [x0, y0, z0] = min;
    const [x1, y1, z1] = max;
    const positions = new Float32Array([
        x0, y0, z0,
        x1, y0, z0,
        x1, y1, z0,
        x0, y1, z0,
        x0, y0, z1,
        x1, y0, z1,
        x1, y1, z1,
        x0, y1, z1
    ]);
    const indices = new Uint32Array([
        // -z, +z
        0, 2, 1, 0, 3, 2,
        4, 5, 6, 4, 6, 7,
        // -y, +y
        0, 1, 5, 0, 5, 4,
        3, 7, 6, 3, 6, 2,
        // -x, +x
        0, 4, 7, 0, 7, 3,
        1, 2, 6, 1, 6, 5
    ]);
    return {
        positions,
        indices
    };
};

const signedVolume = (positions: Float32Array, indices: Uint32Array): number => {
    let total = 0;
    for (let offset = 0; offset + 2 < indices.length; offset += 3) {
        const a = indices[offset] * 3;
        const b = indices[offset + 1] * 3;
        const c = indices[offset + 2] * 3;
        const crossX = positions[b + 1] * positions[c + 2] - positions[b + 2] * positions[c + 1];
        const crossY = positions[b + 2] * positions[c] - positions[b] * positions[c + 2];
        const crossZ = positions[b] * positions[c + 1] - positions[b + 1] * positions[c];
        total += positions[a] * crossX + positions[a + 1] * crossY + positions[a + 2] * crossZ;
    }
    return total / 6;
};

/** Returns the directed edges that have no single matching opposite. */
const findOpenEdges = (indices: Uint32Array): number => {
    const balance = new Map<string, number>();
    for (let offset = 0; offset + 2 < indices.length; offset += 3) {
        const triangle = [indices[offset], indices[offset + 1], indices[offset + 2]];
        for (let corner = 0; corner < 3; corner += 1) {
            const from = triangle[corner];
            const to = triangle[(corner + 1) % 3];
            const key = from < to ? `${from}:${to}` : `${to}:${from}`;
            const direction = from < to ? 1 : -1;
            balance.set(key, (balance.get(key) ?? 0) + direction);
        }
    }

    let open = 0;
    for (const value of balance.values()) {
        if (value !== 0) open += 1;
    }
    return open;
};

/**
 * A directed edge appearing twice means two triangles claim the same side of it,
 * which is what happens when a patch is laid over surface that is already there.
 */
const countDuplicateDirectedEdges = (indices: Uint32Array): number => {
    const seen = new Set<string>();
    let duplicates = 0;
    for (let offset = 0; offset + 2 < indices.length; offset += 3) {
        const triangle = [indices[offset], indices[offset + 1], indices[offset + 2]];
        for (let corner = 0; corner < 3; corner += 1) {
            const key = `${triangle[corner]}:${triangle[(corner + 1) % 3]}`;
            if (seen.has(key)) {
                duplicates += 1;
                continue;
            }
            seen.add(key);
        }
    }
    return duplicates;
};

const reducedExtent = (
    positions: Float32Array,
    cell: MeshDomain
): { min: number[]; max: number[] } => {
    // Only exercised with cells whose matrix is diagonal or upper-triangular in the
    // tests below, so a direct solve is enough here.
    const inverse = (() => {
        const m = [
            cell.matrix[0][0], cell.matrix[0][1], cell.matrix[0][2],
            cell.matrix[1][0], cell.matrix[1][1], cell.matrix[1][2],
            cell.matrix[2][0], cell.matrix[2][1], cell.matrix[2][2]
        ];
        const determinant = m[0] * (m[4] * m[8] - m[5] * m[7])
            - m[3] * (m[1] * m[8] - m[2] * m[7])
            + m[6] * (m[1] * m[5] - m[2] * m[4]);
        const d = 1 / determinant;
        return [
            (m[4] * m[8] - m[5] * m[7]) * d,
            (m[2] * m[7] - m[1] * m[8]) * d,
            (m[1] * m[5] - m[2] * m[4]) * d,
            (m[5] * m[6] - m[3] * m[8]) * d,
            (m[0] * m[8] - m[2] * m[6]) * d,
            (m[2] * m[3] - m[0] * m[5]) * d,
            (m[3] * m[7] - m[4] * m[6]) * d,
            (m[1] * m[6] - m[0] * m[7]) * d,
            (m[0] * m[4] - m[1] * m[3]) * d
        ];
    })();

    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let offset = 0; offset < positions.length; offset += 3) {
        const x = positions[offset] - cell.origin[0];
        const y = positions[offset + 1] - cell.origin[1];
        const z = positions[offset + 2] - cell.origin[2];
        const reduced = [
            inverse[0] * x + inverse[3] * y + inverse[6] * z,
            inverse[1] * x + inverse[4] * y + inverse[7] * z,
            inverse[2] * x + inverse[5] * y + inverse[8] * z
        ];
        for (let dim = 0; dim < 3; dim += 1) {
            min[dim] = Math.min(min[dim], reduced[dim]);
            max[dim] = Math.max(max[dim], reduced[dim]);
        }
    }
    return {
        min,
        max
    };
};

const orthorhombicCell = (size: number, pbc: [boolean, boolean, boolean]): MeshDomain => ({
    matrix: [
        [size, 0, 0],
        [0, size, 0],
        [0, 0, size]
    ],
    origin: [0, 0, 0],
    pbc
});

/* ---- 1. a surface entirely inside the cell is left alone ---- */

{
    const cell = orthorhombicCell(10, [true, true, true]);
    const box = buildBox([3, 3, 3], [7, 7, 7]);
    const clipped = clipMeshToPeriodicCell(box.positions, box.indices, cell);

    check(
        'una superficie que no toca el borde conserva sus triangulos y no genera caps',
        clipped !== null
            && clipped.surfaceTriangleCount === 12
            && clipped.capTriangleCount === 0,
        clipped
            ? `superficie=${clipped.surfaceTriangleCount} caps=${clipped.capTriangleCount}`
            : 'devolvio null'
    );

    check(
        'el volumen de una superficie interior no cambia',
        clipped !== null && approximately(signedVolume(clipped.positions, clipped.indices), 64),
        clipped ? `volumen=${signedVolume(clipped.positions, clipped.indices).toFixed(6)} esperado=64` : 'devolvio null'
    );
}

/* ---- 2. a surface straddling one periodic boundary ---- */

{
    const cell = orthorhombicCell(10, [true, true, true]);
    // Exactly what the plugin emits: PBC-unwrapped, so it reaches out to x = 12.
    const box = buildBox([8, 3, 3], [12, 7, 7]);
    const clipped = clipMeshToPeriodicCell(box.positions, box.indices, cell);

    check(
        'la superficie que cruza el borde se corta y se tapa',
        clipped !== null && clipped.surfaceTriangleCount > 12 && clipped.capTriangleCount > 0,
        clipped
            ? `superficie=${clipped.surfaceTriangleCount} caps=${clipped.capTriangleCount}`
            : 'devolvio null'
    );

    if (clipped) {
        const extent = reducedExtent(clipped.positions, cell);
        check(
            'ningun vertice queda fuera de la celda tras el recorte',
            extent.min.every((value) => value >= -1e-6) && extent.max.every((value) => value <= 1 + 1e-6),
            `reducido min=[${extent.min.map((v) => v.toFixed(4)).join(', ')}] `
            + `max=[${extent.max.map((v) => v.toFixed(4)).join(', ')}]`
        );

        const volume = signedVolume(clipped.positions, clipped.indices);
        check(
            'los caps cierran el corte: el volumen encerrado se conserva',
            approximately(volume, 64),
            `volumen=${volume.toFixed(6)} esperado=64`
        );

        check(
            'el resultado es una malla cerrada (cada arista dirigida emparejada una vez)',
            findOpenEdges(clipped.indices) === 0,
            `aristas sin pareja=${findOpenEdges(clipped.indices)}`
        );
    }
}

/* ---- 3. without caps the surface is contained but open ---- */

{
    const cell = orthorhombicCell(10, [true, true, true]);
    const box = buildBox([8, 3, 3], [12, 7, 7]);
    const clipped = clipMeshToPeriodicCell(box.positions, box.indices, cell, { generateCaps: false });

    check(
        'generateCaps:false contiene la superficie pero la deja abierta',
        clipped !== null && clipped.capTriangleCount === 0 && findOpenEdges(clipped.indices) > 0,
        clipped
            ? `caps=${clipped.capTriangleCount} aristas abiertas=${findOpenEdges(clipped.indices)}`
            : 'devolvio null'
    );
}

/* ---- 4. a surface crossing two boundaries at once ----
 *
 * The opening of such a body bends around the cell edge, so it is not planar and this
 * implementation leaves it uncapped on purpose (see appendCaps). What must still hold
 * is that the containment half worked and that nothing invented a bad patch: no
 * directed edge may appear twice, which is what a fragment fill would produce.
 */

{
    const cell = orthorhombicCell(10, [true, true, true]);
    const box = buildBox([8, 8, 3], [12, 12, 7]);
    const clipped = clipMeshToPeriodicCell(box.positions, box.indices, cell);

    if (clipped) {
        const extent = reducedExtent(clipped.positions, cell);
        check(
            'un cruce simultaneo en dos direcciones queda dentro de la celda',
            extent.min.every((value) => value >= -1e-6) && extent.max.every((value) => value <= 1 + 1e-6),
            `reducido min=[${extent.min.map((v) => v.toFixed(4)).join(', ')}] `
            + `max=[${extent.max.map((v) => v.toFixed(4)).join(', ')}]`
        );

        check(
            'una abertura no plana se deja abierta en vez de rellenarse mal',
            clipped.capTriangleCount === 0,
            `caps=${clipped.capTriangleCount} (esperado 0: la abertura dobla por la arista de la celda)`
        );

        check(
            'ninguna arista dirigida se duplica al cruzar dos bordes',
            countDuplicateDirectedEdges(clipped.indices) === 0,
            `aristas duplicadas=${countDuplicateDirectedEdges(clipped.indices)}`
        );
    } else {
        check('un cruce simultaneo en dos direcciones queda dentro de la celda', false, 'devolvio null');
    }
}

/* ---- 5. triclinic cell ---- */

{
    const cell: MeshDomain = {
        matrix: [
            [10, 0, 0],
            [2, 10, 0],
            [1, 1.5, 10]
        ],
        origin: [-5, -5, -5],
        pbc: [true, true, true]
    };
    // Straddles the first cell vector, expressed in absolute coordinates.
    const box = buildBox([3, -2, -2], [7, 2, 2]);
    const clipped = clipMeshToPeriodicCell(box.positions, box.indices, cell);

    if (clipped) {
        const extent = reducedExtent(clipped.positions, cell);
        const volume = signedVolume(clipped.positions, clipped.indices);
        check(
            'en celda triclinica el recorte respeta la celda y conserva el volumen',
            extent.min.every((value) => value >= -1e-6)
                && extent.max.every((value) => value <= 1 + 1e-6)
                && approximately(volume, 64)
                && findOpenEdges(clipped.indices) === 0,
            `volumen=${volume.toFixed(6)} esperado=64 aristas abiertas=${findOpenEdges(clipped.indices)} `
            + `reducido max=[${extent.max.map((v) => v.toFixed(4)).join(', ')}]`
        );
    } else {
        check('en celda triclinica el recorte respeta la celda y conserva el volumen', false, 'devolvio null');
    }
}

/* ---- 6. a non-periodic cell is a no-op ---- */

{
    const cell = orthorhombicCell(10, [false, false, false]);
    const box = buildBox([8, 3, 3], [12, 7, 7]);
    const clipped = clipMeshToPeriodicCell(box.positions, box.indices, cell);

    check(
        'sin direcciones periodicas no se reescribe nada',
        clipped === null,
        clipped === null ? 'devolvio null como se espera' : 'reescribio la malla'
    );
}

/* ---- 7. a degenerate cell is a no-op rather than a crash ---- */

{
    const cell: MeshDomain = {
        matrix: [
            [10, 0, 0],
            [0, 0, 0],
            [0, 0, 10]
        ],
        origin: [0, 0, 0],
        pbc: [true, true, true]
    };
    const box = buildBox([8, 3, 3], [12, 7, 7]);
    const clipped = clipMeshToPeriodicCell(box.positions, box.indices, cell);

    check(
        'una celda degenerada se ignora en vez de romper el export',
        clipped === null,
        clipped === null ? 'devolvio null como se espera' : 'reescribio la malla'
    );
}

/* ---- 8. cap vertices are separated so their colour and normal stay their own ---- */

{
    const cell = orthorhombicCell(10, [true, true, true]);
    const box = buildBox([8, 3, 3], [12, 7, 7]);
    const clipped = clipMeshToPeriodicCell(box.positions, box.indices, cell)!;
    const separated = separateCapVertices(
        clipped.positions,
        clipped.indices,
        clipped.surfaceTriangleCount
    );

    const baseVertexCount = clipped.positions.length / 3;
    const capIndexCount = clipped.capTriangleCount * 3;

    check(
        'separar los caps agrega un vertice propio por indice de cap',
        separated.positions.length / 3 === baseVertexCount + capIndexCount
            && separated.colors.length / 4 === baseVertexCount + capIndexCount
            && separated.indices.length === clipped.indices.length,
        `vertices=${separated.positions.length / 3} esperado=${baseVertexCount + capIndexCount} `
        + `colores=${separated.colors.length / 4} indices=${separated.indices.length}`
    );

    // Geometry must be untouched: every index still resolves to the same point.
    let movedVertices = 0;
    for (let offset = 0; offset < separated.indices.length; offset += 1) {
        const before = clipped.indices[offset] * 3;
        const after = separated.indices[offset] * 3;
        for (let axis = 0; axis < 3; axis += 1) {
            if (Math.abs(clipped.positions[before + axis] - separated.positions[after + axis]) > 1e-6) {
                movedVertices += 1;
            }
        }
    }
    check(
        'separar los caps no mueve ningun punto de la geometria',
        movedVertices === 0,
        `componentes desplazadas=${movedVertices}`
    );

    // Surface triangles must stay white, cap triangles lavender, with no bleed.
    const colorOf = (vertex: number): [number, number, number, number] => [
        separated.colors[vertex * 4],
        separated.colors[vertex * 4 + 1],
        separated.colors[vertex * 4 + 2],
        separated.colors[vertex * 4 + 3]
    ];
    const isWhite = (vertex: number): boolean => colorOf(vertex).every((channel) => channel === 1);
    const isLavender = (vertex: number): boolean => {
        const [r, g, b, a] = colorOf(vertex);
        return approximately(r, 0.8) && approximately(g, 0.8) && approximately(b, 1) && a === 1;
    };

    const surfaceIndexCount = clipped.surfaceTriangleCount * 3;
    let miscoloured = 0;
    for (let offset = 0; offset < surfaceIndexCount; offset += 1) {
        if (!isWhite(separated.indices[offset])) miscoloured += 1;
    }
    for (let offset = surfaceIndexCount; offset < separated.indices.length; offset += 1) {
        if (!isLavender(separated.indices[offset])) miscoloured += 1;
    }
    check(
        'la superficie queda blanca y los caps con el lavanda de OVITO, sin contagio',
        miscoloured === 0 && capIndexCount > 0,
        `vertices con color incorrecto=${miscoloured} indices de cap=${capIndexCount}`
    );

    check(
        'el volumen se conserva tras separar los caps',
        approximately(signedVolume(separated.positions, separated.indices), 64),
        `volumen=${signedVolume(separated.positions, separated.indices).toFixed(6)} esperado=64`
    );
}

/* ---- report ---- */

let failed = 0;
for (const result of results) {
    if (!result.passed) failed += 1;
    console.log(`${result.passed ? 'PASS' : 'FAIL'}  ${result.label}\n        ${result.detail}`);
}

console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed === 0 ? 0 : 1);
