import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import { closeRedisHandles } from '@tests/redis-handles';
import WhiteboardService from '@modules/whiteboards/services/WhiteboardService';
import type { WhiteboardServiceDependencies } from '@modules/whiteboards/services/WhiteboardService';
import Whiteboard from '@modules/whiteboards/models/Whiteboard';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { CatalogFolderKind } from '@shared/domain/catalog/CatalogFolder';
import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { Readable } from 'node:stream';

interface EmittedEvent{
    name: string;
    payload: unknown;
}

interface PutCall{
    teamClusterId: string;
    bucket: string;
    objectKey: string;
    body: string;
}

interface Fixture{
    team: Team;
    otherTeam: Team;
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

const readAll = async (stream: Readable): Promise<string> => {
    const chunks: Buffer[] = [];
    for await (const chunk of stream){
        chunks.push(Buffer.from(chunk as Buffer));
    }
    return Buffer.concat(chunks).toString('utf8');
};

describe('WhiteboardService', () => {
    let dataSource: DataSource;
    let service: WhiteboardService;
    const published: EmittedEvent[] = [];
    const puts: PutCall[] = [];
    const deletedPrefixes: Array<{ teamClusterId: string; bucket: string; prefix: string }> = [];
    const storedObjects = new Map<string, string>();

    let resolvedClusterId: string;
    let deleteByPrefixFailure: Error | null;

    const buildDependencies = (): WhiteboardServiceDependencies => ({
        objectGatewayClient: {
            putBuffer: async (teamClusterId, request) => {
                puts.push({
                    teamClusterId,
                    bucket: request.bucket,
                    objectKey: request.objectKey,
                    body: request.buffer.toString('utf8')
                });
                storedObjects.set(`${request.bucket}/${request.objectKey}`, request.buffer.toString('utf8'));
            },
            exists: async (_teamClusterId, bucket, objectKey) => storedObjects.has(`${bucket}/${objectKey}`),
            getStream: async (_teamClusterId, bucket, objectKey) => ({
                stream: Readable.from(Buffer.from(storedObjects.get(`${bucket}/${objectKey}`) ?? '')),
                contentType: 'application/json'
            }),
            deleteByPrefix: async (teamClusterId, bucket, prefix) => {
                if(deleteByPrefixFailure) throw deleteByPrefixFailure;
                deletedPrefixes.push({
                    teamClusterId,
                    bucket,
                    prefix
                });
                return 0;
            }
        } as WhiteboardServiceDependencies['objectGatewayClient'],
        clusterSelection: { resolveStorageClusterId: async () => resolvedClusterId },
        eventBus: {
            emit: async (name, payload) => {
                published.push({
                    name,
                    payload
                });
            }
        }
    });

    before(async () => {
        dataSource = await createHarness(ENTITIES);
    });

    after(async () => {
        await destroyHarness(dataSource);
        closeRedisHandles();
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
        published.length = 0;
        puts.length = 0;
        deletedPrefixes.length = 0;
        storedObjects.clear();
        resolvedClusterId = '';
        deleteByPrefixFailure = null;
        service = new WhiteboardService(buildDependencies());
    });

    const createFixture = async (): Promise<Fixture> => {
        const owner = await User.create({
            email: 'owner@volt.test',
            firstName: 'ada',
            lastName: 'lovelace',
            avatar: 'avatar.png'
        }).save();
        const editor = await User.create({
            email: 'editor@volt.test',
            firstName: 'grace'
        }).save();
        const team = await Team.create({
            name: 'Team One',
            owner: owner.id
        }).save();
        const otherTeam = await Team.create({
            name: 'Team Two',
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
        resolvedClusterId = cluster.id;

        return {
            team,
            otherTeam,
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

    const seedFolder = (
        fixture: Fixture,
        title: string,
        parent: string | null = null,
        kind = CatalogFolderKind.Whiteboard
    ): Promise<CatalogFolder> => CatalogFolder.create({
        team: fixture.team.id,
        createdBy: fixture.owner.id,
        title,
        parent,
        kind
    }).save();

    describe('createWhiteboard', () => {
        it('persists the whiteboard with the resolved storage cluster and its creator', async () => {
            const fixture = await createFixture();

            const created = await service.createWhiteboard(fixture.team.id, fixture.owner.id, { title: 'Sketch' });

            const stored = await Whiteboard.findOneBy({ id: created._id });
            assert.equal(stored?.title, 'Sketch');
            assert.equal(stored?.team, fixture.team.id);
            assert.equal(stored?.createdBy, fixture.owner.id);
            assert.equal(stored?.lastEditedBy, fixture.owner.id);
            assert.equal(stored?.storageClusterId, fixture.cluster.id);
            assert.equal(stored?.folder, null);
        });

        it('derives the payload key from the team and the whiteboard id', async () => {
            const fixture = await createFixture();

            const created = await service.createWhiteboard(fixture.team.id, fixture.owner.id, { title: 'Sketch' });

            const expectedKey = `${fixture.team.id}/${created._id}/state.json`;
            assert.equal(created.payloadKey, expectedKey);
            assert.equal((await Whiteboard.findOneBy({ id: created._id }))?.payloadKey, expectedKey);
        });

        it('uploads an empty scene next to the new whiteboard', async () => {
            const fixture = await createFixture();

            const created = await service.createWhiteboard(fixture.team.id, fixture.owner.id, { title: 'Sketch' });

            assert.deepEqual(puts, [{
                teamClusterId: fixture.cluster.id,
                bucket: TEAM_CLUSTER_BUCKETS.WHITEBOARDS,
                objectKey: `${fixture.team.id}/${created._id}/state.json`,
                body: JSON.stringify({
                    revision: 0,
                    elements: [],
                    appState: {}
                })
            }]);
        });

        it('publishes the creation event', async () => {
            const fixture = await createFixture();

            const created = await service.createWhiteboard(fixture.team.id, fixture.owner.id, { title: 'Sketch' });

            assert.deepEqual(published, [{
                name: 'whiteboard.created',
                payload: {
                    whiteboardId: created._id,
                    teamId: fixture.team.id,
                    userId: fixture.owner.id,
                    whiteboardTitle: 'Sketch'
                }
            }]);
        });

        it('places the whiteboard inside the requested folder', async () => {
            const fixture = await createFixture();
            const folder = await seedFolder(fixture, 'sketches');

            const created = await service.createWhiteboard(fixture.team.id, fixture.owner.id, {
                title: 'Sketch',
                folderId: folder.id
            });

            assert.equal((await Whiteboard.findOneBy({ id: created._id }))?.folder, folder.id);
        });

        it('rejects a folder of another catalog kind', async () => {
            const fixture = await createFixture();
            const folder = await seedFolder(fixture, 'sketches', null, CatalogFolderKind.Latex);

            await assert.rejects(
                () => service.createWhiteboard(fixture.team.id, fixture.owner.id, {
                    title: 'Sketch',
                    folderId: folder.id
                }),
                isApplicationError('Resource::NotFound', 404)
            );
            assert.equal(await Whiteboard.count(), 0);
        });

        it('rejects a folder of another team', async () => {
            const fixture = await createFixture();
            const folder = await seedFolder(fixture, 'sketches');

            await assert.rejects(
                () => service.createWhiteboard(fixture.otherTeam.id, fixture.owner.id, {
                    title: 'Sketch',
                    folderId: folder.id
                }),
                isApplicationError('Resource::NotFound', 404)
            );
        });
    });

    describe('listWhiteboards', () => {
        it('returns the whiteboards of the team newest updated first', async () => {
            const fixture = await createFixture();
            const older = await seedWhiteboard(fixture, { title: 'older' });
            const newer = await seedWhiteboard(fixture, { title: 'newer' });
            await Whiteboard.update({ id: older.id }, { updatedAt: new Date('2024-01-01T00:00:00.000Z') });
            await Whiteboard.update({ id: newer.id }, { updatedAt: new Date('2024-06-01T00:00:00.000Z') });

            const page = await service.listWhiteboards(fixture.team.id, {});

            assert.deepEqual(page.data.map((item) => item.title), ['newer', 'older']);
        });

        it('defaults to a page of five hundred whiteboards', async () => {
            const fixture = await createFixture();
            await seedWhiteboard(fixture);

            const page = await service.listWhiteboards(fixture.team.id, {});

            assert.equal(page.limit, 500);
            assert.equal(page.page, 1);
            assert.equal(page.total, 1);
            assert.equal(page.totalPages, 1);
        });

        it('caps the requested limit at five hundred', async () => {
            const fixture = await createFixture();

            assert.equal((await service.listWhiteboards(fixture.team.id, { limit: 5000 })).limit, 500);
        });

        it('paginates while reporting the unpaged total', async () => {
            const fixture = await createFixture();
            for(const title of ['a', 'b', 'c']){
                await seedWhiteboard(fixture, { title });
            }

            const page = await service.listWhiteboards(fixture.team.id, {
                page: 2,
                limit: 2
            });

            assert.equal(page.total, 3);
            assert.equal(page.totalPages, 2);
            assert.equal(page.data.length, 1);
        });

        it('excludes the whiteboards of other teams', async () => {
            const fixture = await createFixture();
            await seedWhiteboard(fixture);
            await seedWhiteboard(fixture, { team: fixture.otherTeam.id });

            assert.equal((await service.listWhiteboards(fixture.team.id, {})).total, 1);
        });

        it('lists every folder when no folder filter is given', async () => {
            const fixture = await createFixture();
            const folder = await seedFolder(fixture, 'sketches');
            await seedWhiteboard(fixture, { title: 'at-root' });
            await seedWhiteboard(fixture, {
                title: 'in-folder',
                folder: folder.id
            });

            assert.equal((await service.listWhiteboards(fixture.team.id, {})).total, 2);
        });

        it('filters the whiteboards at the root when the folder is "root"', async () => {
            const fixture = await createFixture();
            const folder = await seedFolder(fixture, 'sketches');
            await seedWhiteboard(fixture, { title: 'at-root' });
            await seedWhiteboard(fixture, {
                title: 'in-folder',
                folder: folder.id
            });

            const page = await service.listWhiteboards(fixture.team.id, { folderId: 'root' });

            assert.equal(page.total, 1);
            assert.equal(page.data[0].title, 'at-root');
        });

        it('filters the whiteboards of an explicit folder', async () => {
            const fixture = await createFixture();
            const folder = await seedFolder(fixture, 'sketches');
            await seedWhiteboard(fixture, { title: 'at-root' });
            await seedWhiteboard(fixture, {
                title: 'in-folder',
                folder: folder.id
            });

            const page = await service.listWhiteboards(fixture.team.id, { folderId: folder.id });

            assert.equal(page.total, 1);
            assert.equal(page.data[0].title, 'in-folder');
        });

        it('expands the last editor into a user projection', async () => {
            const fixture = await createFixture();
            await seedWhiteboard(fixture, { lastEditedBy: fixture.owner.id });

            const page = await service.listWhiteboards(fixture.team.id, {});

            assert.deepEqual(page.data[0].lastEditedBy, {
                _id: fixture.owner.id,
                firstName: 'ada',
                lastName: 'lovelace',
                email: 'owner@volt.test',
                avatar: 'avatar.png'
            });
        });

        it('reports a null last editor when the whiteboard was never edited', async () => {
            const fixture = await createFixture();
            await seedWhiteboard(fixture, { lastEditedBy: null });

            const page = await service.listWhiteboards(fixture.team.id, {});

            assert.equal(page.data[0].lastEditedBy, null);
        });

        it('drops the last editor when the user is deleted', async () => {
            const fixture = await createFixture();
            const whiteboard = await seedWhiteboard(fixture, { lastEditedBy: fixture.editor.id });

            await User.delete({ id: fixture.editor.id });

            const page = await service.listWhiteboards(fixture.team.id, {});
            assert.equal(page.data[0].lastEditedBy, null);
            assert.equal((await Whiteboard.findOneBy({ id: whiteboard.id }))?.lastEditedBy, null);
        });

        it('exposes the whiteboard id as _id and hides the internal thumbnail null', async () => {
            const fixture = await createFixture();
            const whiteboard = await seedWhiteboard(fixture);

            const page = await service.listWhiteboards(fixture.team.id, {});

            assert.equal(page.data[0]._id, whiteboard.id);
            assert.equal(page.data[0].thumbnailKey, undefined);
        });
    });

    describe('getWhiteboard', () => {
        it('returns the whiteboard of the team', async () => {
            const fixture = await createFixture();
            const whiteboard = await seedWhiteboard(fixture);

            const view = await service.getWhiteboard(fixture.team.id, whiteboard.id);

            assert.equal(view._id, whiteboard.id);
            assert.equal(view.title, 'Board');
            assert.equal(view.payloadKey, whiteboard.payloadKey);
        });

        it('rejects a whiteboard of another team', async () => {
            const fixture = await createFixture();
            const whiteboard = await seedWhiteboard(fixture);

            await assert.rejects(
                () => service.getWhiteboard(fixture.otherTeam.id, whiteboard.id),
                isApplicationError('Resource::NotFound', 404)
            );
        });

        it('rejects an unknown whiteboard', async () => {
            const fixture = await createFixture();

            await assert.rejects(
                () => service.getWhiteboard(fixture.team.id, 'a'.repeat(24)),
                isApplicationError('Resource::NotFound', 404)
            );
        });
    });

    describe('updateWhiteboard', () => {
        it('renames the whiteboard and records the editor', async () => {
            const fixture = await createFixture();
            const whiteboard = await seedWhiteboard(fixture);

            const view = await service.updateWhiteboard(fixture.team.id, whiteboard.id, fixture.editor.id, { title: 'Renamed' });

            assert.equal(view.title, 'Renamed');
            const stored = await Whiteboard.findOneBy({ id: whiteboard.id });
            assert.equal(stored?.title, 'Renamed');
            assert.equal(stored?.lastEditedBy, fixture.editor.id);
        });

        it('records the editor even when no title is given', async () => {
            const fixture = await createFixture();
            const whiteboard = await seedWhiteboard(fixture);

            await service.updateWhiteboard(fixture.team.id, whiteboard.id, fixture.editor.id, {});

            const stored = await Whiteboard.findOneBy({ id: whiteboard.id });
            assert.equal(stored?.title, 'Board');
            assert.equal(stored?.lastEditedBy, fixture.editor.id);
        });

        it('rejects a whiteboard of another team', async () => {
            const fixture = await createFixture();
            const whiteboard = await seedWhiteboard(fixture);

            await assert.rejects(
                () => service.updateWhiteboard(fixture.otherTeam.id, whiteboard.id, fixture.editor.id, { title: 'Renamed' }),
                isApplicationError('Resource::NotFound', 404)
            );
        });
    });

    describe('deleteWhiteboard', () => {
        it('removes the row and the stored objects of the whiteboard', async () => {
            const fixture = await createFixture();
            const whiteboard = await seedWhiteboard(fixture);

            assert.equal(await service.deleteWhiteboard(fixture.team.id, whiteboard.id, fixture.owner.id), null);
            assert.equal(await Whiteboard.countBy({ id: whiteboard.id }), 0);
            assert.deepEqual(deletedPrefixes, [{
                teamClusterId: fixture.cluster.id,
                bucket: TEAM_CLUSTER_BUCKETS.WHITEBOARDS,
                prefix: `${fixture.team.id}/${whiteboard.id}/`
            }]);
        });

        it('publishes the deletion event', async () => {
            const fixture = await createFixture();
            const whiteboard = await seedWhiteboard(fixture);

            await service.deleteWhiteboard(fixture.team.id, whiteboard.id, fixture.owner.id);

            assert.deepEqual(published, [{
                name: 'whiteboard.deleted',
                payload: {
                    whiteboardId: whiteboard.id,
                    teamId: fixture.team.id,
                    userId: fixture.owner.id,
                    whiteboardTitle: 'Board'
                }
            }]);
        });

        it('still deletes the row when the object storage rejects the cleanup', async () => {
            const fixture = await createFixture();
            const whiteboard = await seedWhiteboard(fixture);
            deleteByPrefixFailure = new Error('gateway down');

            await service.deleteWhiteboard(fixture.team.id, whiteboard.id, fixture.owner.id);

            assert.equal(await Whiteboard.countBy({ id: whiteboard.id }), 0);
            assert.deepEqual(published.map((event) => event.name), ['whiteboard.deleted']);
        });

        it('rejects a whiteboard without a storage cluster', async () => {
            const fixture = await createFixture();
            const whiteboard = await seedWhiteboard(fixture, { storageClusterId: null });

            await assert.rejects(
                () => service.deleteWhiteboard(fixture.team.id, whiteboard.id, fixture.owner.id),
                isApplicationError('Whiteboard::StorageClusterRequired', 409)
            );
        });

        it('rejects a whiteboard of another team', async () => {
            const fixture = await createFixture();
            const whiteboard = await seedWhiteboard(fixture);

            await assert.rejects(
                () => service.deleteWhiteboard(fixture.otherTeam.id, whiteboard.id, fixture.owner.id),
                isApplicationError('Resource::NotFound', 404)
            );
            assert.equal(await Whiteboard.countBy({ id: whiteboard.id }), 1);
        });
    });

    describe('moveWhiteboard', () => {
        it('moves a whiteboard into a folder', async () => {
            const fixture = await createFixture();
            const whiteboard = await seedWhiteboard(fixture);
            const folder = await seedFolder(fixture, 'sketches');

            assert.equal(await service.moveWhiteboard(fixture.team.id, whiteboard.id, folder.id), null);
            assert.equal((await Whiteboard.findOneBy({ id: whiteboard.id }))?.folder, folder.id);
        });

        it('moves a whiteboard back to the root', async () => {
            const fixture = await createFixture();
            const folder = await seedFolder(fixture, 'sketches');
            const whiteboard = await seedWhiteboard(fixture, { folder: folder.id });

            await service.moveWhiteboard(fixture.team.id, whiteboard.id, null);

            assert.equal((await Whiteboard.findOneBy({ id: whiteboard.id }))?.folder, null);
        });

        it('rejects a whiteboard of another team', async () => {
            const fixture = await createFixture();
            const whiteboard = await seedWhiteboard(fixture);

            await assert.rejects(
                () => service.moveWhiteboard(fixture.otherTeam.id, whiteboard.id, null),
                isApplicationError('Resource::NotFound', 404)
            );
        });

        it('rejects an unknown target folder', async () => {
            const fixture = await createFixture();
            const whiteboard = await seedWhiteboard(fixture);

            await assert.rejects(
                () => service.moveWhiteboard(fixture.team.id, whiteboard.id, 'a'.repeat(24)),
                isApplicationError('Resource::NotFound', 404)
            );
        });
    });

    describe('whiteboard state', () => {
        it('streams the stored scene', async () => {
            const fixture = await createFixture();
            const whiteboard = await seedWhiteboard(fixture);
            storedObjects.set(`${TEAM_CLUSTER_BUCKETS.WHITEBOARDS}/${whiteboard.payloadKey}`, '{"revision":7}');

            const { stream } = await service.getWhiteboardState(fixture.team.id, whiteboard.id);

            assert.equal(await readAll(stream), '{"revision":7}');
        });

        it('falls back to an empty scene when the object is missing', async () => {
            const fixture = await createFixture();
            const whiteboard = await seedWhiteboard(fixture);

            const { stream } = await service.getWhiteboardState(fixture.team.id, whiteboard.id);

            assert.deepEqual(JSON.parse(await readAll(stream)), {
                revision: 0,
                elements: [],
                appState: {}
            });
        });

        it('rejects reading the state of a whiteboard without a payload key', async () => {
            const fixture = await createFixture();
            const whiteboard = await seedWhiteboard(fixture, { payloadKey: '' });

            await assert.rejects(
                () => service.getWhiteboardState(fixture.team.id, whiteboard.id),
                isApplicationError('Whiteboard::PayloadKeyRequired', 409)
            );
        });

        it('rejects reading the state of a whiteboard without a storage cluster', async () => {
            const fixture = await createFixture();
            const whiteboard = await seedWhiteboard(fixture, { storageClusterId: null });

            await assert.rejects(
                () => service.getWhiteboardState(fixture.team.id, whiteboard.id),
                isApplicationError('Whiteboard::StorageClusterRequired', 409)
            );
        });

        it('uploads the new scene and records the editor', async () => {
            const fixture = await createFixture();
            const whiteboard = await seedWhiteboard(fixture);

            assert.equal(
                await service.saveWhiteboardState(fixture.team.id, whiteboard.id, fixture.editor.id, Buffer.from('{"revision":3}')),
                null
            );
            assert.deepEqual(puts, [{
                teamClusterId: fixture.cluster.id,
                bucket: TEAM_CLUSTER_BUCKETS.WHITEBOARDS,
                objectKey: whiteboard.payloadKey,
                body: '{"revision":3}'
            }]);
            assert.equal((await Whiteboard.findOneBy({ id: whiteboard.id }))?.lastEditedBy, fixture.editor.id);
        });

        it('rejects saving the state of a whiteboard without a payload key', async () => {
            const fixture = await createFixture();
            const whiteboard = await seedWhiteboard(fixture, { payloadKey: '' });

            await assert.rejects(
                () => service.saveWhiteboardState(fixture.team.id, whiteboard.id, fixture.editor.id, Buffer.from('{}')),
                isApplicationError('Whiteboard::PayloadKeyRequired', 409)
            );
        });
    });

    describe('assets', () => {
        it('signs an upload url scoped to the whiteboard', async () => {
            const fixture = await createFixture();
            const whiteboard = await seedWhiteboard(fixture);

            const upload = await service.uploadWhiteboardAsset(fixture.team.id, whiteboard.id, fixture.owner.id, {
                fileName: 'diagram.png',
                size: 1024,
                type: 'image/png'
            });

            assert.match(upload.assetId, /^[0-9a-f-]{36}$/);
            assert.match(upload.uploadUrl, new RegExp(`^/api/teams/${fixture.team.id}/cluster-objects/`));
            assert.ok(Date.parse(upload.expiresAt) > Date.now());
        });

        it('rejects signing an upload for a whiteboard of another team', async () => {
            const fixture = await createFixture();
            const whiteboard = await seedWhiteboard(fixture);

            await assert.rejects(
                () => service.uploadWhiteboardAsset(fixture.otherTeam.id, whiteboard.id, fixture.owner.id, {
                    fileName: 'diagram.png',
                    size: 1024
                }),
                isApplicationError('Resource::NotFound', 404)
            );
        });

        it('streams an asset from the whiteboard scope', async () => {
            const fixture = await createFixture();
            const whiteboard = await seedWhiteboard(fixture);
            storedObjects.set(
                `${TEAM_CLUSTER_BUCKETS.WHITEBOARDS}/${fixture.team.id}/${whiteboard.id}/assets/asset-1`,
                'asset bytes'
            );

            const asset = await service.getWhiteboardAsset(fixture.team.id, whiteboard.id, 'asset-1');

            assert.equal(await readAll(asset.stream), 'asset bytes');
            assert.equal(asset.mimetype, 'application/json');
        });

        it('rejects reading an asset of a whiteboard without a storage cluster', async () => {
            const fixture = await createFixture();
            const whiteboard = await seedWhiteboard(fixture, { storageClusterId: null });

            await assert.rejects(
                () => service.getWhiteboardAsset(fixture.team.id, whiteboard.id, 'asset-1'),
                isApplicationError('Whiteboard::StorageClusterRequired', 409)
            );
        });
    });

    describe('folders', () => {
        it('lists the root folders newest first with the default limit of five hundred', async () => {
            const fixture = await createFixture();
            const root = await seedFolder(fixture, 'root-one');
            await seedFolder(fixture, 'child', root.id);

            const page = await service.listFolders(fixture.team.id, {});

            assert.equal(page.total, 1);
            assert.equal(page.limit, 500);
            assert.equal(page.data[0].title, 'root-one');
            assert.equal(page.data[0].parent, null);
        });

        it('caps the requested folder limit at five hundred', async () => {
            const fixture = await createFixture();

            assert.equal((await service.listFolders(fixture.team.id, { limit: 5000 })).limit, 500);
        });

        it('lists the children of a folder', async () => {
            const fixture = await createFixture();
            const root = await seedFolder(fixture, 'root-one');
            await seedFolder(fixture, 'child', root.id);

            const page = await service.listFolders(fixture.team.id, { parentId: root.id });

            assert.equal(page.total, 1);
            assert.equal(page.data[0].title, 'child');
        });

        it('excludes the folders of another catalog kind', async () => {
            const fixture = await createFixture();
            await seedFolder(fixture, 'boards');
            await seedFolder(fixture, 'papers', null, CatalogFolderKind.Latex);

            const page = await service.listFolders(fixture.team.id, {});

            assert.equal(page.total, 1);
            assert.equal(page.data[0].title, 'boards');
        });

        it('paginates the folder listing', async () => {
            const fixture = await createFixture();
            await seedFolder(fixture, 'one');
            await seedFolder(fixture, 'two');

            const page = await service.listFolders(fixture.team.id, {
                page: 2,
                limit: 1
            });

            assert.equal(page.total, 2);
            assert.equal(page.totalPages, 2);
            assert.equal(page.data.length, 1);
        });

        it('creates a folder tagged with the whiteboard kind', async () => {
            const fixture = await createFixture();

            const folder = await service.createFolder(fixture.team.id, fixture.owner.id, { title: 'created' });

            const stored = await CatalogFolder.findOneBy({ id: folder._id });
            assert.equal(stored?.kind, CatalogFolderKind.Whiteboard);
            assert.equal(stored?.team, fixture.team.id);
            assert.equal(stored?.createdBy, fixture.owner.id);
            assert.equal(stored?.parent, null);
        });

        it('creates a nested folder', async () => {
            const fixture = await createFixture();
            const parent = await seedFolder(fixture, 'parent');

            const folder = await service.createFolder(fixture.team.id, fixture.owner.id, {
                title: 'nested',
                parentId: parent.id
            });

            assert.equal(folder.parent, parent.id);
        });

        it('reads a single folder', async () => {
            const fixture = await createFixture();
            const folder = await seedFolder(fixture, 'readable');

            assert.equal((await service.getFolder(fixture.team.id, folder.id))._id, folder.id);
        });

        it('rejects reading a folder of another team', async () => {
            const fixture = await createFixture();
            const folder = await seedFolder(fixture, 'readable');

            await assert.rejects(
                () => service.getFolder(fixture.otherTeam.id, folder.id),
                isApplicationError('Resource::NotFound', 404)
            );
        });

        it('renames a folder', async () => {
            const fixture = await createFixture();
            const folder = await seedFolder(fixture, 'before');

            assert.equal((await service.updateFolder(fixture.team.id, folder.id, { title: 'after' })).title, 'after');
            assert.equal((await CatalogFolder.findOneBy({ id: folder.id }))?.title, 'after');
        });

        it('rejects renaming an unknown folder', async () => {
            const fixture = await createFixture();

            await assert.rejects(
                () => service.updateFolder(fixture.team.id, 'a'.repeat(24), { title: 'after' }),
                isApplicationError('Resource::NotFound', 404)
            );
        });

        it('deletes a folder tree including its subfolders', async () => {
            const fixture = await createFixture();
            const root = await seedFolder(fixture, 'root-one');
            const child = await seedFolder(fixture, 'child', root.id);
            const survivor = await seedFolder(fixture, 'survivor');

            assert.equal(await service.deleteFolder(fixture.team.id, root.id, fixture.owner.id), null);
            assert.equal(await CatalogFolder.countBy({ id: root.id }), 0);
            assert.equal(await CatalogFolder.countBy({ id: child.id }), 0);
            assert.equal(await CatalogFolder.countBy({ id: survivor.id }), 1);
        });

        it('deletes the whiteboards stored inside the folder tree', async () => {
            const fixture = await createFixture();
            const root = await seedFolder(fixture, 'root-one');
            const child = await seedFolder(fixture, 'child', root.id);
            const doomed = await seedWhiteboard(fixture, { folder: root.id });
            const nested = await seedWhiteboard(fixture, { folder: child.id });
            const survivor = await seedWhiteboard(fixture);

            await service.deleteFolder(fixture.team.id, root.id, fixture.owner.id);

            assert.equal(await Whiteboard.countBy({ id: doomed.id }), 0);
            assert.equal(await Whiteboard.countBy({ id: nested.id }), 0);
            assert.equal(await Whiteboard.countBy({ id: survivor.id }), 1);
            assert.equal(published.filter((event) => event.name === 'whiteboard.deleted').length, 2);
        });

        it('rejects deleting an unknown folder', async () => {
            const fixture = await createFixture();

            await assert.rejects(
                () => service.deleteFolder(fixture.team.id, 'a'.repeat(24), fixture.owner.id),
                isApplicationError('Resource::NotFound', 404)
            );
        });

        it('detaches the whiteboards of a folder removed straight from the database', async () => {
            const fixture = await createFixture();
            const folder = await seedFolder(fixture, 'sketches');
            const whiteboard = await seedWhiteboard(fixture, { folder: folder.id });

            await CatalogFolder.delete({ id: folder.id });

            assert.equal((await Whiteboard.findOneBy({ id: whiteboard.id }))?.folder, null);
        });
    });

    describe('team deletion cascade', () => {
        it('removes the whiteboards of a deleted team', async () => {
            const fixture = await createFixture();
            const whiteboard = await seedWhiteboard(fixture);

            await Team.delete({ id: fixture.team.id });

            assert.equal(await Whiteboard.countBy({ id: whiteboard.id }), 0);
        });
    });
});
