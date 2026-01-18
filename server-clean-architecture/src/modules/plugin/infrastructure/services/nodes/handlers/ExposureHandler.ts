import { injectable, inject } from 'tsyringe';
import { INodeHandler, ExecutionContext, NodeOutputSchema, T } from '@modules/plugin/domain/ports/INodeRegistry';
import { SYS_BUCKETS } from '@core/config/minio';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IStorageService } from '@shared/domain/ports/IStorageService';
import pLimit from '@shared/infrastructure/utilities/p-limit';
import readExposurePayload from '@modules/plugin/infrastructure/utilities/read-exposure-payload';
import { WorkflowNodeType, WorkflowNode } from '@modules/plugin/domain/entities/workflow/WorkflowNode';

@injectable()
export default class ExposureHandler implements INodeHandler{
    readonly type = WorkflowNodeType.Exposure;

    readonly outputSchema: NodeOutputSchema = {
        properties: {
            results: T.array(T.object({
                index: T.number(),
                frame: T.number(),
                name: T.string(),
                data: T.any(),
                count: T.number(),
                storageKey: T.string(),
                localPath: T.string()
            })),
            sample: T.object({})
        }
    };

    constructor(
        @inject(SHARED_TOKENS.StorageService)
        private storage: IStorageService
    ){}

    async execute(node: WorkflowNode, context: ExecutionContext): Promise<Record<string, any>>{
        const config = node.data.exposure!;
        const items = this.getInputItems(node.id, context);
        const reqs = this.analyzeRequirements(node.id, context);
        const limit = pLimit(4);

        const results = await Promise.all(items.map((item: any) => limit(async () => {
            if(!item.success){
                return item;
            }

            try{
                return await this.processItem(item, config, node.id, context, reqs);
            }catch(err: any){
                return {
                    index: item.index,
                    error: err.message
                }
            }
        })));

        return {
            results,
            sample: results.find((result: any) => !result.error)
        };
    }

    private getInputItems(nodeId: string, context: ExecutionContext){
        const entrypoint = context.workflow.findAncestorByType(nodeId, WorkflowNodeType.Entrypoint);
        const output = entrypoint ? context.outputs.get(entrypoint.id) : null;
        if(!output?.results?.length) throw new Error('ExposureHandler: No input results found');
        return output.results;
    }

    private analyzeRequirements(nodeId: string, context: ExecutionContext){
        const exportNode = context.workflow.findDescendantByType(nodeId, WorkflowNodeType.Export);
        const visualizerNode = context.workflow.findAncestorByType(nodeId, WorkflowNodeType.Visualizers);
        const hasListing = !!(visualizerNode?.data?.visualizers?.listing && Object.keys(visualizerNode.data.visualizers.listing).length);
        return {
            needsData: !!exportNode,
            needsMetadata: hasListing
        };
    }

    private async processItem(
        item: any, 
        config: any, 
        nodeId: string, 
        context: ExecutionContext, 
        reqs: any
    ){
        const localPath = `${item.outputPath}_${config.results}`;
        const timestep = item.input.frame;
        const storageKey = `plugins/trajectory-${context.trajectoryId}/analysis-${context.analysisId}/${nodeId}/timestep-${timestep}.msgpack`;

        // Upload result using injected service
        context.generatedFiles.push(localPath);
        await this.storage.upload(
            SYS_BUCKETS.PLUGINS,
            storageKey,
            localPath,
            { 'Content-Type': 'application/msgpack' }
        );

        // Extract data/metadata locally
        let payload: any = {
            data: null,
            count: 0,
            metadata: null
        };

        if(reqs.needsData || reqs.needsMetadata){
            payload = await readExposurePayload(localPath, config.iterable, reqs);
        }

        // Persist metadata
        if(payload.metadata){
            // await pluginExposureMeta.updateOne(...)
        }

        return {
            index: item.index,
            frame: timestep,
            name: config.name,
            data: payload.data,
            count: payload.count,
            storageKey,
            localPath
        };
    }
};