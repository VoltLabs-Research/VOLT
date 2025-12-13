import logger from '@/logger';
import { NodeType, Exporter } from '@/types/models/plugin';
import { IPlugin, IWorkflow } from '@/types/models/modifier';
import nodeRegistry, { ExecutionContext } from '@/services/nodes/node-registry';
import { topologicalSort, findDescendantByType } from '@/utilities/plugins/workflow-utils';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

interface ExposureResult{
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

export default class PluginWorkflowEngine{
    private pluginsDir: string;

    constructor(pluginsDir: string = process.env.PLUGINS_DIR || 'plugins'){
        this.pluginsDir = pluginsDir;
    }

    async execute(
        plugin: IPlugin,
        trajectoryId: string,
        analysisId: string,
        userConfig: Record<string, any>
    ): Promise<ExposureResult[]>{
        const context: ExecutionContext = {
            outputs: new Map(),
            userConfig,
            trajectoryId,
            analysisId,
            generatedFiles: [],
            pluginSlug: plugin.slug,
            pluginDir: path.join(this.pluginsDir, plugin.slug),
            workflow: plugin.workflow
        };

        try{
            const executionOrder = topologicalSort(plugin.workflow);
            logger.info(`[PluginWorkflowEngine] Executing "${plugin.slug}" - ${executionOrder.length} nodes`);

            for(const node of executionOrder){
                await nodeRegistry.execute(node, context);
            }

            return this.collectExposureResults(plugin.workflow, context);
        }catch(error: any){
            logger.error(`[PluginWorkflowEngine] Execution failed: ${error.message}`);
            await this.cleanup(context.generatedFiles);
            throw error;
        }
    }

    private collectExposureResults(workflow: IWorkflow, context: ExecutionContext): ExposureResult[]{
        const results: ExposureResult[] = [];
        const exposureNodes = workflow.nodes.filter((node) => node.type === NodeType.EXPOSURE);

        for(const exposureNode of exposureNodes){
            const exposureOutput = context.outputs.get(exposureNode.id);
            if(!exposureOutput?.results) continue;

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

    private async cleanup(files: string[]): Promise<void>{
        for(const file of files){
            try{
                await fs.unlink(file);
            }catch{
            }
        }
    }
};
