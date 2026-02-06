import { injectable, inject } from 'tsyringe';
import { INodeHandler, ExecutionContext, NodeOutputSchema, T, INodeRegistry } from '@modules/plugin/domain/ports/INodeRegistry';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { WorkflowNodeType, WorkflowNode } from '@modules/plugin/domain/entities/workflow/WorkflowNode';
import { Exporter, ExportType } from '@modules/plugin/domain/entities/workflow/nodes/ExportNode';
import { IAtomisticExporter } from '@modules/trajectory/domain/port/exporters/AtomisticExporter';
import { IChartExporter } from '@modules/trajectory/domain/port/exporters/ChartExporter';
import { IDislocationExporter } from '@modules/trajectory/domain/port/exporters/DislocationExporter';
import { IMeshExporter } from '@modules/trajectory/domain/port/exporters/MeshExporter';
import { IStorageService } from '@shared/domain/ports/IStorageService';
import { SYS_BUCKETS } from '@core/config/minio';
import { decodeMultiStreamFromFile } from '@shared/infrastructure/utilities/msgpack';
import mergeChunkedValue from '@modules/plugin/infrastructure/utilities/merge-chunked-value';
import getNestedValue from '@shared/infrastructure/utilities/get-nested-value';
import slugify from '@shared/infrastructure/utilities/slugify';

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
        private storageService: IStorageService
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
        if(!exposureNode) throw new Error('ExportHandler: Orphaned export node');

        const exposureOutput = context.outputs.get(exposureNode.id);
        const results: any[] = [];

        // Determine settings
        const isChart = config.type === ExportType.ChartPNG || config.exporter === Exporter.Chart;
        const folder = isChart ? 'charts' : 'glb';
        const extension = isChart ? 'png' : config.type;

        // Get iterableKey from exposure node config
        const iterableKey = exposureNode.data.exposure?.iterable;

        // Process items
        for(const item of (exposureOutput?.results || [])){
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
                    error: item.error || 'No data'
                });
                continue;
            }

            const objectPath = `trajectory-${context.trajectoryId}/analysis-${context.analysisId}/${folder}/${item.frame}/${slugify(exposureNode.id)}.${extension}`;
            const options = this.resolveOptionsRecursive(config.options || {}, context);

            console.log('EXPORT HANDLER===', objectPath);
            try{
                await this.runExporter(config.exporter, data, objectPath, options);
                results.push({
                    index: item.index,
                    success: true,
                    objectPath,
                    exporter: config.exporter
                });
            }catch(err: any){
                console.log('ERROR:', err)
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
        switch(type){
            case Exporter.Atomistic:
                // Handle different data formats for AtomisticExporter
                if(data.keys && Array.isArray(data.keys)){
                    // Extract grouped atoms (exclude 'keys' from the data)
                    const groupedAtoms: Record<string, any[]> = {};
                    for(const key of data.keys){
                        if(data[key] && Array.isArray(data[key])){
                            groupedAtoms[key] = data[key];
                        }
                    }
                    await this.atomisticExporter.exportAtomsTypeToGLBBuffer(groupedAtoms, path);
                }else if(typeof data === 'string'){
                    // data is a file path to LAMMPS dump
                    await this.atomisticExporter.toStorage(data, path);
                }else{
                    // data is object with structure keys (legacy format)
                    const structureKeys = Object.keys(data).filter(k =>
                        Array.isArray(data[k]) && data[k].length > 0 && data[k][0]?.pos
                    );
                    if(structureKeys.length > 0){
                        await this.atomisticExporter.exportAtomsTypeToGLBBuffer(data, path);
                    }else{
                        throw new Error('AtomisticExporter: unsupported data format');
                    }
                }
                break;
            case Exporter.Chart:
                await this.chartExporter.toStorage(data, path, options);
                break;
            case Exporter.Dislocation:
                await this.dislocationExporter.toStorage(data, path, options);
                break;
            case Exporter.Mesh:
                await this.meshExporter.toStorage(data, path, options);
                break;
            default:
                throw new Error(`Unknown exporter type: ${type}`);
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