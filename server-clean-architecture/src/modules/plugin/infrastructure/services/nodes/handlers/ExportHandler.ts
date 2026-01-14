import { injectable, inject } from 'tsyringe';
import { INodeHandler, ExecutionContext, NodeOutputSchema, T, INodeRegistry } from '@/src/modules/plugin/domain/ports/INodeRegistry';
import { PLUGIN_TOKENS } from '../../../di/PluginTokens';
import { IAtomisticExporter, IChartExporter, IDislocationExporter, IMeshExporter } from '@/src/modules/trajectory/domain/port/IExporters';
import { TRAJECTORY_TOKENS } from '@/src/modules/trajectory/infrastructure/di/TrajectoryTokens';
import { WorkflowNodeType, WorkflowNode } from '@/src/modules/plugin/domain/entities/workflow/WorkflowNode';
import { Exporter, ExportType } from '@/src/modules/plugin/domain/entities/workflow/nodes/ExportNode';
import slugify from '@/src/shared/infrastructure/utilities/slugify';

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
        private meshExporter: IMeshExporter
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
        const exposureNode = findAncestorByType(node.id, context.workflow, NodeType.Exposure);
        if(!exposureNode) throw new Error('ExportHandler: Orphaned export node');

        const exposureOutput = context.outputs.get(exposureNode.id);
        const results: any[] = [];

        // Determine settings
        const isChart = config.type === ExportType.ChartPNG || config.exporter === Exporter.Chart;
        const folder = isChart ? 'charts' : 'glb';
        const extension = isChart ? 'png' : config.type;

        // Process items
        for(const item of (exposureOutput?.results || [])){
            if(item.error || !item.data){
                results.push({
                    index: item.index,
                    success: false,
                    error: item.error || 'No data'
                });
                continue;
            }

            const objectPath = `trajectory-${context.trajectoryId}/analysis-${context.analysisId}/${folder}/${item.frame ?? item.index}/${slugify(exposureNode.id)}.${extension}`;
            const options = this.resolveOptionsRecursive(config.options || {}, context);
            
            try{
                await this.runExporter(config.exporter, item.data, objectPath, options);
                results.push({
                    index: item.index,
                    success: true,
                    objectPath,
                    exporter: config.exporter
                });
            }catch(err: any){
                results.push({
                    index: item.index,
                    success: false,
                    error: err.message
                });
            }
        }

        return { results };
    }

    private async runExporter(type: string, data: any, path: string, options: any){
        switch(type){
            case Exporter.Atomistic:
                if(typeof data === 'string'){
                    await this.atomisticExporter.toStorage(data, path);
                }else{
                    throw new Error("Atomistic export expects file path as data input");
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