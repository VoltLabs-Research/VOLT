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
import type { QueueService } from '@/core/queues/application/QueueService';
import { PLUGIN_WARMUP_QUEUE_NAME } from '@/core/queues/contracts/queue-names';
import type { PluginWarmupJobPayload } from '@/modules/plugin/application/binaries/PluginWarmupWorker';
import type { DaemonConfig } from '@/core/config';
import { withNativeProcessingTempDir } from '@/support/native-temp-dir';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import * as tar from 'tar';

interface RegistryEntrypointNode {
    type?: string;
    data?: { entrypoint?: { binary?: string; binaryFileName?: string } };
}

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
            await pipeline(createReadStream(tgzPath), tar.x({ cwd: extractDir }));

            const workflow = await this.readWorkflow(extractDir);
            const binaryFileName = this.resolveBinaryFileName(workflow);
            const body = await fs.readFile(await this.locateBinary(extractDir, binaryFileName));
            const hash = createHash('sha256').update(body).digest('hex');
            const scope = payload.name.replace(/^@/, '').replace(/\//g, '-');
            const objectPath = `plugin-binaries/registry/${scope}/${payload.version}/${payload.platform}/${binaryFileName}`;

            await this.objectStore.putObject({
                ownerClusterId: this.config.teamClusterId,
                bucket: ObjectBucketName.Plugins,
                objectKey: objectPath,
                body,
                metadata: { sha256: hash, 'original-name': binaryFileName }
            });

            return {
                workflow,
                binary: { objectPath, fileName: binaryFileName, hash, sizeBytes: body.length },
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

    private resolveBinaryFileName(workflow: unknown): string {
        const nodes = (workflow as { nodes?: RegistryEntrypointNode[] }).nodes ?? [];
        const entrypoint = nodes.find((node) => node.type === 'entrypoint')?.data?.entrypoint;
        const binaryFileName = entrypoint?.binaryFileName ?? entrypoint?.binary;
        if (!binaryFileName) {
            throw new ApplicationError('Plugin::RegistryBinaryMissing', 'Workflow entrypoint does not declare a binary', { statusCode: 422 });
        }

        return path.basename(binaryFileName);
    }

    private async locateBinary(extractDir: string, binaryFileName: string): Promise<string> {
        const matches = await fg(`**/${fg.escapePath(binaryFileName)}`, { cwd: extractDir, absolute: true, dot: true });
        const found = matches[0] ?? (await fg('**/*.zip', { cwd: extractDir, absolute: true, dot: true }))[0];
        if (!found) {
            throw new ApplicationError('Plugin::RegistryBinaryMissing', `Binary ${binaryFileName} not found in registry package`, { statusCode: 422 });
        }

        return found;
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
