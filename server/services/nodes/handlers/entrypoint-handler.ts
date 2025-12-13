import { NodeType } from '@/types/models/plugin';
import { IWorkflowNode } from '@/types/models/modifier';
import { NodeHandler, ExecutionContext, resolveTemplate } from '@/services/nodes/node-registry';
import { T, NodeOutputSchema } from '@/services/nodes/schema-types';
import { findParentByType, parseArgumentString } from '@/utilities/plugins/workflow-utils';
import { SYS_BUCKETS } from '@/config/minio';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import storage from '@/services/storage';
import binaryCache from '@/services/binary-cache';
import CLIExec from '@/services/cli-exec';
import logger from '@/logger';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

class EntrypointHandler implements NodeHandler {
    readonly type = NodeType.ENTRYPOINT;
    private cli = new CLIExec();

    readonly outputSchema: NodeOutputSchema = {
        properties: {
            results: T.array(T.object({
                index: T.number(),
                input: T.any('Input item from forEach'),
                success: T.boolean(),
                outputPath: T.string('Path to output files'),
                error: T.string('Error message if failed')
            }), 'Execution results per item'),
            successCount: T.number('Number of successful executions'),
            failCount: T.number('Number of failed executions')
        }
    };

    async execute(node: IWorkflowNode, context: ExecutionContext): Promise<Record<string, any>>{
        const config = node.data.entrypoint!;
        if(!config.binaryObjectPath) throw new Error('Entrypoint::Binary::NotUploaded');

        const binaryPath = await this.getBinaryPath(config, context);
        const forEachNode = findParentByType(node.id, context.workflow, NodeType.FOREACH);
        if(!forEachNode) throw new Error('Entrypoint must be connected to ForEach');

        const forEachOutput = context.outputs.get(forEachNode.id)!;
        const items = (forEachOutput.items || []) as any[];
        const results: any[] = [];

        for(let i = 0; i < items.length; i++){
            const item = items[i];
            forEachOutput.currentValue = item;
            forEachOutput.currentIndex = i;
            forEachOutput.outputPath = path.join(os.tmpdir(), `${context.pluginSlug}-${context.analysisId}-${i}-${Date.now()}`);

            const resolvedArgs = resolveTemplate(config.arguments, context);
            const argsArray = parseArgumentString(resolvedArgs);

            logger.info(`[EntrypointHandler] Running: ${config.binary} [${i + 1}/${items.length}]`);

            try{
                await this.cli.run(binaryPath, argsArray);
                results.push({
                    index: i,
                    input: item,
                    success: true,
                    outputPath: forEachOutput.outputPath
                });
            }catch(error: any){
                logger.error(`[EntrypointHandler] Failed for item ${i}: ${error.message}`);
                results.push({
                    index: i,
                    input: item,
                    success: false,
                    error: error.message
                });
            }
        }

        return {
            results,
            successCount: results.filter((r) => r.success).length,
            // TODO: total - successCount?? hahah
            failCount: results.filter((r) => !r.success).length
        }
    }

    private async getBinaryPath(config: any, context: ExecutionContext): Promise<string>{
        const hash = config.binaryHash;
        if(hash){
            const cachedPath = await binaryCache.get(hash);
            if(cachedPath) return cachedPath;
        }

        logger.info(`[EntrypointHandler] Downloading binary: ${config.binaryObjectPath}`);
        const stream = await storage.getStream(SYS_BUCKETS.PLUGINS, config.binaryObjectPath);
        const ext = path.extname(config.binaryFileName || config.binary || '');
        const binaryPath = path.join(os.tmpdir(), `plugin-binary-${context.pluginSlug}-${Date.now()}${ext}`);

        const writeStream = createWriteStream(binaryPath);
        await pipeline(stream, writeStream);

        if(hash){
            const buffer = await fs.readFile(binaryPath);
            await binaryCache.putBuffer(hash, buffer);
        }

        context.generatedFiles.push(binaryPath);
        await fs.chmod(binaryPath, 0o755);
        return binaryPath;
    }
};

export default new EntrypointHandler();
