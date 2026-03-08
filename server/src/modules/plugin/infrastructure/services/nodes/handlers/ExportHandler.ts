import { injectable, inject } from 'tsyringe';
import { INodeHandler, ExecutionContext, NodeOutputSchema, T, INodeRegistry } from '@modules/plugin/domain/port/INodeRegistry';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { WorkflowNodeType, WorkflowNode } from '@modules/plugin/domain/entities/workflow/WorkflowNode';
import { Exporter, ExportType } from '@modules/plugin/domain/entities/workflow/nodes/ExportNode';
import { IAtomisticExporter } from '@modules/trajectory/domain/port/exporters/AtomisticExporter';
import { IChartExporter } from '@modules/trajectory/domain/port/exporters/ChartExporter';
import { IDislocationExporter } from '@modules/trajectory/domain/port/exporters/DislocationExporter';
import { IMeshExporter } from '@modules/trajectory/domain/port/exporters/MeshExporter';
import { IStorageService } from '@shared/domain/port/IStorageService';
import { ISceneArtifactRepository } from '@modules/trajectory/domain/port/ISceneArtifactRepository';
import { SYS_BUCKETS } from '@core/config/minio';
import { decodeMultiStreamFromFile } from '@shared/infrastructure/utilities/msgpack';
import mergeChunkedValue from '@modules/plugin/infrastructure/utilities/merge-chunked-value';
import getNestedValue from '@shared/infrastructure/utilities/get-nested-value';
import { ErrorCodes } from '@core/constants/error-codes';

import { recordSceneArtifact } from '@modules/trajectory/infrastructure/utilities/record-scene-artifact';
import logger from '@shared/infrastructure/logger';

@injectable()
export default class ExportHandler implements INodeHandler{
    readonly type = WorkflowNodeType.Export;

    constructor(
        @inject(PLUGIN_TOKENS.NodeRegistry)
        private registry: INodeRegistry,

        @inject(TRAJECTORY_TOKENS.AtomisticExporter)
        private atomisticExporter: IAtomisticExporter,

        @inject(TRAJECTORY_TOKENS.ChartExporter)
        private chartExporter: IChartExporter,

        @inject(TRAJECTORY_TOKENS.DislocationExporter)
        private dislocationExporter: IDislocationExporter,

        @inject(TRAJECTORY_TOKENS.MeshExporter)
        private meshExporter: IMeshExporter,

        @inject(SHARED_TOKENS.StorageService)
        private storageService: IStorageService,

        @inject(TRAJECTORY_TOKENS.SceneArtifactRepository)
        private sceneArtifactRepository: ISceneArtifactRepository
    ){}

    readonly outputSchema: NodeOutputSchema = {
        properties: {
            results: T.array(T.object({
                index: T.number(),
                success: T.boolean(),
                objectPath: T.string()
            }))
        }
    };

    async execute(node: WorkflowNode, context: ExecutionContext): Promise<Record<string, any>>{
        const config = node.data.export!;
        const exposureNode = context.workflow.findAncestorByType(node.id, WorkflowNodeType.Exposure);
        if(!exposureNode) throw new Error(ErrorCodes.PLUGIN_EXPORT_EXPOSURE_REQUIRED);

        const exposureName = typeof exposureNode.data.exposure?.name === 'string'
            ? exposureNode.data.exposure.name.trim()
            : '';

        if (!exposureName) {
            throw new Error(ErrorCodes.PLUGIN_EXPORT_EXPOSURE_NAME_REQUIRED);
        }

        const exposureOutput = context.outputs.get(exposureNode.id);
        const results: any[] = [];

        // Determine settings
        const isChart = config.type === ExportType.ChartPNG || config.exporter === Exporter.Chart;
        const folder = isChart ? 'charts' : 'glb';
        const extension = isChart ? 'png' : config.type;

        // Get iterableKey from exposure node config
        const iterableKey = exposureNode.data.exposure?.iterable;

        // Process items
        const exposureResults = Array.isArray(exposureOutput?.results)
            ? exposureOutput.results
            : [];

        for(const item of exposureResults){
            let data = item.data;
            if(isChart && item.localPath){
                data = await this.loadExposureData(item, undefined); 
            }else if(!item.error && (data === undefined || data === null)){
                data = await this.loadExposureData(item, iterableKey);
            }

            if(item.error || !data){
                results.push({
                    index: item.index,
                    success: false,
                    error: typeof item.error === 'string'
                        ? item.error
                        : ErrorCodes.PLUGIN_EXPORT_DATA_REQUIRED
                });
                continue;
            }

            const objectPath = `trajectory-${context.trajectoryId}/analysis-${context.analysisId}/${folder}/${item.frame}/${exposureNode.id}.${extension}`;
            const options = this.resolveOptionsRecursive(config.options || {}, context);

            try{
                await this.runExporter(config.exporter, data, objectPath, options);

                if (!isChart) {
                    await recordSceneArtifact(this.sceneArtifactRepository, {
                        trajectory: context.trajectoryId,
                        analysis: context.analysisId,
                        plugin: context.pluginId,
                        sourceType: 'plugin-exposure',
                        timestep: Number(item.frame),
                        objectName: objectPath,
                        storageBucket: SYS_BUCKETS.MODELS,
                        params: {
                            exposureId: exposureNode.id
                        },
                        displayName: exposureName,
                        metadata: {
                            pluginId: context.pluginId,
                            exposureId: exposureNode.id,
                            exposureName,
                            exporter: config.exporter,
                            exportType: config.type,
                            listingMetadata: item.metadata || null
                        }
                    });
                }

                results.push({
                    index: item.index,
                    success: true,
                    objectPath,
                    exporter: config.exporter
                });
            }catch(err: any){
                logger.error(err)
                results.push({
                    index: item.index,
                    success: false,
                    error: err.message
                });
            }
        }

        return { results };
    }

    private async loadExposureData(item: any, iterableKey?: string): Promise<any>{
        if(item?.localPath){
            return this.readChunkedData(decodeMultiStreamFromFile(item.localPath), iterableKey);
        }

        if(item?.storageKey){
            const stream = await this.storageService.getStream(SYS_BUCKETS.PLUGINS, item.storageKey);
            return this.readChunkedData(stream as AsyncIterable<Uint8Array>, iterableKey);
        }

        return null;
    }

    private async readChunkedData(iterable: AsyncIterable<unknown>, iterableKey?: string): Promise<any>{
        let data: any = null;
        for await(const msg of iterable){
            const chunkData = iterableKey ? getNestedValue(msg as any, iterableKey) : msg;
            data = mergeChunkedValue(data, chunkData);
        }
        return data;
    }

    private async runExporter(type: string, data: any, path: string, options: any){
        const exportData = data?.export?.[type];

        switch(type){
            case Exporter.Atomistic:
                if(exportData){
                    await this.atomisticExporter.exportAtomsTypeToGLBBuffer(exportData, path);
                }else if(typeof data === 'string'){
                    await this.atomisticExporter.toStorage(data, path);
                }else{
                    throw new Error(ErrorCodes.PLUGIN_EXPORT_DATA_REQUIRED);
                }
                break;
            case Exporter.Chart:
                await this.chartExporter.toStorage(data, path, options);
                break;
            case Exporter.Dislocation:
                if(!exportData) throw new Error(ErrorCodes.PLUGIN_EXPORT_DATA_REQUIRED);
                await this.dislocationExporter.toStorage(exportData, path, options);
                break;
            case Exporter.Mesh:
                if(!exportData) throw new Error(ErrorCodes.PLUGIN_EXPORT_DATA_REQUIRED);
                await this.meshExporter.toStorage(exportData, path, options);
                break;
            default:
                throw new Error(ErrorCodes.PLUGIN_EXPORT_TYPE_UNSUPPORTED);
        }
    }

    private resolveOptionsRecursive(options: any, context: ExecutionContext): any{
        if(typeof options === 'string' && options.includes('{{')){
            return this.registry.resolveTemplate(options, context);
        }

        if(typeof options === 'object' && options !== null){
            return Object.fromEntries(Object.entries(options).map(([k, v]) => [k, this.resolveOptionsRecursive(v, context)]));
        }
        return options;
    }
};
