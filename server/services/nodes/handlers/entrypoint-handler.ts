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
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import tempFileManager from '@/services/temp-file-manager';

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

    async execute(node: IWorkflowNode, context: ExecutionContext): Promise<Record<string, any>> {
        const config = node.data.entrypoint!;
        if (!config.binaryObjectPath) throw new Error('Entrypoint::Binary::NotUploaded');

        const binaryPath = await this.getBinaryPath(config, context);
        const forEachNode = findParentByType(node.id, context.workflow, NodeType.FOREACH);
        if (!forEachNode) throw new Error('Entrypoint must be connected to ForEach');

        const forEachOutput = context.outputs.get(forEachNode.id)!;

        // The currentValue and currentIndex are set by the workflow engine
        // when a specific forEachItem is provided to the job
        const item = forEachOutput.currentValue;
        const index = forEachOutput.currentIndex ?? 0;

        if (item === undefined || item === null) {
            throw new Error('Entrypoint::ForEach::NoCurrentItem - forEach item not set');
        }

        // Set the output path for this item
        forEachOutput.outputPath = path.join(tempFileManager.rootPath, `${context.pluginSlug}-${context.analysisId}-${index}-${Date.now()}`);

        const resolvedArgs = resolveTemplate(config.arguments, context);
        const argsArray = parseArgumentString(resolvedArgs);

        logger.info(`[EntrypointHandler] Running: ${config.binary}`);

        try {
            await this.cli.run(binaryPath, argsArray);
            return {
                results: [{
                    index,
                    input: item,
                    success: true,
                    outputPath: forEachOutput.outputPath
                }],
                successCount: 1,
                failCount: 0
            };
        } catch (error: any) {
            logger.error(`[EntrypointHandler] Failed: ${error.message}`);
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

    private async getBinaryPath(config: any, context: ExecutionContext): Promise<string> {
        const hash = config.binaryHash;

        // If hash exists, use the binary cache system which has internal locks
        // to prevent ETXTBSY errors when multiple jobs run in parallel
        if (hash) {
            // First check if already cached (this waits for pending downloads)
            const cachedPath = await binaryCache.get(hash);
            if (cachedPath) return cachedPath;

            // Download and cache directly using the cache's locking mechanism
            logger.info(`[EntrypointHandler] Downloading binary to cache: ${config.binaryObjectPath}`);
            const stream = await storage.getStream(SYS_BUCKETS.PLUGINS, config.binaryObjectPath);
            // binaryCache.put() handles locking internally - only one process will write
            return await binaryCache.put(hash, stream);
        }

        // Fallback for binaries without hash (legacy behavior)
        // Each job gets its own copy to avoid conflicts
        logger.info(`[EntrypointHandler] Downloading binary (no hash): ${config.binaryObjectPath}`);
        const stream = await storage.getStream(SYS_BUCKETS.PLUGINS, config.binaryObjectPath);
        const ext = path.extname(config.binaryFileName || config.binary || '');
        const binaryPath = path.join(tempFileManager.rootPath, `plugin-binary-${context.pluginSlug}-${Date.now()}${ext}`);

        const writeStream = createWriteStream(binaryPath);
        await pipeline(stream, writeStream);

        context.generatedFiles.push(binaryPath);
        await fs.chmod(binaryPath, 0o755);
        return binaryPath;
    }
};

export default new EntrypointHandler();
