import { injectable, inject } from 'tsyringe';
import { INodeHandler, ExecutionContext, NodeOutputSchema, T } from '@modules/plugin/domain/ports/INodeRegistry';
import { SYS_BUCKETS } from '@core/config/minio';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IStorageService } from '@shared/domain/ports/IStorageService';
import { IExposureMetaRepository } from '@modules/plugin/domain/ports/IExposureMetaRepository';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
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
        private storage: IStorageService,
        @inject(PLUGIN_TOKENS.ExposureMetaRepository)
        private exposureMetaRepository: IExposureMetaRepository
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
        const visualizerNode = context.workflow.findDescendantByType(nodeId, WorkflowNodeType.Visualizers);
        const hasListing = !!(visualizerNode?.data?.visualizers?.listing && Object.keys(visualizerNode.data.visualizers.listing).length);
        
        console.log(`[ExposureHandler] analyzeRequirements for exposure ${nodeId}: visualizerNode=${visualizerNode?.id || 'none'}, hasListing=${hasListing}, listing=${JSON.stringify(visualizerNode?.data?.visualizers?.listing || {})}`);
        
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
            console.log(`[ExposureHandler] Payload extracted - needsMetadata: ${reqs.needsMetadata}, hasMetadata: ${!!payload.metadata}, metadataKeys: ${payload.metadata ? Object.keys(payload.metadata).length : 0}`);
        }

        // Persist metadata with upsert semantics
        if(payload.metadata && Object.keys(payload.metadata).length > 0){
            console.log(`[ExposureHandler] Persisting metadata for exposure ${nodeId}, timestep ${timestep}, analysis ${context.analysisId}`);
            console.log(`[ExposureHandler] Metadata keys: ${Object.keys(payload.metadata).join(', ')}`);
            
            try {
                // Find existing document
                const existing = await this.exposureMetaRepository.findOne({
                    analysis: context.analysisId,
                    exposureId: nodeId,
                    timestep
                });

                const metaData = {
                    plugin: context.pluginId,
                    trajectory: context.trajectoryId,
                    analysis: context.analysisId,
                    exposureId: nodeId,
                    timestep,
                    metadata: {
                        ...payload.metadata,
                        // Add resolved context for simple template resolution during precomputation
                        _resolvedContext: {
                            arguments: context.userConfig || {},
                            timestep: timestep,
                            analysis: {
                                createdAt: new Date(), // Will be fetched during precomputation from Analysis entity
                                _id: context.analysisId,
                                trajectory: context.trajectoryId,
                                plugin: context.pluginId
                            }
                        }
                    },
                    createdAt: existing?.props.createdAt || new Date(),
                    updatedAt: new Date()
                };

                if(existing){
                    console.log(`[ExposureHandler] Updating existing ExposureMeta document: ${existing.id}`);
                    await this.exposureMetaRepository.updateById(existing.id, metaData);
                } else {
                    console.log(`[ExposureHandler] Creating new ExposureMeta document`);
                    const created = await this.exposureMetaRepository.create(metaData);
                    console.log(`[ExposureHandler] Created ExposureMeta document: ${created.id}`);
                }
            } catch (error: any) {
                console.error(`[ExposureHandler] Failed to persist metadata: ${error.message}`);
                console.error(error.stack);
            }
        } else {
            console.log(`[ExposureHandler] Skipping metadata persistence - needsMetadata: ${reqs.needsMetadata}, hasMetadata: ${!!payload.metadata}, metadataKeyCount: ${payload.metadata ? Object.keys(payload.metadata).length : 0}`);
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