import { ArgumentType, Exporter } from '@volt/contracts/modules/plugin/enums';
import { isArgumentVisible, matchesArgumentCondition } from '@volt/contracts/modules/plugin/arguments';
import { isRenderableSceneExporter } from '@/modules/canvas/utils/plugin-exposure-export';
import { exportAtomistic } from './exporters/atomistic';
import { exportBonds, exportLines } from './exporters/lines';
import { exportMesh } from './exporters/mesh';
import { readExporterData, readExposurePayload } from './read-exposure-payload';
import { parseShimTable } from './shim-table';
import type { ExposurePayload } from './read-exposure-payload';
import type { LineEntity } from './exporters/types';
import type { ShimTable } from './shim-table';
import type { WasmPluginRuntime } from './catalog';
import type { IArgumentDefinition } from '@volt/contracts/modules/plugin/workflow';
import type { IExposureComputed } from '@volt/contracts/modules/plugin/exposure';
import type { Plugin } from '@volt/contracts/modules/plugin/plugin';

// Browser counterpart of the cluster's pipeline worker (process-pipeline-job.ts): same CLI arguments,
// same entrypoint template, same chaining through shared exposures and the annotated dump.

export const PLUGIN_DATA_ROOT = '/plugin';
const WORK_DIRECTORY = '/work';
const INPUT_DUMP = `${WORK_DIRECTORY}/in.dump`;
const OUTPUT_BASE = `${WORK_DIRECTORY}/out`;
const ANNOTATED_DUMP = `${OUTPUT_BASE}_annotated.dump`;

// A trajectory frame is passed on as the file's own bytes; other inputs are text.
export type PluginInputFile = string | Uint8Array;

export interface PluginExecution {
    binary: string;
    args: string[];
    // MEMFS path -> contents written before the plugin starts.
    files: Record<string, PluginInputFile>;
    // Paths relative to data/<binary>/, mounted under PLUGIN_DATA_ROOT.
    dataFiles: string[];
    outputDirectory: string;
    onLog: (line: string) => void;
    // Aborting stops the plugin where it is (its worker is terminated) and rejects the run.
    signal?: AbortSignal;
}

export interface PluginExecutionResult {
    exitCode: number;
    outputs: Record<string, string>;
}

export type PluginExecutor = (execution: PluginExecution) => Promise<PluginExecutionResult>;

const stableStringify = (value: unknown): string => {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value) ?? 'null';
    }
    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(',')}]`;
    }
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort()
        .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
        .join(',')}}`;
};

// Same precedence as the cluster's ArgumentsHandler: fixed value, then user config, then default.
const resolveArgumentValues = (
    definitions: IArgumentDefinition[],
    userConfig: Record<string, unknown>
): Record<string, unknown> => Object.fromEntries(definitions.map((definition) => {
    const key = definition.argument;
    if (definition.value !== undefined) return [key, definition.value];
    if (userConfig[key] !== undefined) return [key, userConfig[key]];
    return [key, definition.default];
}));

const isMissingValue = (value: unknown): boolean =>
    value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);

const toCliTokens = (definition: IArgumentDefinition, value: unknown): string[] => {
    const flag = `--${definition.argument}`;
    if (value === null || value === undefined || definition.type === ArgumentType.PLUGIN_REFERENCE) {
        return [];
    }
    if (definition.type === ArgumentType.BOOLEAN) {
        const enabled = value === true || value === 'true';
        if (definition.cliValueStyle === 'explicit') {
            return [flag, enabled ? 'true' : 'false'];
        }
        return enabled ? [flag] : [];
    }
    if (definition.type === ArgumentType.SELECT && definition.multipleSelection) {
        const selected = Array.isArray(value) ? value : [value];
        return selected.length > 0 ? [flag, selected.join(',')] : [];
    }
    return [flag, typeof value === 'string' ? value : stableStringify(value)];
};

export const buildCliArguments = (
    plugin: Plugin,
    userConfig: Record<string, unknown>,
    frameDumpPath: (timestep: number) => string
): string[] => {
    const definitions = (plugin.arguments ?? []) as IArgumentDefinition[];
    const values = resolveArgumentValues(definitions, userConfig);

    return definitions.flatMap((definition) => {
        if (!isArgumentVisible(definition, definitions, values)) {
            return [];
        }
        const value = values[definition.argument];
        if (definition.required && isMissingValue(value)) {
            throw new Error(`${definition.label || definition.argument} is required.`);
        }
        // Frame arguments carry a timestep; the plugin receives that frame as a dump file.
        if (definition.type === ArgumentType.FRAME) {
            const timestep = Number(value);
            return isMissingValue(value) || !Number.isFinite(timestep)
                ? []
                : [`--${definition.argument}`, frameDumpPath(timestep)];
        }
        return toCliTokens(definition, value);
    });
};

const TEMPLATE_PLACEHOLDER = /\{\{\s*([^}]+?)\s*\}\}/g;
const CLI_ARGUMENTS_TOKEN = '\u0000cli-arguments';

export const resolveEntrypointArguments = (plugin: Plugin, cliArguments: string[]): string[] => {
    const entrypoint = plugin.workflow.nodes.find((node) => node.data.entrypoint)?.data.entrypoint;
    const template = entrypoint?.arguments ?? '';
    const resolved = template.replace(TEMPLATE_PLACEHOLDER, (_, path: string) => {
        if (path.endsWith('.currentValue.path')) return INPUT_DUMP;
        if (path.endsWith('.outputPath')) return OUTPUT_BASE;
        if (path.endsWith('.as_str')) return ` ${CLI_ARGUMENTS_TOKEN} `;
        if (path.endsWith('.projectPath')) return PLUGIN_DATA_ROOT;
        throw new Error(`Unsupported entrypoint placeholder {{ ${path} }}`);
    });
    return resolved.split(/\s+/).filter(Boolean)
        .flatMap((token) => (token === CLI_ARGUMENTS_TOKEN ? cliArguments : [token]));
};

// Mirrors pipeline-context.ts: exposure ids and inferFromContext keys match with '-' and '_' interchangeable.
const contextKey = (key: string): string => key.replace(/-/g, '_');

export interface FrameContext {
    // The frame the next stage reads: its bytes in the uploaded file, then each stage's annotated dump.
    workingDump: PluginInputFile;
    // contextKey(exposure id) -> file contents produced by an earlier stage.
    shared: Record<string, string>;
}

export interface PipelineStage {
    runtime: WasmPluginRuntime;
    config: Record<string, unknown>;
}

const exposureOutputPath = (results: string): string => `${OUTPUT_BASE}_${results}`;

const summarizeFailure = (log: string[], exitCode: number): string => {
    const errors = log
        .filter((line) => /\[(error|critical)\]/i.test(line))
        .map((line) => line.replace(/^.*\[(error|critical)\]\s*/i, '').trim())
        .filter(Boolean);
    return errors.length > 0 ? errors.join('\n') : `Exited with code ${exitCode}.`;
};

export const runPipelineStage = async (
    { runtime, config }: PipelineStage,
    context: FrameContext,
    frameDump: (timestep: number) => PluginInputFile,
    execute: PluginExecutor,
    onLog: (line: string) => void
): Promise<Record<string, string>> => {
    const { plugin } = runtime;
    const files: Record<string, PluginInputFile> = { [INPUT_DUMP]: context.workingDump };
    const cliArguments = buildCliArguments(plugin, config, (timestep) => {
        const path = `${WORK_DIRECTORY}/frame_${timestep}.dump`;
        files[path] = frameDump(timestep);
        return path;
    });

    const contextArguments = ((plugin.arguments ?? []) as IArgumentDefinition[])
        .filter((definition) => definition.inferFromContext)
        .flatMap((definition) => {
            const key = contextKey(definition.argument);
            const contents = context.shared[key];
            if (contents === undefined) {
                throw new Error(
                    `Needs "${definition.argument}" from an earlier stage. Add a plugin that exports it before this one.`
                );
            }
            const path = `${WORK_DIRECTORY}/${key}`;
            files[path] = contents;
            return [`--${definition.argument}`, path];
        });

    const args = [...resolveEntrypointArguments(plugin, cliArguments), ...contextArguments, ...runtime.args];
    const log: string[] = [];
    const record = (line: string) => {
        log.push(line);
        onLog(line);
    };
    record(`$ ${runtime.binary} ${args.join(' ')}`);

    const { exitCode, outputs } = await execute({
        binary: runtime.binary,
        args,
        files,
        dataFiles: runtime.files,
        outputDirectory: WORK_DIRECTORY,
        onLog: record
    });
    if (exitCode !== 0) {
        throw new Error(summarizeFailure(log, exitCode));
    }

    for (const exposure of plugin.exposures ?? []) {
        const contents = exposure.id ? outputs[exposureOutputPath(exposure.results)] : undefined;
        if (exposure.id && contents !== undefined) {
            context.shared[contextKey(exposure.id)] = contents;
        }
    }
    if (outputs[ANNOTATED_DUMP] !== undefined) {
        context.workingDump = outputs[ANNOTATED_DUMP];
    }
    return outputs;
};

export interface ListingResult {
    // Scalar main_listing fields, the same filter the cluster applies before persisting a listing row.
    row: Record<string, unknown>;
    subListings: Record<string, Record<string, unknown>[]>;
}

export interface FrameResult {
    // Per-atom table shown in the Particles tab, rows in atom_index order.
    atoms: ShimTable | null;
    listings: Record<string, ListingResult>;
    // exposure _id -> GLB the canvas renders for that exposure.
    scenes: Record<string, Blob>;
}

// WorkflowSession skips every exposure whose exportWhen does not hold: no listing, no artifact.
export const isExposureExported = (plugin: Plugin, exposure: IExposureComputed, config: Record<string, unknown>): boolean =>
    matchesArgumentCondition(exposure.exportWhen, (plugin.arguments ?? []) as IArgumentDefinition[], config);

const toListing = ({ mainListing, subListings }: ExposurePayload): ListingResult | null => {
    const row = Object.fromEntries(Object.entries(mainListing ?? {})
        .filter(([, value]) => value === null || typeof value !== 'object'));
    return Object.keys(row).length > 0 || Object.keys(subListings).length > 0 ? { row, subListings } : null;
};

const toLineEntities = (value: unknown): LineEntity[] => (Array.isArray(value) ? value as LineEntity[] : []);

const buildScene = (
    exporter: string,
    data: Record<string, unknown>,
    options: Record<string, unknown>,
    readTable: (fileName: string) => ShimTable | null
): Blob | null => {
    switch (exporter) {
        case Exporter.ATOMISTIC:
            return exportAtomistic(data, options, readTable);
        case Exporter.LINE:
            return exportLines(toLineEntities(data.lines), options);
        case Exporter.BOND:
            return exportBonds(toLineEntities(data.bonds), options);
        case Exporter.MESH:
            return exportMesh(data, options, readTable);
        default:
            return null;
    }
};

// Mirrors the cluster's ResultProcessor + ExportNodeProcessor for one frame of one plugin.
export const collectFrameResult = (
    plugin: Plugin,
    config: Record<string, unknown>,
    outputs: Record<string, string>,
    atomCount: number
): FrameResult => {
    const result: FrameResult = { atoms: null, listings: {}, scenes: {} };
    const tables = new Map<string, ShimTable | null>();
    // Exporter sources name sibling files relative to the output directory.
    const readTable = (fileName: string): ShimTable | null => {
        const path = fileName.startsWith('/') ? fileName : `${WORK_DIRECTORY}/${fileName}`;
        if (!tables.has(path)) {
            const raw = outputs[path];
            tables.set(path, raw === undefined ? null : parseShimTable(raw));
        }
        return tables.get(path) ?? null;
    };

    for (const exposure of plugin.exposures ?? []) {
        if (!exposure.results.toLowerCase().endsWith('.parquet') || !isExposureExported(plugin, exposure, config)) {
            continue;
        }
        const outputPath = exposureOutputPath(exposure.results);
        const table = readTable(outputPath);
        if (!table) continue;

        const exporter = exposure.export?.exporter;
        const payload = readExposurePayload(table, outputPath, exporter === Exporter.MESH);
        const listing = exporter !== Exporter.CHART && exposure.hasListing !== false ? toListing(payload) : null;
        if (listing) {
            result.listings[exposure._id] = listing;
        }

        if (!result.atoms && exporter === Exporter.ATOMISTIC && payload.atomTable?.rows.length === atomCount) {
            const atomIndex = payload.atomTable.columns.findIndex((column) => column.name === 'atom_index');
            result.atoms = atomIndex < 0
                ? payload.atomTable
                : {
                    ...payload.atomTable,
                    rows: [...payload.atomTable.rows].sort((left, right) => Number(left[atomIndex]) - Number(right[atomIndex]))
                };
        }

        const data = exporter && isRenderableSceneExporter(exporter) ? readExporterData(payload.exportSection, exporter) : null;
        const scene = data && exporter ? buildScene(exporter, data, exposure.export?.options ?? {}, readTable) : null;
        if (scene) {
            result.scenes[exposure._id] = scene;
        }
    }
    return result;
};
