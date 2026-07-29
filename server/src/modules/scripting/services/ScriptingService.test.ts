import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import { closeRedisHandles } from '@tests/redis-handles';
import eventBus from '@shared/infrastructure/events/RedisEventBus';
import ScriptingNotebook from '@modules/scripting/models/ScriptingNotebook';
import Team from '@modules/team/models/Team';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import Trajectory from '@modules/trajectory/models/Trajectory';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import User from '@modules/auth/models/User';
import ScriptingService from '@modules/scripting/services/ScriptingService';
import daemonScriptingSessionOrchestrator from '@modules/scripting/services/DaemonScriptingSessionOrchestrator';
import type { ScriptingSessionStartInput } from '@modules/scripting/services/DaemonScriptingSessionOrchestrator';
import redisScriptingSessionLock from '@modules/scripting/services/RedisScriptingSessionLock';
import notebookCredentialService from '@modules/scripting/services/NotebookCredentialService';
import notebookRuntimeTerminator from '@modules/scripting/services/NotebookRuntimeTerminator';
import teamClusterSelectionService from '@modules/container/services/TeamClusterSelectionService';
import teamClusterExposureRegistryService from '@modules/cluster/services/TeamClusterExposureRegistryService';
import { JupyterNotebookService } from '@modules/scripting/services/JupyterNotebookService';
import { ScriptingNotebookScope } from '@volt/contracts/modules/scripting/domain';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { ErrorCodes } from '@core/constants/error-codes';

interface EmittedEvent{
    name: string;
    payload: Record<string, unknown>;
}

interface LockRequest{
    key: string;
    ttlMs: number;
}

interface TerminatedRuntime{
    teamClusterId: string;
    runtimeNotebookId: string;
}

interface TeamFixture{
    team: Team;
    owner: User;
    cluster: TeamCluster;
    otherCluster: TeamCluster;
    trajectory: Trajectory;
}

const TEMPLATE_CONTENT = {
    cells: [],
    nbformat: 4,
    nbformat_minor: 5
};

const AN_ENTITY_ID = 'a1b2c3d4e5f6a1b2c3d4e5f6';

describe('ScriptingService', () => {
    let dataSource: DataSource;
    const service = new ScriptingService();
    const published: EmittedEvent[] = [];
    const lockRequests: LockRequest[] = [];
    const releasedLocks: string[] = [];
    const terminated: TerminatedRuntime[] = [];
    const startedSessions: ScriptingSessionStartInput[] = [];
    const revokedNotebookIds: string[] = [];
    let lockAvailable = true;

    before(async () => {
        dataSource = await createHarness([
            ScriptingNotebook,
            Team,
            TeamCluster,
            Trajectory,
            CatalogFolder,
            User
        ]);

        eventBus.emit = (async (name: string, payload: Record<string, unknown>) => {
            published.push({
                name,
                payload
            });
        }) as typeof eventBus.emit;
        redisScriptingSessionLock.acquire = (async (key: string, ttlMs: number) => {
            lockRequests.push({
                key,
                ttlMs
            });

            if(!lockAvailable){
                return null;
            }

            return {
                release: async () => {
                    releasedLocks.push(key);
                }
            };
        }) as typeof redisScriptingSessionLock.acquire;
        JupyterNotebookService.prototype.resolveNotebookTemplateContent = (async () => TEMPLATE_CONTENT) as typeof JupyterNotebookService.prototype.resolveNotebookTemplateContent;
        daemonScriptingSessionOrchestrator.resolveNotebookTemplateContent = (async () => TEMPLATE_CONTENT) as typeof daemonScriptingSessionOrchestrator.resolveNotebookTemplateContent;
        daemonScriptingSessionOrchestrator.startSession = (async (input: ScriptingSessionStartInput) => {
            startedSessions.push(input);
            return {
                notebookId: input.notebookId ?? '',
                jupyter: {
                    url: 'https://volt.test/api/jupyter',
                    ready: true,
                    containerStage: 'ready' as const
                },
                accessGrant: {
                    token: 'grant-token',
                    maxAgeMs: 1000,
                    teamId: input.teamId,
                    runtimeNotebookId: input.notebookId ?? ''
                }
            };
        }) as typeof daemonScriptingSessionOrchestrator.startSession;
        notebookCredentialService.resolveSecretKey = (async () => 'vsk_test') as typeof notebookCredentialService.resolveSecretKey;
        notebookCredentialService.revokeSecretKey = (async (notebook: ScriptingNotebook) => {
            revokedNotebookIds.push(notebook.id);
        }) as typeof notebookCredentialService.revokeSecretKey;
        notebookRuntimeTerminator.terminate = (async (teamClusterId: string, runtimeNotebookId: string) => {
            terminated.push({
                teamClusterId,
                runtimeNotebookId
            });
            return true;
        }) as typeof notebookRuntimeTerminator.terminate;
        teamClusterSelectionService.resolveConnectedClusterId = (async (_teamId: string, requested?: string) => {
            if(!requested){
                throw ApplicationError.badRequest(ErrorCodes.VALIDATION_INVALID_INPUT, 'cluster required');
            }
            return requested;
        }) as typeof teamClusterSelectionService.resolveConnectedClusterId;
        teamClusterExposureRegistryService.listTeamClusterExposures = (() => []) as typeof teamClusterExposureRegistryService.listTeamClusterExposures;
    });

    after(async () => {
        await destroyHarness(dataSource);
        closeRedisHandles();
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
        published.length = 0;
        lockRequests.length = 0;
        releasedLocks.length = 0;
        terminated.length = 0;
        startedSessions.length = 0;
        revokedNotebookIds.length = 0;
        lockAvailable = true;
    });

    const createTeamFixture = async (name: string): Promise<TeamFixture> => {
        const owner = await User.create({
            email: `owner-${name}@volt.test`,
            firstName: 'ada'
        }).save();
        const team = await Team.create({
            name,
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
        const otherCluster = await TeamCluster.create({
            name: `other-cluster-${name}`,
            team: team.id,
            createdBy: owner.id,
            services: {},
            queueConcurrency: {},
            queueScopeLimits: {},
            roleConfig: {}
        }).save();
        const trajectory = await Trajectory.create({
            name: `traj-${name}`,
            team: team.id,
            createdBy: owner.id,
            storageClusterId: cluster.id,
            folder: null
        }).save();

        return {
            team,
            owner,
            cluster,
            otherCluster,
            trajectory
        };
    };

    const seedNotebook = (
        fixture: TeamFixture,
        overrides: Partial<ScriptingNotebook> = {}
    ): Promise<ScriptingNotebook> => ScriptingNotebook.create({
        team: fixture.team.id,
        teamCluster: fixture.cluster.id,
        title: 'Untitled Notebook',
        notebookPath: `scripting-notebook-${Math.random().toString(16).slice(2)}.ipynb`,
        trajectory: null,
        createdBy: fixture.owner.id,
        content: TEMPLATE_CONTENT,
        ...overrides
    }).save();

    describe('listNotebooks', () => {
        it('lists every notebook of the team regardless of scope', async () => {
            const fixture = await createTeamFixture('one');
            await seedNotebook(fixture);
            await seedNotebook(fixture, { trajectory: fixture.trajectory.id });

            const result = await service.listNotebooks({ teamId: fixture.team.id });

            assert.equal(result.total, 2);
        });

        it('keeps only the notebooks without a trajectory on the general scope', async () => {
            const fixture = await createTeamFixture('one');
            const general = await seedNotebook(fixture);
            await seedNotebook(fixture, { trajectory: fixture.trajectory.id });

            const result = await service.listNotebooks({
                teamId: fixture.team.id,
                scope: ScriptingNotebookScope.General
            });

            assert.deepEqual(result.data.map((notebook) => notebook._id), [general.id]);
        });

        it('keeps only the notebooks with a trajectory on the trajectory scope', async () => {
            const fixture = await createTeamFixture('one');
            await seedNotebook(fixture);
            const attached = await seedNotebook(fixture, { trajectory: fixture.trajectory.id });

            const result = await service.listNotebooks({
                teamId: fixture.team.id,
                scope: ScriptingNotebookScope.Trajectory
            });

            assert.deepEqual(result.data.map((notebook) => notebook._id), [attached.id]);
        });

        it('narrows the list to a single trajectory when one is given', async () => {
            const fixture = await createTeamFixture('one');
            const other = await Trajectory.create({
                name: 'other',
                team: fixture.team.id,
                createdBy: fixture.owner.id,
                storageClusterId: fixture.cluster.id,
                folder: null
            }).save();
            const attached = await seedNotebook(fixture, { trajectory: fixture.trajectory.id });
            await seedNotebook(fixture, { trajectory: other.id });

            const result = await service.listNotebooks({
                teamId: fixture.team.id,
                trajectoryId: fixture.trajectory.id
            });

            assert.deepEqual(result.data.map((notebook) => notebook._id), [attached.id]);
        });

        it('prefers the trajectory filter over the general scope', async () => {
            const fixture = await createTeamFixture('one');
            await seedNotebook(fixture);
            const attached = await seedNotebook(fixture, { trajectory: fixture.trajectory.id });

            const result = await service.listNotebooks({
                teamId: fixture.team.id,
                trajectoryId: fixture.trajectory.id,
                scope: ScriptingNotebookScope.General
            });

            assert.deepEqual(result.data.map((notebook) => notebook._id), [attached.id]);
        });

        it('excludes the notebooks of another team', async () => {
            const fixture = await createTeamFixture('one');
            const otherFixture = await createTeamFixture('two');
            await seedNotebook(otherFixture);

            const result = await service.listNotebooks({ teamId: fixture.team.id });

            assert.equal(result.total, 0);
        });

        it('projects the loaded relations down to their identity fields', async () => {
            const fixture = await createTeamFixture('one');
            await seedNotebook(fixture, { trajectory: fixture.trajectory.id });

            const result = await service.listNotebooks({ teamId: fixture.team.id });
            const view = result.data[0];

            assert.deepEqual((view.teamCluster as TeamCluster).toJSON(), {
                _id: fixture.cluster.id,
                name: fixture.cluster.name
            });
            assert.deepEqual((view.trajectory as Trajectory).toJSON(), {
                _id: fixture.trajectory.id,
                name: fixture.trajectory.name
            });
            assert.deepEqual((view.createdBy as User).toJSON(), {
                _id: fixture.owner.id,
                firstName: 'ada',
                lastName: '',
                email: 'owner-one@volt.test',
                avatar: null
            });
        });

        it('emits a null trajectory when the notebook has none', async () => {
            const fixture = await createTeamFixture('one');
            await seedNotebook(fixture);

            const result = await service.listNotebooks({ teamId: fixture.team.id });

            assert.equal(result.data[0].trajectory, null);
        });

        it('defaults the page size to five hundred', async () => {
            const fixture = await createTeamFixture('one');
            await seedNotebook(fixture);

            const result = await service.listNotebooks({ teamId: fixture.team.id });

            assert.equal(result.limit, 500);
            assert.equal(result.page, 1);
            assert.equal(result.totalPages, 1);
        });

        it('reports the page metadata of the requested page', async () => {
            const fixture = await createTeamFixture('one');
            await seedNotebook(fixture);
            await seedNotebook(fixture);
            await seedNotebook(fixture);

            const result = await service.listNotebooks({
                teamId: fixture.team.id,
                page: 2,
                limit: 2
            });

            assert.equal(result.total, 3);
            assert.equal(result.page, 2);
            assert.equal(result.totalPages, 2);
            assert.equal(result.data.length, 1);
        });
    });

    describe('createNotebook', () => {
        it('creates an untitled notebook with the resolved cluster and the template content', async () => {
            const fixture = await createTeamFixture('one');

            const notebook = await service.createNotebook({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                teamClusterId: fixture.cluster.id
            });
            const stored = await ScriptingNotebook.findOneByOrFail({ id: notebook._id });

            assert.equal(stored.title, 'Untitled Notebook');
            assert.equal(stored.teamCluster, fixture.cluster.id);
            assert.equal(stored.trajectory, null);
            assert.deepEqual(stored.content, TEMPLATE_CONTENT);
            assert.match(stored.notebookPath, /^scripting-notebook-.+\.ipynb$/);
        });

        it('trims the given title', async () => {
            const fixture = await createTeamFixture('one');

            const notebook = await service.createNotebook({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                teamClusterId: fixture.cluster.id,
                title: '  My Notebook  '
            });

            assert.equal(notebook.title, 'My Notebook');
        });

        it('rejects an unauthenticated request', async () => {
            const fixture = await createTeamFixture('one');

            await assert.rejects(
                () => service.createNotebook({
                    teamId: fixture.team.id,
                    teamClusterId: fixture.cluster.id
                }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, ErrorCodes.AUTHENTICATION_REQUIRED);
                    assert.equal(error.statusCode, 401);
                    return true;
                }
            );
            assert.equal(await ScriptingNotebook.count(), 0);
        });

        it('refuses two notebooks with the same path inside a team', async () => {
            const fixture = await createTeamFixture('one');
            await seedNotebook(fixture, { notebookPath: 'duplicated.ipynb' });

            await assert.rejects(() => seedNotebook(fixture, { notebookPath: 'duplicated.ipynb' }));
        });
    });

    describe('updateNotebook', () => {
        it('renames the notebook', async () => {
            const fixture = await createTeamFixture('one');
            const notebook = await seedNotebook(fixture);

            const result = await service.updateNotebook({
                teamId: fixture.team.id,
                notebookId: notebook.id,
                title: '  Renamed  '
            });

            assert.equal(result.title, 'Renamed');
            assert.equal((await ScriptingNotebook.findOneByOrFail({ id: notebook.id })).title, 'Renamed');
        });

        it('rejects an empty title', async () => {
            const fixture = await createTeamFixture('one');
            const notebook = await seedNotebook(fixture);

            await assert.rejects(
                () => service.updateNotebook({
                    teamId: fixture.team.id,
                    notebookId: notebook.id,
                    title: '   '
                }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, ErrorCodes.VALIDATION_INVALID_INPUT);
                    assert.equal(error.message, 'Notebook title is required');
                    assert.equal(error.statusCode, 400);
                    return true;
                }
            );
        });

        it('rejects an update that changes nothing', async () => {
            const fixture = await createTeamFixture('one');
            const notebook = await seedNotebook(fixture);

            await assert.rejects(
                () => service.updateNotebook({
                    teamId: fixture.team.id,
                    notebookId: notebook.id
                }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, ErrorCodes.VALIDATION_INVALID_INPUT);
                    assert.equal(error.message, 'At least one notebook field must be updated');
                    return true;
                }
            );
        });

        it('rejects a notebook of another team', async () => {
            const fixture = await createTeamFixture('one');
            const otherFixture = await createTeamFixture('two');
            const notebook = await seedNotebook(fixture);

            await assert.rejects(
                () => service.updateNotebook({
                    teamId: otherFixture.team.id,
                    notebookId: notebook.id,
                    title: 'stolen'
                }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, ErrorCodes.RESOURCE_NOT_FOUND);
                    assert.equal(error.statusCode, 404);
                    return true;
                }
            );
        });

        it('answers not found instead of failing when the id is malformed', async () => {
            const fixture = await createTeamFixture('one');

            await assert.rejects(
                () => service.updateNotebook({
                    teamId: fixture.team.id,
                    notebookId: 'not-an-id',
                    title: 'whatever'
                }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.statusCode, 404);
                    return true;
                }
            );
        });

        it('stores the new container resources and stops the running runtime', async () => {
            const fixture = await createTeamFixture('one');
            const notebook = await seedNotebook(fixture, { runtimeNotebookId: 'runtime-1' });

            const result = await service.updateNotebook({
                teamId: fixture.team.id,
                notebookId: notebook.id,
                containerResources: {
                    cpus: 2,
                    memoryMB: 2048
                }
            });

            assert.deepEqual(result.containerResources, {
                cpus: 2,
                memoryMB: 2048
            });
            assert.deepEqual(terminated, [{
                teamClusterId: fixture.cluster.id,
                runtimeNotebookId: 'runtime-1'
            }]);
        });

        it('rejects container resources below the minimum cpus', async () => {
            const fixture = await createTeamFixture('one');
            const notebook = await seedNotebook(fixture);

            await assert.rejects(
                () => service.updateNotebook({
                    teamId: fixture.team.id,
                    notebookId: notebook.id,
                    containerResources: {
                        cpus: 0.1,
                        memoryMB: 2048
                    }
                }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.message, 'Notebook container cpus must be at least 0.5');
                    assert.equal(error.statusCode, 400);
                    return true;
                }
            );
        });

        it('rejects container resources below the minimum memory', async () => {
            const fixture = await createTeamFixture('one');
            const notebook = await seedNotebook(fixture);

            await assert.rejects(
                () => service.updateNotebook({
                    teamId: fixture.team.id,
                    notebookId: notebook.id,
                    containerResources: {
                        cpus: 1,
                        memoryMB: 64
                    }
                }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.message, 'Notebook container memory must be at least 128 MB');
                    return true;
                }
            );
        });

        it('moves the notebook to another cluster and stops the running runtime', async () => {
            const fixture = await createTeamFixture('one');
            const notebook = await seedNotebook(fixture, { runtimeNotebookId: 'runtime-1' });

            await service.updateNotebook({
                teamId: fixture.team.id,
                notebookId: notebook.id,
                teamClusterId: fixture.otherCluster.id
            });

            assert.equal((await ScriptingNotebook.findOneByOrFail({ id: notebook.id })).teamCluster, fixture.otherCluster.id);
            assert.deepEqual(terminated, [{
                teamClusterId: fixture.cluster.id,
                runtimeNotebookId: 'runtime-1'
            }]);
        });

        it('keeps the runtime alive when the cluster does not change', async () => {
            const fixture = await createTeamFixture('one');
            const notebook = await seedNotebook(fixture, { runtimeNotebookId: 'runtime-1' });

            await assert.rejects(() => service.updateNotebook({
                teamId: fixture.team.id,
                notebookId: notebook.id,
                teamClusterId: fixture.cluster.id
            }));
            assert.deepEqual(terminated, []);
        });
    });

    describe('deleteNotebook', () => {
        it('deletes the notebook, revokes its key and announces the deletion', async () => {
            const fixture = await createTeamFixture('one');
            const notebook = await seedNotebook(fixture);

            const result = await service.deleteNotebook({
                teamId: fixture.team.id,
                notebookId: notebook.id
            });

            assert.equal(result, null);
            assert.equal(await ScriptingNotebook.countBy({ id: notebook.id }), 0);
            assert.deepEqual(revokedNotebookIds, [notebook.id]);
            assert.deepEqual(published, [{
                name: 'notebook.deleted',
                payload: {
                    notebookId: notebook.id,
                    teamId: fixture.team.id
                }
            }]);
        });

        it('stops the running runtime before deleting', async () => {
            const fixture = await createTeamFixture('one');
            const notebook = await seedNotebook(fixture, { runtimeNotebookId: 'runtime-1' });

            await service.deleteNotebook({
                teamId: fixture.team.id,
                notebookId: notebook.id
            });

            assert.deepEqual(terminated, [{
                teamClusterId: fixture.cluster.id,
                runtimeNotebookId: 'runtime-1'
            }]);
        });

        it('rejects a notebook that does not exist', async () => {
            const fixture = await createTeamFixture('one');

            await assert.rejects(
                () => service.deleteNotebook({
                    teamId: fixture.team.id,
                    notebookId: AN_ENTITY_ID
                }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, ErrorCodes.RESOURCE_NOT_FOUND);
                    assert.equal(error.statusCode, 404);
                    return true;
                }
            );
            assert.deepEqual(published, []);
        });
    });

    describe('getSessionStatus', () => {
        it('reports a creating stage when the notebook has no runtime yet', async () => {
            const fixture = await createTeamFixture('one');
            const notebook = await seedNotebook(fixture);

            const result = await service.getSessionStatus({
                teamId: fixture.team.id,
                notebookId: notebook.id,
                userId: fixture.owner.id
            });

            assert.deepEqual(result, {
                notebookId: notebook.id,
                jupyter: {
                    ready: false,
                    url: '',
                    containerStage: 'creating'
                }
            });
        });

        it('reports a starting stage while the runtime is not exposed yet', async () => {
            const fixture = await createTeamFixture('one');
            const notebook = await seedNotebook(fixture, { runtimeNotebookId: 'runtime-1' });

            const result = await service.getSessionStatus({
                teamId: fixture.team.id,
                notebookId: notebook.id,
                userId: fixture.owner.id
            });

            assert.equal(result.jupyter.ready, false);
            assert.equal(result.jupyter.containerStage, 'starting');
            assert.ok(result.jupyter.url.includes(`/api/jupyter/${fixture.team.id}/notebooks/runtime-1`));
            assert.ok(result.accessGrant?.token);
        });

        it('rejects an unauthenticated request', async () => {
            const fixture = await createTeamFixture('one');
            const notebook = await seedNotebook(fixture);

            await assert.rejects(
                () => service.getSessionStatus({
                    teamId: fixture.team.id,
                    notebookId: notebook.id
                }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, ErrorCodes.AUTHENTICATION_REQUIRED);
                    assert.equal(error.statusCode, 401);
                    return true;
                }
            );
        });

        it('rejects a notebook of another team', async () => {
            const fixture = await createTeamFixture('one');
            const otherFixture = await createTeamFixture('two');
            const notebook = await seedNotebook(fixture);

            await assert.rejects(
                () => service.getSessionStatus({
                    teamId: otherFixture.team.id,
                    notebookId: notebook.id,
                    userId: otherFixture.owner.id
                }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, ErrorCodes.SCRIPTING_NOTEBOOK_NOT_FOUND);
                    assert.equal(error.statusCode, 404);
                    return true;
                }
            );
        });
    });

    describe('deleteSession', () => {
        it('stops the runtime and reports the removed runtime id', async () => {
            const fixture = await createTeamFixture('one');
            const notebook = await seedNotebook(fixture, { runtimeNotebookId: 'runtime-1' });

            const result = await service.deleteSession({
                teamId: fixture.team.id,
                notebookId: notebook.id
            });

            assert.deepEqual(result, {
                notebookId: notebook.id,
                deleted: true,
                runtimeNotebookId: 'runtime-1'
            });
            assert.deepEqual(terminated, [{
                teamClusterId: fixture.cluster.id,
                runtimeNotebookId: 'runtime-1'
            }]);
        });

        it('reports nothing deleted when the notebook has no runtime', async () => {
            const fixture = await createTeamFixture('one');
            const notebook = await seedNotebook(fixture);

            const result = await service.deleteSession({
                teamId: fixture.team.id,
                notebookId: notebook.id
            });

            assert.deepEqual(result, {
                notebookId: notebook.id,
                deleted: false,
                runtimeNotebookId: undefined
            });
            assert.deepEqual(terminated, []);
        });

        it('rejects a notebook that does not exist', async () => {
            const fixture = await createTeamFixture('one');

            await assert.rejects(
                () => service.deleteSession({
                    teamId: fixture.team.id,
                    notebookId: AN_ENTITY_ID
                }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, ErrorCodes.SCRIPTING_NOTEBOOK_NOT_FOUND);
                    return true;
                }
            );
        });
    });

    describe('createJupyterSession', () => {
        it('locks a trajectory session on lock:jupyter:teamId:trajectory:trajectoryId', async () => {
            const fixture = await createTeamFixture('one');

            await service.createJupyterSession({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                trajectoryId: fixture.trajectory.id,
                teamClusterId: fixture.cluster.id
            });

            assert.deepEqual(lockRequests, [{
                key: `lock:jupyter:${fixture.team.id}:trajectory:${fixture.trajectory.id}`,
                ttlMs: 90000
            }]);
            assert.deepEqual(releasedLocks, [`lock:jupyter:${fixture.team.id}:trajectory:${fixture.trajectory.id}`]);
        });

        it('locks a notebook session on lock:jupyter:teamId:notebook:notebookId', async () => {
            const fixture = await createTeamFixture('one');
            const notebook = await seedNotebook(fixture);

            await service.createJupyterSession({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                notebookId: notebook.id
            });

            assert.deepEqual(lockRequests, [{
                key: `lock:jupyter:${fixture.team.id}:notebook:${notebook.id}`,
                ttlMs: 90000
            }]);
        });

        it('prefers the trajectory lock key when both ids are given', async () => {
            const fixture = await createTeamFixture('one');
            const notebook = await seedNotebook(fixture);

            await service.createJupyterSession({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                notebookId: notebook.id,
                trajectoryId: fixture.trajectory.id
            });

            assert.deepEqual(
                lockRequests.map((request) => request.key),
                [`lock:jupyter:${fixture.team.id}:trajectory:${fixture.trajectory.id}`]
            );
        });

        it('rejects a request without a trajectory and without a notebook', async () => {
            const fixture = await createTeamFixture('one');

            await assert.rejects(
                () => service.createJupyterSession({
                    teamId: fixture.team.id,
                    userId: fixture.owner.id
                }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, ErrorCodes.VALIDATION_MISSING_REQUIRED_FIELDS);
                    assert.equal(error.message, 'Trajectory id or notebook id is required');
                    assert.equal(error.statusCode, 400);
                    return true;
                }
            );
            assert.deepEqual(lockRequests, []);
        });

        it('rejects an unauthenticated request', async () => {
            const fixture = await createTeamFixture('one');

            await assert.rejects(
                () => service.createJupyterSession({
                    teamId: fixture.team.id,
                    trajectoryId: fixture.trajectory.id
                }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, ErrorCodes.AUTHENTICATION_REQUIRED);
                    return true;
                }
            );
        });

        it('creates a notebook for the trajectory and starts the session', async () => {
            const fixture = await createTeamFixture('one');

            const result = await service.createJupyterSession({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                trajectoryId: fixture.trajectory.id,
                teamClusterId: fixture.cluster.id
            });
            const stored = await ScriptingNotebook.findOneByOrFail({ id: result.notebookId });

            assert.equal(stored.trajectory, fixture.trajectory.id);
            assert.equal(stored.notebookPath, `scripting-notebook-${fixture.trajectory.id}.ipynb`);
            assert.equal(startedSessions.length, 1);
            assert.equal(startedSessions[0].notebookId, stored.id);
            assert.equal(startedSessions[0].secretKey, 'vsk_test');
            assert.equal(result.jupyter.ready, true);
        });

        it('reuses the existing notebook of the trajectory', async () => {
            const fixture = await createTeamFixture('one');
            const existing = await seedNotebook(fixture, { trajectory: fixture.trajectory.id });

            const result = await service.createJupyterSession({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                trajectoryId: fixture.trajectory.id,
                teamClusterId: fixture.cluster.id
            });

            assert.equal(result.notebookId, existing.id);
            assert.equal(await ScriptingNotebook.count(), 1);
        });

        it('never reuses a notebook of another team for the same trajectory', async () => {
            const fixture = await createTeamFixture('one');
            const otherFixture = await createTeamFixture('two');
            await ScriptingNotebook.create({
                team: otherFixture.team.id,
                teamCluster: otherFixture.cluster.id,
                title: 'theirs',
                notebookPath: 'theirs.ipynb',
                trajectory: fixture.trajectory.id,
                createdBy: otherFixture.owner.id,
                content: TEMPLATE_CONTENT
            }).save();

            const result = await service.createJupyterSession({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                trajectoryId: fixture.trajectory.id,
                teamClusterId: fixture.cluster.id
            });
            const created = await ScriptingNotebook.findOneByOrFail({ id: result.notebookId });

            assert.equal(created.team, fixture.team.id);
            assert.equal(await ScriptingNotebook.count(), 2);
        });

        it('requires a cluster to create the notebook of a trajectory', async () => {
            const fixture = await createTeamFixture('one');

            await assert.rejects(
                () => service.createJupyterSession({
                    teamId: fixture.team.id,
                    userId: fixture.owner.id,
                    trajectoryId: fixture.trajectory.id
                }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, ErrorCodes.VALIDATION_MISSING_REQUIRED_FIELDS);
                    assert.equal(error.message, 'Notebook deployment cluster is required');
                    return true;
                }
            );
        });

        it('touches the notebook it opens', async () => {
            const fixture = await createTeamFixture('one');
            const notebook = await seedNotebook(fixture);

            await service.createJupyterSession({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                notebookId: notebook.id
            });

            assert.ok((await ScriptingNotebook.findOneByOrFail({ id: notebook.id })).lastOpenedAt instanceof Date);
        });

        it('attaches the trajectory to the notebook it opens', async () => {
            const fixture = await createTeamFixture('one');
            const notebook = await seedNotebook(fixture);

            await service.createJupyterSession({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                notebookId: notebook.id,
                trajectoryId: fixture.trajectory.id
            });

            assert.equal((await ScriptingNotebook.findOneByOrFail({ id: notebook.id })).trajectory, fixture.trajectory.id);
        });

        it('rejects a notebook of another team', async () => {
            const fixture = await createTeamFixture('one');
            const otherFixture = await createTeamFixture('two');
            const notebook = await seedNotebook(fixture);

            await assert.rejects(
                () => service.createJupyterSession({
                    teamId: otherFixture.team.id,
                    userId: otherFixture.owner.id,
                    notebookId: notebook.id
                }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, ErrorCodes.SCRIPTING_NOTEBOOK_NOT_FOUND);
                    assert.equal(error.statusCode, 404);
                    return true;
                }
            );
        });

        it('returns a pending session for the known notebook when the lock is taken', async () => {
            const fixture = await createTeamFixture('one');
            const notebook = await seedNotebook(fixture);
            lockAvailable = false;

            const result = await service.createJupyterSession({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                notebookId: notebook.id
            });

            assert.deepEqual(result, {
                notebookId: notebook.id,
                jupyter: {
                    url: '',
                    ready: false,
                    containerStage: 'creating'
                }
            });
            assert.deepEqual(startedSessions, []);
        });

        it('returns the pending notebook of the trajectory when the lock is taken', async () => {
            const fixture = await createTeamFixture('one');
            const existing = await seedNotebook(fixture, { trajectory: fixture.trajectory.id });
            lockAvailable = false;

            const result = await service.createJupyterSession({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                trajectoryId: fixture.trajectory.id
            });

            assert.equal(result.notebookId, existing.id);
            assert.equal(result.jupyter.ready, false);
        });
    });
});
