import path from 'node:path';

import { Service } from '@/core/decorators/service';
import { BinaryExecutorService } from '@/core/runtime/infrastructure/binary-executor-service';
import type { AnalysisValueMap } from '@/modules/analysis/contracts/http-analysis';

const DUMP_TRANSFORM_BINARY_NAME = 'volt-dump-transform';

// The CoreToolkit `volt-dump-transform` CLI applies slice / select / merge ops
// to a LAMMPS dump in place (input == output is allowed; it buffers in memory).
// The binary is VENDORED into the daemon at
// `modules/analysis/infrastructure/bin/volt-dump-transform` and shipped to dist/
// by copy-static-assets.js. The same `__dirname`-relative path resolves in dev
// (tsx over src/, where the binary is committed) and in a built/Docker daemon
// (dist/, where it's copied) — mirrors resolvePythonStubPath. An env override
// wins for deployments that install the binary elsewhere.
export const resolveDumpTransformBinary = (): string => {
    const override = process.env.VOLT_DUMP_TRANSFORM_BIN;
    if (override && override.length > 0) {
        return override;
    }
    // dump-transform.ts lives in .../analysis/application/analysis; the binary in
    // .../analysis/infrastructure/bin → up two to the analysis module root.
    return path.resolve(__dirname, '..', '..', 'infrastructure', 'bin', DUMP_TRANSFORM_BINARY_NAME);
};

const readNumber = (value: unknown): number | undefined => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
};

const readBoolean = (value: unknown): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return value === 'true' || value === '1';
    return false;
};

// Builds the `--slice <nx>,<ny>,<nz>,<distance>,<reverse>` argv from a stage
// config. The normal can be given as a `{x,y,z}` tuple under `normal` or as flat
// `nx`/`ny`/`nz` keys; `distance` is the signed plane offset; reverse is read
// from `reverseOrientation` or `reverse`. The binary normalizes the normal, so
// only direction matters here.
export const buildSliceArgs = (config: AnalysisValueMap): string[] => {
    const normal = (config.normal ?? {}) as AnalysisValueMap;
    const nx = readNumber(config.nx) ?? readNumber(normal.x) ?? 0;
    const ny = readNumber(config.ny) ?? readNumber(normal.y) ?? 0;
    const nz = readNumber(config.nz) ?? readNumber(normal.z) ?? 0;
    const distance = readNumber(config.distance) ?? 0;
    const reverse = readBoolean(config.reverseOrientation ?? config.reverse) ? 1 : 0;

    return ['--slice', `${nx},${ny},${nz},${distance},${reverse}`];
};

export const buildSelectArgs = (expression: string): string[] => ['--select', expression];

export const buildMergeArgs = (propsParquet: string): string[] => ['--merge', propsParquet];

@Service('dumpTransformService')
export class DumpTransformService {
    constructor(private readonly binaryExecutorService: BinaryExecutorService) {}

    // Half-space slice: keep atoms on one side of a plane. Mutates workingDump
    // in place (input == output path).
    async slice(workingDump: string, sliceConfig: AnalysisValueMap): Promise<void> {
        await this.run(workingDump, buildSliceArgs(sliceConfig));
    }

    // Expression filter: keep atoms matching the boolean selection expression.
    async select(workingDump: string, expression: string): Promise<void> {
        await this.run(workingDump, buildSelectArgs(expression));
    }

    // Merge: append the parquet's per-atom property columns onto the dump by id.
    async merge(workingDump: string, propsParquet: string): Promise<void> {
        await this.run(workingDump, buildMergeArgs(propsParquet));
    }

    private async run(workingDump: string, operationArgs: string[]): Promise<void> {
        const binary = resolveDumpTransformBinary();
        const result = await this.binaryExecutorService.executeProcess({
            jobId: `dump-transform:${path.basename(workingDump)}`,
            commandPath: binary,
            args: [workingDump, workingDump, ...operationArgs],
            cwd: path.dirname(workingDump)
        });

        if (result.code !== 0) {
            throw new Error(
                `volt-dump-transform ${operationArgs[0]} failed with code ${result.code}: ${result.stderr || result.stdout}`
            );
        }
    }
}
