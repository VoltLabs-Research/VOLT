import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import { closeRedisHandles } from '@tests/redis-handles';
import ScriptingNotebook from '@modules/scripting/models/ScriptingNotebook';
import Team from '@modules/team/models/Team';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import Trajectory from '@modules/trajectory/models/Trajectory';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import User from '@modules/auth/models/User';
import { DaemonScriptingSessionOrchestrator } from '@modules/scripting/services/DaemonScriptingSessionOrchestrator';
import teamClusterDaemonClient from '@modules/cluster/services/TeamClusterDaemonClient';
import teamClusterSelectionService from '@modules/container/services/TeamClusterSelectionService';
import notebookRuntimeTerminator from '@modules/scripting/services/NotebookRuntimeTerminator';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import ApplicationError from '@shared/application/errors/ApplicationError';

interface DaemonCall{
    teamClusterId: string;
    command: string;
    payload?: Record<string, unknown>;
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

const NOTEBOOK_CONTENT = {
    cells: [],
    nbformat: 4,
    nbformat_minor: 5
};

describe('DaemonScriptingSessionOrchestrator', () => {
    let dataSource: DataSource;
    const orchestrator = new DaemonScriptingSessionOrchestrator();
    const daemonCalls: DaemonCall[] = [];
    const terminated: TerminatedRuntime[] = [];
    let daemonResponse: Record<string, unknown>;

    before(async () => {
        dataSource = await createHarness([
            ScriptingNotebook,
            Team,
            TeamCluster,
            Trajectory,
            CatalogFolder,
            User
        ]);

        teamClusterDaemonClient.command = (async (teamClusterId: string, command: string, payload?: Record<string, unknown>) => {
            daemonCalls.push({
                teamClusterId,
                command,
                payload
            });
            return daemonResponse;
        }) as typeof teamClusterDaemonClient.command;
        teamClusterSelectionService.resolveConnectedClusterId = (async (_teamId: string, requested?: string) => requested ?? '') as typeof teamClusterSelectionService.resolveConnectedClusterId;
        notebookRuntimeTerminator.terminate = (async (teamClusterId: string, runtimeNotebookId: string) => {
            terminated.push({
                teamClusterId,
                runtimeNotebookId
            });
            return true;
        }) as typeof notebookRuntimeTerminator.terminate;
    });

    after(async () => {
        await destroyHarness(dataSource);
        closeRedisHandles();
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
        daemonCalls.length = 0;
        terminated.length = 0;
        daemonResponse = {
            jupyter: {
                internalPath: '/lab/tree/notebook.ipynb',
                ready: true,
                containerStage: 'ready'
            }
        };
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
        content: NOTEBOOK_CONTENT,
        ...overrides
    }).save();

    describe('startSession', () => {
        it('stamps the notebook with the runtime id and the resolved cluster', async () => {
            const fixture = await createTeamFixture('one');
            const notebook = await seedNotebook(fixture);

            await orchestrator.startSession({
                teamId: fixture.team.id,
                teamClusterId: fixture.otherCluster.id,
                userId: fixture.owner.id,
                notebookId: notebook.id,
                notebook: {
                    notebookPath: notebook.notebookPath,
                    content: NOTEBOOK_CONTENT
                }
            });
            const stored = await ScriptingNotebook.findOneByOrFail({ id: notebook.id });

            assert.equal(stored.runtimeNotebookId, notebook.id);
            assert.equal(stored.teamCluster, fixture.otherCluster.id);
        });

        it('sends the notebook snapshot to the cluster that hosts the session', async () => {
            const fixture = await createTeamFixture('one');
            const notebook = await seedNotebook(fixture);

            await orchestrator.startSession({
                teamId: fixture.team.id,
                teamClusterId: fixture.cluster.id,
                userId: fixture.owner.id,
                notebookId: notebook.id,
                secretKey: 'vsk_test',
                trajectoryId: fixture.trajectory.id,
                notebook: {
                    notebookPath: notebook.notebookPath,
                    content: NOTEBOOK_CONTENT
                }
            });

            assert.equal(daemonCalls.length, 1);
            assert.equal(daemonCalls[0].teamClusterId, fixture.cluster.id);
            assert.equal(daemonCalls[0].command, ChannelCommands.NotebookSessionCreate);
            assert.equal(daemonCalls[0].payload?.requestedBy, fixture.owner.id);
            assert.equal(daemonCalls[0].payload?.secretKey, 'vsk_test');
            assert.equal(daemonCalls[0].payload?.trajectoryId, fixture.trajectory.id);
            assert.deepEqual(daemonCalls[0].payload?.notebook, {
                _id: notebook.id,
                teamId: fixture.team.id,
                notebookPath: notebook.notebookPath,
                content: NOTEBOOK_CONTENT
            });
        });

        it('builds the proxy url from the path the daemon reported', async () => {
            const fixture = await createTeamFixture('one');
            const notebook = await seedNotebook(fixture);

            const result = await orchestrator.startSession({
                teamId: fixture.team.id,
                teamClusterId: fixture.cluster.id,
                userId: fixture.owner.id,
                notebookId: notebook.id,
                notebook: {
                    notebookPath: notebook.notebookPath,
                    content: NOTEBOOK_CONTENT
                }
            });

            assert.equal(result.notebookId, notebook.id);
            assert.equal(result.jupyter.ready, true);
            assert.ok(result.jupyter.url.includes(`/api/jupyter/${fixture.team.id}/notebooks/${notebook.id}/lab/tree/notebook.ipynb`));
            assert.ok(result.accessGrant.token);
        });

        it('sends an undefined trajectory when the notebook has none', async () => {
            const fixture = await createTeamFixture('one');
            const notebook = await seedNotebook(fixture);

            await orchestrator.startSession({
                teamId: fixture.team.id,
                teamClusterId: fixture.cluster.id,
                userId: fixture.owner.id,
                notebookId: notebook.id,
                trajectoryId: null,
                notebook: {
                    notebookPath: notebook.notebookPath,
                    content: NOTEBOOK_CONTENT
                }
            });

            assert.equal(daemonCalls[0].payload?.trajectoryId, undefined);
        });

        it('rejects a session without a notebook id', async () => {
            const fixture = await createTeamFixture('one');

            await assert.rejects(
                () => orchestrator.startSession({
                    teamId: fixture.team.id,
                    teamClusterId: fixture.cluster.id,
                    userId: fixture.owner.id,
                    notebook: { notebookPath: 'notebook.ipynb' }
                }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'Scripting::NotebookRequired');
                    assert.equal(error.statusCode, 400);
                    return true;
                }
            );
            assert.deepEqual(daemonCalls, []);
        });

        it('rejects a session without a notebook snapshot', async () => {
            const fixture = await createTeamFixture('one');
            const notebook = await seedNotebook(fixture);

            await assert.rejects(
                () => orchestrator.startSession({
                    teamId: fixture.team.id,
                    teamClusterId: fixture.cluster.id,
                    userId: fixture.owner.id,
                    notebookId: notebook.id
                }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'Scripting::NotebookSnapshotRequired');
                    assert.equal(error.statusCode, 400);
                    return true;
                }
            );
        });

        it('rejects a daemon answer without an internal path', async () => {
            const fixture = await createTeamFixture('one');
            const notebook = await seedNotebook(fixture);
            daemonResponse = {};

            await assert.rejects(
                () => orchestrator.startSession({
                    teamId: fixture.team.id,
                    teamClusterId: fixture.cluster.id,
                    userId: fixture.owner.id,
                    notebookId: notebook.id,
                    notebook: {
                        notebookPath: notebook.notebookPath,
                        content: NOTEBOOK_CONTENT
                    }
                }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.message, 'Daemon returned an invalid Jupyter session response');
                    assert.equal(error.statusCode, 500);
                    return true;
                }
            );
        });
    });

    describe('deleteSession', () => {
        it('stops the runtime of every notebook of the trajectory', async () => {
            const fixture = await createTeamFixture('one');
            await seedNotebook(fixture, {
                trajectory: fixture.trajectory.id,
                runtimeNotebookId: 'runtime-1'
            });
            await seedNotebook(fixture, {
                trajectory: fixture.trajectory.id,
                runtimeNotebookId: 'runtime-2',
                teamCluster: fixture.otherCluster.id
            });

            await orchestrator.deleteSession(fixture.trajectory.id);

            assert.deepEqual(terminated.map((entry) => entry.runtimeNotebookId).sort(), ['runtime-1', 'runtime-2']);
        });

        it('skips the notebooks without a runtime', async () => {
            const fixture = await createTeamFixture('one');
            await seedNotebook(fixture, { trajectory: fixture.trajectory.id });

            await orchestrator.deleteSession(fixture.trajectory.id);

            assert.deepEqual(terminated, []);
        });

        it('ignores the notebooks of another trajectory', async () => {
            const fixture = await createTeamFixture('one');
            await seedNotebook(fixture, {
                trajectory: null,
                runtimeNotebookId: 'runtime-1'
            });

            await orchestrator.deleteSession(fixture.trajectory.id);

            assert.deepEqual(terminated, []);
        });

        it('does nothing for a malformed trajectory id', async () => {
            await createTeamFixture('one');

            await orchestrator.deleteSession('not-a-trajectory-id');

            assert.deepEqual(terminated, []);
        });
    });
});
