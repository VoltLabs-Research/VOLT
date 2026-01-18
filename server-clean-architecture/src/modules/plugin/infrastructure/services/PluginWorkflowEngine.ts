import { IPluginWorkflowEngine, ExposureResult, ExecutionPlanResult, WorkflowExecutionRequest } from '@modules/plugin/domain/ports/IPluginWorkflowEngine';
import Workflow from '@modules/plugin/domain/entities/workflow/Workflow';
import { WorkflowNodeType } from '@modules/plugin/domain/entities/workflow/WorkflowNode';
import { injectable, inject } from 'tsyringe';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { ExecutionContext, INodeRegistry } from '@modules/plugin/domain/ports/INodeRegistry';
import fs from 'node:fs/promises';
import logger from '@shared/infrastructure/logger';

@injectable()
export default class PluginWorkflowEngine implements IPluginWorkflowEngine{
    constructor(
        @inject(PLUGIN_TOKENS.NodeRegistry)
        private nodeRegistry: INodeRegistry
    ){}

    /**
     * Runs nodes sequentially until a ForEach node is encountered to determine paralleism.
     */
    async planExecutionStrategy(request: WorkflowExecutionRequest): Promise<ExecutionPlanResult | null>{
        const context = this.createExecutionContext(request);
        const executionOrder = request.plugin.props.workflow.topologicalSort();

        logger.info(`@plugin-workflow-engine: planning execution for plugin "${request.plugin.props.slug}"`);
        for(const node of executionOrder){
            // Execute the current node
            await this.nodeRegistry.execute(node, context);

            if(node.type === WorkflowNodeType.ForEach){
                const forEachOutput = context.outputs.get(node.id);
                if(forEachOutput?.items && Array.isArray(forEachOutput.items)){
                    logger.info(`@plugin-workflow-engine: found ${forEachOutput.items.length} items to process`);

                    return {
                        items: forEachOutput.items,
                        forEachNodeId: node.id
                    };
                } 
            }
        }

        logger.warn(`@plugin-workflow-engine: no foreach node found or no items generated`);
        return null;
    }

    /**
     * 
     * @param request Runs the workflow for a specific item
     */
    async executeWorkflowJob(request: WorkflowExecutionRequest): Promise<ExposureResult[]>{
        const { plugin, currentIterationIndex, currentIterationItem } = request;
        const context = this.createExecutionContext(request);

        try{
            const executionOrder = plugin.props.workflow.topologicalSort();
            const nodesToSkip = new Set<string>();

            logger.info(`@plugin-workflow-engine: job start "${plugin.props.slug}" (Index: ${currentIterationIndex})`);
            for(const node of executionOrder){
                // Skip logic (handled by previous If-Statements)
                if(nodesToSkip.has(node.id)) continue;

                // ForEach injection logic
                if(node.type === WorkflowNodeType.ForEach && currentIterationIndex !== undefined){
                    await this.nodeRegistry.execute(node, context);
                    const forEachOutput = context.outputs.get(node.id);
                    if(forEachOutput){
                        forEachOutput.currentValue = currentIterationItem;
                        forEachOutput.currentIndex = currentIterationIndex ?? 0;
                    }
                }else{
                    // Standard execution
                    await this.nodeRegistry.execute(node, context);
                }

                // Branching Logic (If-Statement)
                if(node.type === WorkflowNodeType.IfStatement){
                    this.handleBranching(node.id, context, plugin.props.workflow, nodesToSkip);
                }
            }

            const results = this.collectExposureResults(plugin.props.workflow, context);
            await this.cleanupGeneratedFiles(context.generatedFiles);

            return results;
        }catch(error: any){
            logger.error(`@plugin-workflow-engine: job failed ${error.message}`);
            await this.cleanupGeneratedFiles(context.generatedFiles);
            throw error;
        }
    }

    private collectExposureResults(workflow: Workflow, context: ExecutionContext): ExposureResult[]{
        const results: ExposureResult[] = [];
        const exposureNodes = workflow.props.nodes.filter((node) => node.type === WorkflowNodeType.Exposure);
        
        for(const exposureNode of exposureNodes){
            const exposureOutput = context.outputs.get(exposureNode.id);
            if(!exposureOutput?.results) continue;

            // Find related configuration nodes
            const schemaNode = workflow.findDescendantByType(exposureNode.id, WorkflowNodeType.Schema);
            const visualizersNode = workflow.findDescendantByType(exposureNode.id, WorkflowNodeType.Visualizers);
            const exportNode = workflow.findDescendantByType(exposureNode.id, WorkflowNodeType.Export);

            const exposureData = exposureNode.data.exposure;
            if(!exposureData) continue;
            const firstSuccess = exposureOutput.results.find((result: any) => !result.error);

            results.push({
                exposureName: exposureData.name,
                nodeId: exposureNode.id,
                data: firstSuccess?.data,
                schema: schemaNode ? context.outputs.get(schemaNode.id)?.definition : undefined,
                visualizers: visualizersNode ? context.outputs.get(visualizersNode.id) as any : undefined,
                export: exportNode ? {
                    exporter: exportNode.data.export!.exporter,
                    type: exportNode.data.export!.type,
                    objectPath: context.outputs.get(exportNode.id)?.results?.[0]?.objectPath
                } : undefined
            });
        }

        return results;
    }

    private handleBranching(
        nodeId: string,
        context: ExecutionContext,
        workflow: Workflow,
        skippedSet: Set<string>
    ): void{
        const ifOutput = context.outputs.get(nodeId);
        // boolean
        const conditionPassed = ifOutput?.result;
        // If true, skip the "false" branch. If false, skip the "true" branch
        const branchHandleToSkip = conditionPassed ? 'output-false' : 'output-true';
        const nodesToSkip = workflow.findDescendantNodesOnBranch(nodeId, branchHandleToSkip);
        nodesToSkip.forEach((id) => skippedSet.add(id));
        logger.debug(`@plugin-workflow-engine: if-node ${nodeId} is ${conditionPassed}; skipping ${nodesToSkip.length} nodes on '${branchHandleToSkip}'`);
    }

    private createExecutionContext(req: WorkflowExecutionRequest): ExecutionContext{
        return {
            outputs: new Map(),
            userConfig: req.userConfig,
            trajectoryId: req.trajectoryId,
            pluginId: req.plugin.id,
            teamId: req.teamId,
            analysisId: req.analysisId,
            generatedFiles: [],
            pluginSlug: req.plugin.props.slug,
            selectedFrameOnly: req.options?.selectedFrameOnly,
            selectedTimestep: req.options?.timestep,
            workflow: req.plugin.props.workflow
        };
    }

    private async cleanupGeneratedFiles(files: string[]): Promise<void>{
        if(files.length === 0) return;
        const promises = files.map((file) => fs.rm(file, { recursive: true, force: true }).catch(() => {}));
        await Promise.all(promises);
    }
};