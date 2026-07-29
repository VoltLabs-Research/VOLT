import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import {
    assertLatexAssetStorageKey,
    buildLatexAssetContentUrl,
    buildLatexAssetStorageKey,
    buildLatexAssetStoragePrefix,
    requireLatexStorageClusterId,
    sanitizeAssetPath
} from '@modules/latex/services/LatexAssetStorage';
import LatexDocument from '@modules/latex/models/LatexDocument';
import LatexAsset from '@modules/latex/models/LatexAsset';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';
import ApplicationError from '@shared/application/errors/ApplicationError';

interface Fixture{
    team: Team;
    owner: User;
    cluster: TeamCluster;
    document: LatexDocument;
}

const ENTITIES = [LatexDocument, LatexAsset, TeamCluster, CatalogFolder, Team, User];

const isApplicationError = (code: string, statusCode: number) => (error: unknown): boolean => {
    assert.ok(error instanceof ApplicationError);
    assert.equal(error.code, code);
    assert.equal(error.statusCode, statusCode);
    return true;
};

describe('LatexAssetStorage', () => {
    let dataSource: DataSource;

    before(async () => {
        dataSource = await createHarness(ENTITIES);
    });

    after(async () => {
        await destroyHarness(dataSource);
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
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
        const cluster = await TeamCluster.create({
            name: 'cluster',
            team: team.id,
            createdBy: owner.id,
            services: {},
            queueConcurrency: {},
            queueScopeLimits: {},
            roleConfig: {}
        }).save();
        const document = await LatexDocument.create({
            team: team.id,
            title: 'Paper',
            storageClusterId: cluster.id,
            createdBy: owner.id,
            lastEditedBy: owner.id,
            folder: null
        }).save();

        return {
            team,
            owner,
            cluster,
            document
        };
    };

    describe('storage keys', () => {
        it('scopes the prefix to the team and the document', async () => {
            const fixture = await createFixture();

            assert.equal(
                buildLatexAssetStoragePrefix(fixture.team.id, fixture.document.id),
                `latex-assets/${fixture.team.id}/${fixture.document.id}/`
            );
        });

        it('builds a key under the document prefix keeping the extension', async () => {
            const fixture = await createFixture();

            assert.equal(
                buildLatexAssetStorageKey(fixture.team.id, fixture.document.id, 'unique-1', '.png'),
                `latex-assets/${fixture.team.id}/${fixture.document.id}/unique-1.png`
            );
        });

        it('builds a key without extension when none is given', async () => {
            const fixture = await createFixture();

            assert.equal(
                buildLatexAssetStorageKey(fixture.team.id, fixture.document.id, 'unique-1', ''),
                `latex-assets/${fixture.team.id}/${fixture.document.id}/unique-1`
            );
        });

        it('accepts a key that lives inside the document scope', async () => {
            const fixture = await createFixture();
            const asset = await LatexAsset.create({
                team: fixture.team.id,
                document: fixture.document.id,
                originalName: 'diagram.png',
                path: 'diagram.png',
                storageKey: buildLatexAssetStorageKey(fixture.team.id, fixture.document.id, 'unique-1', '.png'),
                url: 'url',
                mimetype: 'image/png',
                size: 10,
                createdBy: fixture.owner.id
            }).save();

            assertLatexAssetStorageKey(fixture.team.id, fixture.document.id, asset.storageKey);
        });

        it('rejects a key that belongs to another document', async () => {
            const fixture = await createFixture();
            const foreignKey = buildLatexAssetStorageKey(fixture.team.id, 'a'.repeat(24), 'unique-1', '.png');

            assert.throws(
                () => assertLatexAssetStorageKey(fixture.team.id, fixture.document.id, foreignKey),
                isApplicationError('LatexAsset::StorageKeyForbidden', 403)
            );
        });

        it('rejects a key that belongs to another team', async () => {
            const fixture = await createFixture();
            const foreignKey = buildLatexAssetStorageKey('b'.repeat(24), fixture.document.id, 'unique-1', '.png');

            assert.throws(
                () => assertLatexAssetStorageKey(fixture.team.id, fixture.document.id, foreignKey),
                isApplicationError('LatexAsset::StorageKeyForbidden', 403)
            );
        });

        it('rejects a key that escapes the prefix with a traversal', async () => {
            const fixture = await createFixture();

            assert.throws(
                () => assertLatexAssetStorageKey(fixture.team.id, fixture.document.id, '../../etc/passwd'),
                isApplicationError('LatexAsset::StorageKeyForbidden', 403)
            );
        });
    });

    describe('content urls', () => {
        it('encodes the team, the document and the key into the content url', async () => {
            const fixture = await createFixture();
            const storageKey = buildLatexAssetStorageKey(fixture.team.id, fixture.document.id, 'unique-1', '.png');

            assert.equal(
                buildLatexAssetContentUrl(fixture.team.id, fixture.document.id, storageKey),
                `/api/teams/${fixture.team.id}/latex-documents/${fixture.document.id}/assets/content?key=${encodeURIComponent(storageKey)}`
            );
        });

        it('escapes the slashes of the storage key inside the query string', async () => {
            const fixture = await createFixture();
            const url = buildLatexAssetContentUrl(fixture.team.id, fixture.document.id, 'latex-assets/a/b.png');

            assert.equal(url.includes('key=latex-assets%2Fa%2Fb.png'), true);
        });
    });

    describe('requireLatexStorageClusterId', () => {
        it('returns the storage cluster of the document', async () => {
            const fixture = await createFixture();

            assert.equal(
                requireLatexStorageClusterId(fixture.document.id, fixture.document),
                fixture.cluster.id
            );
        });

        it('rejects a document whose storage cluster is null', async () => {
            const fixture = await createFixture();
            await LatexDocument.update({ id: fixture.document.id }, { storageClusterId: null });
            const reloaded = await LatexDocument.findOneBy({ id: fixture.document.id });

            assert.throws(
                () => requireLatexStorageClusterId(fixture.document.id, reloaded!),
                isApplicationError('LatexDocument::StorageClusterRequired', 409)
            );
        });

        it('rejects a document whose storage cluster is only whitespace', async () => {
            const fixture = await createFixture();

            assert.throws(
                () => requireLatexStorageClusterId(fixture.document.id, { storageClusterId: '   ' }),
                isApplicationError('LatexDocument::StorageClusterRequired', 409)
            );
        });
    });

    describe('sanitizeAssetPath', () => {
        it('keeps a nested relative path', async () => {
            assert.equal(sanitizeAssetPath('figures/plot.png', 'plot.png'), 'figures/plot.png');
        });

        it('normalizes windows separators', async () => {
            assert.equal(sanitizeAssetPath('figures\\plot.png', 'plot.png'), 'figures/plot.png');
        });

        it('drops the current directory segments', async () => {
            assert.equal(sanitizeAssetPath('./figures/./plot.png', 'plot.png'), 'figures/plot.png');
        });

        it('collapses a parent directory segment', async () => {
            assert.equal(sanitizeAssetPath('figures/../plot.png', 'plot.png'), 'plot.png');
        });

        it('refuses to escape the document root', async () => {
            assert.equal(sanitizeAssetPath('../../etc/passwd', 'passwd'), 'etc/passwd');
        });

        it('falls back to the original file name when nothing is left', async () => {
            assert.equal(sanitizeAssetPath('../..', 'plot.png'), 'plot.png');
            assert.equal(sanitizeAssetPath('', 'plot.png'), 'plot.png');
            assert.equal(sanitizeAssetPath('/', 'plot.png'), 'plot.png');
        });

        it('strips the leading slash of an absolute path', async () => {
            assert.equal(sanitizeAssetPath('/figures/plot.png', 'plot.png'), 'figures/plot.png');
        });

        it('round trips the stored asset path of a persisted asset', async () => {
            const fixture = await createFixture();
            const asset = await LatexAsset.create({
                team: fixture.team.id,
                document: fixture.document.id,
                originalName: 'plot.png',
                path: sanitizeAssetPath('figures/../../plot.png', 'plot.png'),
                storageKey: buildLatexAssetStorageKey(fixture.team.id, fixture.document.id, 'unique-1', '.png'),
                url: 'url',
                mimetype: 'image/png',
                size: 10,
                createdBy: fixture.owner.id
            }).save();

            assert.equal((await LatexAsset.findOneBy({ id: asset.id }))?.path, 'plot.png');
        });
    });
});
