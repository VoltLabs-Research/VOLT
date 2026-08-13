/*
 * Pins the property that keeps the daemon agnostic: it must hold no opinion about what
 * a category name means. A plugin declares the colours for its own categories; anything
 * undeclared gets a deterministic generated colour, and a category invented tomorrow
 * renders without a change here.
 *
 * The regression this guards against is a well-meaning "FCC is green" table creeping
 * back into the daemon, which would silently override whatever a plugin declared and
 * leave any new structure type unrenderable without editing VOLT.
 *
 * Run: npx tsx scripts/category-colors-check.ts
 */

import { resolveCategoryColors } from '@modules/plugin/services/exports/category-colors';

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

const asText = (color: [number, number, number, number] | undefined): string =>
    color ? `[${color.map((c) => c.toFixed(4)).join(', ')}]` : 'undefined';

/* ---- 1. a declared colour is used verbatim ---- */

{
    const declared: [number, number, number, number] = [0.4, 1, 0.4, 1];
    const resolved = resolveCategoryColors(['FCC', 'HCP'], { FCC: declared });

    check(
        'un color declarado por el plugin se usa tal cual',
        JSON.stringify(resolved.get('FCC')) === JSON.stringify(declared),
        asText(resolved.get('FCC'))
    );
}

/* ---- 2. the daemon has no built-in meaning for well-known names ---- */

{
    const undeclared = resolveCategoryColors(['FCC'], undefined);
    const green: [number, number, number, number] = [0.4, 1, 0.4, 1];

    check(
        'sin declaracion, "FCC" NO sale verde: el daemon no interpreta el nombre',
        JSON.stringify(undeclared.get('FCC')) !== JSON.stringify(green),
        `${asText(undeclared.get('FCC'))} (verde de OVITO seria ${asText(green)})`
    );

    // The same check from the other side: an invented category resolves fine.
    const invented = resolveCategoryColors(['QUASICRYSTAL_APPROXIMANT'], undefined);
    const color = invented.get('QUASICRYSTAL_APPROXIMANT');
    check(
        'una categoria nueva se resuelve sin tocar VOLT',
        Boolean(color) && color!.every((channel) => Number.isFinite(channel)) && color![3] === 1,
        asText(color)
    );
}

/* ---- 3. declaration matching tolerates spelling, not meaning ---- */

{
    const resolved = resolveCategoryColors(
        ['Cubic diamond'],
        { CUBIC_DIAMOND: [0.1, 0.2, 0.3, 1] }
    );

    check(
        'la busqueda ignora mayusculas y separadores',
        JSON.stringify(resolved.get('Cubic diamond')) === JSON.stringify([0.1, 0.2, 0.3, 1]),
        asText(resolved.get('Cubic diamond'))
    );
}

/* ---- 4. generated colours are stable and distinct ---- */

{
    const first = resolveCategoryColors(['A', 'B', 'C'], undefined);
    const again = resolveCategoryColors(['C', 'B', 'A'], undefined);

    check(
        'el color generado no depende del orden de entrada',
        (['A', 'B', 'C'] as const).every((name) =>
            JSON.stringify(first.get(name)) === JSON.stringify(again.get(name))),
        (['A', 'B', 'C'] as const).map((name) => `${name}=${asText(first.get(name))}`).join(' ')
    );

    const distinct = new Set((['A', 'B', 'C'] as const).map((name) => JSON.stringify(first.get(name))));
    check(
        'categorias distintas reciben colores distintos',
        distinct.size === 3,
        `${distinct.size} colores unicos de 3`
    );
}

/* ---- 5. cluster names pin the colour to the id, not to list position ---- */

{
    const dense = resolveCategoryColors(['Cluster 1', 'Cluster 2', 'Cluster 3'], undefined);
    // Cluster 2 disappears between frames; Cluster 3 must not inherit its colour.
    const sparse = resolveCategoryColors(['Cluster 1', 'Cluster 3'], undefined);

    check(
        'el color de un cluster no se desplaza cuando otro desaparece',
        JSON.stringify(dense.get('Cluster 3')) === JSON.stringify(sparse.get('Cluster 3')),
        `denso=${asText(dense.get('Cluster 3'))} disperso=${asText(sparse.get('Cluster 3'))}`
    );

    check(
        'una declaracion explicita gana sobre la regla de indice de cluster',
        JSON.stringify(
            resolveCategoryColors(['Cluster 3'], { 'Cluster 3': [1, 0, 0, 1] }).get('Cluster 3')
        ) === JSON.stringify([1, 0, 0, 1]),
        asText(resolveCategoryColors(['Cluster 3'], { 'Cluster 3': [1, 0, 0, 1] }).get('Cluster 3'))
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
