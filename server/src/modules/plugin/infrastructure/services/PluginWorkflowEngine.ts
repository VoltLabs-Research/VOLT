import { IPluginWorkflowEngine, ExposureResult, ExecutionPlanResult, WorkflowExecutionRequest, DebugHooks } from '@modules/plugin/domain/port/IPluginWorkflowEngine';
import Workflow from '@modules/plugin/domain/entities/workflow/Workflow';
import { WorkflowNodeType } from '@modules/plugin/domain/entities/workflow/WorkflowNode';
import { injectable, inject } from 'tsyringe';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { ExecutionContext, INodeRegistry } from '@modules/plugin/domain/port/INodeRegistry';
import { getExposureNodes } from '@modules/plugin/infrastructure/utilities/get-exposure-nodes';
import fs from 'node:fs/promises';
import logger from '@shared/infrastructure/logger';

type ExposureOutputItem = {
    error?: unknown;
    data?: unknown;
    objectPath?: string;
};

type ExposureOutput = {
    results?: ExposureOutputItem[];
};

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

        logger.info(`@plugin-workflow-engine: planning execution for plugin "${request.plugin._id}"`);
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

    async executeWorkflowJob(request: WorkflowExecutionRequest, hooks?: DebugHooks): Promise<ExposureResult[]>{
        const { plugin, currentIterationIndex, currentIterationItem } = request;
        const context = this.createExecutionContext(request);

        try{
            const executionOrder = plugin.props.workflow.topologicalSort();
            const nodesToSkip = new Set<string>();
            const total = executionOrder.length;
            const logPrefix = hooks ? 'debug job' : 'job';

            logger.info(`@plugin-workflow-engine: ${logPrefix} start "${plugin._id}" (Index: ${currentIterationIndex})`);

            for(let i = 0; i < executionOrder.length; i++){
                const node = executionOrder[i];

                if(nodesToSkip.has(node.id)){
                    if(hooks){
                        await hooks.onNodeSkipped(node.id, node.type, 'Disabled by if-statement branch');
                    }
                    continue;
                }

                if(hooks){
                    await hooks.onNodeStart(node.id, node.type, i, total);
                }

                const startTime = Date.now();

                try{
                    if(node.type === WorkflowNodeType.ForEach && currentIterationIndex !== undefined){
                        logger.info(`@plugin-workflow-engine: executing ForEach node ${node.id} with iterationIndex=${currentIterationIndex}`);
                        await this.nodeRegistry.execute(node, context);
                        const forEachOutput = context.outputs.get(node.id);
                        if(forEachOutput){
                            forEachOutput.currentValue = currentIterationItem;
                            forEachOutput.currentIndex = currentIterationIndex ?? 0;
                        }
                    }else{
                        await this.nodeRegistry.execute(node, context);
                    }

                    const rawOutput = context.outputs.get(node.id);

                    if(hooks){
                        const durationMs = Date.now() - startTime;
                        const output = rawOutput ?? {};
                        const contextSnapshot: Record<string, Record<string, unknown>> = {};
                        context.outputs.forEach((value, key) => {
                            contextSnapshot[key] = value;
                        });
                        await hooks.onNodeCompleted(node.id, node.type, output, durationMs, i, contextSnapshot);
                    }
                }catch(nodeError: unknown){
                    if(hooks){
                        const error = nodeError instanceof Error ? nodeError : new Error(String(nodeError));
                        await hooks.onNodeError(node.id, node.type, error);
                    }
                    throw nodeError;
                }

                if(node.type === WorkflowNodeType.IfStatement){
                    this.handleBranching(node.id, context, plugin.props.workflow, nodesToSkip);
                }
            }

            const results = this.collectExposureResults(plugin.props.workflow, context);
            await this.cleanupGeneratedFiles(context.generatedFiles);

            return results;
        }catch(error: unknown){
            const message = error instanceof Error ? error.message : String(error);
            logger.error(`@plugin-workflow-engine: ${hooks ? 'debug ' : ''}job failed ${message}`);
            await this.cleanupGeneratedFiles(context.generatedFiles);
            throw error;
        }
    }

    private collectExposureResults(workflow: Workflow, context: ExecutionContext): ExposureResult[]{
        const results: ExposureResult[] = [];
        const descriptors = getExposureNodes(workflow.props.nodes);

        for(const { exposureName, node } of descriptors){
            const exposureOutput = context.outputs.get(node.id) as ExposureOutput | undefined;
            if(!exposureOutput?.results) continue;

            const exportNode = workflow.findDescendantByType(node.id, WorkflowNodeType.Export);

            const exposureData = node.data.exposure;
            if(!exposureData) continue;
            const firstSuccess = exposureOutput.results.find((result) => !result.error);

            results.push({
                exposureName,
                nodeId: node.id,
                data: firstSuccess?.data,
                canvas: exposureData.canvas,
                raster: exposureData.raster,
                export: exportNode ? {
                    exporter: exportNode.data.export!.exporter,
                    type: exportNode.data.export!.type,
                    objectPath: (context.outputs.get(exportNode.id) as ExposureOutput | undefined)?.results?.[0]?.objectPath
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
            pluginId: req.plugin._id,
            teamId: req.teamId,
            analysisId: req.analysisId,
            generatedFiles: [],
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
