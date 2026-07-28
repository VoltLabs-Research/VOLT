import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import { AnalysisListingExportCatalogService } from '@modules/plugin/services/listing-row/AnalysisListingExportCatalogService';
import Analysis from '@modules/analysis/models/Analysis';
import Plugin from '@modules/plugin/models/Plugin';
import Trajectory from '@modules/trajectory/models/Trajectory';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import { Exporter } from '@modules/plugin/models/plugin/workflow/WorkflowTypes';
import { ExportType } from '@shared/domain/port/persistence';
import type { ITeamClusterDaemonClient } from '@shared/domain/port/ITeamClusterDaemonClient';
import type { DaemonListingRow } from '@modules/plugin/services/listing-row/DaemonListingMapper';

interface TeamFixture{
    team: Team;
    owner: User;
    cluster: TeamCluster;
    trajectory: Trajectory;
}

interface DaemonCall{
    teamClusterId: string;
    command: string;
    payload?: Record<string, unknown>;
}

describe('AnalysisListingExportCatalogService', () => {
    let dataSource: DataSource;
    const daemonCalls: DaemonCall[] = [];
    let listingRows: DaemonListingRow[] = [];

    const daemonClient = {
        command: (async (teamClusterId: string, command: string, payload?: Record<string, unknown>) => {
            daemonCalls.push({
                teamClusterId,
                command,
                payload
            });

            if(command === ChannelCommands.PluginListingsList){
                return {
                    data: listingRows,
                    total: listingRows.length,
                    page: 1,
                    totalPages: 1,
                    limit: 200
                };
            }

            return {
                data: [],
                total: 0,
                page: 1,
                totalPages: 1,
                limit: 200
            };
        })
    } as unknown as ITeamClusterDaemonClient;

    const service = new AnalysisListingExportCatalogService(daemonClient);

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
        daemonCalls.length = 0;
        listingRows = [];
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
        const trajectory = await Trajectory.create({
            name: `run-${name}`,
            team: team.id,
            storageClusterId: cluster.id,
            createdBy: owner.id
        }).save();

        return {
            team,
            owner,
            cluster,
            trajectory
        };
    };

    const seedPlugin = (fixture: TeamFixture, exposures: Plugin['exposures'] = []): Promise<Plugin> => Plugin.create({
        team: fixture.team.id,
        workflow: { nodes: [] },
        exposures
    }).save();

    const seedAnalysis = (
        fixture: TeamFixture,
        pluginId: string,
        overrides: Partial<Analysis> = {}
    ): Promise<Analysis> => Analysis.create({
        plugin: pluginId,
        pluginDisplayName: 'Radial Distribution',
        team: fixture.team.id,
        trajectory: fixture.trajectory.id,
        createdBy: fixture.owner.id,
        config: {},
        ...overrides
    }).save();

    describe('getExportOptions', () => {
        it('returns nothing and skips the daemon when the analysis does not exist', async () => {
            const options = await service.getExportOptions('missing');

            assert.deepEqual(options, {
                analysisId: 'missing',
                hasConfig: false,
                listings: [],
                subListings: []
            });
            assert.deepEqual(daemonCalls, []);
        });

        it('reports hasConfig from the stored analysis config without a compute cluster', async () => {
            const fixture = await createTeamFixture('one');
            const plugin = await seedPlugin(fixture);
            const analysis = await seedAnalysis(fixture, plugin.id, { config: { cutoff: 5 } });

            const options = await service.getExportOptions(analysis.id);

            assert.equal(options.hasConfig, true);
            assert.deepEqual(options.listings, []);
            assert.deepEqual(daemonCalls, []);
        });

        it('builds the listing and sub listing options from the daemon rows', async () => {
            const fixture = await createTeamFixture('one');
            const plugin = await seedPlugin(fixture);
            const analysis = await seedAnalysis(fixture, plugin.id, { computeClusterId: fixture.cluster.id });
            listingRows = [{
                _id: 'row-1',
                analysis: analysis.id,
                exposureId: 'exposure-1',
                exposureName: 'RDF',
                timestep: 0,
                subListingNames: ['neighbours'],
                row: { energy: 1 }
            }];

            const options = await service.getExportOptions(analysis.id);

            assert.deepEqual(options.listings.map((listing) => listing.listingId), ['exposure-1']);
            assert.deepEqual(options.subListings.map((subListing) => subListing.subListingName), ['neighbours']);
            assert.equal(daemonCalls[0].teamClusterId, fixture.cluster.id);
        });

        it('drops the exposures the plugin exports as a mesh', async () => {
            const fixture = await createTeamFixture('one');
            const plugin = await seedPlugin(fixture, [{
                _id: 'exposure-1',
                name: 'RDF',
                results: 'rdf.json',
                hasListing: true,
                properties: [],
                export: {
                    exporter: Exporter.Mesh,
                    type: 'glb'
                }
            }] as Plugin['exposures']);
            const analysis = await seedAnalysis(fixture, plugin.id, { computeClusterId: fixture.cluster.id });
            listingRows = [
                {
                    _id: 'row-1',
                    analysis: analysis.id,
                    exposureId: 'exposure-1',
                    exposureName: 'RDF',
                    timestep: 0
                },
                {
                    _id: 'row-2',
                    analysis: analysis.id,
                    exposureId: 'exposure-2',
                    exposureName: 'Coordination',
                    timestep: 0
                }
            ];

            const options = await service.getExportOptions(analysis.id);

            assert.deepEqual(options.listings.map((listing) => listing.listingId), ['exposure-2']);
        });
    });

    describe('buildExportPayload', () => {
        it('returns an empty payload when the analysis has no compute cluster', async () => {
            const fixture = await createTeamFixture('one');
            const plugin = await seedPlugin(fixture);
            const analysis = await seedAnalysis(fixture, plugin.id, { config: { cutoff: 5 } });

            const payload = await service.buildExportPayload({
                analysisId: analysis.id,
                teamId: fixture.team.id
            });

            assert.equal(payload.format, ExportType.Csv);
            assert.deepEqual(payload.config, { cutoff: 5 });
            assert.deepEqual(payload.listings, []);
            assert.deepEqual(payload.subListings, []);
        });

        it('omits the config when the caller opts out', async () => {
            const fixture = await createTeamFixture('one');
            const plugin = await seedPlugin(fixture);
            const analysis = await seedAnalysis(fixture, plugin.id, { config: { cutoff: 5 } });

            const payload = await service.buildExportPayload({
                analysisId: analysis.id,
                teamId: fixture.team.id,
                includeConfig: false
            });

            assert.equal(payload.config, undefined);
        });

        it('aggregates the selected listing rows', async () => {
            const fixture = await createTeamFixture('one');
            const plugin = await seedPlugin(fixture);
            const analysis = await seedAnalysis(fixture, plugin.id, { computeClusterId: fixture.cluster.id });
            listingRows = [{
                _id: 'row-1',
                analysis: analysis.id,
                exposureId: 'exposure-1',
                exposureName: 'RDF',
                timestep: 2,
                row: { energy: 1 }
            }];

            const payload = await service.buildExportPayload({
                analysisId: analysis.id,
                teamId: fixture.team.id,
                selectedListingIds: ['exposure-1::RDF']
            });

            assert.deepEqual(payload.listings.map((listing) => listing.listingId), ['exposure-1']);
            assert.equal(payload.listings[0].rows.length, 1);
            assert.equal(payload.listings[0].rows[0].trajectoryName, fixture.trajectory.name);
            assert.ok(payload.listings[0].columns.includes('energy'));
        });

        it('drops the listings the caller did not select', async () => {
            const fixture = await createTeamFixture('one');
            const plugin = await seedPlugin(fixture);
            const analysis = await seedAnalysis(fixture, plugin.id, { computeClusterId: fixture.cluster.id });
            listingRows = [{
                _id: 'row-1',
                analysis: analysis.id,
                exposureId: 'exposure-1',
                exposureName: 'RDF',
                timestep: 0
            }];

            const payload = await service.buildExportPayload({
                analysisId: analysis.id,
                teamId: fixture.team.id,
                selectedListingIds: ['another::Another']
            });

            assert.deepEqual(payload.listings, []);
        });
    });
});
