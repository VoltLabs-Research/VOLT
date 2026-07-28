import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import Plugin from '@modules/plugin/models/Plugin';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';
import {
    findPluginsByIds,
    mapPluginToRecord,
    toPluginLike
} from '@modules/plugin/services/plugin/PluginQueries';
import { PluginStatus } from '@volt/contracts/modules/plugin/domain/enums';
import type { WorkflowProps } from '@modules/plugin/models/plugin/workflow/Workflow';

const workflowWithModifierAndExposure = (): WorkflowProps => ({
    nodes: [
        {
            id: 'modifier-1',
            type: 'modifier',
            position: {
                x: 0,
                y: 0
            },
            data: {
                modifier: {
                    key: 'radial',
                    name: 'Radial Distribution',
                    license: 'MIT',
                    version: '1.0.0'
                }
            }
        },
        {
            id: 'exposure-1',
            type: 'exposure',
            position: {
                x: 10,
                y: 0
            },
            data: {
                exposure: {
                    id: 'rdf',
                    name: 'RDF',
                    results: 'rdf.json',
                    hasListing: true,
                    properties: []
                }
            }
        },
        {
            id: 'arguments-1',
            type: 'arguments',
            position: {
                x: 20,
                y: 0
            },
            data: {
                arguments: {
                    arguments: [{
                        argument: 'cutoff',
                        type: 'number',
                        label: 'Cutoff',
                        inferFromContext: true
                    }]
                }
            }
        }
    ],
    edges: []
} as unknown as WorkflowProps);

describe('PluginQueries', () => {
    let dataSource: DataSource;

    before(async () => {
        dataSource = await createHarness([Plugin, Team, User]);
    });

    after(async () => {
        await destroyHarness(dataSource);
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
    });

    const createTeam = async (name = 'Team One'): Promise<Team> => {
        const owner = await User.create({
            email: `owner-${name}@volt.test`,
            firstName: 'ada'
        }).save();

        return Team.create({
            name,
            owner: owner.id
        }).save();
    };

    const createPlugin = async (team: Team, overrides: Partial<Plugin> = {}): Promise<Plugin> => Plugin.create({
        team: team.id,
        workflow: workflowWithModifierAndExposure(),
        ...overrides
    }).save();

    describe('toPluginLike', () => {
        it('rebuilds the workflow class and keeps the identifiers on both keys', async () => {
            const team = await createTeam();
            const entity = await createPlugin(team);

            const plugin = toPluginLike(entity);

            assert.equal(plugin._id, entity.id);
            assert.equal(plugin.id, entity.id);
            assert.equal(plugin.props.workflow.id, entity.id);
            assert.deepEqual(plugin.props.workflow.props, entity.workflow);
            assert.equal(plugin.props.team, team.id);
            assert.equal(plugin.props.status, PluginStatus.DRAFT);
        });

        it('fills the nullable projected columns from the workflow when the row has none', async () => {
            const team = await createTeam();
            const entity = await createPlugin(team);

            const plugin = toPluginLike(entity);

            assert.equal(plugin.props.modifier?.name, 'Radial Distribution');
            assert.equal(plugin.props.listingExposures?.pluginId, entity.id);
            assert.deepEqual(plugin.props.listingExposures?.exposures, [{
                exposureId: 'exposure-1',
                name: 'RDF'
            }]);
            assert.deepEqual(plugin.props.producesExposures, ['rdf']);
            assert.deepEqual(plugin.props.requiresExposures, ['cutoff']);
        });

        it('keeps the empty array defaults of exposures and arguments over the projection', async () => {
            const team = await createTeam();
            const entity = await createPlugin(team);

            const plugin = toPluginLike(entity);

            assert.deepEqual(plugin.props.exposures, []);
            assert.deepEqual(plugin.props.arguments, []);
        });

        it('reports the workflow projection when the row stores it', async () => {
            const team = await createTeam();
            const entity = await createPlugin(team, {
                exposures: [{
                    _id: 'exposure-1',
                    id: 'rdf',
                    name: 'RDF',
                    results: 'rdf.json',
                    hasListing: true,
                    properties: [],
                    export: null
                }]
            });

            const plugin = toPluginLike(entity);

            assert.deepEqual(plugin.props.exposures?.map((exposure) => exposure._id), ['exposure-1']);
        });

        it('keeps the persisted projection when the row already has one', async () => {
            const team = await createTeam();
            const entity = await createPlugin(team, {
                modifier: {
                    key: 'stored',
                    name: 'Stored Name'
                } as Plugin['modifier'],
                exposures: [],
                arguments: []
            });

            const plugin = toPluginLike(entity);

            assert.equal(plugin.props.modifier?.name, 'Stored Name');
            assert.deepEqual(plugin.props.exposures, []);
            assert.deepEqual(plugin.props.arguments, []);
        });

        it('preserves the keys the workflow schema never declared', async () => {
            const team = await createTeam();
            const entity = await createPlugin(team, {
                workflow: {
                    nodes: [{
                        id: 'modifier-1',
                        type: 'modifier',
                        position: {
                            x: 0,
                            y: 0
                        },
                        data: { modifier: { name: 'Kept' } },
                        voltUnknownNodeKey: 'kept'
                    }],
                    edges: [],
                    voltUnknownRootKey: { nested: true }
                } as unknown as WorkflowProps
            });

            const reloaded = await Plugin.findOneByOrFail({ id: entity.id });
            const plugin = toPluginLike(reloaded);
            const [node] = plugin.props.workflow.props.nodes as unknown as Array<Record<string, unknown>>;

            assert.equal(node.voltUnknownNodeKey, 'kept');
            assert.deepEqual(
                (plugin.props.workflow.props as unknown as Record<string, unknown>).voltUnknownRootKey,
                { nested: true }
            );
        });
    });

    describe('mapPluginToRecord', () => {
        it('flattens the workflow class into its props and exposes _id', async () => {
            const team = await createTeam();
            const entity = await createPlugin(team);

            const record = mapPluginToRecord(toPluginLike(entity));

            assert.equal(record._id, entity.id);
            assert.deepEqual(record.workflow, entity.workflow);
            assert.equal(record.team, team.id);
            assert.equal(Object.prototype.hasOwnProperty.call(record, 'id'), false);
        });
    });

    describe('findPluginsByIds', () => {
        it('returns an empty list without querying when no id is given', async () => {
            assert.deepEqual(await findPluginsByIds([]), []);
        });

        it('returns only the requested plugins', async () => {
            const team = await createTeam();
            const first = await createPlugin(team);
            const second = await createPlugin(team);
            await createPlugin(team);

            const plugins = await findPluginsByIds([first.id, second.id]);

            assert.deepEqual(plugins.map((plugin) => plugin.id).sort(), [first.id, second.id].sort());
        });

        it('skips the ids that do not exist', async () => {
            const team = await createTeam();
            const plugin = await createPlugin(team);

            const plugins = await findPluginsByIds([plugin.id, 'missing-plugin-id']);

            assert.deepEqual(plugins.map((entry) => entry.id), [plugin.id]);
        });
    });
});
