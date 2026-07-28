import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { ErrorCodes } from '@core/constants/error-codes';
import PluginStorageService from '@modules/plugin/services/plugin/PluginStorageService';
import { WorkflowValidatorService } from '@modules/plugin/services/plugin/WorkflowValidatorService';
import { PluginDependencyResolverService } from '@modules/plugin/services/plugin/PluginDependencyResolverService';
import Plugin from '@modules/plugin/models/Plugin';
import StoragePlacement from '@modules/cluster/models/StoragePlacement';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';
import { PluginStatus } from '@volt/contracts/modules/plugin/domain/enums';
import type {
    IClusterObjectArchiveService,
    IClusterObjectSignedUrlService,
    IStoragePlacementService,
    ITeamClusterObjectGatewayClient
} from '@shared/contracts/ports';
import type { WorkflowProps } from '@modules/plugin/models/plugin/workflow/Workflow';

const OWNER_CLUSTER_ID = 'owner-cluster';

const modifierNode = (name: string, key: string) => ({
    id: 'modifier-1',
    type: 'modifier',
    position: {
        x: 0,
        y: 0
    },
    data: {
        modifier: {
            key,
            name
        }
    }
});

const entrypointNode = (entrypoint: Record<string, unknown>) => ({
    id: 'entrypoint-1',
    type: 'entrypoint',
    position: {
        x: 10,
        y: 0
    },
    data: { entrypoint }
});

const buildWorkflow = (name: string, key: string, entrypoint: Record<string, unknown>): WorkflowProps => ({
    nodes: [
        modifierNode(name, key),
        entrypointNode(entrypoint)
    ],
    edges: []
} as unknown as WorkflowProps);

describe('PluginStorageService', () => {
    let dataSource: DataSource;
    const deletedObjects: string[] = [];
    const assignedPlacements: Array<{ pluginId: string; teamId: string; clusterId: string }> = [];

    const storagePlacementService = {
        ensurePlacement: async () => ({ props: { primaryClusterId: OWNER_CLUSTER_ID } }),
        assignPluginBinaryPlacement: async (pluginId: string, teamId: string, clusterId: string) => {
            assignedPlacements.push({
                pluginId,
                teamId,
                clusterId
            });
            return { props: { primaryClusterId: clusterId } };
        }
    } as unknown as IStoragePlacementService;

    const objectGatewayClient = {
        deleteObject: async (_clusterId: string, _bucket: string, objectKey: string) => {
            deletedObjects.push(objectKey);
        }
    } as unknown as ITeamClusterObjectGatewayClient;

    const signedUrlService = {
        createToken: () => ({
            url: 'https://volt.test/upload',
            expiresAt: new Date('2030-01-01T00:00:00.000Z')
        })
    } as unknown as IClusterObjectSignedUrlService;

    const archiveService = {} as unknown as IClusterObjectArchiveService;

    const service = new PluginStorageService(
        storagePlacementService,
        objectGatewayClient,
        new WorkflowValidatorService(new PluginDependencyResolverService()),
        signedUrlService,
        archiveService
    );

    before(async () => {
        dataSource = await createHarness([Plugin, StoragePlacement, TeamCluster, Team, User]);
    });

    after(async () => {
        await destroyHarness(dataSource);
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
        deletedObjects.length = 0;
        assignedPlacements.length = 0;
    });

    const createTeam = async (name: string): Promise<Team> => {
        const owner = await User.create({
            email: `owner-${name}@volt.test`,
            firstName: 'ada'
        }).save();

        return Team.create({
            name: `team-${name}`,
            owner: owner.id
        }).save();
    };

    const seedPlugin = (team: Team, overrides: Partial<Plugin> = {}): Promise<Plugin> => Plugin.create({
        team: team.id,
        workflow: buildWorkflow('Radial Distribution', 'radial', {}),
        ...overrides
    }).save();

    const expectApplicationError = async (run: () => Promise<unknown>, code: string): Promise<void> => {
        try {
            await run();
        } catch (error: unknown) {
            assert.ok(error instanceof ApplicationError);
            assert.equal(error.code, code);
            return;
        }

        throw new Error(`expected ${code} to be thrown`);
    };

    describe('deleteBinary', () => {
        it('clears the entrypoint binary fields and rewrites the projection', async () => {
            const team = await createTeam('one');
            const plugin = await seedPlugin(team, {
                workflow: buildWorkflow('Radial Distribution', 'radial', {
                    binary: 'run.bin',
                    binaryObjectPath: 'plugin-binaries/x/run.bin',
                    binaryFileName: 'run.bin',
                    binaryHash: 'hash'
                })
            });

            await service.deleteBinary(plugin.id);

            const stored = await Plugin.findOneByOrFail({ id: plugin.id });
            const entrypoint = stored.workflow.nodes
                .find((node) => node.type === 'entrypoint')?.data.entrypoint;
            assert.equal(entrypoint?.binaryObjectPath, undefined);
            assert.equal(entrypoint?.binaryFileName, undefined);
            assert.equal(entrypoint?.binaryHash, 'hash');
            assert.equal(stored.modifier?.name, 'Radial Distribution');
            assert.deepEqual(deletedObjects, ['plugin-binaries/x/run.bin']);
        });

        it('demotes a published plugin to draft', async () => {
            const team = await createTeam('one');
            const plugin = await seedPlugin(team, {
                status: PluginStatus.PUBLISHED,
                workflow: buildWorkflow('Radial Distribution', 'radial', { binaryObjectPath: 'plugin-binaries/x/run.bin' })
            });

            await service.deleteBinary(plugin.id);

            assert.equal((await Plugin.findOneByOrFail({ id: plugin.id })).status, PluginStatus.DRAFT);
        });

        it('throws PLUGIN_NOT_FOUND for an unknown plugin', async () => {
            await expectApplicationError(() => service.deleteBinary('missing'), ErrorCodes.PLUGIN_NOT_FOUND);
        });

        it('throws RESOURCE_NOT_FOUND when the workflow has no binary', async () => {
            const team = await createTeam('one');
            const plugin = await seedPlugin(team);

            await expectApplicationError(() => service.deleteBinary(plugin.id), ErrorCodes.RESOURCE_NOT_FOUND);
        });
    });

    describe('createBinaryUploadTarget', () => {
        it('builds a namespaced object path for an existing plugin', async () => {
            const team = await createTeam('one');
            const plugin = await seedPlugin(team);

            const target = await service.createBinaryUploadTarget(plugin.id, team.id, {
                userId: 'user-1',
                fileName: '  run.bin ',
                size: 10,
                sha256: 'abc'
            });

            assert.equal(target.fileName, 'run.bin');
            assert.ok(target.objectPath.startsWith(`plugin-binaries/${plugin.id}/`));
            assert.ok(target.objectPath.endsWith('.bin'));
            assert.equal(target.binaryHash, 'abc');
        });

        it('throws PLUGIN_NOT_FOUND for an unknown plugin', async () => {
            const team = await createTeam('one');

            await expectApplicationError(
                () => service.createBinaryUploadTarget('missing', team.id, {
                    userId: 'user-1',
                    fileName: 'run.bin',
                    size: 10
                }),
                ErrorCodes.PLUGIN_NOT_FOUND
            );
        });
    });

    describe('commitBinaryUpload', () => {
        it('throws PLUGIN_NOT_FOUND for an unknown plugin', async () => {
            const team = await createTeam('one');

            await expectApplicationError(
                () => service.commitBinaryUpload('missing', team.id, {
                    objectPath: 'plugin-binaries/missing/run.bin',
                    fileName: 'run.bin',
                    size: 10
                }),
                ErrorCodes.PLUGIN_NOT_FOUND
            );
        });

        it('rejects an object path outside the plugin namespace', async () => {
            const team = await createTeam('one');
            const plugin = await seedPlugin(team);

            await expectApplicationError(
                () => service.commitBinaryUpload(plugin.id, team.id, {
                    objectPath: 'plugin-binaries/another/run.bin',
                    fileName: 'run.bin',
                    size: 10
                }),
                ErrorCodes.VALIDATION_INVALID_INPUT
            );
        });
    });

    describe('exportPlugin', () => {
        it('throws PLUGIN_NOT_FOUND for an unknown plugin', async () => {
            await expectApplicationError(() => service.exportPlugin('missing'), ErrorCodes.PLUGIN_NOT_FOUND);
        });
    });

    describe('importPlugin', () => {
        it('rejects a buffer that is not a ZIP archive', async () => {
            const team = await createTeam('one');

            await expectApplicationError(
                () => service.importPlugin(Buffer.from('not a zip'), team.id),
                ErrorCodes.VALIDATION_INVALID_INPUT
            );
        });
    });

    describe('createFromRegistry', () => {
        const binary = {
            objectPath: 'plugin-binaries/registry/run.bin',
            fileName: 'run.bin',
            hash: 'registry-hash',
            sizeBytes: 12
        };

        it('rejects a payload that is not a workflow', async () => {
            const team = await createTeam('one');

            await expectApplicationError(
                () => service.createFromRegistry({ nodes: 'nope' }, binary, OWNER_CLUSTER_ID, team.id),
                ErrorCodes.VALIDATION_INVALID_INPUT
            );
        });

        it('creates a draft plugin and records its binary placement', async () => {
            const team = await createTeam('one');

            const result = await service.createFromRegistry(
                buildWorkflow('Registry Plugin', 'registry', {}),
                binary,
                OWNER_CLUSTER_ID,
                team.id
            );

            const stored = await Plugin.findOneByOrFail({ id: result.plugin.id });
            assert.equal(await Plugin.count(), 1);
            assert.equal(stored.team, team.id);
            assert.equal(stored.status, PluginStatus.DRAFT);
            assert.equal(result.binaryImported, true);
            assert.deepEqual(assignedPlacements, [{
                pluginId: stored.id,
                teamId: team.id,
                clusterId: OWNER_CLUSTER_ID
            }]);

            const entrypoint = stored.workflow.nodes
                .find((node) => node.type === 'entrypoint')?.data.entrypoint;
            assert.equal(entrypoint?.binaryObjectPath, binary.objectPath);
            assert.equal(entrypoint?.binaryHash, binary.hash);
        });

        it('reuses the plugin of the same team that already carries the modifier key', async () => {
            const team = await createTeam('one');
            const existing = await seedPlugin(team, {
                workflow: buildWorkflow('Registry Plugin', 'registry', {}),
                modifier: {
                    key: 'registry',
                    name: 'Registry Plugin'
                } as Plugin['modifier']
            });

            const result = await service.createFromRegistry(
                buildWorkflow('Registry Plugin v2', 'registry', {}),
                binary,
                OWNER_CLUSTER_ID,
                team.id
            );

            assert.equal(result.plugin.id, existing.id);
            assert.equal(await Plugin.count(), 1);
            assert.equal((await Plugin.findOneByOrFail({ id: existing.id })).modifier?.name, 'Registry Plugin v2');
        });

        it('does not reuse the plugin of another team', async () => {
            const team = await createTeam('one');
            const other = await createTeam('two');
            const foreign = await seedPlugin(other, {
                modifier: {
                    key: 'registry',
                    name: 'Registry Plugin'
                } as Plugin['modifier']
            });

            const result = await service.createFromRegistry(
                buildWorkflow('Registry Plugin', 'registry', {}),
                binary,
                OWNER_CLUSTER_ID,
                team.id
            );

            assert.notEqual(result.plugin.id, foreign.id);
            assert.equal(await Plugin.count(), 2);
            assert.equal(await Plugin.countBy({ team: team.id }), 1);
        });

        it('creates a new plugin when no modifier key matches', async () => {
            const team = await createTeam('one');
            await seedPlugin(team, {
                modifier: {
                    key: 'other-key',
                    name: 'Other'
                } as Plugin['modifier']
            });

            const result = await service.createFromRegistry(
                buildWorkflow('Registry Plugin', 'registry', {}),
                binary,
                OWNER_CLUSTER_ID,
                team.id
            );

            assert.equal(await Plugin.count(), 2);
            assert.equal((await Plugin.findOneByOrFail({ id: result.plugin.id })).modifier?.key, 'registry');
        });

        it('leaves the installed plugin in draft when it is not ready to publish', async () => {
            const team = await createTeam('one');

            const result = await service.createFromRegistry(
                buildWorkflow('Registry Plugin', 'registry', {}),
                binary,
                OWNER_CLUSTER_ID,
                team.id
            );

            assert.equal(result.plugin.props.status, PluginStatus.DRAFT);
            assert.equal((await Plugin.findOneByOrFail({ id: result.plugin.id })).status, PluginStatus.DRAFT);
        });
    });
});
