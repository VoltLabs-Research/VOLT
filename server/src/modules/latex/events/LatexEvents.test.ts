import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import { closeRedisHandles } from '@tests/redis-handles';
import eventBus from '@shared/infrastructure/events/RedisEventBus';
import objectGatewayClient from '@modules/cluster/services/TeamClusterObjectGatewayClient';
import teamClusterSelectionService from '@modules/container/services/TeamClusterSelectionService';
import latexSocketModule from '@modules/latex/socket/LatexSocketModule';
import LatexEvents from '@modules/latex/events/LatexEvents';
import LatexDocument from '@modules/latex/models/LatexDocument';
import LatexFile from '@modules/latex/models/LatexFile';
import LatexAsset from '@modules/latex/models/LatexAsset';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';

interface EmittedEvent{
    name: string;
    payload: unknown;
}

interface PrefixDeletion{
    teamClusterId: string;
    bucket: string;
    prefix: string;
}

interface AiContentCall{
    documentId: string;
    teamId: string;
    fileId: string;
    content: string;
}

interface Fixture{
    team: Team;
    otherTeam: Team;
    owner: User;
    cluster: TeamCluster;
}

const ENTITIES = [LatexDocument, LatexFile, LatexAsset, TeamCluster, CatalogFolder, Team, User];

const isApplicationError = (code: string, statusCode: number) => (error: unknown): boolean => {
    assert.ok(error instanceof ApplicationError);
    assert.equal(error.code, code);
    assert.equal(error.statusCode, statusCode);
    return true;
};


describe('LatexEvents', () => {
    let dataSource: DataSource;
    const events = new LatexEvents();
    const published: EmittedEvent[] = [];
    const deletedPrefixes: PrefixDeletion[] = [];
    const aiContentCalls: AiContentCall[] = [];

    before(async () => {
        dataSource = await createHarness(ENTITIES);

        eventBus.emit = async (name, payload) => {
            published.push({
                name,
                payload
            });
        };
        teamClusterSelectionService.resolveStorageClusterId = async () => '';
        objectGatewayClient.deleteByPrefix = async (teamClusterId, bucket, prefix) => {
            deletedPrefixes.push({
                teamClusterId,
                bucket,
                prefix
            });
            return 0;
        };
        latexSocketModule.applyAiContentToFile = (async (
            documentId: string,
            teamId: string,
            fileId: string,
            content: string
        ) => {
            aiContentCalls.push({
                documentId,
                teamId,
                fileId,
                content
            });
        }) as typeof latexSocketModule.applyAiContentToFile;
    });

    after(async () => {
        await destroyHarness(dataSource);
        closeRedisHandles();
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
        published.length = 0;
        deletedPrefixes.length = 0;
        aiContentCalls.length = 0;
    });


    const createFixture = async (): Promise<Fixture> => {
        const owner = await User.create({
            email: 'owner@volt.test',
            firstName: 'ada'
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

        return {
            team,
            otherTeam,
            owner,
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
        originalName: string
    ): Promise<LatexAsset> => LatexAsset.create({
        team: fixture.team.id,
        document: documentId,
        originalName,
        path: originalName,
        storageKey: `latex-assets/${fixture.team.id}/${documentId}/${originalName}`,
        url: 'url',
        mimetype: 'application/octet-stream',
        size: 4,
        createdBy: fixture.owner.id
    }).save();


    describe('cleanupDocumentAssets', () => {
        it('removes the files and the assets rows of the deleted document', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);
            const survivorDocument = await seedDocument(fixture, { title: 'survivor' });
            await seedFile(fixture, document.id, 'main.tex', { isEntrypoint: true });
            await seedAsset(fixture, document.id, 'plot.png');
            const survivorFile = await seedFile(fixture, survivorDocument.id, 'main.tex', { isEntrypoint: true });
            const survivorAsset = await seedAsset(fixture, survivorDocument.id, 'other.png');

            await events.cleanupDocumentAssets({
                documentId: document.id,
                teamId: fixture.team.id,
                storageClusterId: fixture.cluster.id,
                userId: fixture.owner.id,
                documentTitle: 'Paper'
            });

            assert.equal(await LatexFile.countBy({ document: document.id }), 0);
            assert.equal(await LatexAsset.countBy({ document: document.id }), 0);
            assert.equal(await LatexFile.countBy({ id: survivorFile.id }), 1);
            assert.equal(await LatexAsset.countBy({ id: survivorAsset.id }), 1);
        });

        it('clears the stored objects under the document prefix', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);

            await events.cleanupDocumentAssets({
                documentId: document.id,
                teamId: fixture.team.id,
                storageClusterId: fixture.cluster.id,
                userId: fixture.owner.id,
                documentTitle: 'Paper'
            });

            assert.deepEqual(deletedPrefixes, [{
                teamClusterId: fixture.cluster.id,
                bucket: TEAM_CLUSTER_BUCKETS.LATEX_ASSETS,
                prefix: `latex-assets/${fixture.team.id}/${document.id}/`
            }]);
        });

        it('rejects an event that carries no storage cluster', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);
            await seedFile(fixture, document.id, 'main.tex');

            await assert.rejects(
                () => events.cleanupDocumentAssets({
                    documentId: document.id,
                    teamId: fixture.team.id,
                    userId: fixture.owner.id,
                    documentTitle: 'Paper'
                }),
                isApplicationError('LatexDocument::StorageClusterRequired', 409)
            );
            assert.equal(await LatexFile.countBy({ document: document.id }), 1);
        });

        it('resolves for a document that had no file nor asset', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);

            await events.cleanupDocumentAssets({
                documentId: document.id,
                teamId: fixture.team.id,
                storageClusterId: fixture.cluster.id,
                userId: fixture.owner.id,
                documentTitle: 'Paper'
            });

            assert.equal(deletedPrefixes.length, 1);
        });
    });


    describe('applyAiContentToFile', () => {
        it('forwards the assistant content to the collaborative session of the file', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);
            const file = await seedFile(fixture, document.id, 'main.tex', { isEntrypoint: true });

            await events.applyAiContentToFile({
                documentId: document.id,
                teamId: fixture.team.id,
                fileId: file.id,
                content: '\\section{Generated}'
            });

            assert.deepEqual(aiContentCalls, [{
                documentId: document.id,
                teamId: fixture.team.id,
                fileId: file.id,
                content: '\\section{Generated}'
            }]);
        });
    });

    describe('deleteTeamDocuments', () => {
        it('deletes every document of the team', async () => {
            const fixture = await createFixture();
            const first = await seedDocument(fixture);
            const second = await seedDocument(fixture, { title: 'second' });

            await events.deleteTeamDocuments({
                teamId: fixture.team.id,
                userId: fixture.owner.id
            });

            assert.equal(await LatexDocument.countBy({ id: first.id }), 0);
            assert.equal(await LatexDocument.countBy({ id: second.id }), 0);
        });

        it('keeps the documents of the other teams', async () => {
            const fixture = await createFixture();
            await seedDocument(fixture);
            const survivor = await seedDocument(fixture, { team: fixture.otherTeam.id });

            await events.deleteTeamDocuments({
                teamId: fixture.team.id,
                userId: fixture.owner.id
            });

            assert.equal(await LatexDocument.countBy({ id: survivor.id }), 1);
        });

        it('publishes one deletion event per document', async () => {
            const fixture = await createFixture();
            const first = await seedDocument(fixture);
            const second = await seedDocument(fixture, { title: 'second' });

            await events.deleteTeamDocuments({
                teamId: fixture.team.id,
                userId: fixture.owner.id
            });

            assert.deepEqual(published.map((event) => event.name), ['latex-document.deleted', 'latex-document.deleted']);
            assert.deepEqual(
                published.map((event) => (event.payload as { documentId: string }).documentId).sort(),
                [first.id, second.id].sort()
            );
        });

        it('tolerates an event without a user id', async () => {
            const fixture = await createFixture();
            const document = await seedDocument(fixture);

            await events.deleteTeamDocuments({ teamId: fixture.team.id });

            assert.equal(await LatexDocument.countBy({ id: document.id }), 0);
            assert.equal((published[0].payload as { userId: string }).userId, '');
        });

        it('resolves when the team has no document', async () => {
            const fixture = await createFixture();

            await events.deleteTeamDocuments({
                teamId: fixture.team.id,
                userId: fixture.owner.id
            });

            assert.deepEqual(published, []);
        });
    });
});
