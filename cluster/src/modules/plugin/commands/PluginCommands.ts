import { ErrorCodes } from '@core/constants/error-codes';
import { getObjectStore } from '@shared/infrastructure/storage/ClusterObjectStore';
import { getPluginListingRepository } from '@modules/plugin/models/PluginListingRepository';
import { getQueueService } from '@shared/infrastructure/queues/QueueService';
import { getConfig } from '@core/config/daemon';
import { Command, CommandGroup, commandGroupFactory } from '@shared/commands/command';
import type { ClusterObjectStore } from '@shared/contracts/types/cluster-object-store';
import { isObjectNotFoundError } from '@shared/contracts/types/cluster-object-store';
import { ObjectBucketName } from '@shared/contracts/types/http-object-store';
import {
    type PluginSyncRequest,
    type PluginWarmupRequest,
    type PluginWarmupResponse
} from '@shared/contracts/types/http-analysis';
import {
    type PluginListingTransferExportPayload,
    type PluginListingTransferImportPayload,
    type PluginListingTransferPurgePayload
} from '@shared/contracts/types/listing-transfer-payloads';
import {
    type TeamClusterDaemonRegistryInstallPayload,
    type TeamClusterDaemonRegistryInstallResult
} from '@shared/contracts/types/registry-install';
import type { PluginListingRepository } from '@modules/plugin/models/PluginListingRepository';
import type {
    PluginListingFilter,
    PluginSubListingFilter
} from '@modules/plugin/models/plugin-listing-repository-contract';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { logger } from '@shared/infrastructure/logger';
import type { QueueService } from '@shared/infrastructure/queues/QueueService';
import { PLUGIN_WARMUP_QUEUE_NAME } from '@core/constants/queue-names';
import type { PluginWarmupJobPayload } from '@modules/plugin/workers/PluginWarmupWorker';
import type { DaemonConfig } from '@core/config/daemon';
import { withNativeProcessingTempDir } from '@shared/infrastructure/utilities/native-temp-dir';
import {
    downloadVerifiedTarball,
    locateRegistryExecutable,
    packageRegistryProjectZip,
    readRegistryWorkflow,
    resolveRegistryEntrypoint
} from '@modules/plugin/commands/plugin-registry-package';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { createZstdDecompress } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import fs from 'node:fs/promises';
import path from 'node:path';
import * as tar from 'tar';

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
                ErrorCodes.PLUGIN_SYNC_UNAVAILABLE,
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
        return {
            queued,
            jobId
        };
    }

    @Command('registry.install')
    async registryInstall(payload: TeamClusterDaemonRegistryInstallPayload): Promise<TeamClusterDaemonRegistryInstallResult> {
        return withNativeProcessingTempDir('plugin-registry-install', async (dir) => {
            const tarball = await downloadVerifiedTarball(payload.downloadUrl, payload.sha256);
            const tgzPath = path.join(dir, 'package.tgz');
            const extractDir = path.join(dir, 'extracted');
            await fs.writeFile(tgzPath, tarball);
            await fs.mkdir(extractDir, { recursive: true });
            const isZstd = tarball[0] === 0x28 && tarball[1] === 0xb5 && tarball[2] === 0x2f && tarball[3] === 0xfd;
            const archiveStream = createReadStream(tgzPath);
            await (isZstd
                ? pipeline(archiveStream, createZstdDecompress(), tar.x({ cwd: extractDir }))
                : pipeline(archiveStream, tar.x({ cwd: extractDir })));

            const workflow = await readRegistryWorkflow(extractDir);
            const entrypoint = resolveRegistryEntrypoint(workflow);
            const fileName = path.basename(entrypoint.binaryFileName ?? entrypoint.binary ?? '');
            let body: Buffer;
            if (entrypoint.type === 'executable') {
                body = await fs.readFile(await locateRegistryExecutable(extractDir, fileName));
            } else {
                const zipPath = path.join(dir, fileName);
                await packageRegistryProjectZip(extractDir, zipPath);
                body = await fs.readFile(zipPath);
            }
            const hash = createHash('sha256').update(body).digest('hex');
            const scope = payload.name.replace(/^@/, '').replace(/\//g, '-');
            const objectPath = `plugin-binaries/registry/${scope}/${payload.version}/${payload.platform}/${fileName}`;

            logger.info({
                fileName,
                type: entrypoint.type,
                size: body.length,
                objectPath
            }, '@plugin-registry-install: uploading binary');
            await this.objectStore.putObject({
                ownerClusterId: this.config.teamClusterId,
                bucket: ObjectBucketName.Plugins,
                objectKey: objectPath,
                body,
                metadata: {
                    sha256: hash,
                    'original-name': fileName
                }
            });
            logger.info({ objectPath }, '@plugin-registry-install: upload complete');

            return {
                workflow,
                binary: {
                    objectPath,
                    fileName,
                    hash,
                    sizeBytes: body.length
                },
                ownerClusterId: this.config.teamClusterId
            };
        });
    }

    @Command('listings.list')
    listListings(payload: PluginListingFilter) {
        return this.pluginListingRepository.listPluginListings(payload);
    }

    @Command('sub-listings.list')
    listSubListings(payload: PluginSubListingFilter) {
        return this.pluginListingRepository.listPluginSubListings(payload);
    }

    @Command('transfer.listings.export')
    exportListings(payload: PluginListingTransferExportPayload) {
        return this.pluginListingRepository.exportListingRows(payload);
    }

    @Command('transfer.listings.import')
    async importListings(payload: PluginListingTransferImportPayload) {
        return {
            importedRows: await this.pluginListingRepository.importListingRows(payload)
        };
    }

    @Command('transfer.listings.purge')
    async purgeListings(payload: PluginListingTransferPurgePayload) {
        return {
            deletedRows: await this.pluginListingRepository.purgeListingRows(payload)
        };
    }
}

export const getPluginCommands = commandGroupFactory(PluginCommands, () => new PluginCommands(getObjectStore(), getPluginListingRepository(), getQueueService(), getConfig()));
