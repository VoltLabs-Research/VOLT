import { injectable, inject } from 'tsyringe';
import { WorkflowNodeType, WorkflowNode } from '@modules/plugin/domain/entities/workflow/WorkflowNode';
import { INodeHandler, ExecutionContext, NodeOutputSchema, T, INodeRegistry } from '@modules/plugin/domain/port/INodeRegistry';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IPluginBinaryCacheService } from '@modules/plugin/domain/port/IPluginBinaryCacheService';
import { ITempFileService } from '@shared/domain/port/ITempFileService';
import { IProcessExecutorService } from '@modules/plugin/domain/port/IProcessExecutorService';
import { ErrorCodes } from '@core/constants/error-codes';
import path from 'node:path';
import logger from '@shared/infrastructure/logger';

@injectable()
export default class EntrypointHandler implements INodeHandler{
    readonly type = WorkflowNodeType.Entrypoint;

    constructor(
        @inject(PLUGIN_TOKENS.NodeRegistry)
        private registry: INodeRegistry,
        @inject(PLUGIN_TOKENS.PluginBinaryCacheService)
        private binaryCache: IPluginBinaryCacheService,
        @inject(PLUGIN_TOKENS.ProcessExecutorService)
        private processExecutor: IProcessExecutorService,
        @inject(SHARED_TOKENS.TempFileService)
        private tempFileService: ITempFileService
    ){}

    readonly outputSchema: NodeOutputSchema = {
        properties: {
            results: T.array(T.object({
                index: T.number(),
                input: T.any(),
                success: T.boolean(),
                outputPath: T.string(),
                error: T.string()
            })),
            successCount: T.number(),
            failCount: T.number()
        }
    };

    async execute(node: WorkflowNode, context: ExecutionContext): Promise<Record<string, any>>{
        const config = node.data.entrypoint!;
        if(!config.binaryObjectPath) throw new Error(ErrorCodes.PLUGIN_ENTRYPOINT_BINARY_REQUIRED);

        // Resolve binary 
        const binaryPath = await this.binaryCache.getBinaryPath({
            pluginId: context.pluginId,
            binaryObjectPath: config.binaryObjectPath,
            binaryFileName: config.binaryFileName
        });

        // Prepare execution context (output dir)
        const { item, index, outputDir } = await this.prepareContext(node.id, context);

        // Resolve arguments
        const rawArgs = this.registry.resolveTemplate(config.arguments, context);
        const args = this.parseArguments(rawArgs);

        logger.info(`@entrypoint-handler: executing job #${index} using binary: ${path.basename(binaryPath)}`);

        // Execute
        try{
            const result = await this.processExecutor.execute(binaryPath, args, outputDir);
            const output = {
                results: [{
                    index,
                    input: item,
                    success: true,
                    outputPath: outputDir
                }],
                stdout: result.stdout,
                stderr: result.stderr,
                exitCode: result.code,
                successCount: 1,
                failCount: 0
            };
            return output;
        }catch(error: unknown){
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`@entrypoint-handler: job #${index} failed: ${errorMessage}`);
            const output = {
                results: [{
                    index,
                    input: item,
                    success: false,
                    error: errorMessage
                }],
                stdout: '',
                stderr: errorMessage,
                exitCode: 1,
                successCount: 0,
                failCount: 1
            };
            return output;
        }
    }

    private async prepareContext(nodeId: string, context: ExecutionContext){
        const forEachNode = context.workflow.findParentByType(nodeId, WorkflowNodeType.ForEach);
        if(!forEachNode) throw new Error(ErrorCodes.PLUGIN_ENTRYPOINT_FOREACH_REQUIRED);

        const output = context.outputs.get(forEachNode.id);
        const item = output?.currentValue;
        const index = output?.currentIndex ?? 0;

        if(item === null || item === undefined) throw new Error(ErrorCodes.PLUGIN_ENTRYPOINT_ITERATION_MISSING);

        // Create unique output directory for this job execution
        const dirName = `job-${context.analysisId}-${index}-${Date.now()}`;
        const outputDir = this.tempFileService.getDirPath(dirName);
        await this.tempFileService.ensureDir(outputDir);
        
        output!.outputPath = outputDir;

        return { item, index, outputDir };
    }

    private parseArguments(str: string): string[]{
        if(!str) return [];
        const regex = /"([^"]*)"|'([^']*)'|(\S+)/g;
        return [...str.matchAll(regex)].map(m => m[1] ?? m[2] ?? m[3]);
    }
};
