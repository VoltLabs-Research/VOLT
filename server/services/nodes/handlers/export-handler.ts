import { Exporter, NodeType } from '@/models/plugin';
import { IWorkflowNode } from '@/types/models/modifier';
import { NodeHandler, ExecutionContext } from '@/services/nodes/node-registry';
import { T, NodeOutputSchema } from '@/services/nodes/schema-types';
import { findAncestorByType } from '@/utilities/plugins/workflow-utils';
import { slugify } from '@/utilities/runtime/runtime';
import AtomisticExporter from '@/utilities/export/atoms';
import DislocationExporter from '@/utilities/export/dislocations';
import MeshExporter from '@/utilities/export/mesh';
import logger from '@/logger';

class ExportHandler implements NodeHandler{
    readonly type = NodeType.EXPORT;

    readonly outputSchema: NodeOutputSchema = {
        properties: {
            results: T.array(T.object({
                index: T.number(),
                success: T.boolean(),
                objectPath: T.string('MinIO path to exported file'),
                exporter: T.string('Exporter used'),
                type: T.string('Export type'),
                error: T.string('Error if failed')
            }), 'Export results per frame')
        }
    };

    async execute(node: IWorkflowNode, context: ExecutionContext): Promise<Record<string, any>>{
        const config = node.data.export!;
        const exposureNode = findAncestorByType(node.id, context.workflow, NodeType.EXPOSURE);
        if(!exposureNode) throw new Error('Export must be connected to an Exposure');

        const exposureOutput = context.outputs.get(exposureNode.id);
        if(!exposureOutput?.results) return { error: 'No exposure data available to export' };

        const exposureResults = exposureOutput.results as any[];
        const exportResults: any[] = [];
        const exporter = this.getExporter(config.exporter as Exporter);

        for(const item of exposureResults){
            if(item.error || !item.data){
                exportResults.push({
                    index: item.index,
                    success: false,
                    error: 'Exposure item had error'
                });
                continue;
            }

            const objectName = `trajectory-${context.trajectoryId}/analysis-${context.analysisId}/glb/${item.frame ?? item.index}/${slugify(exposureNode.id)}.${config.type}`;

            try{
                await exporter.toGLBMinIO(item.data, objectName, config.options || {});
                exportResults.push({
                    index: item.index,
                    success: true,
                    objectPath: objectName,
                    exporter: config.exporter,
                    type: config.type
                });
            }catch(error: any){
                logger.error(`[ExportHandler] Failed for item ${item.index}: ${error.message}`);
                exportResults.push({ 
                    index: item.index, 
                    success: false, 
                    error: error.message 
                });
            }
        }

        return { results: exportResults };
    }

    private getExporter(exporterType: Exporter): any{
        switch(exporterType){
            case Exporter.ATOMISTIC: return new AtomisticExporter();
            case Exporter.DISLOCATION: return new DislocationExporter();
            case Exporter.MESH: return new MeshExporter();
        }
    }
};

export default new ExportHandler();