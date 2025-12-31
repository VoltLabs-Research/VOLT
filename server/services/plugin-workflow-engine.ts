import logger from '@/logger';
import { NodeType, Exporter } from '@/types/models/plugin';
import { IPlugin, IWorkflow } from '@/types/models/modifier';
import nodeRegistry, { ExecutionContext } from '@/services/nodes/node-registry';
import { topologicalSort, findDescendantByType } from '@/utilities/plugins/workflow-utils';
import tempFileManager from '@/services/temp-file-manager';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
// Ensure all node handlers are registered
import '@/services/nodes/handlers';

interface ExposureResult {
    exposureName: string;
    nodeId: string;
    data: any;
    schema?: Record<string, any>;
    visualizers?: {
        canvas: boolean;
        raster: boolean;
        listing: Record<string, string>;
    };
    export?: {
        exporter: Exporter;
        type: string;
        objectPath?: string;
    };
};

export default class PluginWorkflowEngine {
    private pluginsDir: string;

    constructor(pluginsDir: string = process.env.PLUGINS_DIR || 'plugins') {
        this.pluginsDir = pluginsDir;
    }

    /**
     * Evaluates the workflow up to the forEach node and returns the items to iterate over.
     * This is used to determine how many jobs to create.
     */
    async evaluateForEachItems(
        plugin: IPlugin,
        trajectoryId: string,
        analysisId: string,
        userConfig: Record<string, any>,
        teamId: string,
        options?: { selectedFrameOnly?: boolean; timestep?: number }
    ): Promise<{ items: any[]; forEachNodeId: string } | null> {
        const context = this.createContext(plugin, trajectoryId, analysisId, userConfig, teamId, options);
        const executionOrder = topologicalSort(plugin.workflow);

        // Execute nodes until we hit the forEach node
        for (const node of executionOrder) {
            await nodeRegistry.execute(node, context);

            if (node.type === NodeType.FOREACH) {
                const forEachOutput = context.outputs.get(node.id);
                if (forEachOutput?.items) {
                    return {
                        items: forEachOutput.items,
                        forEachNodeId: node.id
                    };
                }
            }
        }

        return null;
    }

    /**
     * Execute the full workflow for a specific forEach item.
     * Called by the worker for each job.
     */
    async execute(
        plugin: IPlugin,
        trajectoryId: string,
        analysisId: string,
        userConfig: Record<string, any>,
        teamId: string,
        forEachItem?: any,
        forEachIndex?: number,
    ): Promise<ExposureResult[]> {
        const context = this.createContext(plugin, trajectoryId, analysisId, userConfig, teamId);

        try {
            const executionOrder = topologicalSort(plugin.workflow);
            logger.info(`[PluginWorkflowEngine] Executing "${plugin.slug}" - ${executionOrder.length} nodes`);

            // Track nodes to skip based on If-Statement branches
            const skippedNodes = new Set<string>();

            for (const node of executionOrder) {
                // Check if this node should be skipped due to If-Statement branch
                if (skippedNodes.has(node.id)) {
                    logger.debug(`[PluginWorkflowEngine] Skipping node ${node.id} (${node.type}) - branch not taken`);
                    continue;
                }

                // If this is the forEach node and we have a specific item, inject it
                if (node.type === NodeType.FOREACH && forEachItem !== undefined) {
                    // Execute the forEach to get the items array first
                    await nodeRegistry.execute(node, context);
                    const forEachOutput = context.outputs.get(node.id);
                    if (forEachOutput) {
                        // Override with the specific item for this job
                        forEachOutput.currentValue = forEachItem;
                        forEachOutput.currentIndex = forEachIndex ?? 0;
                    }
                } else {
                    await nodeRegistry.execute(node, context);
                }

                // After executing an If-Statement, determine which branch to skip
                if (node.type === NodeType.IF_STATEMENT) {
                    const ifOutput = context.outputs.get(node.id);
                    const result = ifOutput?.result; // true or false
                    const skipBranch = result ? 'output-false' : 'output-true';

                    // Find nodes connected to the skipped branch and mark them (recursively)
                    const nodesToSkip = this.getNodesOnBranch(node.id, skipBranch, plugin.workflow);
                    for (const nodeId of nodesToSkip) {
                        skippedNodes.add(nodeId);
                    }
                    logger.info(`[PluginWorkflowEngine] If-Statement ${node.id} = ${result}, skipping ${nodesToSkip.length} nodes on ${skipBranch} branch`);
                }
            }

            const results = this.collectExposureResults(plugin.workflow, context);
            await this.cleanup(context.generatedFiles);
            return results;
        } catch (error: any) {
            logger.error(`[PluginWorkflowEngine] Execution failed: ${error.message}`);
            await this.cleanup(context.generatedFiles);
            throw error;
        }
    }

    /**
     * Get all nodes transitively reachable from a specific source handle
     */
    private getNodesOnBranch(ifNodeId: string, sourceHandle: string, workflow: IWorkflow): string[] {
        const result: string[] = [];
        const visited = new Set<string>();

        // Find direct children connected via the specific handle
        const directChildren = workflow.edges
            .filter(e => e.source === ifNodeId && e.sourceHandle === sourceHandle)
            .map(e => e.target);

        const queue = [...directChildren];

        while (queue.length > 0) {
            const nodeId = queue.shift()!;
            if (visited.has(nodeId)) continue;
            visited.add(nodeId);
            result.push(nodeId);

            // Add all children of this node (they're also on this branch)
            const children = workflow.edges
                .filter(e => e.source === nodeId)
                .map(e => e.target);
            queue.push(...children);
        }

        return result;
    }

    private createContext(
        plugin: IPlugin,
        trajectoryId: string,
        analysisId: string,
        userConfig: Record<string, any>,
        teamId: string,
        options?: { selectedFrameOnly?: boolean; timestep?: number }
    ): ExecutionContext {
        return {
            outputs: new Map(),
            userConfig,
            trajectoryId,
            pluginId: plugin._id.toString(),
            teamId,
            analysisId,
            generatedFiles: [],
            pluginSlug: plugin.slug,
            pluginDir: path.join(this.pluginsDir, plugin.slug),
            selectedFrameOnly: options?.selectedFrameOnly,
            selectedTimestep: options?.timestep,
            workflow: plugin.workflow
        };
    }

    private collectExposureResults(workflow: IWorkflow, context: ExecutionContext): ExposureResult[] {
        const results: ExposureResult[] = [];
        const exposureNodes = workflow.nodes.filter((node) => node.type === NodeType.EXPOSURE);

        for (const exposureNode of exposureNodes) {
            const exposureOutput = context.outputs.get(exposureNode.id);
            if (!exposureOutput?.results) continue;

            const schemaNode = findDescendantByType(exposureNode.id, workflow, NodeType.SCHEMA);
            const visualizersNode = findDescendantByType(exposureNode.id, workflow, NodeType.VISUALIZERS);
            const exportNode = findDescendantByType(exposureNode.id, workflow, NodeType.EXPORT);

            const exposureData = exposureNode.data.exposure!;
            const firstSuccess = exposureOutput.results.find((r: any) => !r.error);

            results.push({
                exposureName: exposureData.name,
                nodeId: exposureNode.id,
                data: firstSuccess?.data,
                schema: schemaNode ? context.outputs.get(schemaNode.id)?.definition : undefined,
                visualizers: visualizersNode ? context.outputs.get(visualizersNode.id) as {
                    canvas: boolean;
                    raster: boolean;
                    listing: Record<string, string>;
                } : undefined,
                export: exportNode ? {
                    exporter: exportNode.data.export!.exporter,
                    type: exportNode.data.export!.type,
                    objectPath: context.outputs.get(exportNode.id)?.results?.[0]?.objectPath
                } : undefined
            });
        }

        return results;
    }

    private async cleanup(files: string[], sessionId?: string): Promise<void> {
        // Register files with session for fallback cleanup if session ID provided
        if (sessionId && files.length > 0) {
            tempFileManager.registerMany(sessionId, files);
        }

        // Immediate cleanup of generated files
        for (const file of files) {
            try {
                await fs.rm(file, { recursive: true, force: true });
            } catch {
                // Silently ignore - file might already be deleted
            }
        }
    }
};
