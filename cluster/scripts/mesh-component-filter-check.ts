/*
 * Checks the "interior defects only" filter, which drops the connected component of a
 * defect mesh that encloses the others -- the sample's outer shell.
 *
 * The case that matters most here is the one where it must NOT act: in a fully
 * periodic bulk cell the components are voids sitting side by side, and dropping "the
 * biggest" would silently delete a real void. The filter only fires when one component
 * genuinely contains all the rest.
 *
 * Run: npx tsx scripts/mesh-component-filter-check.ts
 */

import { dropEnclosingComponent } from '@modules/plugin/services/exports/mesh-component-filter';

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

const BOX_TRIANGLES = 12;

/** Appends an axis-aligned closed box, outward-wound, to the arrays being built. */
const pushBox = (
    positions: number[],
    indices: number[],
    min: [number, number, number],
    max: [number, number, number]
): void => {
    const base = positions.length / 3;
    const [x0, y0, z0] = min;
    const [x1, y1, z1] = max;
    positions.push(
        x0, y0, z0,
        x1, y0, z0,
        x1, y1, z0,
        x0, y1, z0,
        x0, y0, z1,
        x1, y0, z1,
        x1, y1, z1,
        x0, y1, z1
    );
    const box = [
        0, 2, 1, 0, 3, 2,
        4, 5, 6, 4, 6, 7,
        0, 1, 5, 0, 5, 4,
        3, 7, 6, 3, 6, 2,
        0, 4, 7, 0, 7, 3,
        1, 2, 6, 1, 6, 5
    ];
    for (const corner of box) {
        indices.push(base + corner);
    }
};

const buildMesh = (boxes: Array<[[number, number, number], [number, number, number]]>) => {
    const positions: number[] = [];
    const indices: number[] = [];
    for (const [min, max] of boxes) {
        pushBox(positions, indices, min, max);
    }
    return {
        positions: new Float32Array(positions),
        indices: new Uint32Array(indices)
    };
};

const boundsOf = (positions: Float32Array) => {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let offset = 0; offset < positions.length; offset += 3) {
        for (let axis = 0; axis < 3; axis += 1) {
            min[axis] = Math.min(min[axis], positions[offset + axis]);
            max[axis] = Math.max(max[axis], positions[offset + axis]);
        }
    }
    return {
        min,
        max
    };
};

const maxIndex = (indices: Uint32Array): number => {
    let highest = -1;
    for (const value of indices) {
        if (value > highest) highest = value;
    }
    return highest;
};

/* ---- 1. a shell wrapping one interior void: the shell goes ---- */

{
    const mesh = buildMesh([
        [[0, 0, 0], [100, 100, 100]],   // outer shell
        [[40, 40, 40], [60, 60, 60]]    // interior void
    ]);
    const filtered = dropEnclosingComponent(mesh.positions, mesh.indices);

    check(
        'con cascara envolviendo un hueco, la cascara se descarta',
        filtered.componentCount === 2
            && filtered.droppedTriangles === BOX_TRIANGLES
            && filtered.indices.length === BOX_TRIANGLES * 3,
        `componentes=${filtered.componentCount} descartados=${filtered.droppedTriangles} `
        + `triangulos restantes=${filtered.indices.length / 3}`
    );

    const bounds = boundsOf(filtered.positions);
    check(
        'lo que queda es exactamente el hueco interior',
        bounds.min.every((value) => Math.abs(value - 40) < 1e-4)
            && bounds.max.every((value) => Math.abs(value - 60) < 1e-4),
        `min=[${bounds.min.join(', ')}] max=[${bounds.max.join(', ')}]`
    );

    check(
        'los vertices de la cascara no se quedan colgando en el buffer',
        filtered.positions.length / 3 === 8 && maxIndex(filtered.indices) === 7,
        `vertices=${filtered.positions.length / 3} indice mayor=${maxIndex(filtered.indices)}`
    );
}

/* ---- 2. two voids side by side: nothing may be dropped ---- */

{
    const mesh = buildMesh([
        [[10, 10, 10], [30, 30, 30]],
        [[60, 60, 60], [95, 95, 95]]    // bigger, but encloses nothing
    ]);
    const filtered = dropEnclosingComponent(mesh.positions, mesh.indices);

    check(
        'dos huecos sueltos: no se borra el mas grande',
        filtered.droppedTriangles === 0
            && filtered.indices.length === mesh.indices.length
            && filtered.componentCount === 2,
        `componentes=${filtered.componentCount} descartados=${filtered.droppedTriangles}`
    );
}

/* ---- 3. a lone component is never dropped ---- */

{
    const mesh = buildMesh([[[0, 0, 0], [100, 100, 100]]]);
    const filtered = dropEnclosingComponent(mesh.positions, mesh.indices);

    check(
        'una sola componente nunca se descarta',
        filtered.droppedTriangles === 0 && filtered.indices.length === mesh.indices.length,
        `componentes=${filtered.componentCount} descartados=${filtered.droppedTriangles}`
    );
}

/* ---- 4. a shell with several interior defects ---- */

{
    const mesh = buildMesh([
        [[0, 0, 0], [100, 100, 100]],
        [[10, 10, 10], [20, 20, 20]],
        [[50, 50, 50], [70, 70, 70]],
        [[80, 20, 20], [90, 30, 30]]
    ]);
    const filtered = dropEnclosingComponent(mesh.positions, mesh.indices);

    check(
        'la cascara se descarta y sobreviven todos los defectos internos',
        filtered.componentCount === 4
            && filtered.droppedTriangles === BOX_TRIANGLES
            && filtered.indices.length === BOX_TRIANGLES * 3 * 3,
        `componentes=${filtered.componentCount} descartados=${filtered.droppedTriangles} `
        + `triangulos restantes=${filtered.indices.length / 3}`
    );

    check(
        'la compactacion deja exactamente los vertices en uso',
        filtered.positions.length / 3 === 24 && maxIndex(filtered.indices) === 23,
        `vertices=${filtered.positions.length / 3} indice mayor=${maxIndex(filtered.indices)}`
    );
}

/* ---- 5. nested shells: only the outermost goes ---- */

{
    const mesh = buildMesh([
        [[0, 0, 0], [100, 100, 100]],
        [[20, 20, 20], [80, 80, 80]],
        [[40, 40, 40], [60, 60, 60]]
    ]);
    const filtered = dropEnclosingComponent(mesh.positions, mesh.indices);

    const bounds = boundsOf(filtered.positions);
    check(
        'con cascaras anidadas solo se quita la mas externa',
        filtered.droppedTriangles === BOX_TRIANGLES
            && Math.abs(bounds.min[0] - 20) < 1e-4
            && Math.abs(bounds.max[0] - 80) < 1e-4,
        `descartados=${filtered.droppedTriangles} min=[${bounds.min.join(', ')}] max=[${bounds.max.join(', ')}]`
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
