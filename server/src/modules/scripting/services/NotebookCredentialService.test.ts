import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import { closeRedisHandles } from '@tests/redis-handles';
import eventBus from '@shared/infrastructure/events/RedisEventBus';
import ScriptingNotebook from '@modules/scripting/models/ScriptingNotebook';
import SecretKey from '@modules/team/models/SecretKey';
import Team from '@modules/team/models/Team';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import TeamMember from '@modules/team/models/TeamMember';
import TeamRole from '@modules/team/models/TeamRole';
import Trajectory from '@modules/trajectory/models/Trajectory';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import User from '@modules/auth/models/User';
import { NotebookCredentialService } from '@modules/scripting/services/NotebookCredentialService';
import { decrypt, encrypt } from '@shared/infrastructure/utilities/crypto';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { ErrorCodes } from '@core/constants/error-codes';

interface EmittedEvent{
    name: string;
    payload: Record<string, unknown>;
}

interface TeamFixture{
    team: Team;
    owner: User;
    role: TeamRole;
    cluster: TeamCluster;
}

const NOTEBOOK_CONTENT = {
    cells: [],
    nbformat: 4,
    nbformat_minor: 5
};

describe('NotebookCredentialService', () => {
    let dataSource: DataSource;
    const service = new NotebookCredentialService();
    const published: EmittedEvent[] = [];

    before(async () => {
        dataSource = await createHarness([
            ScriptingNotebook,
            SecretKey,
            Team,
            TeamCluster,
            TeamMember,
            TeamRole,
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
    });

    after(async () => {
        await destroyHarness(dataSource);
        closeRedisHandles();
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
        published.length = 0;
    });

    const createTeamFixture = async (name: string, withMembership = true): Promise<TeamFixture> => {
        const owner = await User.create({
            email: `owner-${name}@volt.test`,
            firstName: 'ada'
        }).save();
        const team = await Team.create({
            name,
            owner: owner.id
        }).save();
        const role = await TeamRole.create({
            team: team.id,
            name: `role-${name}`,
            permissions: []
        }).save();

        if(withMembership){
            await TeamMember.create({
                team: team.id,
                user: owner.id,
                role: role.id
            }).save();
        }

        const cluster = await TeamCluster.create({
            name: `cluster-${name}`,
            team: team.id,
            createdBy: owner.id,
            services: {},
            queueConcurrency: {},
            queueScopeLimits: {},
            roleConfig: {}
        }).save();

        return {
            team,
            owner,
            role,
            cluster
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

    describe('resolveSecretKey', () => {
        it('mints a secret key named after the notebook and stores it encrypted', async () => {
            const fixture = await createTeamFixture('one');
            const notebook = await seedNotebook(fixture);

            const secretKey = await service.resolveSecretKey(notebook, fixture.owner.id);
            const stored = await ScriptingNotebook.findOneByOrFail({ id: notebook.id });
            const createdKey = await SecretKey.findOneByOrFail({ id: stored.secretKeyId! });

            assert.match(secretKey, /^vsk_[0-9a-f]{64}$/);
            assert.equal(createdKey.name, `notebook:${notebook.id}`);
            assert.equal(createdKey.team, fixture.team.id);
            assert.equal(createdKey.role, fixture.role.id);
            assert.equal(createdKey.createdBy, fixture.owner.id);
            assert.notEqual(stored.secretKeyEncrypted, secretKey);
            assert.equal(await decrypt(stored.secretKeyEncrypted!), secretKey);
        });

        it('reuses the stored key instead of minting a second one', async () => {
            const fixture = await createTeamFixture('one');
            const notebook = await seedNotebook(fixture);

            const first = await service.resolveSecretKey(notebook, fixture.owner.id);
            const reloaded = await ScriptingNotebook.findOneByOrFail({ id: notebook.id });
            const second = await service.resolveSecretKey(reloaded, fixture.owner.id);

            assert.equal(second, first);
            assert.equal(await SecretKey.count(), 1);
        });

        it('mints a new key when only the ciphertext is missing', async () => {
            const fixture = await createTeamFixture('one');
            const notebook = await seedNotebook(fixture, {
                secretKeyId: 'a1b2c3d4e5f6a1b2c3d4e5f6',
                secretKeyEncrypted: null
            });

            await service.resolveSecretKey(notebook, fixture.owner.id);

            assert.equal(await SecretKey.count(), 1);
        });

        it('inherits the role of the launching member', async () => {
            const fixture = await createTeamFixture('one');
            const launcher = await User.create({
                email: 'launcher@volt.test',
                firstName: 'grace'
            }).save();
            const launcherRole = await TeamRole.create({
                team: fixture.team.id,
                name: 'analyst',
                permissions: []
            }).save();
            await TeamMember.create({
                team: fixture.team.id,
                user: launcher.id,
                role: launcherRole.id
            }).save();
            const notebook = await seedNotebook(fixture);

            await service.resolveSecretKey(notebook, launcher.id);
            const stored = await ScriptingNotebook.findOneByOrFail({ id: notebook.id });
            const createdKey = await SecretKey.findOneByOrFail({ id: stored.secretKeyId! });

            assert.equal(createdKey.role, launcherRole.id);
            assert.equal(createdKey.createdBy, launcher.id);
        });

        it('rejects a user that is not a member of the team of the notebook', async () => {
            const fixture = await createTeamFixture('one', false);
            const notebook = await seedNotebook(fixture);

            await assert.rejects(
                () => service.resolveSecretKey(notebook, fixture.owner.id),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, ErrorCodes.TEAM_MEMBER_NOT_FOUND);
                    assert.equal(error.message, 'Team membership not found for notebook credential');
                    assert.equal(error.statusCode, 404);
                    return true;
                }
            );
            assert.equal(await SecretKey.count(), 0);
        });

        it('announces the created key', async () => {
            const fixture = await createTeamFixture('one');
            const notebook = await seedNotebook(fixture);

            await service.resolveSecretKey(notebook, fixture.owner.id);

            assert.deepEqual(published.map((event) => event.name), ['secret-key.created']);
        });
    });

    describe('revokeSecretKey', () => {
        it('deletes the secret key of the notebook', async () => {
            const fixture = await createTeamFixture('one');
            const notebook = await seedNotebook(fixture);
            await service.resolveSecretKey(notebook, fixture.owner.id);
            const stored = await ScriptingNotebook.findOneByOrFail({ id: notebook.id });

            await service.revokeSecretKey(stored);

            assert.equal(await SecretKey.count(), 0);
            assert.deepEqual(published.map((event) => event.name), ['secret-key.created', 'secret-key.deleted']);
        });

        it('does nothing when the notebook has no key', async () => {
            const fixture = await createTeamFixture('one');
            const notebook = await seedNotebook(fixture);

            await service.revokeSecretKey(notebook);

            assert.deepEqual(published, []);
        });

        it('swallows the failure when the key no longer exists', async () => {
            const fixture = await createTeamFixture('one');
            const notebook = await seedNotebook(fixture, {
                secretKeyId: 'a1b2c3d4e5f6a1b2c3d4e5f6',
                secretKeyEncrypted: await encrypt('vsk_stale')
            });

            await service.revokeSecretKey(notebook);

            assert.deepEqual(published, []);
        });

        it('keeps the keys of the other notebooks', async () => {
            const fixture = await createTeamFixture('one');
            const first = await seedNotebook(fixture);
            const second = await seedNotebook(fixture);
            await service.resolveSecretKey(first, fixture.owner.id);
            await service.resolveSecretKey(second, fixture.owner.id);

            await service.revokeSecretKey(await ScriptingNotebook.findOneByOrFail({ id: first.id }));

            const remaining = await SecretKey.find();
            assert.deepEqual(remaining.map((key) => key.name), [`notebook:${second.id}`]);
        });
    });

    describe('secret key wire shape', () => {
        it('never emits the key hash of a secret key', async () => {
            const fixture = await createTeamFixture('one');
            const notebook = await seedNotebook(fixture);
            await service.resolveSecretKey(notebook, fixture.owner.id);
            const stored = await ScriptingNotebook.findOneByOrFail({ id: notebook.id });
            const createdKey = await SecretKey.findOneByOrFail({ id: stored.secretKeyId! });

            const wire = createdKey.toJSON();

            assert.equal(Object.prototype.hasOwnProperty.call(wire, 'keyHash'), false);
            assert.equal(wire._id, createdKey.id);
        });
    });
});
