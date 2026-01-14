import { injectable, inject } from 'tsyringe';
import { WorkflowNodeType, WorkflowNode } from '@/src/modules/plugin/domain/entities/workflow/WorkflowNode';
import { INodeHandler, ExecutionContext, NodeOutputSchema, T, INodeRegistry } from '@/src/modules/plugin/domain/ports/INodeRegistry';
import { PLUGIN_TOKENS } from '../../../di/PluginTokens';
import { SHARED_TOKENS } from '@/src/shared/infrastructure/di/SharedTokens';
import { IPluginBinaryCacheService } from '@/src/modules/plugin/domain/ports/IPluginBinaryCacheService';
import { ITempFileService } from '@/src/shared/domain/ports/ITempFileService';
import { IProcessExecutorService } from '@/src/modules/plugin/domain/ports/IProcessExecutorService';
import path from 'node:path';
import logger from '@/src/shared/infrastructure/logger';

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
        if(!config.binaryObjectPath) throw new Error('Entrypoint: Binary not configured');

        // Resolve binary 
        const binaryPath = await this.binaryCache.getBinaryPath({
            pluginSlug: context.pluginSlug,
            binaryObjectPath: config.binaryObjectPath,
            binaryHash: config.binaryHash!,
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
            await this.processExecutor.execute(binaryPath, args, outputDir);
            return {
                results: [{
                    index,
                    input: item,
                    success: true,
                    outputPath: outputDir
                }],
                successCount: 1,
                failCount: 0
            };
        }catch(error: any){
            logger.error(`@entrypoint-handler: job #${index} failed: ${error.message}`);
            return {
                results: [{
                    index,
                    input: item,
                    success: false,
                    error: error.message
                }],
                successCount: 0,
                failCount: 1
            };
        }
    }

    private async prepareContext(nodeId: string, context: ExecutionContext){
        const forEachNode = context.workflow.findParentByType(nodeId, WorkflowNodeType.ForEach);
        if(!forEachNode) throw new Error('Entrypoint: Must be inside a ForEach loop');

        const output = context.outputs.get(forEachNode.id);
        const item = output?.currentValue;
        const index = output?.currentIndex ?? 0;

        if(item === null) throw new Error('Entrypoint: No current item in loop iteration');

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