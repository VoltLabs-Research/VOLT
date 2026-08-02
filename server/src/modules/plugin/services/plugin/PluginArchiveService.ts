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
import {
    WorkflowValidationMode,
    WorkflowValidatorService
} from '@modules/plugin/services/plugin/WorkflowValidatorService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type {
    IClusterObjectArchiveService,
    IStoragePlacementService,
    ITeamClusterObjectGatewayClient
} from '@shared/contracts/ports';
import logger from '@shared/infrastructure/logger';
import type { TeamClusterDaemonRegistryInstallBinary } from '@shared/infrastructure/contracts/team-cluster';
import { PluginStatus } from '@volt/contracts/modules/plugin/enums';
import path from 'node:path';
import type { Readable } from 'node:stream';
import unzipper from 'unzipper';
import { v4 } from 'uuid';

/**
 * Moves whole plugins in and out of the platform as zip archives: the `.zip`
 * export, the user-uploaded import, and the registry install that shares the
 * same "create the plugin, attach its binary, publish when valid" path.
 */
export default class PluginArchiveService {
    constructor(
        private readonly storagePlacementService: IStoragePlacementService,
        private readonly objectGatewayClient: ITeamClusterObjectGatewayClient,
        private readonly workflowValidator: WorkflowValidatorService,
        private readonly archiveService: IClusterObjectArchiveService
    ) {}

    private async resolveOwnerClusterId(pluginId: string): Promise<string> {
        const placement = await this.storagePlacementService.ensurePlacement('plugin-binary', pluginId);
        return placement.props.primaryClusterId;
    }

    async exportPlugin(pluginId: string): Promise<Readable> {
        const plugin = await requirePlugin(pluginId);
        const entrypoint = plugin.props.workflow.entrypoint;
        const ownerClusterId = await this.resolveOwnerClusterId(pluginId);
        const binaryObjectPath = entrypoint?.binaryObjectPath;

        const archive = await this.archiveService.createArchiveDownload({
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

        return archive.stream;
    }

    async importPlugin(fileBuffer: Buffer, teamId: string): Promise<Plugin> {
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
        return this.publishIfValid(newPlugin);
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

        await this.storagePlacementService.assignPluginBinaryPlacement(newPlugin.id, teamId, ownerClusterId);

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

        await this.objectGatewayClient.putBuffer(await this.resolveOwnerClusterId(plugin.id), {
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

    /**
     * Imported and registry-installed plugins are only published when their
     * workflow is publishable; otherwise they stay a draft the user can fix.
     */
    private async publishIfValid(plugin: Plugin): Promise<Plugin> {
        const validation = await this.workflowValidator.validate(
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
