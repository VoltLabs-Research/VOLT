import { createFilterEvaluatorService, EmptyFilterResultError } from './FilterEvaluatorService';
import type { TrajectoryParserService } from './TrajectoryParserService';
import type { NativeModuleLoader, NativeExporterModule, ParsedTrajectory, NativeParticleFilterModelRequest } from './NativeModuleLoader';
import type { MinioService } from '@/modules/platform/services';
import assert from 'node:assert/strict';
import test from 'node:test';

/** Minimal parsed trajectory with 3 atoms for use in tests. */
const FAKE_PARSED: ParsedTrajectory = {
    metadata: {
        timestep: 0,
        natoms: 3,
        headers: [],
        simulationCell: {
            boundingBox: { width: 10, height: 10, length: 10 },
            geometry: {
                cell_vectors: [],
                cell_origin: [],
                periodic_boundary_conditions: { x: false, y: false, z: false }
            }
        }
    },
    positions: new Float32Array([0, 0, 0, 1, 1, 1, 2, 2, 2]),
    types: new Uint16Array([1, 1, 2]),
    min: [0, 0, 0],
    max: [2, 2, 2]
};

/** Encodes a Uint8Array as base64, matching what the real service produces. */
const encodeBase64 = (bytes: Uint8Array): string =>
    Buffer.from(bytes).toString('base64');

interface TestServiceParts {
    putObjectCallCount: number;
    generateGLBCallCount: number;
};

interface BuildResult {
    service: ReturnType<typeof createFilterEvaluatorService>;
    parts: TestServiceParts;
};

const buildService = (): BuildResult => {
    const parts: TestServiceParts = {
        putObjectCallCount: 0,
        generateGLBCallCount: 0
    };

    const minioService = {
        async putObject() {
            parts.putObjectCallCount++;
        }
    } as unknown as MinioService;

    const fakeExporter = {
        generateGLB(): Buffer {
            parts.generateGLBCallCount++;
            return Buffer.from('fake-glb');
        },
        generatePointCloudGLB(): Buffer {
            return Buffer.from('fake-point-cloud-glb');
        }
    } as unknown as NativeExporterModule;

    const nativeModuleLoader = {
        getExporterModule: () => fakeExporter
    } as unknown as NativeModuleLoader;

    const trajectoryParserService: TrajectoryParserService = {
        async withDumpFile<T>(_input: unknown, action: (dumpPath: string) => Promise<T>): Promise<T> {
            return action('/fake/dump.lammpstrj');
        },
        parseTrajectory(): ParsedTrajectory {
            return FAKE_PARSED;
        },
        decodeUint8Array(value: string): Uint8Array {
            return new Uint8Array(Buffer.from(value, 'base64'));
        }
    } as unknown as TrajectoryParserService;

    return {
        service: createFilterEvaluatorService(minioService, nativeModuleLoader, trajectoryParserService),
        parts
    };
};

const baseRequest: Omit<NativeParticleFilterModelRequest, 'maskBase64' | 'action'> = {
    trajectoryId: 'traj-1',
    timestep: 0,
    objectKey: 'models/traj-1/filtered.glb'
};

/** mask where all 3 atoms are selected (delete removes all → empty result). */
const allSelectedMask = encodeBase64(new Uint8Array([1, 1, 1]));

/** mask where only atom 0 is selected (delete removes 1 → 2 atoms remain). */
const partialMask = encodeBase64(new Uint8Array([1, 0, 0]));

/** mask where no atoms are selected (delete removes none → all 3 remain). */
const emptyMask = encodeBase64(new Uint8Array([0, 0, 0]));

test('exportParticleFilterModel delete: throws EmptyFilterResultError when all atoms are deleted', async () => {
    const { service } = buildService();

    await assert.rejects(
        () => service.exportParticleFilterModel({
            ...baseRequest,
            action: 'delete',
            maskBase64: allSelectedMask
        }),
        (error: unknown) => {
            assert.ok(error instanceof EmptyFilterResultError, 'expected EmptyFilterResultError');
            assert.equal(error.code, 'EMPTY_FILTER_RESULT');
            assert.match(error.message, /3 atom/);
            return true;
        }
    );
});

test('exportParticleFilterModel delete: does not call generateGLB when all atoms are deleted', async () => {
    const { service, parts } = buildService();

    await assert.rejects(
        () => service.exportParticleFilterModel({
            ...baseRequest,
            action: 'delete',
            maskBase64: allSelectedMask
        }),
        EmptyFilterResultError
    );

    assert.equal(parts.generateGLBCallCount, 0, 'generateGLB must not be called for empty result');
    assert.equal(parts.putObjectCallCount, 0, 'putObject must not be called for empty result');
});

test('exportParticleFilterModel delete: succeeds and stores GLB when at least one atom remains', async () => {
    const { service, parts } = buildService();

    const result = await service.exportParticleFilterModel({
        ...baseRequest,
        action: 'delete',
        maskBase64: partialMask
    });

    assert.equal(result.objectKey, baseRequest.objectKey);
    assert.equal(result.atomsResult, 2, 'two atoms should remain after deleting atom 0');
    assert.equal(parts.generateGLBCallCount, 1, 'generateGLB should be called once');
    assert.equal(parts.putObjectCallCount, 1, 'putObject should be called once');
});

test('exportParticleFilterModel delete: all atoms retained when mask selects none', async () => {
    const { service, parts } = buildService();

    const result = await service.exportParticleFilterModel({
        ...baseRequest,
        action: 'delete',
        maskBase64: emptyMask
    });

    assert.equal(result.atomsResult, 3, 'all three atoms should remain');
    assert.equal(parts.generateGLBCallCount, 1);
    assert.equal(parts.putObjectCallCount, 1);
});

test('exportParticleFilterModel highlight: never throws EmptyFilterResultError regardless of mask', async () => {
    const { service, parts } = buildService();

    const result = await service.exportParticleFilterModel({
        ...baseRequest,
        action: 'highlight',
        maskBase64: allSelectedMask
    });

    assert.equal(result.atomsResult, 3, 'highlight counts highlighted atoms (all selected)');
    assert.equal(parts.putObjectCallCount, 1, 'putObject should be called once');
});

test('EmptyFilterResultError exposes the correct code and name properties', () => {
    const error = new EmptyFilterResultError(42);

    assert.equal(error.code, 'EMPTY_FILTER_RESULT');
    assert.equal(error.name, 'EmptyFilterResultError');
    assert.ok(error instanceof Error);
    assert.match(error.message, /42 atom/);
});
