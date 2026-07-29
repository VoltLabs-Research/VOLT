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
import ScriptingEvents from '@modules/scripting/events/ScriptingEvents';
import scriptingSessionOrchestrator from '@modules/scripting/services/DaemonScriptingSessionOrchestrator';
import notebookCredentialService from '@modules/scripting/services/NotebookCredentialService';
import notebookRuntimeTerminator from '@modules/scripting/services/NotebookRuntimeTerminator';

interface EmittedEvent{
    name: string;
    payload: Record<string, unknown>;
}

interface TeamFixture{
    team: Team;
    owner: User;
    cluster: TeamCluster;
    trajectory: Trajectory;
}

const NOTEBOOK_CONTENT = {
    cells: [],
    nbformat: 4,
    nbformat_minor: 5
};

describe('ScriptingEvents', () => {
    let dataSource: DataSource;
    const events = new ScriptingEvents();
    const published: EmittedEvent[] = [];
    const revokedNotebookIds: string[] = [];
    const deletedSessions: string[] = [];

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
        notebookCredentialService.revokeSecretKey = (async (notebook: ScriptingNotebook) => {
            revokedNotebookIds.push(notebook.id);
        }) as typeof notebookCredentialService.revokeSecretKey;
        scriptingSessionOrchestrator.deleteSession = (async (trajectoryId: string) => {
            deletedSessions.push(trajectoryId);
        }) as typeof scriptingSessionOrchestrator.deleteSession;
        notebookRuntimeTerminator.terminate = (async () => true) as typeof notebookRuntimeTerminator.terminate;
    });

    after(async () => {
        await destroyHarness(dataSource);
        closeRedisHandles();
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
        published.length = 0;
        revokedNotebookIds.length = 0;
        deletedSessions.length = 0;
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

    describe('deleteTeamNotebooks', () => {
        it('deletes every notebook of the team and announces each one', async () => {
            const fixture = await createTeamFixture('one');
            const first = await seedNotebook(fixture);
            const second = await seedNotebook(fixture, { trajectory: fixture.trajectory.id });

            await events.deleteTeamNotebooks({ teamId: fixture.team.id } as EventMap['team.deleted']);

            assert.equal(await ScriptingNotebook.countBy({ team: fixture.team.id }), 0);
            assert.deepEqual(
                published.map((event) => event.payload.notebookId).sort(),
                [first.id, second.id].sort()
            );
            assert.deepEqual(revokedNotebookIds.sort(), [first.id, second.id].sort());
        });

        it('keeps the notebooks of another team', async () => {
            const fixture = await createTeamFixture('one');
            const otherFixture = await createTeamFixture('two');
            await seedNotebook(fixture);
            const survivor = await seedNotebook(otherFixture);

            await events.deleteTeamNotebooks({ teamId: fixture.team.id } as EventMap['team.deleted']);

            const remaining = await ScriptingNotebook.find();
            assert.deepEqual(remaining.map((notebook) => notebook.id), [survivor.id]);
        });

        it('does nothing when the team has no notebook', async () => {
            const fixture = await createTeamFixture('one');

            await events.deleteTeamNotebooks({ teamId: fixture.team.id } as EventMap['team.deleted']);

            assert.deepEqual(published, []);
        });
    });

    describe('detachTrajectoryNotebooks', () => {
        it('deletes the notebooks attached to the removed trajectory', async () => {
            const fixture = await createTeamFixture('one');
            await seedNotebook(fixture, { trajectory: fixture.trajectory.id });

            await events.detachTrajectoryNotebooks({ trajectoryId: fixture.trajectory.id } as EventMap['trajectory.deleted']);

            assert.equal(await ScriptingNotebook.count(), 0);
        });

        it('keeps the notebooks that were never attached to the trajectory', async () => {
            const fixture = await createTeamFixture('one');
            const survivor = await seedNotebook(fixture);
            await seedNotebook(fixture, { trajectory: fixture.trajectory.id });

            await events.detachTrajectoryNotebooks({ trajectoryId: fixture.trajectory.id } as EventMap['trajectory.deleted']);

            const remaining = await ScriptingNotebook.find();
            assert.deepEqual(remaining.map((notebook) => notebook.id), [survivor.id]);
        });

        it('revokes the credentials of the impacted notebooks and stops their sessions', async () => {
            const fixture = await createTeamFixture('one');
            const notebook = await seedNotebook(fixture, { trajectory: fixture.trajectory.id });

            await events.detachTrajectoryNotebooks({ trajectoryId: fixture.trajectory.id } as EventMap['trajectory.deleted']);

            assert.deepEqual(revokedNotebookIds, [notebook.id]);
            assert.deepEqual(deletedSessions, [fixture.trajectory.id]);
        });

        it('does nothing when no notebook is attached to the trajectory', async () => {
            const fixture = await createTeamFixture('one');
            const survivor = await seedNotebook(fixture);

            await events.detachTrajectoryNotebooks({ trajectoryId: fixture.trajectory.id } as EventMap['trajectory.deleted']);

            assert.deepEqual(revokedNotebookIds, []);
            assert.equal(await ScriptingNotebook.countBy({ id: survivor.id }), 1);
        });

        it('leaves the notebooks of another trajectory attached', async () => {
            const fixture = await createTeamFixture('one');
            const other = await Trajectory.create({
                name: 'other',
                team: fixture.team.id,
                createdBy: fixture.owner.id,
                storageClusterId: fixture.cluster.id,
                folder: null
            }).save();
            const survivor = await seedNotebook(fixture, { trajectory: other.id });
            await seedNotebook(fixture, { trajectory: fixture.trajectory.id });

            await events.detachTrajectoryNotebooks({ trajectoryId: fixture.trajectory.id } as EventMap['trajectory.deleted']);

            const remaining = await ScriptingNotebook.find();
            assert.deepEqual(remaining.map((notebook) => notebook.id), [survivor.id]);
            assert.equal((await ScriptingNotebook.findOneByOrFail({ id: survivor.id })).trajectory, other.id);
        });

        it('detaches the notebooks of a trajectory removed by the database before the event runs', async () => {
            const fixture = await createTeamFixture('one');
            const notebook = await seedNotebook(fixture, { trajectory: fixture.trajectory.id });

            await Trajectory.delete({ id: fixture.trajectory.id });

            assert.equal((await ScriptingNotebook.findOneByOrFail({ id: notebook.id })).trajectory, null);
        });
    });
});
