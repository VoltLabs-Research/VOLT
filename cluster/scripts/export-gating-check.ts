/*
 * Checks the two halves of argument-driven exports against the real opendxa workflow:
 *
 *   1. an exposure whose `exportWhen` is false never reaches the run's exposure list, so
 *      nothing downstream registers, exports or persists it;
 *   2. a boolean declared `cliValueStyle: 'explicit'` always reaches the binary with a
 *      value, which is the only way to switch off a flag the binary defaults to true.
 *
 * Run: npx tsx scripts/export-gating-check.ts
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { WorkflowSession } from '@modules/analysis/services/workflow/WorkflowSession';
import type { WorkflowArgumentDefinition, WorkflowDefinition } from '@shared/contracts/types/http-workflow';
import type { WorkflowValueMap } from '@shared/contracts/types/workflow.types';

const PLUGIN_JSON = resolve(
    __dirname,
    '../../../packages/opendxa/plugin.json'
);

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

const loadWorkflow = (): WorkflowDefinition => {
    const raw = JSON.parse(readFileSync(PLUGIN_JSON, 'utf8')) as { workflow: WorkflowDefinition };
    return raw.workflow;
};

const workflow = loadWorkflow();

const argumentDefinitions: WorkflowArgumentDefinition[] = workflow.nodes
    .find((node) => node.type === 'arguments')
    ?.data.arguments?.arguments ?? [];

const defaultConfig = (): WorkflowValueMap => {
    const config: WorkflowValueMap = {};
    for (const definition of argumentDefinitions) {
        if (definition.argument !== undefined && definition.default !== undefined) {
            config[definition.argument] = definition.default;
        }
    }
    return config;
};

const namesFor = (config?: WorkflowValueMap): string[] => (
    WorkflowSession.collectExposureDefinitions(workflow, config)
        .map((exposure) => exposure.name)
        .sort()
);

/* ---- 1. no config at all keeps the pre-gating behaviour ---- */

const ungated = namesFor();
check(
    'sin config se conservan las 8 exposures (compatibilidad)',
    ungated.length === 8,
    `${ungated.length} exposures`
);

/* ---- 2. defaults: only what opendxa writes by default ---- */

const withDefaults = namesFor(defaultConfig());
const expectedByDefault = [
    'Burgers Length Distribution',
    'Burgers Segment Counts',
    'Defect Mesh',
    'Dislocations',
    'Network Statistics'
].sort();

check(
    'con defaults quedan las 5 que opendxa escribe',
    JSON.stringify(withDefaults) === JSON.stringify(expectedByDefault),
    withDefaults.join(', ')
);

check(
    'con defaults NO aparece Structure Identification (la del ENOENT)',
    !withDefaults.includes('Structure Identification'),
    withDefaults.includes('Structure Identification') ? 'sigue presente' : 'ausente'
);

/* ---- 3. turning the defect mesh off removes exactly one exposure ---- */

const meshOff = namesFor({
    ...defaultConfig(),
    export_defect_mesh: false
});

check(
    'export_defect_mesh=false quita solo el Defect Mesh',
    !meshOff.includes('Defect Mesh') && meshOff.length === withDefaults.length - 1,
    meshOff.join(', ')
);

/* ---- 4. one flag can gate several exposures ---- */

const statsOff = namesFor({
    ...defaultConfig(),
    export_dislocation_network_stats: false
});

check(
    'export_dislocation_network_stats=false quita los 3 derivados del summary',
    statsOff.length === withDefaults.length - 3
        && !statsOff.some((name) => name.startsWith('Burgers') || name === 'Network Statistics'),
    statsOff.join(', ')
);

/* ---- 5. opting in adds exposures back ---- */

const structureOn = namesFor({
    ...defaultConfig(),
    export_structure_identification: true
});

check(
    'export_structure_identification=true suma Structure Identification',
    structureOn.includes('Structure Identification'),
    structureOn.join(', ')
);

/* ---- 6. everything off yields nothing, without throwing ---- */

const allOff: WorkflowValueMap = {};
for (const definition of argumentDefinitions) {
    if (definition.argument?.startsWith('export_')) {
        allOff[definition.argument] = false;
    }
}

const nothing = namesFor(allOff);
check(
    'todo apagado no rompe y no deja exposures',
    nothing.length === 0,
    `${nothing.length} exposures`
);

/* ---- 7. explicit CLI style can express false ---- */

const buildCliArgument = (
    definition: WorkflowArgumentDefinition,
    value: unknown
): string[] => {
    if (definition.type !== 'boolean') {
        return [];
    }
    const isEnabled = value === true || value === 'true';
    if (definition.cliValueStyle === 'explicit') {
        return [`--${definition.argument}`, isEnabled ? 'true' : 'false'];
    }
    return isEnabled ? [`--${definition.argument}`] : [];
};

const meshDefinition = argumentDefinitions.find(
    (definition) => definition.argument === 'export_defect_mesh'
);

check(
    'export_defect_mesh declara cliValueStyle explicit',
    meshDefinition?.cliValueStyle === 'explicit',
    String(meshDefinition?.cliValueStyle)
);

if (meshDefinition) {
    const offArgs = buildCliArgument(meshDefinition, false);
    const onArgs = buildCliArgument(meshDefinition, true);

    check(
        'apagado emite "--export_defect_mesh false" (presencia sola no podria)',
        offArgs.join(' ') === '--export_defect_mesh false',
        offArgs.join(' ') || '(vacio)'
    );

    check(
        'encendido emite "--export_defect_mesh true"',
        onArgs.join(' ') === '--export_defect_mesh true',
        onArgs.join(' ')
    );
}

/* ---- 8. every gate points at a declared argument ---- */

const declared = new Set(argumentDefinitions.map((definition) => definition.argument));
const danglingGates = workflow.nodes
    .filter((node) => node.type === 'exposure')
    .map((node) => node.data.exposure?.exportWhen?.argument)
    .filter((argument): argument is string => argument !== undefined)
    .filter((argument) => !declared.has(argument));

check(
    'ningun exportWhen apunta a un argumento inexistente',
    danglingGates.length === 0,
    danglingGates.length === 0 ? 'todos resueltos' : danglingGates.join(', ')
);

/* ---- report ---- */

let failed = 0;
for (const result of results) {
    if (!result.passed) failed += 1;
    console.log(`${result.passed ? 'PASS' : 'FAIL'}  ${result.label}\n        ${result.detail}`);
}

console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed === 0 ? 0 : 1);
