import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import PluginEntity from '@modules/plugin/models/Plugin';
import Workflow from '@modules/plugin/models/plugin/workflow/Workflow';
import type { Plugin } from '@modules/plugin/contracts/plugin';
import {
    persistProjectedWorkflow,
    projectWorkflowColumns,
    requirePlugin,
    requirePluginEntity,
    toPluginLike
} from '@modules/plugin/services/plugin/PluginQueries';
import { computeSha256 } from '@modules/plugin/services/plugin/PluginBinaryStorageService';
import {
    isWorkflowProps,
    readPluginArchive
} from '@modules/plugin/services/plugin/plugin-archive-reader';
import workflowValidatorService, { WorkflowValidationMode } from '@modules/plugin/services/plugin/WorkflowValidatorService';
import ApplicationError from '@shared/errors/ApplicationError';
import logger from '@shared/logger';
import {
    ChannelCommands,
    type TeamClusterDaemonRegistryInstallBinary,
    type TeamClusterDaemonRegistryInstallResult
} from '@shared/contracts/types/team-cluster-daemon-channel';
import { PluginStatus } from '@volt/contracts/modules/plugin/enums';
import path from 'node:path';
import type unzipper from 'unzipper';
import { v4 } from 'uuid';
import storagePlacementService from '@modules/cluster/services/storage/StoragePlacementService';
import objectGatewayClient from '@modules/cluster/services/object-gateway/TeamClusterObjectGatewayClient';
import clusterObjectArchiveService from '@modules/cluster/services/object-store/ClusterObjectArchiveService';
import teamClusterDaemonClient from '@modules/cluster/services/team-cluster/TeamClusterDaemonClient';
import teamClusterSelectionService from '@modules/cluster/services/team-cluster/TeamClusterSelectionService';
import registryGateway from '@modules/plugin/services/plugin/RegistryGateway';
import { mapPluginToRecord } from '@modules/plugin/services/plugin/PluginQueries';
import eventBus from '@shared/events/PostgresEventBus';
import { createDownloadStreamResponse } from '@shared/http/responses/download-response';
import type { DownloadStreamOutput } from '@shared/contracts/types/DownloadStream';
import type { PluginRecord } from '@modules/plugin/contracts/plugin';

export interface RegistryInstallPluginInput {
    teamId: string;
    name: string;
    version?: string;
}

const DEFAULT_REGISTRY_INSTALL_PLATFORM = 'linux-x86_64';

class PluginArchiveService {
    async installFromRegistry(input: RegistryInstallPluginInput): Promise<PluginRecord> {
        if (!input.name) {
            throw ApplicationError.badRequest(ErrorCodes.REGISTRY_PACKAGE_NAME_REQUIRED, 'A registry package name is required');
        }

        const computeClusterId = await teamClusterSelectionService.resolveComputeClusterId(input.teamId);
        const platform = await teamClusterSelectionService.resolveClusterPlatform(computeClusterId) ?? DEFAULT_REGISTRY_INSTALL_PLATFORM;
        const tarball = await registryGateway.resolveTarball(input.name, input.version, platform);

        const installed = await teamClusterDaemonClient.command<TeamClusterDaemonRegistryInstallResult>(
            computeClusterId,
            ChannelCommands.PluginRegistryInstall,
            {
                downloadUrl: tarball.downloadUrl,
                sha256: tarball.sha256,
                fileName: tarball.fileName,
                name: input.name,
                version: tarball.version,
                platform
            },
            {
                timeoutClass: 'long-running-control-plane',
                retryClass: 'idempotent-command'
            }
        );

        const plugin = await this.createFromRegistry(
            installed.workflow,
            installed.binary,
            installed.ownerClusterId,
            input.teamId
        );

        await eventBus.emit('plugin.created', {
            pluginId: plugin._id,
            teamId: input.teamId
        });

        return mapPluginToRecord(plugin);
    }

    private async resolveOwnerClusterId(pluginId: string): Promise<string> {
        const placement = await storagePlacementService.ensurePlacement('plugin-binary', pluginId);
        return placement.props.primaryClusterId;
    }

    async exportPlugin(pluginId: string): Promise<DownloadStreamOutput> {
        const plugin = await requirePlugin(pluginId);
        const entrypoint = plugin.props.workflow.entrypoint;
        const ownerClusterId = await this.resolveOwnerClusterId(pluginId);
        const binaryObjectPath = entrypoint?.binaryObjectPath;

        const archive = await clusterObjectArchiveService.createArchiveDownload({
            teamClusterId: ownerClusterId,
            outputBucket: TEAM_CLUSTER_BUCKETS.TRAJECTORIES,
            outputObjectKey: `exports/plugins/${pluginId}/${v4()}.zip`,
            filename: `${pluginId}.zip`,
            entries: [
                {
                    type: 'inline',
                    name: 'plugin.json',
                    content: JSON.stringify({
                        workflow: plugin.props.workflow.props,
                        status: plugin.props.status,
                        exportedAt: new Date().toISOString()
                    }, null, 2)
                },
                ...(binaryObjectPath ? [{
                    type: 'object' as const,
                    ownerClusterId,
                    bucket: TEAM_CLUSTER_BUCKETS.PLUGINS,
                    objectKey: binaryObjectPath,
                    name: `binary/${entrypoint?.binaryFileName || path.basename(binaryObjectPath)}`,
                    optional: true
                }] : [])
            ]
        });

        return createDownloadStreamResponse({
            stream: archive.stream,
            contentType: 'application/zip',
            filename: `${pluginId}.zip`
        });
    }

    async importPlugin(fileBuffer: Buffer, teamId: string): Promise<PluginRecord> {
        const { workflowProps, binaryFile } = await readPluginArchive(fileBuffer);

        const workflow = new Workflow('', workflowProps);
        workflow.updateEntrypoint({
            binary: undefined,
            binaryObjectPath: undefined,
            binaryFileName: undefined
        });
        const newPlugin = await this.createDraft(workflow, teamId);

        if (binaryFile) {
            await this.attachImportedBinary(newPlugin, binaryFile);
        }

        logger.info(`@plugin-archive-service: plugin imported ${newPlugin._id}`);
        const plugin = await this.publishIfValid(newPlugin);

        await eventBus.emit('plugin.created', {
            pluginId: plugin._id,
            teamId
        });

        return mapPluginToRecord(plugin);
    }

    async createFromRegistry(
        workflowProps: unknown,
        binary: TeamClusterDaemonRegistryInstallBinary,
        ownerClusterId: string,
        teamId: string
    ): Promise<Plugin> {
        if (!isWorkflowProps(workflowProps)) {
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                'Invalid plugin workflow from registry'
            );
        }

        const workflow = new Workflow('', workflowProps);
        const columns = projectWorkflowColumns(workflow, '');
        const modifierKey = columns.modifier?.key?.trim();
        const existingEntity = modifierKey
            ? await this.findByTeamAndModifierKey(teamId, modifierKey)
            : null;

        const pluginEntity = existingEntity ?? PluginEntity.create();
        const newPlugin = toPluginLike(await Object.assign(pluginEntity, {
            ...columns,
            status: PluginStatus.DRAFT,
            team: teamId
        }).save());

        await storagePlacementService.assignPluginBinaryPlacement(newPlugin.id, teamId, ownerClusterId);

        newPlugin.props.workflow.updateEntrypoint({
            binary: binary.fileName,
            binaryObjectPath: binary.objectPath,
            binaryFileName: binary.fileName,
            binaryHash: binary.hash
        });
        await persistProjectedWorkflow(newPlugin._id, newPlugin.props.workflow);

        logger.info(`@plugin-archive-service: plugin installed from registry ${newPlugin._id}`);
        return this.publishIfValid(newPlugin);
    }

    private async createDraft(workflow: Workflow, teamId: string): Promise<Plugin> {
        return toPluginLike(await PluginEntity.create({
            ...projectWorkflowColumns(workflow, ''),
            status: PluginStatus.DRAFT,
            team: teamId
        }).save());
    }

    private async attachImportedBinary(plugin: Plugin, binaryFile: unzipper.File): Promise<void> {
        const binaryBuffer = await binaryFile.buffer();
        const binaryFileName = path.basename(binaryFile.path);
        const binaryObjectPath = `plugin-binaries/${plugin._id}/${v4()}-${binaryFileName}`;
        const binaryHash = computeSha256(binaryBuffer);

        await objectGatewayClient.putBuffer(await this.resolveOwnerClusterId(plugin.id), {
            bucket: TEAM_CLUSTER_BUCKETS.PLUGINS,
            objectKey: binaryObjectPath,
            buffer: binaryBuffer,
            contentLength: binaryBuffer.length,
            contentType: 'application/octet-stream',
            metadata: {
                'original-name': binaryFileName,
                sha256: binaryHash
            }
        });

        plugin.props.workflow.updateEntrypoint({
            binary: binaryFileName,
            binaryObjectPath,
            binaryFileName,
            binaryHash
        });

        await persistProjectedWorkflow(plugin._id, plugin.props.workflow);
        logger.info(`@plugin-archive-service: imported binary ${binaryObjectPath}`);
    }

    private async findByTeamAndModifierKey(teamId: string, modifierKey: string): Promise<PluginEntity | null> {
        const candidates = await PluginEntity.find({
            where: { team: teamId },
            select: {
                id: true,
                modifier: true
            },
            order: { createdAt: 'ASC' }
        });

        const match = candidates.find((candidate) => candidate.modifier?.key?.trim() === modifierKey);

        return match ? PluginEntity.findOneBy({ id: match.id }) : null;
    }

    private async publishIfValid(plugin: Plugin): Promise<Plugin> {
        const validation = await workflowValidatorService.validate(
            plugin.props.workflow.props,
            plugin.id,
            WorkflowValidationMode.Strict
        );

        if (!validation.isValid) {
            logger.warn(
                {
                    pluginId: plugin.id,
                    validationErrors: validation.errors
                },
                '@plugin-archive-service: plugin left in draft because it is not ready to publish'
            );
            return plugin;
        }

        const publishedEntity = await requirePluginEntity(plugin.id);

        return toPluginLike(await Object.assign(publishedEntity, { status: PluginStatus.PUBLISHED }).save());
    }
}

export default new PluginArchiveService();
