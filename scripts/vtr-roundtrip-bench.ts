/* eslint-disable no-console */
// Manual benchmark/roundtrip harness. Run with `npx tsx scripts/vtr-roundtrip-bench.ts`.

import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';

import { VtrWriter } from '@/modules/trajectory/infrastructure/codecs/vtr-writer';
import { VtrReader } from '@/modules/trajectory/infrastructure/codecs/vtr-reader';

const FRAME_COUNT = Number(process.env.VTR_BENCH_FRAMES ?? 20);
const ATOMS_PER_FRAME = Number(process.env.VTR_BENCH_ATOMS ?? 100_000);

const buildFrame = (timestep: number, atomCount: number): {
    timestep: number;
    atomCount: number;
    positions: Float32Array;
    types: Uint16Array;
    ids: Uint32Array;
    properties: Record<string, Float32Array>;
} => {
    const positions = new Float32Array(atomCount * 3);
    const types = new Uint16Array(atomCount);
    const ids = new Uint32Array(atomCount);
    for (let index = 0; index < atomCount; index++) {
        positions[index * 3] = Math.sin((index + timestep) * 0.001) * 50;
        positions[index * 3 + 1] = Math.cos((index + timestep) * 0.001) * 50;
        positions[index * 3 + 2] = ((index * 37) % 1000) / 20;
        types[index] = (index % 4) + 1;
        ids[index] = index + 1;
    }
    return {
        timestep,
        atomCount,
        positions,
        types,
        ids,
        properties: {}
    };
};

const main = async (): Promise<void> => {
    const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vtr-bench-'));
    const outputPath = path.join(outputDir, 'test.vtr');

    const lossless = process.env.VTR_LOSSLESS !== 'false';
    const writer = new VtrWriter({
        outputPath,
        lossless,
        keyframeInterval: 3,
        useDelta: true,
        useMortonOrder: true,
        zstdLevel: 9
    });

    const writeStart = performance.now();
    await writer.open();
    for (let frameIndex = 0; frameIndex < FRAME_COUNT; frameIndex++) {
        const frame = buildFrame(frameIndex * 100, ATOMS_PER_FRAME);
        await writer.writeFrame(frame);
    }
    const finalized = await writer.finalize();
    const writeEnd = performance.now();

    console.log(`write: size=${finalized.size} frames=${finalized.frameCount} time=${(writeEnd - writeStart).toFixed(1)}ms`);

    const reader = new VtrReader({
        source: { kind: 'local', filePath: finalized.path }
    });
    await reader.open();
    console.log('frameIndex length:', reader.getFrameIndex().length);

    for (let frameIndex = 0; frameIndex < FRAME_COUNT; frameIndex++) {
        const timestep = frameIndex * 100;
        const readStart = performance.now();
        const frame = await reader.readFrame(timestep);
        const readEnd = performance.now();
        console.log(
            `read timestep=${timestep} kind=${frame.frameKind} atoms=${frame.atomCount} ` +
            `pos0=${frame.positions[0].toFixed(3)} time=${(readEnd - readStart).toFixed(1)}ms`
        );
    }

    await reader.close();
    await fs.rm(outputDir, { recursive: true, force: true });
};

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
