import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import AnalysisProvenance from '@modules/analysis/models/AnalysisProvenance';
import { ProvenanceNotFoundError, ProvenanceService } from '@modules/analysis/services/ProvenanceService';
import type { RecordProvenanceInput } from '@modules/analysis/services/ProvenanceService';

const FIRST_TRAJECTORY = 'a1b2c3d4e5f6a1b2c3d4e5f6';
const SECOND_TRAJECTORY = 'f6e5d4c3b2a1f6e5d4c3b2a1';
const EXECUTOR = '0f0e0d0c0b0a0f0e0d0c0b0a';

const JANUARY = new Date('2024-01-15T10:00:00.000Z');
const FEBRUARY = new Date('2024-02-15T10:00:00.000Z');
const MARCH = new Date('2024-03-15T10:00:00.000Z');

describe('ProvenanceService', () => {
    let dataSource: DataSource;
    const service = new ProvenanceService();

    before(async () => {
        dataSource = await createHarness([AnalysisProvenance]);
    });

    after(async () => {
        await destroyHarness(dataSource);
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
    });

    const recordInput = (overrides: Partial<RecordProvenanceInput> = {}): RecordProvenanceInput => ({
        pluginName: 'radial-distribution',
        pluginVersion: '1.0.0',
        parameters: {
            cutoff: 6.5,
            bins: 100
        },
        inputFrameContentHash: 'content-hash',
        atomCount: 4096,
        frameIndex: 7,
        trajectoryId: FIRST_TRAJECTORY,
        coreToolkitVersion: '2.1.0',
        executedAt: FEBRUARY,
        executedBy: EXECUTOR,
        executionTimeMs: 1234,
        outputArtifactIds: ['artifact-1', 'artifact-2'],
        ...overrides
    });

    describe('recordAnalysisExecution', () => {
        it('persists the execution and returns the stored row', async () => {
            const provenance = await service.recordAnalysisExecution(recordInput());

            const stored = await AnalysisProvenance.findOneByOrFail({ id: provenance.id });

            assert.equal(stored.pluginName, 'radial-distribution');
            assert.equal(stored.pluginVersion, '1.0.0');
            assert.equal(stored.inputFrameContentHash, 'content-hash');
            assert.equal(stored.coreToolkitVersion, '2.1.0');
            assert.equal(stored.executedBy, EXECUTOR);
            assert.equal(stored.executionTimeMs, 1234);
        });

        it('promotes the trajectory id to its own column', async () => {
            const provenance = await service.recordAnalysisExecution(recordInput());

            const stored = await AnalysisProvenance.findOneByOrFail({ id: provenance.id });

            assert.equal(stored.trajectoryId, FIRST_TRAJECTORY);
            assert.equal(stored.inputFrameMetadata.trajectoryId, FIRST_TRAJECTORY);
        });

        it('keeps the frame metadata as a json subdocument', async () => {
            const provenance = await service.recordAnalysisExecution(recordInput());

            const stored = await AnalysisProvenance.findOneByOrFail({ id: provenance.id });

            assert.deepEqual(stored.inputFrameMetadata, {
                atomCount: 4096,
                frameIndex: 7,
                trajectoryId: FIRST_TRAJECTORY
            });
        });

        it('round-trips the parameters json untouched', async () => {
            const provenance = await service.recordAnalysisExecution(recordInput({
                parameters: {
                    cutoff: 6.5,
                    nested: { labels: ['a', 'b'] }
                }
            }));

            const stored = await AnalysisProvenance.findOneByOrFail({ id: provenance.id });

            assert.deepEqual(stored.parameters, {
                cutoff: 6.5,
                nested: { labels: ['a', 'b'] }
            });
        });

        it('stores the artifact ids as a simple array', async () => {
            const provenance = await service.recordAnalysisExecution(recordInput());

            const stored = await AnalysisProvenance.findOneByOrFail({ id: provenance.id });

            assert.deepEqual(stored.outputArtifactIds, ['artifact-1', 'artifact-2']);
        });

        it('records a null seed when none is given', async () => {
            const provenance = await service.recordAnalysisExecution(recordInput());

            const stored = await AnalysisProvenance.findOneByOrFail({ id: provenance.id });

            assert.equal(stored.rngSeed, null);
        });

        it('keeps a zero seed instead of nulling it', async () => {
            const provenance = await service.recordAnalysisExecution(recordInput({ rngSeed: 0 }));

            const stored = await AnalysisProvenance.findOneByOrFail({ id: provenance.id });

            assert.equal(stored.rngSeed, 0);
        });

        it('builds the reproduction command from the plugin name and version', async () => {
            const provenance = await service.recordAnalysisExecution(recordInput());

            assert.equal(
                provenance.reproductionCommand,
                'voltcli analyze --plugin radial-distribution@1.0.0 --provenance-replay'
            );
        });
    });

    describe('getProvenance', () => {
        it('returns null for an unknown id', async () => {
            assert.equal(await service.getProvenance('not-a-provenance-id'), null);
        });

        it('returns the stored row for a known id', async () => {
            const provenance = await service.recordAnalysisExecution(recordInput());

            const found = await service.getProvenance(provenance.id);

            assert.equal(found?.id, provenance.id);
        });
    });

    describe('getRequired', () => {
        it('throws a not found error for an unknown id', async () => {
            await assert.rejects(
                () => service.getRequired('not-a-provenance-id'),
                (error: unknown) => {
                    assert.ok(error instanceof ProvenanceNotFoundError);
                    assert.equal(error.name, 'ProvenanceNotFoundError');
                    assert.equal(error.message, 'Provenance record not found');
                    return true;
                }
            );
        });
    });

    describe('getReproduction', () => {
        it('returns the stored command next to the provenance id', async () => {
            const provenance = await service.recordAnalysisExecution(recordInput());

            assert.deepEqual(await service.getReproduction(provenance.id), {
                command: 'voltcli analyze --plugin radial-distribution@1.0.0 --provenance-replay',
                provenanceId: provenance.id
            });
        });

        it('throws a not found error for an unknown id', async () => {
            await assert.rejects(
                () => service.getReproduction('not-a-provenance-id'),
                ProvenanceNotFoundError
            );
        });
    });

    describe('queryProvenance', () => {
        const seedThreeMonths = async (): Promise<void> => {
            await service.recordAnalysisExecution(recordInput({ executedAt: JANUARY }));
            await service.recordAnalysisExecution(recordInput({ executedAt: FEBRUARY }));
            await service.recordAnalysisExecution(recordInput({ executedAt: MARCH }));
        };

        it('returns every row when no filter is given', async () => {
            await seedThreeMonths();

            assert.equal((await service.queryProvenance({})).length, 3);
        });

        it('filters by the promoted trajectory column', async () => {
            await service.recordAnalysisExecution(recordInput({ trajectoryId: FIRST_TRAJECTORY }));
            await service.recordAnalysisExecution(recordInput({ trajectoryId: FIRST_TRAJECTORY }));
            await service.recordAnalysisExecution(recordInput({ trajectoryId: SECOND_TRAJECTORY }));

            const rows = await service.queryProvenance({ trajectoryId: FIRST_TRAJECTORY });

            assert.equal(rows.length, 2);
            assert.ok(rows.every((row) => row.trajectoryId === FIRST_TRAJECTORY));
        });

        it('filters by the plugin name and version', async () => {
            await service.recordAnalysisExecution(recordInput({ pluginVersion: '1.0.0' }));
            await service.recordAnalysisExecution(recordInput({ pluginVersion: '2.0.0' }));
            await service.recordAnalysisExecution(recordInput({ pluginName: 'coordination-number' }));

            const rows = await service.queryProvenance({
                pluginName: 'radial-distribution',
                pluginVersion: '2.0.0'
            });

            assert.equal(rows.length, 1);
            assert.equal(rows[0].pluginVersion, '2.0.0');
        });

        it('filters by the executing user', async () => {
            await service.recordAnalysisExecution(recordInput());
            await service.recordAnalysisExecution(recordInput({ executedBy: '0a0b0c0d0e0f0a0b0c0d0e0f' }));

            const rows = await service.queryProvenance({ executedBy: EXECUTOR });

            assert.equal(rows.length, 1);
            assert.equal(rows[0].executedBy, EXECUTOR);
        });

        it('keeps only the executions inside the closed date range', async () => {
            await seedThreeMonths();

            const rows = await service.queryProvenance({
                fromDate: new Date('2024-02-01T00:00:00.000Z'),
                toDate: new Date('2024-02-28T00:00:00.000Z')
            });

            assert.deepEqual(rows.map((row) => row.executedAt.toISOString()), [FEBRUARY.toISOString()]);
        });

        it('keeps only the executions at or after the from date', async () => {
            await seedThreeMonths();

            const rows = await service.queryProvenance({ fromDate: FEBRUARY });

            assert.deepEqual(
                rows.map((row) => row.executedAt.toISOString()),
                [MARCH.toISOString(), FEBRUARY.toISOString()]
            );
        });

        it('keeps only the executions at or before the to date', async () => {
            await seedThreeMonths();

            const rows = await service.queryProvenance({ toDate: FEBRUARY });

            assert.deepEqual(
                rows.map((row) => row.executedAt.toISOString()),
                [FEBRUARY.toISOString(), JANUARY.toISOString()]
            );
        });

        it('combines the trajectory filter with the date range', async () => {
            await service.recordAnalysisExecution(recordInput({
                executedAt: FEBRUARY,
                trajectoryId: FIRST_TRAJECTORY
            }));
            await service.recordAnalysisExecution(recordInput({
                executedAt: FEBRUARY,
                trajectoryId: SECOND_TRAJECTORY
            }));
            await service.recordAnalysisExecution(recordInput({
                executedAt: MARCH,
                trajectoryId: FIRST_TRAJECTORY
            }));

            const rows = await service.queryProvenance({
                trajectoryId: FIRST_TRAJECTORY,
                fromDate: new Date('2024-02-01T00:00:00.000Z'),
                toDate: new Date('2024-02-28T00:00:00.000Z')
            });

            assert.equal(rows.length, 1);
            assert.equal(rows[0].trajectoryId, FIRST_TRAJECTORY);
            assert.equal(rows[0].executedAt.toISOString(), FEBRUARY.toISOString());
        });

        it('returns the newest execution first', async () => {
            await seedThreeMonths();

            const rows = await service.queryProvenance({});

            assert.deepEqual(
                rows.map((row) => row.executedAt.toISOString()),
                [MARCH.toISOString(), FEBRUARY.toISOString(), JANUARY.toISOString()]
            );
        });

        it('honours the limit and the skip', async () => {
            await seedThreeMonths();

            const rows = await service.queryProvenance({
                limit: 1,
                skip: 1
            });

            assert.deepEqual(rows.map((row) => row.executedAt.toISOString()), [FEBRUARY.toISOString()]);
        });

        it('returns an empty list when nothing matches', async () => {
            await seedThreeMonths();

            assert.deepEqual(await service.queryProvenance({ trajectoryId: SECOND_TRAJECTORY }), []);
        });
    });

    describe('computeHash', () => {
        it('hashes a string and its buffer to the same digest', () => {
            assert.equal(
                ProvenanceService.computeHash('volt'),
                ProvenanceService.computeHash(Buffer.from('volt'))
            );
        });

        it('produces a different digest for a different payload', () => {
            assert.notEqual(ProvenanceService.computeHash('volt'), ProvenanceService.computeHash('volt '));
        });
    });
});
