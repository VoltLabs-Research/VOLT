import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import {
    getDocumentCompileWorkDirSegment,
    prepareWorkDir,
    runCompiler,
    withDocumentCompileLock
} from '@modules/latex/services/LatexCompiler';
import LatexDocument from '@modules/latex/models/LatexDocument';
import LatexFile from '@modules/latex/models/LatexFile';
import LatexAsset from '@modules/latex/models/LatexAsset';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import type { ITeamClusterObjectGatewayClient } from '@shared/contracts/ports';
import type { ITempFileService } from '@shared/domain/port/ITempFileService';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';

interface Fixture{
    team: Team;
    owner: User;
    cluster: TeamCluster;
    document: LatexDocument;
}

interface Manifest{
    inputs: Record<string, string>;
}

const ENTITIES = [LatexDocument, LatexFile, LatexAsset, TeamCluster, CatalogFolder, Team, User];

const MANIFEST_FILENAME = '.volt-latex-input-manifest.json';
const ENTITY_ID_PATTERN = /^[0-9a-f]{24}$/;

const isApplicationError = (code: string, statusCode: number) => (error: unknown): boolean => {
    assert.ok(error instanceof ApplicationError);
    assert.equal(error.code, code);
    assert.equal(error.statusCode, statusCode);
    return true;
};

describe('LatexCompiler', () => {
    let dataSource: DataSource;
    let sandbox: string;
    let stubBinDir: string;
    let originalPath: string | undefined;
    const storedObjects = new Map<string, string>();
    const requestedObjectKeys: string[] = [];

    const objectGatewayClient = {
        getStream: async (_teamClusterId: string, bucket: string, objectKey: string) => {
            requestedObjectKeys.push(objectKey);
            const body = storedObjects.get(`${bucket}/${objectKey}`);
            if(body === undefined){
                throw ApplicationError.notFound('Object::NotFound', 'missing object');
            }
            return {
                stream: Readable.from(Buffer.from(body)),
                contentType: 'application/octet-stream'
            };
        }
    } as unknown as ITeamClusterObjectGatewayClient;

    const tempFileService = {
        ensureDir: async (dirPath: string) => {
            await fs.mkdir(dirPath, { recursive: true });
        }
    } as unknown as ITempFileService;

    before(async () => {
        dataSource = await createHarness(ENTITIES);
        sandbox = await fs.mkdtemp(path.join(os.tmpdir(), 'volt-latex-compiler-'));
        stubBinDir = path.join(sandbox, 'bin');
        await fs.mkdir(stubBinDir, { recursive: true });
        await fs.writeFile(
            path.join(stubBinDir, 'latexmk'),
            '#!/bin/sh\nif [ "$1" = "--version" ]; then echo "stub latexmk"; exit 0; fi\necho "stub compile $@"\nexit 0\n',
            { mode: 0o755 }
        );
        originalPath = process.env.PATH;
        process.env.PATH = `${stubBinDir}${path.delimiter}${originalPath ?? ''}`;
    });

    after(async () => {
        await destroyHarness(dataSource);
        process.env.PATH = originalPath;
        await fs.rm(sandbox, {
            recursive: true,
            force: true
        });
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
        storedObjects.clear();
        requestedObjectKeys.length = 0;
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

    const seedFile = (
        fixture: Fixture,
        name: string,
        overrides: Partial<LatexFile> = {}
    ): Promise<LatexFile> => LatexFile.create({
        document: fixture.document.id,
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
        originalName: string,
        overrides: Partial<LatexAsset> = {}
    ): Promise<LatexAsset> => LatexAsset.create({
        team: fixture.team.id,
        document: fixture.document.id,
        originalName,
        path: originalName,
        storageKey: `latex-assets/${fixture.team.id}/${fixture.document.id}/${originalName}`,
        url: 'url',
        mimetype: 'application/octet-stream',
        size: 4,
        createdBy: fixture.owner.id,
        ...overrides
    }).save();

    const workDirFor = (name: string): string => path.join(sandbox, 'work', name);

    const prepare = (
        fixture: Fixture,
        workDir: string,
        overrides: { teamId?: string; documentId?: string } = {}
    ) => prepareWorkDir(
        {
            teamId: overrides.teamId ?? fixture.team.id,
            documentId: overrides.documentId ?? fixture.document.id,
            workDir,
            haltOnError: true
        },
        {
            objectGatewayClient,
            tempFileService
        }
    );

    const readManifest = async (workDir: string): Promise<Manifest> => JSON.parse(
        await fs.readFile(path.join(workDir, MANIFEST_FILENAME), 'utf-8')
    ) as Manifest;

    describe('getDocumentCompileWorkDirSegment', () => {
        it('keeps the hexadecimal ids of the team and the document intact', async () => {
            const fixture = await createFixture();

            assert.equal(
                getDocumentCompileWorkDirSegment(fixture.team.id, fixture.document.id),
                `latex-compile-${fixture.team.id}-${fixture.document.id}`
            );
        });

        it('replaces the characters that cannot appear in a directory name', async () => {
            assert.equal(
                getDocumentCompileWorkDirSegment('team/../etc', 'doc id'),
                'latex-compile-team_etc-doc_id'
            );
        });
    });

    describe('prepareWorkDir', () => {
        it('reports a missing document', async () => {
            const fixture = await createFixture();

            const result = await prepare(fixture, workDirFor('missing-document'), { documentId: 'a'.repeat(24) });

            assert.deepEqual(result, { status: 'no-document' });
        });

        it('reports a document that belongs to another team as missing', async () => {
            const fixture = await createFixture();
            await seedFile(fixture, 'main.tex', { isEntrypoint: true });

            const result = await prepare(fixture, workDirFor('foreign-team'), { teamId: 'b'.repeat(24) });

            assert.deepEqual(result, { status: 'no-document' });
        });

        it('reports a document without any file', async () => {
            const fixture = await createFixture();

            const result = await prepare(fixture, workDirFor('no-files'));

            assert.deepEqual(result, { status: 'no-files' });
        });

        it('reports a document whose files hold no tex entrypoint', async () => {
            const fixture = await createFixture();
            await seedFile(fixture, 'notes.md');

            const result = await prepare(fixture, workDirFor('no-entrypoint'));

            assert.deepEqual(result, { status: 'no-entrypoint' });
        });

        it('rejects a document without a storage cluster', async () => {
            const fixture = await createFixture();
            await LatexDocument.update({ id: fixture.document.id }, { storageClusterId: null });

            await assert.rejects(
                () => prepare(fixture, workDirFor('no-cluster')),
                isApplicationError('LatexDocument::StorageClusterRequired', 409)
            );
        });

        it('prefers the flagged entrypoint over any other tex file', async () => {
            const fixture = await createFixture();
            await seedFile(fixture, 'appendix.tex');
            await seedFile(fixture, 'report.tex', { isEntrypoint: true });

            const result = await prepare(fixture, workDirFor('flagged-entrypoint'));

            assert.equal(result.status, 'ready');
            assert.equal(result.status === 'ready' && result.entrypointFilename, 'report.tex');
        });

        it('falls back to the first tex file when nothing is flagged', async () => {
            const fixture = await createFixture();
            const first = await seedFile(fixture, 'alpha.tex');
            await seedFile(fixture, 'beta.tex');
            await LatexFile.update({ id: first.id }, { createdAt: new Date('2024-01-01T00:00:00.000Z') });

            const result = await prepare(fixture, workDirFor('fallback-entrypoint'));

            assert.equal(result.status === 'ready' && result.entrypointFilename, 'alpha.tex');
        });

        it('prefixes the entrypoint with the stored directory of the file', async () => {
            const fixture = await createFixture();
            await seedFile(fixture, 'main.tex', {
                path: 'chapters/',
                isEntrypoint: true
            });

            const result = await prepare(fixture, workDirFor('nested-entrypoint'));

            assert.equal(result.status === 'ready' && result.entrypointFilename, 'chapters/main.tex');
        });

        it('writes every latex file into the work directory', async () => {
            const fixture = await createFixture();
            const workDir = workDirFor('write-files');
            await seedFile(fixture, 'main.tex', {
                content: '\\documentclass{article}',
                isEntrypoint: true
            });
            await seedFile(fixture, 'chapter.tex', {
                path: 'chapters/',
                content: '\\section{One}'
            });

            await prepare(fixture, workDir);

            assert.equal(await fs.readFile(path.join(workDir, 'main.tex'), 'utf-8'), '\\documentclass{article}');
            assert.equal(await fs.readFile(path.join(workDir, 'chapters', 'chapter.tex'), 'utf-8'), '\\section{One}');
        });

        it('downloads the assets of the document into the work directory', async () => {
            const fixture = await createFixture();
            const workDir = workDirFor('write-assets');
            await seedFile(fixture, 'main.tex', { isEntrypoint: true });
            const asset = await seedAsset(fixture, 'plot.png', { path: 'figures/plot.png' });
            storedObjects.set(`${TEAM_CLUSTER_BUCKETS.LATEX_ASSETS}/${asset.storageKey}`, 'png bytes');

            await prepare(fixture, workDir);

            assert.equal(await fs.readFile(path.join(workDir, 'figures', 'plot.png'), 'utf-8'), 'png bytes');
            assert.deepEqual(requestedObjectKeys, [asset.storageKey]);
        });

        it('keeps compiling when an asset cannot be downloaded', async () => {
            const fixture = await createFixture();
            const workDir = workDirFor('missing-asset');
            await seedFile(fixture, 'main.tex', { isEntrypoint: true });
            await seedAsset(fixture, 'plot.png');

            const result = await prepare(fixture, workDir);

            assert.equal(result.status, 'ready');
            const manifest = await readManifest(workDir);
            assert.equal('plot.png' in manifest.inputs, false);
        });
    });

    describe('work directory manifest', () => {
        it('versions each latex file with its id, its full path and its update time', async () => {
            const fixture = await createFixture();
            const workDir = workDirFor('manifest-files');
            const main = await seedFile(fixture, 'main.tex', { isEntrypoint: true });
            const chapter = await seedFile(fixture, 'chapter.tex', { path: 'chapters/' });

            await prepare(fixture, workDir);
            const manifest = await readManifest(workDir);
            const reloadedMain = await LatexFile.findOneBy({ id: main.id });
            const reloadedChapter = await LatexFile.findOneBy({ id: chapter.id });

            assert.equal(
                manifest.inputs['main.tex'],
                `${main.id}:main.tex:${reloadedMain!.updatedAt.toISOString()}`
            );
            assert.equal(
                manifest.inputs['chapters/chapter.tex'],
                `${chapter.id}:chapters/chapter.tex:${reloadedChapter!.updatedAt.toISOString()}`
            );
        });

        it('keeps the latex file id in the manifest as twenty four hexadecimal characters', async () => {
            const fixture = await createFixture();
            const workDir = workDirFor('manifest-file-id');
            const main = await seedFile(fixture, 'main.tex', { isEntrypoint: true });

            await prepare(fixture, workDir);
            const manifest = await readManifest(workDir);
            const [manifestId] = manifest.inputs['main.tex'].split(':');

            assert.match(main.id, ENTITY_ID_PATTERN);
            assert.equal(manifestId, main.id);
            assert.match(manifestId, ENTITY_ID_PATTERN);
            assert.equal(manifestId.length, 24);
        });

        it('keeps the asset id in the manifest as twenty four hexadecimal characters', async () => {
            const fixture = await createFixture();
            const workDir = workDirFor('manifest-asset-id');
            await seedFile(fixture, 'main.tex', { isEntrypoint: true });
            const asset = await seedAsset(fixture, 'plot.png');
            storedObjects.set(`${TEAM_CLUSTER_BUCKETS.LATEX_ASSETS}/${asset.storageKey}`, 'png bytes');

            await prepare(fixture, workDir);
            const manifest = await readManifest(workDir);
            const [manifestId] = manifest.inputs['plot.png'].split(':');

            assert.match(asset.id, ENTITY_ID_PATTERN);
            assert.equal(manifestId, asset.id);
            assert.match(manifestId, ENTITY_ID_PATTERN);
            assert.equal(manifestId.length, 24);
        });

        it('versions each asset with its id, its path, its storage key, its size and its update time', async () => {
            const fixture = await createFixture();
            const workDir = workDirFor('manifest-assets');
            await seedFile(fixture, 'main.tex', { isEntrypoint: true });
            const asset = await seedAsset(fixture, 'plot.png', {
                path: 'figures/plot.png',
                size: 9
            });
            storedObjects.set(`${TEAM_CLUSTER_BUCKETS.LATEX_ASSETS}/${asset.storageKey}`, 'png bytes');

            await prepare(fixture, workDir);
            const manifest = await readManifest(workDir);
            const reloaded = await LatexAsset.findOneBy({ id: asset.id });

            assert.equal(
                manifest.inputs['figures/plot.png'],
                `${asset.id}:figures/plot.png:${asset.storageKey}:9:${reloaded!.updatedAt.toISOString()}`
            );
        });

        it('leaves the version of an unchanged file alone across two preparations', async () => {
            const fixture = await createFixture();
            const workDir = workDirFor('manifest-stable');
            await seedFile(fixture, 'main.tex', { isEntrypoint: true });

            await prepare(fixture, workDir);
            const first = await readManifest(workDir);
            await prepare(fixture, workDir);
            const second = await readManifest(workDir);

            assert.deepEqual(second, first);
        });

        it('rewrites the version once the file content changes', async () => {
            const fixture = await createFixture();
            const workDir = workDirFor('manifest-changed');
            const main = await seedFile(fixture, 'main.tex', { isEntrypoint: true });

            await prepare(fixture, workDir);
            const before = await readManifest(workDir);

            await LatexFile.update({ id: main.id }, {
                content: '\\documentclass{report}',
                updatedAt: new Date(Date.now() + 60_000)
            });
            await prepare(fixture, workDir);
            const after = await readManifest(workDir);

            assert.notEqual(after.inputs['main.tex'], before.inputs['main.tex']);
            assert.equal(await fs.readFile(path.join(workDir, 'main.tex'), 'utf-8'), '\\documentclass{report}');
        });

        it('removes the file that no longer belongs to the document', async () => {
            const fixture = await createFixture();
            const workDir = workDirFor('manifest-stale');
            await seedFile(fixture, 'main.tex', { isEntrypoint: true });
            const removable = await seedFile(fixture, 'appendix.tex');

            await prepare(fixture, workDir);
            assert.equal(await fs.readFile(path.join(workDir, 'appendix.tex'), 'utf-8'), '% appendix.tex');

            await LatexFile.delete({ id: removable.id });
            await prepare(fixture, workDir);

            const manifest = await readManifest(workDir);
            assert.equal('appendix.tex' in manifest.inputs, false);
            await assert.rejects(() => fs.readFile(path.join(workDir, 'appendix.tex'), 'utf-8'));
        });

        it('restores a managed file that disappeared from the work directory', async () => {
            const fixture = await createFixture();
            const workDir = workDirFor('manifest-restore');
            await seedFile(fixture, 'main.tex', {
                content: '\\documentclass{article}',
                isEntrypoint: true
            });

            await prepare(fixture, workDir);
            await fs.rm(path.join(workDir, 'main.tex'));
            await prepare(fixture, workDir);

            assert.equal(await fs.readFile(path.join(workDir, 'main.tex'), 'utf-8'), '\\documentclass{article}');
        });
    });

    describe('runCompiler', () => {
        it('reports a successful run and captures its output', async () => {
            const fixture = await createFixture();
            const workDir = workDirFor('compile-ok');
            await seedFile(fixture, 'main.tex', { isEntrypoint: true });
            const preparation = await prepare(fixture, workDir);

            assert.equal(preparation.status, 'ready');
            const result = await runCompiler(
                preparation.status === 'ready' ? preparation.compiler : {
                    binary: 'latexmk',
                    args: []
                },
                workDir
            );

            assert.equal(result.success, true);
            assert.match(result.log, /stub compile/);
        });

        it('reports a failure when the binary cannot be spawned', async () => {
            const workDir = workDirFor('compile-missing-binary');
            await fs.mkdir(workDir, { recursive: true });

            const result = await runCompiler({
                binary: 'volt-compiler-that-does-not-exist',
                args: []
            }, workDir);

            assert.equal(result.success, false);
            assert.notEqual(result.log, '');
        });

        it('passes the halt on error flag through to the compiler arguments', async () => {
            const fixture = await createFixture();
            await seedFile(fixture, 'main.tex', { isEntrypoint: true });

            const preparation = await prepare(fixture, workDirFor('compile-args'));

            assert.equal(preparation.status, 'ready');
            assert.deepEqual(
                preparation.status === 'ready' ? preparation.compiler.args : [],
                ['-pdf', '-interaction=nonstopmode', '-halt-on-error', '-file-line-error', 'main.tex']
            );
        });
    });

    describe('withDocumentCompileLock', () => {
        it('serializes two compilations of the same document', async () => {
            const fixture = await createFixture();
            const events: string[] = [];

            const first = withDocumentCompileLock(fixture.team.id, fixture.document.id, async () => {
                events.push('first:start');
                await new Promise((resolve) => setTimeout(resolve, 20));
                events.push('first:end');
                return 1;
            });
            const second = withDocumentCompileLock(fixture.team.id, fixture.document.id, async () => {
                events.push('second:start');
                events.push('second:end');
                return 2;
            });

            assert.deepEqual(await Promise.all([first, second]), [1, 2]);
            assert.deepEqual(events, ['first:start', 'first:end', 'second:start', 'second:end']);
        });

        it('lets two different documents compile at the same time', async () => {
            const fixture = await createFixture();
            const other = await LatexDocument.create({
                team: fixture.team.id,
                title: 'Other',
                storageClusterId: fixture.cluster.id,
                createdBy: fixture.owner.id,
                lastEditedBy: fixture.owner.id,
                folder: null
            }).save();
            const events: string[] = [];

            const first = withDocumentCompileLock(fixture.team.id, fixture.document.id, async () => {
                events.push('first:start');
                await new Promise((resolve) => setTimeout(resolve, 20));
                events.push('first:end');
            });
            const second = withDocumentCompileLock(fixture.team.id, other.id, async () => {
                events.push('second:start');
                events.push('second:end');
            });

            await Promise.all([first, second]);

            assert.deepEqual(events, ['first:start', 'second:start', 'second:end', 'first:end']);
        });

        it('releases the lock when the task throws', async () => {
            const fixture = await createFixture();

            await assert.rejects(
                () => withDocumentCompileLock(fixture.team.id, fixture.document.id, async () => {
                    throw new Error('compilation exploded');
                }),
                /compilation exploded/
            );

            assert.equal(
                await withDocumentCompileLock(fixture.team.id, fixture.document.id, async () => 'free'),
                'free'
            );
        });
    });

    describe('document deletion cascade', () => {
        it('removes the files and the assets of a deleted document', async () => {
            const fixture = await createFixture();
            await seedFile(fixture, 'main.tex', { isEntrypoint: true });
            await seedAsset(fixture, 'plot.png');

            await LatexDocument.delete({ id: fixture.document.id });

            assert.equal(await LatexFile.countBy({ document: fixture.document.id }), 0);
            assert.equal(await LatexAsset.countBy({ document: fixture.document.id }), 0);
        });
    });
});
