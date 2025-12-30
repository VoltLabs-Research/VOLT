import { NodeType } from '@/types/models/plugin';
import { IWorkflowNode } from '@/types/models/modifier';
import { NodeHandler, ExecutionContext } from '@/services/nodes/node-registry';
import { T, NodeOutputSchema } from '@/services/nodes/schema-types';
import { findAncestorByType, findDescendantByType, getNestedValue } from '@/utilities/plugins/workflow-utils';
import { SYS_BUCKETS } from '@/config/minio';
import { decodeMultiStreamFromFile } from '@/utilities/msgpack/msgpack-stream';
import storage from '@/services/storage';
import logger from '@/logger';
import { PluginExposureMeta } from '@/models';
import removeArrays from '@/utilities/runtime/remove-arrays';
import pLimit from '@/utilities/perf/p-limit';
import * as fs from 'node:fs/promises';

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
                localPath: T.string('Local file path for downstream nodes'),
                error: T.string('Error if failed')
            }), 'Results per frame'),
            sample: T.object({}, 'First successful result')
        }
    };

    private mergeChunkedValue(target: any, incoming: any): any{
        if(incoming === undefined || incoming === null) return target;
        if(target === undefined || target === null) return incoming;

        if(Array.isArray(target) && Array.isArray(incoming)){
            target.push(...incoming);
            return target;
        }

        if(target && incoming && typeof target === 'object' && typeof incoming === 'object'){
            for(const [key, value] of Object.entries(incoming)){
                const existing = (target as any)[key];
                if(Array.isArray(existing) && Array.isArray(value)){
                    existing.push(...value);
                }else if(existing && value && typeof existing === 'object' && typeof value === 'object'){
                    (target as any)[key] = this.mergeChunkedValue(existing, value);
                }else{
                    (target as any)[key] = value;
                }
            }
            return target;
        }

        return incoming;
    }

    private async readExposurePayload(
        filePath: string,
        iterableKey: string | undefined,
        needsData: boolean,
        needsMetadata: boolean
    ): Promise<{ data: any; metadata: Record<string, any> | null; count: number; chunkCount: number }>{
        let data: any = null;
        let metadata: Record<string, any> | null = null;
        let count = 0;
        let chunkCount = 0;

        for await (const msg of decodeMultiStreamFromFile(filePath)){
            chunkCount++;

            if(needsMetadata){
                const chunkMeta = removeArrays(msg as any) as Record<string, any>;
                if(chunkMeta && typeof chunkMeta === 'object'){
                    metadata = this.mergeChunkedValue(metadata, chunkMeta) as Record<string, any>;
                }
            }

            const chunkData = iterableKey ? getNestedValue(msg as any, iterableKey) : msg;
            if(needsData){
                data = this.mergeChunkedValue(data, chunkData);
            }
            if(Array.isArray(chunkData)) count += chunkData.length;
            else if(chunkData !== undefined && chunkData !== null) count = Math.max(count, 1);
        }

        if(needsData && Array.isArray(data)) count = data.length;

        return { data, metadata, count, chunkCount };
    }

    async execute(node: IWorkflowNode, context: ExecutionContext): Promise<Record<string, any>>{
        const config = node.data.exposure!;
        const entrypointNode = findAncestorByType(node.id, context.workflow, NodeType.ENTRYPOINT);
        const entrypointOutput = entrypointNode ? context.outputs.get(entrypointNode.id) : null;
        const exposureId = node.id;

        let itemsToProcess: any[] = [];
        if(entrypointOutput && Array.isArray(entrypointOutput.results)){
            itemsToProcess = entrypointOutput.results;
        }
        if(itemsToProcess.length === 0) throw new Error('Exposure::NoItemsToProcess');

        const exportNode = findDescendantByType(node.id, context.workflow, NodeType.EXPORT);
        const visualizerNode = findDescendantByType(node.id, context.workflow, NodeType.VISUALIZERS);
        const needsExportData = Boolean(exportNode);
        const hasListing = Boolean(visualizerNode?.data?.visualizers?.listing && Object.keys(visualizerNode.data.visualizers.listing).length);
        const needsMetadata = hasListing;

        const concurrency = Math.max(1, parseInt(process.env.EXPOSURE_HANDLER_CONCURRENCY || '4', 10));
        const limit = pLimit(concurrency);

        const exposureResults = await Promise.all(itemsToProcess.map((item) => limit(async() => {
            if(!item.success && item.error){
                return { index: item.index, error: item.error };
            }

            const resultsPath = `${item.outputPath}_${config.results}`;
            try{
                context.generatedFiles.push(resultsPath);

                const timestep = item.input.frame;
                const storageKey = `plugins/trajectory-${context.trajectoryId}/analysis-${context.analysisId}/${exposureId}/timestep-${timestep}.msgpack`;

                await storage.put(SYS_BUCKETS.PLUGINS, storageKey, resultsPath, { 'Content-Type': 'application/msgpack' });

                let data: any = null;
                let count = 0;
                let metadata: Record<string, any> | null = null;

                if(needsExportData || needsMetadata){
                    const payload = await this.readExposurePayload(
                        resultsPath,
                        config.iterable,
                        needsExportData,
                        needsMetadata
                    );
                    data = payload.data;
                    metadata = payload.metadata;
                    count = payload.count;
                }

                if(metadata && Object.keys(metadata).length){
                    await PluginExposureMeta.updateOne({
                        analysis: context.analysisId,
                        exposureId: exposureId,
                        timestep
                    }, {
                        $set: {
                            plugin: context.pluginId,
                            trajectory: context.trajectoryId,
                            analysis: context.analysisId,
                            exposureId: exposureId,
                            timestep,
                            metadata
                        }
                    }, { upsert: true });
                }

                return {
                    index: item.index,
                    frame: item.input?.frame,
                    name: config.name,
                    data,
                    count,
                    storageKey,
                    localPath: resultsPath
                };
            }catch(error: any){
                logger.error(`[ExposureHandler] Failed for item ${item.index}: ${error.message}`);
                return {
                    index: item.index,
                    name: config.name,
                    error: error.message,
                    data: null
                };
            }
        })));

        return {
            results: exposureResults,
            sample: exposureResults.find((r) => !r.error)
        };
    }
};

export default new ExposureHandler();
