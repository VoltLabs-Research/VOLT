import { singleton } from '@shared/utilities/singleton';
import path from 'node:path';
import { currentPlatformTag } from '@shared/utilities/platform-tag';
import { firstExistingPath, vendorBinaryCandidates, vendorBinaryName } from '@shared/utilities/vendor-binaries';

import { BinaryExecutorService, getBinaryExecutorService } from '@modules/plugin/services/runtime/BinaryExecutorService';
import type { AnalysisValueMap } from '@shared/contracts/types/http-analysis';

const dumpTransformCandidates = (): string[] =>
    vendorBinaryCandidates('volt-dump-transform', vendorBinaryName('volt-dump-transform'));

const resolveDumpTransformBinary = async (): Promise<string> => {
    const override = process.env.VOLT_DUMP_TRANSFORM_BIN;
    if (override && override.length > 0) {
        return override;
    }

    const found = firstExistingPath(dumpTransformCandidates());
    if (found) return found;

    throw new Error(
        `volt-dump-transform is not installed for ${currentPlatformTag()} (expected ${dumpTransformCandidates()[0]}); `
        + 'run "npm run fetch:tools" in the daemon package or point VOLT_DUMP_TRANSFORM_BIN at a native build'
    );
};

const readNumber = (value: AnalysisValueMap[string]): number | undefined => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
};

const readBoolean = (value: AnalysisValueMap[string]): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return value === 'true' || value === '1';
    return false;
};

const buildSliceArgs = (config: AnalysisValueMap): string[] => {
    const normal = (config.normal ?? {}) as AnalysisValueMap;
    const nx = readNumber(config.nx) ?? readNumber(normal.x) ?? 0;
    const ny = readNumber(config.ny) ?? readNumber(normal.y) ?? 0;
    const nz = readNumber(config.nz) ?? readNumber(normal.z) ?? 0;
    const distance = readNumber(config.distance) ?? 0;
    const reverse = readBoolean(config.reverseOrientation ?? config.reverse) ? 1 : 0;

    return ['--slice', `${nx},${ny},${nz},${distance},${reverse}`];
};

export class DumpTransformService {
    constructor(private readonly binaryExecutorService: BinaryExecutorService) {}

    async slice(workingDump: string, sliceConfig: AnalysisValueMap): Promise<void> {
        await this.run(workingDump, buildSliceArgs(sliceConfig));
    }

    async select(workingDump: string, expression: string): Promise<void> {
        await this.run(workingDump, ['--select', expression]);
    }

    async merge(workingDump: string, propsParquet: string): Promise<void> {
        await this.run(workingDump, ['--merge', propsParquet]);
    }

    private async run(workingDump: string, operationArgs: string[]): Promise<void> {
        const binary = await resolveDumpTransformBinary();
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

export const getDumpTransformService = singleton((): DumpTransformService => new DumpTransformService(getBinaryExecutorService()));
