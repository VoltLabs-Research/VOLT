import { Command, CommandGroup } from '@/core/commands/decorators';
import type { ClusterObjectStore } from '@/core/storage/application/ClusterObjectStore';
import { isObjectNotFoundError } from '@/core/storage/contracts/cluster-object-store';
import {
    ObjectBucketName,
    type PluginSyncRequest,
    type PluginWarmupRequest,
    type PluginWarmupResponse,
    type TeamClusterDaemonPluginMongoExportPayload,
    type TeamClusterDaemonPluginMongoImportPayload,
    type TeamClusterDaemonPluginMongoPurgePayload,
    type TeamClusterDaemonRegistryInstallPayload,
    type TeamClusterDaemonRegistryInstallResult
} from '@/contracts';
import type {
    PluginListingFilter,
    PluginListingRepository,
    PluginSubListingFilter
} from '@/modules/plugin/infrastructure/repositories/plugin-listing-repository-contract';
import ApplicationError from '@/app/coordination/ApplicationError';
import { logger } from '@/core/logger';
import type { QueueService } from '@/core/queues/application/QueueService';
import { PLUGIN_WARMUP_QUEUE_NAME } from '@/core/queues/contracts/queue-names';
import type { PluginWarmupJobPayload } from '@/modules/plugin/application/binaries/PluginWarmupWorker';
import type { DaemonConfig } from '@/core/config';
import { withNativeProcessingTempDir } from '@/support/native-temp-dir';
import { createReadStream, createWriteStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { createZstdDecompress } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import * as tar from 'tar';

interface RegistryEntrypointNode {
    type?: string;
    data?: { entrypoint?: { type?: string; binary?: string; binaryFileName?: string } };
}

// archiver@8 is ESM with named class exports (ZipArchive); the installed
// @types/archiver@7 only types the legacy callable default, so reach the v8
// class through require (Node returns the ESM namespace) with a local type.
interface ProjectArchive {
    pipe(destination: NodeJS.WritableStream): unknown;
    file(filepath: string, data: { name: string }): unknown;
    on(event: 'error', listener: (error: Error) => void): unknown;
    finalize(): Promise<void>;
}

type ZipArchiveConstructor = new (options?: { zlib?: { level?: number } }) => ProjectArchive;

@CommandGroup('plugin')
export class PluginCommands {
    constructor(
        private readonly objectStore: ClusterObjectStore,
        private readonly pluginListingRepository: PluginListingRepository,
        private readonly queueService: QueueService,
        private readonly config: DaemonConfig
    ) {}

    @Command('sync')
    async sync(payload: PluginSyncRequest) {
        try {
            await this.objectStore.head(payload.ownerClusterId, ObjectBucketName.Plugins, payload.objectKey);
            return {
                synced: true,
                objectKey: payload.objectKey
            };
        } catch (error) {
            if (isObjectNotFoundError(error)) {
                return {
                    synced: false,
                    objectKey: payload.objectKey
                };
            }

            throw new ApplicationError(
                'Plugin::SyncUnavailable',
                `Failed to verify plugin binary availability for ${payload.objectKey}`,
                {
                    statusCode: 503,
                    cause: error
                }
            );
        }
    }

    @Command('warmup')
    async warmup(payload: PluginWarmupRequest): Promise<PluginWarmupResponse> {
        const jobId = `plugin-warmup:${payload.pluginId}:${payload.expectedHash ?? payload.binaryObjectPath}`;
        const warmupPayload: PluginWarmupJobPayload = {
            jobId,
            pluginId: payload.pluginId,
            binaryObjectPath: payload.binaryObjectPath,
            ownerClusterId: payload.ownerClusterId,
            requirementsFile: payload.requirementsFile,
            entrypointScript: payload.entrypointScript
        };
        const queued = await this.queueService.enqueue(PLUGIN_WARMUP_QUEUE_NAME, warmupPayload, {
            preserveExistingJob: true
        });
        return { queued, jobId };
    }

    @Command('registry.install')
    async registryInstall(payload: TeamClusterDaemonRegistryInstallPayload): Promise<TeamClusterDaemonRegistryInstallResult> {
        return withNativeProcessingTempDir('plugin-registry-install', async (dir) => {
            const tarball = await this.downloadVerified(payload.downloadUrl, payload.sha256);
            const tgzPath = path.join(dir, 'package.tgz');
            const extractDir = path.join(dir, 'extracted');
            await fs.writeFile(tgzPath, tarball);
            await fs.mkdir(extractDir, { recursive: true });
            // Registry artifacts are tar compressed with zstd (.tar.zst). node-tar
            // only auto-detects gzip/brotli, so decompress zstd ourselves first.
            const isZstd = tarball[0] === 0x28 && tarball[1] === 0xb5 && tarball[2] === 0x2f && tarball[3] === 0xfd;
            const archiveStream = createReadStream(tgzPath);
            await (isZstd
                ? pipeline(archiveStream, createZstdDecompress(), tar.x({ cwd: extractDir }))
                : pipeline(archiveStream, tar.x({ cwd: extractDir })));

            const workflow = await this.readWorkflow(extractDir);
            const entrypoint = this.resolveEntrypoint(workflow);
            const fileName = path.basename(entrypoint.binaryFileName ?? entrypoint.binary ?? '');
            // executable → upload the native binary directly; packaged entrypoints
            // (e.g. opendxa, which needs bundled data) ship the project as a zip.
            let body: Buffer;
            if (entrypoint.type === 'executable') {
                body = await fs.readFile(await this.locateExecutable(extractDir, fileName));
            } else {
                const zipPath = path.join(dir, fileName);
                await this.packageProjectZip(extractDir, zipPath);
                body = await fs.readFile(zipPath);
            }
            const hash = createHash('sha256').update(body).digest('hex');
            const scope = payload.name.replace(/^@/, '').replace(/\//g, '-');
            const objectPath = `plugin-binaries/registry/${scope}/${payload.version}/${payload.platform}/${fileName}`;

            logger.info({ fileName, type: entrypoint.type, size: body.length, objectPath }, '@plugin-registry-install: uploading binary');
            await this.objectStore.putObject({
                ownerClusterId: this.config.teamClusterId,
                bucket: ObjectBucketName.Plugins,
                objectKey: objectPath,
                body,
                metadata: { sha256: hash, 'original-name': fileName }
            });
            logger.info({ objectPath }, '@plugin-registry-install: upload complete');

            return {
                workflow,
                binary: { objectPath, fileName, hash, sizeBytes: body.length },
                ownerClusterId: this.config.teamClusterId
            };
        });
    }

    private async downloadVerified(url: string, expectedSha256: string): Promise<Buffer> {
        const response = await fetch(url);
        if (!response.ok) {
            throw new ApplicationError('Plugin::RegistryDownloadFailed', `Registry download failed with status ${response.status}`, { statusCode: 502 });
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        const actualSha256 = createHash('sha256').update(buffer).digest('hex');
        if (actualSha256 !== expectedSha256) {
            throw new ApplicationError('Plugin::RegistryChecksumMismatch', 'Downloaded plugin tarball failed checksum verification', { statusCode: 422 });
        }

        return buffer;
    }

    private async readWorkflow(extractDir: string): Promise<unknown> {
        const [pluginJsonPath] = await fg('**/plugin.json', { cwd: extractDir, absolute: true, dot: true });
        if (!pluginJsonPath) {
            throw new ApplicationError('Plugin::RegistryWorkflowMissing', 'plugin.json not found in registry package', { statusCode: 422 });
        }

        const parsed = JSON.parse(await fs.readFile(pluginJsonPath, 'utf-8')) as { workflow?: unknown };
        if (!parsed.workflow) {
            throw new ApplicationError('Plugin::RegistryWorkflowMissing', 'plugin.json does not contain a workflow', { statusCode: 422 });
        }

        return parsed.workflow;
    }

    private resolveEntrypoint(workflow: unknown): { type?: string; binary?: string; binaryFileName?: string } {
        const nodes = (workflow as { nodes?: RegistryEntrypointNode[] }).nodes ?? [];
        const entrypoint = nodes.find((node) => node.type === 'entrypoint')?.data?.entrypoint;
        if (!entrypoint || !(entrypoint.binaryFileName ?? entrypoint.binary)) {
            throw new ApplicationError('Plugin::RegistryBinaryMissing', 'Workflow entrypoint does not declare a binary', { statusCode: 422 });
        }

        return entrypoint;
    }

    private async locateExecutable(extractDir: string, binaryName: string): Promise<string> {
        const matches = await fg(`**/bin/${fg.escapePath(binaryName)}`, { cwd: extractDir, absolute: true, dot: true, onlyFiles: true });
        const found = matches[0] ?? (await fg(`**/${fg.escapePath(binaryName)}`, { cwd: extractDir, absolute: true, dot: true, onlyFiles: true }))[0];
        if (!found) {
            throw new ApplicationError('Plugin::RegistryBinaryMissing', `Binary ${binaryName} not found in registry package`, { statusCode: 422 });
        }

        return found;
    }

    private async packageProjectZip(extractDir: string, destPath: string): Promise<void> {
        // Exclude the workflow manifest; the zip is the runnable project (bin/lib/scripts).
        await fs.rm(path.join(extractDir, 'plugin.json'), { force: true });
        const { ZipArchive } = require('archiver') as { ZipArchive: ZipArchiveConstructor };
        const output = createWriteStream(destPath);
        const archive = new ZipArchive({ zlib: { level: 9 } });
        const closed = new Promise<void>((resolve, reject) => {
            output.on('close', () => resolve());
            archive.on('error', reject);
        });

        archive.pipe(output);
        // Dereference symlinks (lib/*.so chains) into real files: the daemon's
        // unzipper extraction does not restore symlinks, which would leave shared
        // libraries as short stub files (the link target string).
        const files = await fg('**/*', { cwd: extractDir, onlyFiles: true, followSymbolicLinks: true, dot: true });
        for (const relativePath of files) {
            archive.file(await fs.realpath(path.join(extractDir, relativePath)), { name: relativePath });
        }
        await archive.finalize();
        await closed;
    }

    @Command('listings.list')
    listListings(payload: PluginListingFilter) {
        return this.pluginListingRepository.listPluginListings(payload);
    }

    @Command('sub-listings.list')
    listSubListings(payload: PluginSubListingFilter) {
        return this.pluginListingRepository.listPluginSubListings(payload);
    }

    @Command('transfer.mongo.export')
    exportMongo(payload: TeamClusterDaemonPluginMongoExportPayload) {
        return this.pluginListingRepository.exportMongoRows(payload);
    }

    @Command('transfer.mongo.import')
    async importMongo(payload: TeamClusterDaemonPluginMongoImportPayload) {
        return {
            importedRows: await this.pluginListingRepository.importMongoRows(payload)
        };
    }

    @Command('transfer.mongo.purge')
    async purgeMongo(payload: TeamClusterDaemonPluginMongoPurgePayload) {
        return {
            deletedRows: await this.pluginListingRepository.purgeMongoRows(payload)
        };
    }
}
