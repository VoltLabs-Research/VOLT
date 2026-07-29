import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import { closeRedisHandles } from '@tests/redis-handles';
import eventBus from '@shared/infrastructure/events/RedisEventBus';
import objectGatewayClient from '@modules/cluster/services/TeamClusterObjectGatewayClient';
import teamClusterDaemonClient from '@modules/cluster/services/TeamClusterDaemonClient';
import teamClusterSelectionService from '@modules/container/services/TeamClusterSelectionService';
import LatexService from '@modules/latex/services/LatexService';
import LatexDocument from '@modules/latex/models/LatexDocument';
import LatexFile from '@modules/latex/models/LatexFile';
import LatexAsset from '@modules/latex/models/LatexAsset';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { CatalogFolderKind } from '@shared/domain/catalog/CatalogFolder';
import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { getDocumentCompileWorkDirSegment } from '@modules/latex/services/LatexCompiler';
import tempFileService from '@shared/infrastructure/services/TempFileService';
import archiver from 'archiver';
import fs from 'node:fs/promises';
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

interface DaemonCall{
    teamClusterId: string;
    command: string;
    payload: unknown;
}

interface Fixture{
    team: Team;
    otherTeam: Team;
    owner: User;
    editor: User;
    cluster: TeamCluster;
}

const ENTITIES = [LatexDocument, LatexFile, LatexAsset, TeamCluster, CatalogFolder, Team, User];


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

const uploadedFile = (
    originalname: string,
    content: string | Buffer,
    mimetype = 'application/octet-stream'
): Express.Multer.File => {
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
    return {
        originalname,
        mimetype,
        buffer,
        size: buffer.byteLength
    } as unknown as Express.Multer.File;
};

const zipBuffer = async (entries: Array<{ name: string; content: string }>): Promise<Buffer> => {
    const archive = archiver('zip', { zlib: { level: 0 } });
    const chunks: Buffer[] = [];
    archive.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
    });
    const closed = new Promise<void>((resolve, reject) => {
        archive.on('end', () => resolve());
        archive.on('error', reject);
    });

    for(const entry of entries){
        archive.append(entry.content, { name: entry.name });
    }
    await archive.finalize();
    await closed;

    return Buffer.concat(chunks);
};


describe('LatexService', () => {
    let dataSource: DataSource;
    const service = new LatexService();
    const published: EmittedEvent[] = [];
    const puts: PutCall[] = [];
    const daemonCalls: DaemonCall[] = [];
    const deletedObjects: Array<{ bucket: string; objectKey: string }> = [];
    const storedObjects = new Map<string, string>();

    let resolvedClusterId: string;
    let deleteObjectFailure: ApplicationError | Error | null;
    const compileWorkDirs: string[] = [];

    before(async () => {
        dataSource = await createHarness(ENTITIES);

        eventBus.emit = async (name, payload) => {
            published.push({
                name,
                payload
            });
        };
        teamClusterSelectionService.resolveStorageClusterId = async () => resolvedClusterId;
        objectGatewayClient.putBuffer = async (teamClusterId, request) => {
            puts.push({
                teamClusterId,
                bucket: request.bucket,
                objectKey: request.objectKey,
                body: request.buffer.toString('utf8')
            });
            storedObjects.set(`${request.bucket}/${request.objectKey}`, request.buffer.toString('utf8'));
        };
        objectGatewayClient.getStream = (async (_teamClusterId: string, bucket: string, objectKey: string) => {
            const body = storedObjects.get(`${bucket}/${objectKey}`);
            if(body === undefined){
                throw ApplicationError.notFound('Object::NotFound', 'missing object');
            }
            return {
                stream: Readable.from(Buffer.from(body)),
                contentType: 'application/octet-stream',
                contentLength: Buffer.byteLength(body)
            };
        }) as typeof objectGatewayClient.getStream;
        objectGatewayClient.deleteObject = async (_teamClusterId, bucket, objectKey) => {
            if(deleteObjectFailure) throw deleteObjectFailure;
            deletedObjects.push({
                bucket,
                objectKey
            });
            storedObjects.delete(`${bucket}/${objectKey}`);
        };

        teamClusterDaemonClient.command = (async (teamClusterId: string, command: string, payload: unknown) => {
            daemonCalls.push({
                teamClusterId,
                command,
                payload
            });
            const output = (payload as { output?: { bucket: string; objectKey: string } } | undefined)?.output;
            if(output){
                storedObjects.set(`${output.bucket}/${output.objectKey}`, 'archive bytes');
            }
            return { queued: true };
        }) as typeof teamClusterDaemonClient.command;
    });

    after(async () => {
        await destroyHarness(dataSource);
        closeRedisHandles();
        for(const workDir of compileWorkDirs){
            await fs.rm(workDir, {
                recursive: true,
                force: true
            });
        }
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
        published.length = 0;
        puts.length = 0;
        daemonCalls.length = 0;
        deletedObjects.length = 0;
        storedObjects.clear();
        resolvedClusterId = '';
        deleteObjectFailure = null;
    });

    const createFixture = async (): Promise<Fixture> => {
        const owner = await User.create({
            email: 'owner@volt.test',
            firstName: 'ada',
            lastName: 'lovelace'
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


    const seedDocument = (
        fixture: Fixture,
        overrides: Partial<LatexDocument> = {}
    ): Promise<LatexDocument> => LatexDocument.create({
        team: fixture.team.id,
        title: 'Paper',
        storageClusterId: fixture.cluster.id,
        createdBy: fixture.owner.id,
        lastEditedBy: fixture.owner.id,
        folder: null,
        ...overrides
    }).save();

    const seedFile = (
        fixture: Fixture,
        documentId: string,
        name: string,
        overrides: Partial<LatexFile> = {}
    ): Promise<LatexFile> => LatexFile.create({
        document: documentId,
        team: fixture.team.id,
        name,
        path: '',
        content: `% ${name}`,
        isEntrypoint: false,
        createdBy: fixture.owner.id,
        ...overrides
    }).save();

    const seedAsset = (
        fixture: Fixture,
        documentId: string,
        originalName: string,
        overrides: Partial<LatexAsset> = {}
    ): Promise<LatexAsset> => LatexAsset.create({
        team: fixture.team.id,
        document: documentId,
        originalName,
        path: originalName,
        storageKey: `latex-assets/${fixture.team.id}/${documentId}/${originalName}`,
        url: 'url',
        mimetype: 'application/octet-stream',
        size: 4,
        createdBy: fixture.owner.id,
        ...overrides
    }).save();

    const seedFolder = (
        fixture: Fixture,
        title: string,
        parent: string | null = null,
        kind = CatalogFolderKind.Latex
    ): Promise<CatalogFolder> => CatalogFolder.create({
        team: fixture.team.id,
        createdBy: fixture.owner.id,
        title,
        parent,
        kind
    }).save();


    describe('listDocuments', () => {
        it('returns the documents of the team newest updated first', async () => {
            const fixture = await createFixture();
            const older = await seedDocument(fixture, { title: 'older' });
            const newer = await seedDocument(fixture, { title: 'newer' });
            await LatexDocument.update({ id: older.id }, { updatedAt: new Date('2024-01-01T00:00:00.000Z') });
            await LatexDocument.update({ id: newer.id }, { updatedAt: new Date('2024-06-01T00:00:00.000Z') });

            const page = await service.listDocuments({ teamId: fixture.team.id });

            assert.deepEqual(page.data.map((item) => item.title), ['newer', 'older']);
        });

        it('defaults to a page of five hundred documents', async () => {
            const fixture = await createFixture();
            await seedDocument(fixture);

            const page = await service.listDocuments({ teamId: fixture.team.id });

            assert.equal(page.limit, 500);
            assert.equal(page.page, 1);
            assert.equal(page.total, 1);
            assert.equal(page.totalPages, 1);
        });

        it('caps the requested limit at five hundred', async () => {
            const fixture = await createFixture();

            assert.equal((await service.listDocuments({
                teamId: fixture.team.id,
                limit: 5000
            })).limit, 500);
        });

        it('paginates while reporting the unpaged total', async () => {
            const fixture = await createFixture();
            for(const title of ['a', 'b', 'c']){
                await seedDocument(fixture, { title });
            }

            const page = await service.listDocuments({
                teamId: fixture.team.id,
                page: 2,
                limit: 2
            });

            assert.equal(page.total, 3);
            assert.equal(page.totalPages, 2);
            assert.equal(page.data.length, 1);
        });


        it('excludes the documents of other teams', async () => {
            const fixture = await createFixture();
            await seedDocument(fixture);
            await seedDocument(fixture, { team: fixture.otherTeam.id });

            assert.equal((await service.listDocuments({ teamId: fixture.team.id })).total, 1);
        });

        it('searches the title case insensitively', async () => {
            const fixture = await createFixture();
            await seedDocument(fixture, { title: 'Thermal Report' });
            await seedDocument(fixture, { title: 'lattice notes' });

            const page = await service.listDocuments({
                teamId: fixture.team.id,
                search: 'thermal'
            });

            assert.equal(page.total, 1);
            assert.equal(page.data[0].title, 'Thermal Report');
        });

        it('does not let a percent sign in the search match every document', async () => {
            const fixture = await createFixture();
            await seedDocument(fixture, { title: '100% coverage' });
            await seedDocument(fixture, { title: 'lattice notes' });

            const page = await service.listDocuments({
                teamId: fixture.team.id,
                search: '%'
            });

            assert.equal(page.data.some((item) => item.title === 'lattice notes'), false);
        });

        it('does not let an underscore in the search match any single character', async () => {
            const fixture = await createFixture();
            await seedDocument(fixture, { title: 'my_paper' });
            await seedDocument(fixture, { title: 'myXpaper' });

            const page = await service.listDocuments({
                teamId: fixture.team.id,
                search: 'my_paper'
            });

            assert.equal(page.data.some((item) => item.title === 'myXpaper'), false);
        });


        it('lists every folder when no folder filter is given', async () => {
            const fixture = await createFixture();
            const folder = await seedFolder(fixture, 'papers');
            await seedDocument(fixture, { title: 'at-root' });
            await seedDocument(fixture, {
                title: 'in-folder',
                folder: folder.id
            });

            assert.equal((await service.listDocuments({ teamId: fixture.team.id })).total, 2);
        });

        it('filters the documents at the root when the folder is "root"', async () => {
            const fixture = await createFixture();
            const folder = await seedFolder(fixture, 'papers');
            await seedDocument(fixture, { title: 'at-root' });
            await seedDocument(fixture, {
                title: 'in-folder',
                folder: folder.id
            });

            const page = await service.listDocuments({
                teamId: fixture.team.id,
                folderId: 'root'
            });

            assert.equal(page.total, 1);
            assert.equal(page.data[0].title, 'at-root');
        });

        it('filters the documents of an explicit folder', async () => {
            const fixture = await createFixture();
            const folder = await seedFolder(fixture, 'papers');
            await seedDocument(fixture, { title: 'at-root' });
            await seedDocument(fixture, {
                title: 'in-folder',
                folder: folder.id
            });

            const page = await service.listDocuments({
                teamId: fixture.team.id,
                folderId: folder.id
            });

            assert.equal(page.total, 1);
            assert.equal(page.data[0].title, 'in-folder');
        });


        it('expands the creator and the last editor into user objects', async () => {
            const fixture = await createFixture();
            await seedDocument(fixture, { lastEditedBy: fixture.editor.id });

            const page = await service.listDocuments({ teamId: fixture.team.id });
            const record = page.data[0] as unknown as {
                createdBy: { id: string; email: string; password?: string };
                lastEditedBy: { id: string; email: string };
            };

            assert.equal(record.createdBy.id, fixture.owner.id);
            assert.equal(record.createdBy.email, 'owner@volt.test');
            assert.equal(record.lastEditedBy.id, fixture.editor.id);
            assert.equal(record.createdBy.password, undefined);
        });

        it('keeps the last editor as a null when the document was never edited', async () => {
            const fixture = await createFixture();
            await seedDocument(fixture, { lastEditedBy: null });

            const page = await service.listDocuments({ teamId: fixture.team.id });

            assert.equal((page.data[0] as unknown as { lastEditedBy: unknown }).lastEditedBy, null);
        });

        it('exposes the document id as _id', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);

            const page = await service.listDocuments({ teamId: fixture.team.id });

            assert.equal(page.data[0]._id, document.id);
        });
    });


    describe('createDocument', () => {
        it('persists the document with the resolved storage cluster and its creator', async () => {
            const fixture = await createFixture();

            const document = await service.createDocument({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                title: 'Thermal Report'
            });

            const stored = await LatexDocument.findOneBy({ id: document._id });
            assert.equal(stored?.title, 'Thermal Report');
            assert.equal(stored?.team, fixture.team.id);
            assert.equal(stored?.storageClusterId, fixture.cluster.id);
            assert.equal(stored?.createdBy, fixture.owner.id);
            assert.equal(stored?.lastEditedBy, fixture.owner.id);
            assert.equal(stored?.folder, null);
        });

        it('trims the title before persisting it', async () => {
            const fixture = await createFixture();

            const document = await service.createDocument({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                title: '   Padded   '
            });

            assert.equal((await LatexDocument.findOneBy({ id: document._id }))?.title, 'Padded');
        });

        it('rejects a title that is only whitespace', async () => {
            const fixture = await createFixture();

            await assert.rejects(
                () => service.createDocument({
                    teamId: fixture.team.id,
                    userId: fixture.owner.id,
                    title: '   '
                }),
                isApplicationError('Validation::InvalidInput', 400)
            );
            assert.equal(await LatexDocument.count(), 0);
        });

        it('publishes the creation event', async () => {
            const fixture = await createFixture();

            const document = await service.createDocument({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                title: 'Paper'
            });

            assert.deepEqual(published, [{
                name: 'latex-document.created',
                payload: {
                    documentId: document._id,
                    teamId: fixture.team.id,
                    userId: fixture.owner.id,
                    documentTitle: 'Paper'
                }
            }]);
        });


        it('places the document inside the requested folder', async () => {
            const fixture = await createFixture();
            const folder = await seedFolder(fixture, 'papers');

            const document = await service.createDocument({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                title: 'Paper',
                folderId: folder.id
            });

            assert.equal((await LatexDocument.findOneBy({ id: document._id }))?.folder, folder.id);
        });

        it('rejects a folder of another catalog kind', async () => {
            const fixture = await createFixture();
            const folder = await seedFolder(fixture, 'papers', null, CatalogFolderKind.Whiteboard);

            await assert.rejects(
                () => service.createDocument({
                    teamId: fixture.team.id,
                    userId: fixture.owner.id,
                    title: 'Paper',
                    folderId: folder.id
                }),
                isApplicationError('Resource::NotFound', 404)
            );
        });

        it('rejects a folder of another team', async () => {
            const fixture = await createFixture();
            const folder = await seedFolder(fixture, 'papers');

            await assert.rejects(
                () => service.createDocument({
                    teamId: fixture.otherTeam.id,
                    userId: fixture.owner.id,
                    title: 'Paper',
                    folderId: folder.id
                }),
                isApplicationError('Resource::NotFound', 404)
            );
        });
    });


    describe('getDocument', () => {
        it('returns the document of the team', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);

            const view = await service.getDocument({
                teamId: fixture.team.id,
                documentId: document.id
            });

            assert.equal(view._id, document.id);
            assert.equal(view.title, 'Paper');
        });

        it('rejects a document of another team', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);

            await assert.rejects(
                () => service.getDocument({
                    teamId: fixture.otherTeam.id,
                    documentId: document.id
                }),
                isApplicationError('Resource::NotFound', 404)
            );
        });

        it('rejects an unknown document', async () => {
            const fixture = await createFixture();

            await assert.rejects(
                () => service.getDocument({
                    teamId: fixture.team.id,
                    documentId: 'a'.repeat(24)
                }),
                isApplicationError('Resource::NotFound', 404)
            );
        });
    });


    describe('updateDocument', () => {
        it('renames the document and records the editor', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);

            const view = await service.updateDocument({
                teamId: fixture.team.id,
                documentId: document.id,
                userId: fixture.editor.id,
                title: '  Renamed  '
            });

            assert.equal(view.title, 'Renamed');
            const stored = await LatexDocument.findOneBy({ id: document.id });
            assert.equal(stored?.title, 'Renamed');
            assert.equal(stored?.lastEditedBy, fixture.editor.id);
        });

        it('keeps the current editor when the input carries no user', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);

            await service.updateDocument({
                teamId: fixture.team.id,
                documentId: document.id,
                title: 'Renamed'
            });

            assert.equal((await LatexDocument.findOneBy({ id: document.id }))?.lastEditedBy, fixture.owner.id);
        });

        it('keeps the title when the input carries none', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);

            await service.updateDocument({
                teamId: fixture.team.id,
                documentId: document.id,
                userId: fixture.editor.id
            });

            assert.equal((await LatexDocument.findOneBy({ id: document.id }))?.title, 'Paper');
        });

        it('rejects a document of another team', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);

            await assert.rejects(
                () => service.updateDocument({
                    teamId: fixture.otherTeam.id,
                    documentId: document.id,
                    title: 'Renamed'
                }),
                isApplicationError('Resource::NotFound', 404)
            );
        });
    });


    describe('deleteDocument', () => {
        it('removes the document row', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);

            await service.deleteDocument({
                teamId: fixture.team.id,
                documentId: document.id,
                userId: fixture.owner.id
            });

            assert.equal(await LatexDocument.countBy({ id: document.id }), 0);
        });

        it('cascades to the files and the assets of the document', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);
            const survivorDocument = await seedDocument(fixture, { title: 'survivor' });
            await seedFile(fixture, document.id, 'main.tex', { isEntrypoint: true });
            await seedAsset(fixture, document.id, 'plot.png');
            const survivorFile = await seedFile(fixture, survivorDocument.id, 'main.tex', { isEntrypoint: true });

            await service.deleteDocument({
                teamId: fixture.team.id,
                documentId: document.id,
                userId: fixture.owner.id
            });

            assert.equal(await LatexFile.countBy({ document: document.id }), 0);
            assert.equal(await LatexAsset.countBy({ document: document.id }), 0);
            assert.equal(await LatexFile.countBy({ id: survivorFile.id }), 1);
        });

        it('publishes the deletion event carrying the storage cluster', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);

            await service.deleteDocument({
                teamId: fixture.team.id,
                documentId: document.id,
                userId: fixture.owner.id
            });

            assert.deepEqual(published, [{
                name: 'latex-document.deleted',
                payload: {
                    documentId: document.id,
                    teamId: fixture.team.id,
                    storageClusterId: fixture.cluster.id,
                    userId: fixture.owner.id,
                    documentTitle: 'Paper'
                }
            }]);
        });


        it('reports a missing user as an empty string on the event', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);

            await service.deleteDocument({
                teamId: fixture.team.id,
                documentId: document.id
            });

            assert.equal((published[0].payload as { userId: string }).userId, '');
        });

        it('rejects a document of another team', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);

            await assert.rejects(
                () => service.deleteDocument({
                    teamId: fixture.otherTeam.id,
                    documentId: document.id
                }),
                isApplicationError('Resource::NotFound', 404)
            );
            assert.equal(await LatexDocument.countBy({ id: document.id }), 1);
        });
    });

    describe('moveDocument', () => {
        it('moves a document into a folder', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);
            const folder = await seedFolder(fixture, 'papers');

            assert.equal(await service.moveDocument({
                teamId: fixture.team.id,
                documentId: document.id,
                folderId: folder.id
            }), null);
            assert.equal((await LatexDocument.findOneBy({ id: document.id }))?.folder, folder.id);
        });

        it('moves a document back to the root', async () => {
            const fixture = await createFixture();
            const folder = await seedFolder(fixture, 'papers');
            const document = await seedDocument(fixture, { folder: folder.id });

            await service.moveDocument({
                teamId: fixture.team.id,
                documentId: document.id,
                folderId: null
            });

            assert.equal((await LatexDocument.findOneBy({ id: document.id }))?.folder, null);
        });


        it('rejects a document of another team', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);

            await assert.rejects(
                () => service.moveDocument({
                    teamId: fixture.otherTeam.id,
                    documentId: document.id,
                    folderId: null
                }),
                isApplicationError('Resource::NotFound', 404)
            );
        });

        it('rejects an unknown target folder', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);

            await assert.rejects(
                () => service.moveDocument({
                    teamId: fixture.team.id,
                    documentId: document.id,
                    folderId: 'a'.repeat(24)
                }),
                isApplicationError('Resource::NotFound', 404)
            );
        });
    });

    describe('importDocument', () => {
        it('imports a plain tex file as the entrypoint of a new document', async () => {
            const fixture = await createFixture();

            const document = await service.importDocument({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                file: uploadedFile('thermal_report.tex', '\\documentclass{article}')
            });

            const stored = await LatexDocument.findOneBy({ id: document._id });
            assert.equal(stored?.title, 'thermal report');
            assert.equal(stored?.storageClusterId, fixture.cluster.id);
            assert.equal(stored?.lastEditedBy, null);

            const files = await LatexFile.findBy({ document: document._id });
            assert.equal(files.length, 1);
            assert.equal(files[0].name, 'main.tex');
            assert.equal(files[0].path, '');
            assert.equal(files[0].content, '\\documentclass{article}');
            assert.equal(files[0].isEntrypoint, true);
        });


        it('rejects an empty upload', async () => {
            const fixture = await createFixture();

            await assert.rejects(
                () => service.importDocument({
                    teamId: fixture.team.id,
                    userId: fixture.owner.id,
                    file: uploadedFile('empty.tex', '')
                }),
                isApplicationError('File::ReadError', 400)
            );
            assert.equal(await LatexDocument.count(), 0);
        });

        it('rejects an unknown target folder', async () => {
            const fixture = await createFixture();

            await assert.rejects(
                () => service.importDocument({
                    teamId: fixture.team.id,
                    userId: fixture.owner.id,
                    file: uploadedFile('paper.tex', 'content'),
                    folderId: 'a'.repeat(24)
                }),
                isApplicationError('Resource::NotFound', 404)
            );
        });

        it('imports a zip archive keeping the extra tex files and their directories', async () => {
            const fixture = await createFixture();
            const buffer = await zipBuffer([
                {
                    name: 'main.tex',
                    content: '\\documentclass{article}'
                },
                {
                    name: 'chapters/one.tex',
                    content: '\\section{One}'
                }
            ]);

            const document = await service.importDocument({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                file: uploadedFile('bundle.zip', buffer, 'application/zip')
            });

            const files = await LatexFile.find({ where: { document: document._id } });
            const chapter = files.find((file) => file.name === 'one.tex');
            assert.equal(files.length, 2);
            assert.equal(files.find((file) => file.name === 'main.tex')?.isEntrypoint, true);
            assert.equal(chapter?.path, 'chapters/');
            assert.equal(chapter?.content, '\\section{One}');
            assert.equal(chapter?.isEntrypoint, false);
        });


        it('uploads the non tex entries of a zip archive as assets', async () => {
            const fixture = await createFixture();
            const buffer = await zipBuffer([
                {
                    name: 'main.tex',
                    content: '\\documentclass{article}'
                },
                {
                    name: 'figures/plot.png',
                    content: 'png bytes'
                }
            ]);

            const document = await service.importDocument({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                file: uploadedFile('bundle.zip', buffer, 'application/zip')
            });

            const assets = await LatexAsset.findBy({ document: document._id });
            assert.equal(assets.length, 1);
            assert.equal(assets[0].originalName, 'plot.png');
            assert.equal(assets[0].path, 'figures/plot.png');
            assert.match(assets[0].storageKey, new RegExp(`^latex-assets/${fixture.team.id}/${document._id}/`));
            assert.equal(puts.length, 1);
            assert.equal(puts[0].bucket, TEAM_CLUSTER_BUCKETS.LATEX_ASSETS);
            assert.equal(puts[0].body, 'png bytes');
        });

        it('rejects a zip archive without a main tex file', async () => {
            const fixture = await createFixture();
            const buffer = await zipBuffer([{
                name: 'notes.md',
                content: 'notes'
            }]);

            await assert.rejects(
                () => service.importDocument({
                    teamId: fixture.team.id,
                    userId: fixture.owner.id,
                    file: uploadedFile('bundle.zip', buffer, 'application/zip')
                }),
                isApplicationError('Validation::InvalidInput', 400)
            );
            assert.equal(await LatexDocument.count(), 0);
        });

        it('rejects a corrupted zip archive', async () => {
            const fixture = await createFixture();

            await assert.rejects(
                () => service.importDocument({
                    teamId: fixture.team.id,
                    userId: fixture.owner.id,
                    file: uploadedFile('bundle.zip', 'not a zip at all', 'application/zip')
                }),
                isApplicationError('Validation::InvalidInput', 400)
            );
        });


        it('wraps an imported pdf into a document that includes it', async () => {
            const fixture = await createFixture();

            const document = await service.importDocument({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                file: uploadedFile('thesis.pdf', 'pdf bytes', 'application/pdf')
            });

            const files = await LatexFile.findBy({ document: document._id });
            const assets = await LatexAsset.findBy({ document: document._id });
            assert.equal((await LatexDocument.findOneBy({ id: document._id }))?.title, 'thesis');
            assert.equal(files.length, 1);
            assert.equal(files[0].name, 'main.tex');
            assert.match(files[0].content, /\\includepdf\[pages=-\]\{thesis\.pdf\}/);
            assert.equal(assets.length, 1);
            assert.equal(assets[0].originalName, 'thesis.pdf');
            assert.equal(assets[0].mimetype, 'application/pdf');
            assert.match(assets[0].storageKey, /\.pdf$/);
            assert.equal(puts[0].body, 'pdf bytes');
        });

        it('falls back to a default title when the file name is only whitespace', async () => {
            const fixture = await createFixture();

            const document = await service.importDocument({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                file: uploadedFile('  .tex', 'content')
            });

            assert.equal((await LatexDocument.findOneBy({ id: document._id }))?.title, 'Imported Document');
        });

        it('keeps a dot file name as the title because it carries no extension', async () => {
            const fixture = await createFixture();

            const document = await service.importDocument({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                file: uploadedFile('.tex', 'content')
            });

            assert.equal((await LatexDocument.findOneBy({ id: document._id }))?.title, '.tex');
        });

        it('turns the underscores and the dashes of the file name into spaces', async () => {
            const fixture = await createFixture();

            const document = await service.importDocument({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                file: uploadedFile('thermal_report-final.tex', 'content')
            });

            assert.equal((await LatexDocument.findOneBy({ id: document._id }))?.title, 'thermal report final');
        });
    });


    describe('files', () => {
        it('lists the files of the document with the entrypoint first', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);
            await seedFile(fixture, document.id, 'appendix.tex');
            await seedFile(fixture, document.id, 'main.tex', { isEntrypoint: true });

            const files = await service.listFiles({
                teamId: fixture.team.id,
                documentId: document.id
            });

            assert.deepEqual(files.map((file) => file.name), ['main.tex', 'appendix.tex']);
        });

        it('excludes the files of another document', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);
            const other = await seedDocument(fixture, { title: 'other' });
            await seedFile(fixture, document.id, 'main.tex');
            await seedFile(fixture, other.id, 'foreign.tex');

            const files = await service.listFiles({
                teamId: fixture.team.id,
                documentId: document.id
            });

            assert.deepEqual(files.map((file) => file.name), ['main.tex']);
        });

        it('creates a file and exposes its id as _id', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);

            const file = await service.createFile({
                teamId: fixture.team.id,
                documentId: document.id,
                userId: fixture.owner.id,
                name: '  main.tex  ',
                path: 'chapters/',
                content: '\\documentclass{article}'
            });

            const stored = await LatexFile.findOneBy({ id: file._id });
            assert.equal(stored?.name, 'main.tex');
            assert.equal(stored?.path, 'chapters/');
            assert.equal(stored?.content, '\\documentclass{article}');
            assert.equal(stored?.team, fixture.team.id);
            assert.equal(stored?.createdBy, fixture.owner.id);
            assert.equal(stored?.isEntrypoint, false);
        });


        it('defaults the path and the content of a new file to an empty string', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);

            const file = await service.createFile({
                teamId: fixture.team.id,
                documentId: document.id,
                userId: fixture.owner.id,
                name: 'main.tex'
            });

            const stored = await LatexFile.findOneBy({ id: file._id });
            assert.equal(stored?.path, '');
            assert.equal(stored?.content, '');
        });

        it('demotes the previous entrypoint when a new one is created', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);
            const previous = await seedFile(fixture, document.id, 'old.tex', { isEntrypoint: true });

            const file = await service.createFile({
                teamId: fixture.team.id,
                documentId: document.id,
                userId: fixture.owner.id,
                name: 'new.tex',
                isEntrypoint: true
            });

            assert.equal((await LatexFile.findOneBy({ id: previous.id }))?.isEntrypoint, false);
            assert.equal((await LatexFile.findOneBy({ id: file._id }))?.isEntrypoint, true);
        });

        it('rejects two files with the same name and path in one document', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);
            await seedFile(fixture, document.id, 'main.tex');

            await assert.rejects(
                () => service.createFile({
                    teamId: fixture.team.id,
                    documentId: document.id,
                    userId: fixture.owner.id,
                    name: 'main.tex'
                }),
                /UNIQUE/
            );
        });

        it('accepts the same file name in two different documents', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);
            const other = await seedDocument(fixture, { title: 'other' });
            await seedFile(fixture, document.id, 'main.tex');

            const file = await service.createFile({
                teamId: fixture.team.id,
                documentId: other.id,
                userId: fixture.owner.id,
                name: 'main.tex'
            });

            assert.equal((await LatexFile.findOneBy({ id: file._id }))?.document, other.id);
        });


        it('rewrites the name, the path and the content of a file', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);
            const file = await seedFile(fixture, document.id, 'main.tex');

            const updated = await service.updateFile({
                teamId: fixture.team.id,
                documentId: document.id,
                fileId: file.id,
                name: '  renamed.tex  ',
                path: 'chapters/',
                content: 'new content'
            });

            assert.equal(updated.name, 'renamed.tex');
            const stored = await LatexFile.findOneBy({ id: file.id });
            assert.equal(stored?.name, 'renamed.tex');
            assert.equal(stored?.path, 'chapters/');
            assert.equal(stored?.content, 'new content');
        });

        it('publishes a content event only for an update coming from the assistant', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);
            const file = await seedFile(fixture, document.id, 'main.tex');

            await service.updateFile({
                teamId: fixture.team.id,
                documentId: document.id,
                fileId: file.id,
                content: 'from editor'
            });
            assert.deepEqual(published, []);

            await service.updateFile({
                teamId: fixture.team.id,
                documentId: document.id,
                fileId: file.id,
                content: 'from assistant',
                source: 'ai'
            });

            assert.deepEqual(published, [{
                name: 'latex-file.content.updated',
                payload: {
                    documentId: document.id,
                    teamId: fixture.team.id,
                    fileId: file.id,
                    content: 'from assistant'
                }
            }]);
        });

        it('rejects updating a file of another document', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);
            const other = await seedDocument(fixture, { title: 'other' });
            const file = await seedFile(fixture, other.id, 'main.tex');

            await assert.rejects(
                () => service.updateFile({
                    teamId: fixture.team.id,
                    documentId: document.id,
                    fileId: file.id,
                    content: 'x'
                }),
                isApplicationError('Latex::File::NotFound', 404)
            );
        });


        it('deletes a file that is not the entrypoint', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);
            const entrypoint = await seedFile(fixture, document.id, 'main.tex', { isEntrypoint: true });
            const extra = await seedFile(fixture, document.id, 'appendix.tex');

            await service.deleteFile({
                teamId: fixture.team.id,
                documentId: document.id,
                fileId: extra.id
            });

            assert.equal(await LatexFile.countBy({ id: extra.id }), 0);
            assert.equal((await LatexFile.findOneBy({ id: entrypoint.id }))?.isEntrypoint, true);
        });

        it('promotes another tex file when the entrypoint is deleted', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);
            const entrypoint = await seedFile(fixture, document.id, 'main.tex', { isEntrypoint: true });
            await seedFile(fixture, document.id, 'notes.md');
            const successor = await seedFile(fixture, document.id, 'appendix.tex');

            await service.deleteFile({
                teamId: fixture.team.id,
                documentId: document.id,
                fileId: entrypoint.id
            });

            assert.equal((await LatexFile.findOneBy({ id: successor.id }))?.isEntrypoint, true);
        });

        it('promotes the remaining file even when it is not a tex file', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);
            const entrypoint = await seedFile(fixture, document.id, 'main.tex', { isEntrypoint: true });
            const successor = await seedFile(fixture, document.id, 'notes.md');

            await service.deleteFile({
                teamId: fixture.team.id,
                documentId: document.id,
                fileId: entrypoint.id
            });

            assert.equal((await LatexFile.findOneBy({ id: successor.id }))?.isEntrypoint, true);
        });

        it('leaves the document without files when the last one is deleted', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);
            const only = await seedFile(fixture, document.id, 'main.tex', { isEntrypoint: true });

            await service.deleteFile({
                teamId: fixture.team.id,
                documentId: document.id,
                fileId: only.id
            });

            assert.equal(await LatexFile.countBy({ document: document.id }), 0);
        });

        it('rejects deleting an unknown file', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);

            await assert.rejects(
                () => service.deleteFile({
                    teamId: fixture.team.id,
                    documentId: document.id,
                    fileId: 'a'.repeat(24)
                }),
                isApplicationError('Latex::File::NotFound', 404)
            );
        });


        it('moves the entrypoint flag to the requested file', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);
            const previous = await seedFile(fixture, document.id, 'main.tex', { isEntrypoint: true });
            const next = await seedFile(fixture, document.id, 'appendix.tex');

            const updated = await service.setFileEntrypoint({
                teamId: fixture.team.id,
                documentId: document.id,
                fileId: next.id
            });

            assert.equal(updated.isEntrypoint, true);
            assert.equal((await LatexFile.findOneBy({ id: previous.id }))?.isEntrypoint, false);
            assert.equal((await LatexFile.findOneBy({ id: next.id }))?.isEntrypoint, true);
        });

        it('keeps a single entrypoint per document', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);
            await seedFile(fixture, document.id, 'main.tex', { isEntrypoint: true });
            const second = await seedFile(fixture, document.id, 'appendix.tex');

            await service.setFileEntrypoint({
                teamId: fixture.team.id,
                documentId: document.id,
                fileId: second.id
            });

            assert.equal(await LatexFile.countBy({
                document: document.id,
                isEntrypoint: true
            }), 1);
        });

        it('rejects setting the entrypoint of an unknown file', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);

            await assert.rejects(
                () => service.setFileEntrypoint({
                    teamId: fixture.team.id,
                    documentId: document.id,
                    fileId: 'a'.repeat(24)
                }),
                isApplicationError('Latex::File::NotFound', 404)
            );
        });
    });


    describe('assets', () => {
        it('lists the assets of the document newest first', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);
            const older = await seedAsset(fixture, document.id, 'older.png');
            const newer = await seedAsset(fixture, document.id, 'newer.png');
            await LatexAsset.update({ id: older.id }, { createdAt: new Date('2024-01-01T00:00:00.000Z') });
            await LatexAsset.update({ id: newer.id }, { createdAt: new Date('2024-06-01T00:00:00.000Z') });

            const assets = await service.listAssets({
                teamId: fixture.team.id,
                documentId: document.id
            });

            assert.deepEqual(assets.map((asset) => asset.originalName), ['newer.png', 'older.png']);
        });

        it('exposes a content url scoped to the team and the document', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);
            const asset = await seedAsset(fixture, document.id, 'plot.png');

            const [view] = await service.listAssets({
                teamId: fixture.team.id,
                documentId: document.id
            });

            assert.equal(view._id, asset.id);
            assert.equal(
                view.url,
                `/api/teams/${fixture.team.id}/latex-documents/${document.id}/assets/content?key=${encodeURIComponent(asset.storageKey)}`
            );
        });

        it('excludes the assets of another document', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);
            const other = await seedDocument(fixture, { title: 'other' });
            await seedAsset(fixture, document.id, 'own.png');
            await seedAsset(fixture, other.id, 'foreign.png');

            const assets = await service.listAssets({
                teamId: fixture.team.id,
                documentId: document.id
            });

            assert.deepEqual(assets.map((asset) => asset.originalName), ['own.png']);
        });


        it('registers each uploaded file with a signed upload url', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);

            const result = await service.uploadAsset({
                teamId: fixture.team.id,
                documentId: document.id,
                userId: fixture.owner.id,
                files: [{
                    name: 'plot.png',
                    size: 2048,
                    type: 'image/png'
                }]
            });

            assert.equal(result.total, 1);
            assert.equal(result.failedCount, 0);
            assert.equal(result.uploaded.length, 1);
            assert.equal(result.uploaded[0].uploadIndex, 0);
            assert.equal(result.uploaded[0].originalName, 'plot.png');
            assert.equal(result.uploaded[0].mimetype, 'image/png');
            assert.match(result.uploaded[0].uploadUrl, new RegExp(`^/api/teams/${fixture.team.id}/cluster-objects/`));

            const stored = await LatexAsset.findOneBy({ id: result.uploaded[0]._id });
            assert.equal(stored?.document, document.id);
            assert.equal(stored?.size, 2048);
            assert.match(stored!.storageKey, new RegExp(`^latex-assets/${fixture.team.id}/${document.id}/.+\\.png$`));
        });

        it('rejects an upload without any valid file', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);

            await assert.rejects(
                () => service.uploadAsset({
                    teamId: fixture.team.id,
                    documentId: document.id,
                    userId: fixture.owner.id,
                    files: []
                }),
                isApplicationError('File::ReadError', 400)
            );
        });

        it('counts a file above the fifty megabyte limit as failed', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);

            const result = await service.uploadAsset({
                teamId: fixture.team.id,
                documentId: document.id,
                userId: fixture.owner.id,
                files: [{
                    name: 'huge.bin',
                    size: 51 * 1024 * 1024
                }]
            });

            assert.equal(result.total, 1);
            assert.equal(result.failedCount, 1);
            assert.deepEqual(result.uploaded, []);
            assert.equal(await LatexAsset.count(), 0);
        });


        it('sanitizes the requested asset path', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);

            const result = await service.uploadAsset({
                teamId: fixture.team.id,
                documentId: document.id,
                userId: fixture.owner.id,
                path: '../../figures/plot.png',
                files: [{
                    name: 'plot.png',
                    size: 10
                }]
            });

            assert.equal((await LatexAsset.findOneBy({ id: result.uploaded[0]._id }))?.path, 'figures/plot.png');
        });

        it('streams the content of an asset inside the document scope', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);
            const asset = await seedAsset(fixture, document.id, 'plot.png');
            storedObjects.set(`${TEAM_CLUSTER_BUCKETS.LATEX_ASSETS}/${asset.storageKey}`, 'png bytes');

            const content = await service.getAssetContent({
                teamId: fixture.team.id,
                documentId: document.id,
                key: asset.storageKey
            });

            assert.equal(await readAll(content.stream), 'png bytes');
            assert.equal(content.contentType, 'application/octet-stream');
        });

        it('refuses to stream a key that lives outside the document scope', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);
            const other = await seedDocument(fixture, { title: 'other' });
            const foreign = await seedAsset(fixture, other.id, 'foreign.png');

            await assert.rejects(
                () => service.getAssetContent({
                    teamId: fixture.team.id,
                    documentId: document.id,
                    key: foreign.storageKey
                }),
                isApplicationError('LatexAsset::StorageKeyForbidden', 403)
            );
        });

        it('rejects streaming an asset of a document without a storage cluster', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture, { storageClusterId: null });
            const asset = await seedAsset(fixture, document.id, 'plot.png');

            await assert.rejects(
                () => service.getAssetContent({
                    teamId: fixture.team.id,
                    documentId: document.id,
                    key: asset.storageKey
                }),
                isApplicationError('LatexDocument::StorageClusterRequired', 409)
            );
        });


        it('deletes the row and the stored object of an asset', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);
            const asset = await seedAsset(fixture, document.id, 'plot.png');

            await service.deleteAsset({
                teamId: fixture.team.id,
                documentId: document.id,
                assetId: asset.id
            });

            assert.equal(await LatexAsset.countBy({ id: asset.id }), 0);
            assert.deepEqual(deletedObjects, [{
                bucket: TEAM_CLUSTER_BUCKETS.LATEX_ASSETS,
                objectKey: asset.storageKey
            }]);
        });

        it('still deletes the row when the stored object is already gone', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);
            const asset = await seedAsset(fixture, document.id, 'plot.png');
            deleteObjectFailure = ApplicationError.notFound('Object::NotFound', 'already gone');

            await service.deleteAsset({
                teamId: fixture.team.id,
                documentId: document.id,
                assetId: asset.id
            });

            assert.equal(await LatexAsset.countBy({ id: asset.id }), 0);
        });

        it('keeps the row when the object store fails for another reason', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);
            const asset = await seedAsset(fixture, document.id, 'plot.png');
            deleteObjectFailure = new Error('gateway down');

            await assert.rejects(
                () => service.deleteAsset({
                    teamId: fixture.team.id,
                    documentId: document.id,
                    assetId: asset.id
                }),
                /gateway down/
            );
            assert.equal(await LatexAsset.countBy({ id: asset.id }), 1);
        });

        it('rejects deleting an asset of another document', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);
            const other = await seedDocument(fixture, { title: 'other' });
            const asset = await seedAsset(fixture, other.id, 'foreign.png');

            await assert.rejects(
                () => service.deleteAsset({
                    teamId: fixture.team.id,
                    documentId: document.id,
                    assetId: asset.id
                }),
                isApplicationError('Resource::NotFound', 404)
            );
        });


        it('rewrites the path of an asset through the sanitizer', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);
            const asset = await seedAsset(fixture, document.id, 'plot.png');

            const updated = await service.updateAsset({
                teamId: fixture.team.id,
                documentId: document.id,
                assetId: asset.id,
                path: '../figures/plot.png'
            });

            assert.equal(updated.path, 'figures/plot.png');
            assert.equal((await LatexAsset.findOneBy({ id: asset.id }))?.path, 'figures/plot.png');
        });

        it('falls back to the original name when the requested path collapses to nothing', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);
            const asset = await seedAsset(fixture, document.id, 'plot.png');

            const updated = await service.updateAsset({
                teamId: fixture.team.id,
                documentId: document.id,
                assetId: asset.id,
                path: '../..'
            });

            assert.equal(updated.path, 'plot.png');
        });

        it('rejects updating an unknown asset', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);

            await assert.rejects(
                () => service.updateAsset({
                    teamId: fixture.team.id,
                    documentId: document.id,
                    assetId: 'a'.repeat(24),
                    path: 'plot.png'
                }),
                isApplicationError('Resource::NotFound', 404)
            );
        });
    });


    describe('exportDocumentTex', () => {
        it('streams the content of the entrypoint under a sanitized file name', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture, { title: 'Thermal Report/2024' });
            await seedFile(fixture, document.id, 'main.tex', {
                content: '\\documentclass{article}',
                isEntrypoint: true
            });

            const download = await service.exportDocumentTex({
                teamId: fixture.team.id,
                documentId: document.id
            });

            assert.equal(await readAll(download.stream), '\\documentclass{article}');
            assert.equal(download.headers['Content-Type'], 'application/x-tex; charset=utf-8');
            assert.equal(download.headers['Content-Disposition'], 'attachment; filename="Thermal-Report-2024.tex"');
        });

        it('falls back to the first tex file when nothing is flagged as the entrypoint', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);
            await seedFile(fixture, document.id, 'notes.md', { content: 'notes' });
            await seedFile(fixture, document.id, 'paper.tex', { content: 'tex body' });

            const download = await service.exportDocumentTex({
                teamId: fixture.team.id,
                documentId: document.id
            });

            assert.equal(await readAll(download.stream), 'tex body');
        });

        it('rejects a document without any tex file', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);
            await seedFile(fixture, document.id, 'notes.md');

            await assert.rejects(
                () => service.exportDocumentTex({
                    teamId: fixture.team.id,
                    documentId: document.id
                }),
                isApplicationError('Latex::Compilation::Failed', 422)
            );
        });

        it('rejects a document of another team', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);

            await assert.rejects(
                () => service.exportDocumentTex({
                    teamId: fixture.otherTeam.id,
                    documentId: document.id
                }),
                isApplicationError('Resource::NotFound', 404)
            );
        });
    });


    describe('exportDocumentZip', () => {
        it('archives every latex file and asset of the document', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture, { title: 'Report' });
            await seedFile(fixture, document.id, 'main.tex', {
                content: '\\documentclass{article}',
                isEntrypoint: true
            });
            await seedFile(fixture, document.id, 'chapter.tex', {
                path: 'chapters/',
                content: '\\section{One}'
            });
            const asset = await seedAsset(fixture, document.id, 'plot.png', { path: 'figures/plot.png' });

            const download = await service.exportDocumentZip({
                teamId: fixture.team.id,
                documentId: document.id
            });

            assert.equal(daemonCalls.length, 1);
            assert.equal(daemonCalls[0].teamClusterId, fixture.cluster.id);
            const entries = (daemonCalls[0].payload as { entries: Array<Record<string, unknown>> }).entries;
            assert.deepEqual(entries, [
                {
                    type: 'inline',
                    name: 'main.tex',
                    content: '\\documentclass{article}'
                },
                {
                    type: 'inline',
                    name: 'chapters/chapter.tex',
                    content: '\\section{One}'
                },
                {
                    type: 'object',
                    ownerClusterId: fixture.cluster.id,
                    bucket: TEAM_CLUSTER_BUCKETS.LATEX_ASSETS,
                    objectKey: asset.storageKey,
                    name: 'figures/plot.png',
                    optional: true
                }
            ]);
            assert.equal(download.headers['Content-Disposition'], 'attachment; filename="Report.zip"');
        });

        it('writes the archive under an export prefix scoped to the document', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);
            await seedFile(fixture, document.id, 'main.tex', { isEntrypoint: true });

            await service.exportDocumentZip({
                teamId: fixture.team.id,
                documentId: document.id
            });

            const output = (daemonCalls[0].payload as { output: { bucket: string; objectKey: string } }).output;
            assert.equal(output.bucket, TEAM_CLUSTER_BUCKETS.TRAJECTORIES);
            assert.match(output.objectKey, new RegExp(`^exports/latex/${document.id}/[0-9a-f-]{36}\\.zip$`));
        });


        it('rejects a document without any latex file', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);

            await assert.rejects(
                () => service.exportDocumentZip({
                    teamId: fixture.team.id,
                    documentId: document.id
                }),
                isApplicationError('Latex::Compilation::Failed', 422)
            );
            assert.deepEqual(daemonCalls, []);
        });

        it('rejects a document without a storage cluster', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture, { storageClusterId: null });
            await seedFile(fixture, document.id, 'main.tex', { isEntrypoint: true });

            await assert.rejects(
                () => service.exportDocumentZip({
                    teamId: fixture.team.id,
                    documentId: document.id
                }),
                isApplicationError('LatexDocument::StorageClusterRequired', 409)
            );
        });
    });

    describe('compileDocument', () => {
        const trackWorkDir = (teamId: string, documentId: string): void => {
            compileWorkDirs.push(tempFileService.getDirPath(getDocumentCompileWorkDirSegment(teamId, documentId)));
        };

        it('rejects an unknown document', async () => {
            const fixture = await createFixture();
            trackWorkDir(fixture.team.id, 'a'.repeat(24));

            await assert.rejects(
                () => service.compileDocument({
                    teamId: fixture.team.id,
                    documentId: 'a'.repeat(24)
                }),
                isApplicationError('Resource::NotFound', 404)
            );
        });

        it('rejects a document without any latex file', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);
            trackWorkDir(fixture.team.id, document.id);

            await assert.rejects(
                () => service.compileDocument({
                    teamId: fixture.team.id,
                    documentId: document.id
                }),
                isApplicationError('Latex::Compilation::Failed', 422)
            );
        });

        it('rejects a document whose files hold no tex entrypoint', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);
            await seedFile(fixture, document.id, 'notes.md');
            trackWorkDir(fixture.team.id, document.id);

            await assert.rejects(
                () => service.compileDocument({
                    teamId: fixture.team.id,
                    documentId: document.id
                }),
                isApplicationError('Latex::Compilation::Failed', 422)
            );
        });
    });


    describe('folders', () => {
        it('lists the root folders newest first with the default limit of five hundred', async () => {
            const fixture = await createFixture();
            const root = await seedFolder(fixture, 'root-one');
            await seedFolder(fixture, 'child', root.id);

            const page = await service.listFolders({ teamId: fixture.team.id });

            assert.equal(page.total, 1);
            assert.equal(page.limit, 500);
            assert.equal(page.data[0].title, 'root-one');
            assert.equal(page.data[0].parent, null);
        });

        it('caps the requested folder limit at five hundred', async () => {
            const fixture = await createFixture();

            assert.equal((await service.listFolders({
                teamId: fixture.team.id,
                limit: 5000
            })).limit, 500);
        });

        it('lists the children of a folder', async () => {
            const fixture = await createFixture();
            const root = await seedFolder(fixture, 'root-one');
            await seedFolder(fixture, 'child', root.id);

            const page = await service.listFolders({
                teamId: fixture.team.id,
                parentId: root.id
            });

            assert.equal(page.total, 1);
            assert.equal(page.data[0].title, 'child');
        });

        it('excludes the folders of another catalog kind', async () => {
            const fixture = await createFixture();
            await seedFolder(fixture, 'papers');
            await seedFolder(fixture, 'boards', null, CatalogFolderKind.Whiteboard);

            const page = await service.listFolders({ teamId: fixture.team.id });

            assert.equal(page.total, 1);
            assert.equal(page.data[0].title, 'papers');
        });

        it('paginates the folder listing', async () => {
            const fixture = await createFixture();
            await seedFolder(fixture, 'one');
            await seedFolder(fixture, 'two');

            const page = await service.listFolders({
                teamId: fixture.team.id,
                page: 2,
                limit: 1
            });

            assert.equal(page.total, 2);
            assert.equal(page.totalPages, 2);
            assert.equal(page.data.length, 1);
        });


        it('creates a folder tagged with the latex kind', async () => {
            const fixture = await createFixture();

            const folder = await service.createFolder({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                title: 'created'
            });

            const stored = await CatalogFolder.findOneBy({ id: folder._id });
            assert.equal(stored?.kind, CatalogFolderKind.Latex);
            assert.equal(stored?.team, fixture.team.id);
            assert.equal(stored?.createdBy, fixture.owner.id);
            assert.equal(stored?.parent, null);
        });

        it('creates a nested folder', async () => {
            const fixture = await createFixture();
            const parent = await seedFolder(fixture, 'parent');

            const folder = await service.createFolder({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                title: 'nested',
                parentId: parent.id
            });

            assert.equal(folder.parent, parent.id);
        });

        it('reads a single folder', async () => {
            const fixture = await createFixture();
            const folder = await seedFolder(fixture, 'readable');

            assert.equal((await service.getFolder({
                teamId: fixture.team.id,
                folderId: folder.id
            }))._id, folder.id);
        });

        it('rejects reading a folder of another team', async () => {
            const fixture = await createFixture();
            const folder = await seedFolder(fixture, 'readable');

            await assert.rejects(
                () => service.getFolder({
                    teamId: fixture.otherTeam.id,
                    folderId: folder.id
                }),
                isApplicationError('Resource::NotFound', 404)
            );
        });

        it('renames a folder', async () => {
            const fixture = await createFixture();
            const folder = await seedFolder(fixture, 'before');

            const updated = await service.updateFolder({
                teamId: fixture.team.id,
                folderId: folder.id,
                title: 'after'
            });

            assert.equal(updated.title, 'after');
            assert.equal((await CatalogFolder.findOneBy({ id: folder.id }))?.title, 'after');
        });


        it('rejects renaming an unknown folder', async () => {
            const fixture = await createFixture();

            await assert.rejects(
                () => service.updateFolder({
                    teamId: fixture.team.id,
                    folderId: 'a'.repeat(24),
                    title: 'after'
                }),
                isApplicationError('Resource::NotFound', 404)
            );
        });

        it('deletes a folder tree including its subfolders', async () => {
            const fixture = await createFixture();
            const root = await seedFolder(fixture, 'root-one');
            const child = await seedFolder(fixture, 'child', root.id);
            const survivor = await seedFolder(fixture, 'survivor');

            await service.deleteFolder({
                teamId: fixture.team.id,
                folderId: root.id
            });

            assert.equal(await CatalogFolder.countBy({ id: root.id }), 0);
            assert.equal(await CatalogFolder.countBy({ id: child.id }), 0);
            assert.equal(await CatalogFolder.countBy({ id: survivor.id }), 1);
        });

        it('deletes the documents stored inside the folder tree', async () => {
            const fixture = await createFixture();
            const root = await seedFolder(fixture, 'root-one');
            const child = await seedFolder(fixture, 'child', root.id);
            const doomed = await seedDocument(fixture, { folder: root.id });
            const nested = await seedDocument(fixture, {
                title: 'nested',
                folder: child.id
            });
            const survivor = await seedDocument(fixture, { title: 'survivor' });

            await service.deleteFolder({
                teamId: fixture.team.id,
                folderId: root.id
            });

            assert.equal(await LatexDocument.countBy({ id: doomed.id }), 0);
            assert.equal(await LatexDocument.countBy({ id: nested.id }), 0);
            assert.equal(await LatexDocument.countBy({ id: survivor.id }), 1);
            assert.equal(published.filter((event) => event.name === 'latex-document.deleted').length, 2);
        });

        it('rejects deleting an unknown folder', async () => {
            const fixture = await createFixture();

            await assert.rejects(
                () => service.deleteFolder({
                    teamId: fixture.team.id,
                    folderId: 'a'.repeat(24)
                }),
                isApplicationError('Resource::NotFound', 404)
            );
        });

        it('detaches the documents of a folder removed straight from the database', async () => {
            const fixture = await createFixture();
            const folder = await seedFolder(fixture, 'papers');
            const document = await seedDocument(fixture, { folder: folder.id });

            await CatalogFolder.delete({ id: folder.id });

            assert.equal((await LatexDocument.findOneBy({ id: document.id }))?.folder, null);
        });
    });


    describe('deleteAllDocumentsForTeam', () => {
        it('deletes every document of the team', async () => {
            const fixture = await createFixture();
            const first = await seedDocument(fixture);
            const second = await seedDocument(fixture, { title: 'second' });

            await service.deleteAllDocumentsForTeam(fixture.team.id, fixture.owner.id);

            assert.equal(await LatexDocument.countBy({ id: first.id }), 0);
            assert.equal(await LatexDocument.countBy({ id: second.id }), 0);
        });

        it('keeps the documents of the other teams', async () => {
            const fixture = await createFixture();
            await seedDocument(fixture);
            const survivor = await seedDocument(fixture, { team: fixture.otherTeam.id });

            await service.deleteAllDocumentsForTeam(fixture.team.id, fixture.owner.id);

            assert.equal(await LatexDocument.countBy({ id: survivor.id }), 1);
        });

        it('publishes one deletion event per document', async () => {
            const fixture = await createFixture();
            const first = await seedDocument(fixture);
            const second = await seedDocument(fixture, { title: 'second' });

            await service.deleteAllDocumentsForTeam(fixture.team.id, fixture.owner.id);

            assert.deepEqual(published.map((event) => event.name), ['latex-document.deleted', 'latex-document.deleted']);
            assert.deepEqual(
                published.map((event) => (event.payload as { documentId: string }).documentId).sort(),
                [first.id, second.id].sort()
            );
        });

        it('resolves when the team has no document', async () => {
            const fixture = await createFixture();

            await service.deleteAllDocumentsForTeam(fixture.team.id, fixture.owner.id);

            assert.deepEqual(published, []);
        });
    });

    describe('team deletion cascade', () => {
        it('removes the documents, files and assets of a deleted team', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);
            await seedFile(fixture, document.id, 'main.tex', { isEntrypoint: true });
            await seedAsset(fixture, document.id, 'plot.png');

            await Team.delete({ id: fixture.team.id });

            assert.equal(await LatexDocument.countBy({ id: document.id }), 0);
            assert.equal(await LatexFile.count(), 0);
            assert.equal(await LatexAsset.count(), 0);
        });
    });
});
