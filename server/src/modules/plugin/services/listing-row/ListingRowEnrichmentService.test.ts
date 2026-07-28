import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import {
    buildListingColumns,
    buildListingExportColumns,
    enrichDaemonListingRows
} from '@modules/plugin/services/listing-row/ListingRowEnrichmentService';
import Analysis from '@modules/analysis/models/Analysis';
import Plugin from '@modules/plugin/models/Plugin';
import Trajectory from '@modules/trajectory/models/Trajectory';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';
import type { DaemonListingRow } from '@modules/plugin/services/listing-row/DaemonListingMapper';

interface TeamFixture{
    team: Team;
    owner: User;
    cluster: TeamCluster;
    plugin: Plugin;
}

describe('ListingRowEnrichmentService', () => {
    let dataSource: DataSource;

    before(async () => {
        dataSource = await createHarness([
            Analysis,
            Plugin,
            Trajectory,
            TeamCluster,
            CatalogFolder,
            Team,
            User
        ]);
    });

    after(async () => {
        await destroyHarness(dataSource);
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
    });

    const createTeamFixture = async (name: string): Promise<TeamFixture> => {
        const owner = await User.create({
            email: `owner-${name}@volt.test`,
            firstName: 'ada'
        }).save();
        const team = await Team.create({
            name: `team-${name}`,
            owner: owner.id
        }).save();
        const cluster = await TeamCluster.create({
            name: `cluster-${name}`,
            team: team.id,
            createdBy: owner.id,
            services: {},
            queueConcurrency: {},
            queueScopeLimits: {},
            roleConfig: {}
        }).save();
        const plugin = await Plugin.create({
            team: team.id,
            workflow: { nodes: [] }
        }).save();

        return {
            team,
            owner,
            cluster,
            plugin
        };
    };

    const createTrajectory = (fixture: TeamFixture, name: string): Promise<Trajectory> => Trajectory.create({
        name,
        team: fixture.team.id,
        storageClusterId: fixture.cluster.id,
        createdBy: fixture.owner.id
    }).save();

    const createAnalysis = (fixture: TeamFixture, trajectory: Trajectory): Promise<Analysis> => Analysis.create({
        plugin: fixture.plugin.id,
        pluginDisplayName: 'Radial Distribution',
        team: fixture.team.id,
        trajectory: trajectory.id,
        createdBy: fixture.owner.id,
        config: {}
    }).save();

    describe('enrichDaemonListingRows', () => {
        it('returns the rows untouched when there is nothing to enrich', async () => {
            const rows: DaemonListingRow[] = [];

            assert.equal(await enrichDaemonListingRows({ rows }), rows);
        });

        it('resolves the trajectory name through the analysis of the row', async () => {
            const fixture = await createTeamFixture('one');
            const trajectory = await createTrajectory(fixture, 'run-one');
            const analysis = await createAnalysis(fixture, trajectory);

            const [row] = await enrichDaemonListingRows({
                rows: [{
                    _id: 'row-1',
                    analysis: analysis.id
                }]
            });

            assert.equal(row.analysis, analysis.id);
            assert.equal(row.trajectory, trajectory.id);
            assert.equal(row.trajectoryName, 'run-one');
            assert.equal(row.timestep, 0);
        });

        it('uses the fallback analysis id when the row has none', async () => {
            const fixture = await createTeamFixture('one');
            const trajectory = await createTrajectory(fixture, 'run-two');
            const analysis = await createAnalysis(fixture, trajectory);

            const [row] = await enrichDaemonListingRows({
                rows: [{ _id: 'row-1' }],
                fallbackAnalysisId: analysis.id
            });

            assert.equal(row.analysis, analysis.id);
            assert.equal(row.trajectoryName, 'run-two');
        });

        it('prefers the trajectory carried by the row over the one of the analysis', async () => {
            const fixture = await createTeamFixture('one');
            const analysisTrajectory = await createTrajectory(fixture, 'analysis-run');
            const rowTrajectory = await createTrajectory(fixture, 'row-run');
            const analysis = await createAnalysis(fixture, analysisTrajectory);

            const [row] = await enrichDaemonListingRows({
                rows: [{
                    _id: 'row-1',
                    analysis: analysis.id,
                    trajectory: rowTrajectory.id
                }]
            });

            assert.equal(row.trajectory, rowTrajectory.id);
            assert.equal(row.trajectoryName, 'row-run');
        });

        it('leaves the name empty when the analysis does not exist', async () => {
            const [row] = await enrichDaemonListingRows({
                rows: [{
                    _id: 'row-1',
                    analysis: 'missing-analysis'
                }]
            });

            assert.equal(row.analysis, 'missing-analysis');
            assert.equal(row.trajectory, '');
            assert.equal(row.trajectoryName, '');
        });

        it('resolves several analyses and trajectories in one pass', async () => {
            const fixture = await createTeamFixture('one');
            const firstTrajectory = await createTrajectory(fixture, 'run-a');
            const secondTrajectory = await createTrajectory(fixture, 'run-b');
            const firstAnalysis = await createAnalysis(fixture, firstTrajectory);
            const secondAnalysis = await createAnalysis(fixture, secondTrajectory);

            const rows = await enrichDaemonListingRows({
                rows: [
                    {
                        _id: 'row-1',
                        analysis: firstAnalysis.id
                    },
                    {
                        _id: 'row-2',
                        analysis: secondAnalysis.id
                    },
                    {
                        _id: 'row-3',
                        analysis: firstAnalysis.id,
                        timestep: 4
                    }
                ]
            });

            assert.deepEqual(rows.map((row) => row.trajectoryName), ['run-a', 'run-b', 'run-a']);
            assert.deepEqual(rows.map((row) => row.timestep), [0, 0, 4]);
        });
    });

    describe('buildListingColumns', () => {
        it('puts the trajectory and timestep columns first and drops their duplicates', () => {
            const columns = buildListingColumns([], ['trajectoryName', 'timestep', 'energy']);

            assert.deepEqual(columns.map((column) => column.key), ['trajectoryName', 'timestep', 'energy']);
        });

        it('derives the dynamic columns from the rows when the daemon sends none', () => {
            const columns = buildListingColumns([{
                _id: 'row-1',
                row: {
                    energy: 1,
                    pressure: 2
                }
            }]);

            assert.deepEqual(columns.map((column) => column.key), ['trajectoryName', 'timestep', 'energy', 'pressure']);
        });
    });

    describe('buildListingExportColumns', () => {
        it('prefixes the export identity columns and deduplicates', () => {
            const columns = buildListingExportColumns([{
                _id: 'row-1',
                row: { energy: 1 }
            }]);

            assert.deepEqual(columns, [
                '_id',
                'analysisId',
                'trajectoryId',
                'trajectoryName',
                'timestep',
                'exposureId',
                'energy'
            ]);
        });
    });
});
