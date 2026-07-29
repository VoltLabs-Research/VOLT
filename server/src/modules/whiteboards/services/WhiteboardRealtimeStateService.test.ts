import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import { WhiteboardRealtimeStateService } from '@modules/whiteboards/services/WhiteboardRealtimeStateService';
import type { WhiteboardRealtimeObjectGateway } from '@modules/whiteboards/services/WhiteboardRealtimeStateService';
import Whiteboard from '@modules/whiteboards/models/Whiteboard';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';

interface PutCall{
    teamClusterId: string;
    objectKey: string;
    body: string;
}

interface Fixture{
    team: Team;
    owner: User;
    editor: User;
    cluster: TeamCluster;
}

const ENTITIES = [Whiteboard, TeamCluster, CatalogFolder, Team, User];

const isApplicationError = (code: string, statusCode: number) => (error: unknown): boolean => {
    assert.ok(error instanceof ApplicationError);
    assert.equal(error.code, code);
    assert.equal(error.statusCode, statusCode);
    return true;
};

describe('WhiteboardRealtimeStateService', () => {
    let dataSource: DataSource;
    let service: WhiteboardRealtimeStateService;
    const puts: PutCall[] = [];
    const storedObjects = new Map<string, string>();

    const gateway = (): WhiteboardRealtimeObjectGateway => ({
        exists: async (_teamClusterId, bucket, objectKey) => storedObjects.has(`${bucket}/${objectKey}`),
        getBuffer: async (_teamClusterId, bucket, objectKey) => Buffer.from(storedObjects.get(`${bucket}/${objectKey}`) ?? ''),
        putBuffer: async (teamClusterId, request) => {
            puts.push({
                teamClusterId,
                objectKey: request.objectKey,
                body: request.buffer.toString('utf8')
            });
            storedObjects.set(`${request.bucket}/${request.objectKey}`, request.buffer.toString('utf8'));
        }
    });

    before(async () => {
        dataSource = await createHarness(ENTITIES);
    });

    after(async () => {
        await destroyHarness(dataSource);
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
        puts.length = 0;
        storedObjects.clear();
        service = new WhiteboardRealtimeStateService({ objectGatewayClient: gateway() });
    });

    const createFixture = async (): Promise<Fixture> => {
        const owner = await User.create({
            email: 'owner@volt.test',
            firstName: 'ada'
        }).save();
        const editor = await User.create({
            email: 'editor@volt.test',
            firstName: 'grace'
        }).save();
        const team = await Team.create({
            name: 'Team One',
            owner: owner.id
        }).save();
        const cluster = await TeamCluster.create({
            name: 'cluster',
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
            editor,
            cluster
        };
    };

    const seedWhiteboard = (
        fixture: Fixture,
        overrides: Partial<Whiteboard> = {}
    ): Promise<Whiteboard> => Whiteboard.create({
        team: fixture.team.id,
        createdBy: fixture.owner.id,
        lastEditedBy: fixture.owner.id,
        title: 'Board',
        storageClusterId: fixture.cluster.id,
        payloadKey: `${fixture.team.id}/state.json`,
        folder: null,
        ...overrides
    }).save();

    const storeScene = (whiteboard: Whiteboard, scene: unknown): void => {
        storedObjects.set(`${TEAM_CLUSTER_BUCKETS.WHITEBOARDS}/${whiteboard.payloadKey}`, JSON.stringify(scene));
    };

    describe('getSnapshot', () => {
        it('loads the scene stored for the whiteboard', async () => {
            const fixture = await createFixture();
            const whiteboard = await seedWhiteboard(fixture);
            storeScene(whiteboard, {
                revision: 4,
                elements: [{
                    id: 'a',
                    version: 1
                }],
                appState: { theme: 'dark' }
            });

            const snapshot = await service.getSnapshot(whiteboard.id);

            assert.equal(snapshot?.whiteboardId, whiteboard.id);
            assert.equal(snapshot?.revision, 4);
            assert.deepEqual(snapshot?.elements, [{
                id: 'a',
                version: 1
            }]);
            assert.deepEqual(snapshot?.appState, { theme: 'dark' });
        });

        it('starts from an empty scene when nothing is stored yet', async () => {
            const fixture = await createFixture();
            const whiteboard = await seedWhiteboard(fixture);

            const snapshot = await service.getSnapshot(whiteboard.id);

            assert.equal(snapshot?.revision, 0);
            assert.deepEqual(snapshot?.elements, []);
            assert.deepEqual(snapshot?.appState, {});
        });

        it('falls back to an empty scene when the stored payload is not valid json', async () => {
            const fixture = await createFixture();
            const whiteboard = await seedWhiteboard(fixture);
            storedObjects.set(`${TEAM_CLUSTER_BUCKETS.WHITEBOARDS}/${whiteboard.payloadKey}`, 'not json');

            const snapshot = await service.getSnapshot(whiteboard.id);

            assert.equal(snapshot?.revision, 0);
            assert.deepEqual(snapshot?.elements, []);
        });

        it('drops the stored elements that carry no string id', async () => {
            const fixture = await createFixture();
            const whiteboard = await seedWhiteboard(fixture);
            storeScene(whiteboard, {
                revision: 1,
                elements: [
                    { id: 'a' },
                    { id: 7 },
                    null
                ],
                appState: {}
            });

            const snapshot = await service.getSnapshot(whiteboard.id);

            assert.deepEqual(snapshot?.elements, [{ id: 'a' }]);
        });

        it('returns null for an unknown whiteboard', async () => {
            await createFixture();

            assert.equal(await service.getSnapshot('a'.repeat(24)), null);
        });

        it('rejects a whiteboard without a payload key', async () => {
            const fixture = await createFixture();
            const whiteboard = await seedWhiteboard(fixture, { payloadKey: '' });

            await assert.rejects(
                () => service.getSnapshot(whiteboard.id),
                isApplicationError('Whiteboard::PayloadKeyRequired', 409)
            );
        });

        it('rejects a whiteboard without a storage cluster', async () => {
            const fixture = await createFixture();
            const whiteboard = await seedWhiteboard(fixture, { storageClusterId: null });

            await assert.rejects(
                () => service.getSnapshot(whiteboard.id),
                isApplicationError('Whiteboard::StorageClusterRequired', 409)
            );
        });
    });

    describe('getTeamId', () => {
        it('reads the team of the whiteboard from the loaded room', async () => {
            const fixture = await createFixture();
            const whiteboard = await seedWhiteboard(fixture);

            assert.equal(await service.getTeamId(whiteboard.id), fixture.team.id);
        });

        it('returns null for an unknown whiteboard', async () => {
            await createFixture();

            assert.equal(await service.getTeamId('a'.repeat(24)), null);
        });
    });

    describe('mergeScene', () => {
        it('adds a new element and bumps the revision', async () => {
            const fixture = await createFixture();
            const whiteboard = await seedWhiteboard(fixture);

            const result = await service.mergeScene(whiteboard.id, [{
                id: 'a',
                version: 1
            }], {}, fixture.editor.id);

            assert.equal(result?.changed, true);
            assert.equal(result?.revision, 1);
            assert.deepEqual(result?.delta?.elements, [{
                id: 'a',
                version: 1
            }]);
        });

        it('replaces an element that carries a newer version', async () => {
            const fixture = await createFixture();
            const whiteboard = await seedWhiteboard(fixture);
            await service.mergeScene(whiteboard.id, [{
                id: 'a',
                version: 1
            }], {}, fixture.editor.id);

            const result = await service.mergeScene(whiteboard.id, [{
                id: 'a',
                version: 2
            }], {}, fixture.editor.id);

            assert.equal(result?.changed, true);
            assert.deepEqual((await service.getSnapshot(whiteboard.id))?.elements, [{
                id: 'a',
                version: 2
            }]);
        });

        it('keeps the element when an older version arrives', async () => {
            const fixture = await createFixture();
            const whiteboard = await seedWhiteboard(fixture);
            await service.mergeScene(whiteboard.id, [{
                id: 'a',
                version: 5
            }], {}, fixture.editor.id);

            const result = await service.mergeScene(whiteboard.id, [{
                id: 'a',
                version: 2
            }], {}, fixture.editor.id);

            assert.equal(result?.changed, false);
            assert.deepEqual((await service.getSnapshot(whiteboard.id))?.elements, [{
                id: 'a',
                version: 5
            }]);
        });

        it('reports no change when the very same element arrives twice', async () => {
            const fixture = await createFixture();
            const whiteboard = await seedWhiteboard(fixture);
            await service.mergeScene(whiteboard.id, [{
                id: 'a',
                version: 1
            }], {}, fixture.editor.id);

            const result = await service.mergeScene(whiteboard.id, [{
                id: 'a',
                version: 1
            }], {}, fixture.editor.id);

            assert.equal(result?.changed, false);
            assert.equal(result?.revision, 1);
        });

        it('merges only the changed keys of the application state', async () => {
            const fixture = await createFixture();
            const whiteboard = await seedWhiteboard(fixture);
            await service.mergeScene(whiteboard.id, [], { theme: 'dark' }, fixture.editor.id);

            const result = await service.mergeScene(whiteboard.id, [], {
                theme: 'dark',
                zoom: 2
            }, fixture.editor.id);

            assert.deepEqual(result?.delta?.appState, { zoom: 2 });
            assert.deepEqual((await service.getSnapshot(whiteboard.id))?.appState, {
                theme: 'dark',
                zoom: 2
            });
        });

        it('ignores the elements that carry no id', async () => {
            const fixture = await createFixture();
            const whiteboard = await seedWhiteboard(fixture);

            const result = await service.mergeScene(whiteboard.id, [{ version: 1 }], {}, fixture.editor.id);

            assert.equal(result?.changed, false);
            assert.deepEqual((await service.getSnapshot(whiteboard.id))?.elements, []);
        });

        it('reorders the elements when an explicit order is given', async () => {
            const fixture = await createFixture();
            const whiteboard = await seedWhiteboard(fixture);
            await service.mergeScene(whiteboard.id, [
                { id: 'a' },
                { id: 'b' }
            ], {}, fixture.editor.id);

            const result = await service.mergeScene(whiteboard.id, [], {}, fixture.editor.id, ['b', 'a']);

            assert.deepEqual(result?.delta?.elementOrder, ['b', 'a']);
            assert.deepEqual((await service.getSnapshot(whiteboard.id))?.elements.map((element) => element.id), ['b', 'a']);
        });

        it('returns null for an unknown whiteboard', async () => {
            await createFixture();

            assert.equal(await service.mergeScene('a'.repeat(24), [{ id: 'a' }], {}, 'user'), null);
        });
    });

    describe('flushAndRelease', () => {
        it('writes the merged scene back to the object store', async () => {
            const fixture = await createFixture();
            const whiteboard = await seedWhiteboard(fixture);
            await service.mergeScene(whiteboard.id, [{
                id: 'a',
                version: 1
            }], { theme: 'dark' }, fixture.editor.id);

            await service.flushAndRelease(whiteboard.id);

            assert.equal(puts.length, 1);
            assert.equal(puts[0].teamClusterId, fixture.cluster.id);
            assert.equal(puts[0].objectKey, whiteboard.payloadKey);
            assert.deepEqual(JSON.parse(puts[0].body), {
                revision: 1,
                elements: [{
                    id: 'a',
                    version: 1
                }],
                appState: { theme: 'dark' }
            });
        });

        it('records the last editor on the whiteboard row', async () => {
            const fixture = await createFixture();
            const whiteboard = await seedWhiteboard(fixture);
            await service.mergeScene(whiteboard.id, [{ id: 'a' }], {}, fixture.editor.id);

            await service.flushAndRelease(whiteboard.id);

            assert.equal((await Whiteboard.findOneBy({ id: whiteboard.id }))?.lastEditedBy, fixture.editor.id);
        });

        it('writes nothing when the room saw no change', async () => {
            const fixture = await createFixture();
            const whiteboard = await seedWhiteboard(fixture);
            await service.getSnapshot(whiteboard.id);

            await service.flushAndRelease(whiteboard.id);

            assert.deepEqual(puts, []);
            assert.equal((await Whiteboard.findOneBy({ id: whiteboard.id }))?.lastEditedBy, fixture.owner.id);
        });

        it('reloads the room from the object store after being released', async () => {
            const fixture = await createFixture();
            const whiteboard = await seedWhiteboard(fixture);
            await service.mergeScene(whiteboard.id, [{
                id: 'a',
                version: 1
            }], {}, fixture.editor.id);
            await service.flushAndRelease(whiteboard.id);

            const snapshot = await service.getSnapshot(whiteboard.id);

            assert.equal(snapshot?.revision, 1);
            assert.deepEqual(snapshot?.elements, [{
                id: 'a',
                version: 1
            }]);
        });

        it('resolves for a room that was never loaded', async () => {
            await createFixture();

            await service.flushAndRelease('a'.repeat(24));

            assert.deepEqual(puts, []);
        });
    });
});
