import { Exporter, NodeType } from '@/types/models/plugin';
import { IWorkflowNode } from '@/types/models/modifier';
import { NodeHandler, ExecutionContext } from '@/services/nodes/node-registry';
import { T, NodeOutputSchema } from '@/services/nodes/schema-types';
import { findAncestorByType, getNestedValue } from '@/utilities/plugins/workflow-utils';
import { SYS_BUCKETS } from '@/config/minio';
import { encodeMsgpack, readMsgpackFile } from '@/utilities/msgpack/msgpack';
import storage from '@/services/storage';
import logger from '@/logger';

class ExposureHandler implements NodeHandler{
    readonly type = NodeType.EXPOSURE;

    readonly outputSchema: NodeOutputSchema = {
        properties: {
            results: T.array(T.object({
                index: T.number(),
                frame: T.number('Frame number'),
                name: T.string('Exposure name'),
                data: T.any('Processed data'),
                count: T.number('Data item count'),
                storageKey: T.string('MinIO storage key'),
                error: T.string('Error if failed')
            }), 'Results per frame'),
            sample: T.object({}, 'First successful result')
        }
    };

    async execute(node: IWorkflowNode, context: ExecutionContext): Promise<Record<string, any>>{
        const config = node.data.exposure!;
        const entrypointNode = findAncestorByType(node.id, context.workflow, NodeType.ENTRYPOINT);
        const entrypointOutput = entrypointNode ? context.outputs.get(entrypointNode.id) : null;

        let itemsToProcess: any[] = [];
        if(entrypointOutput && Array.isArray(entrypointOutput.results)){
            itemsToProcess = entrypointOutput.results;
        }
        if(itemsToProcess.length === 0) throw new Error('Exposure::NoItemsToProcess');

        const exposureResults: any[] = [];
        for(const item of itemsToProcess){
            if(!item.success && item.error){
                exposureResults.push({ index: item.index, error: item.error });
                continue;
            }
            const resultsPath = `${item.outputPath}_${config.results}`;
            try{
                const rawData = await readMsgpackFile(resultsPath);
                context.generatedFiles.push(resultsPath);

                let data = rawData;
                if(config.iterable) data = getNestedValue(rawData, config.iterable);

                const storageKey = `plugins/trajectory-${context.trajectoryId}/analysis-${context.analysisId}/${node.id}/timestep-${item.input.frame}.msgpack`;
                const buffer = encodeMsgpack(data);
                await storage.put(SYS_BUCKETS.PLUGINS, storageKey, buffer, { 'Content-Type': 'application/msgpack' });

                exposureResults.push({
                    index: item.index,
                    frame: item.input?.frame,
                    name: config.name,
                    raw: rawData,
                    data,
                    count: Array.isArray(data) ? data.length : 1,
                    storageKey
                });
            }catch(error: any){
                logger.error(`[ExposureHandler] Failed for item ${item.index}: ${error.message}`);
                exposureResults.push({
                    index: item.index,
                    name: config.name,
                    error: error.message,
                    data: null
                });
            }
        }

        return {
            results: exposureResults,
            sample: exposureResults.find((r) => !r.error)
        };
    }
};

export default new ExposureHandler();
