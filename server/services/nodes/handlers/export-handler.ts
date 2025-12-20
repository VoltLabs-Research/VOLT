import { Exporter, NodeType } from '@/types/models/plugin';
import { IWorkflowNode } from '@/types/models/modifier';
import { NodeHandler, ExecutionContext } from '@/services/nodes/node-registry';
import { T, NodeOutputSchema } from '@/services/nodes/schema-types';
import { findAncestorByType } from '@/utilities/plugins/workflow-utils';
import { slugify } from '@/utilities/runtime/runtime';
import AtomisticExporter from '@/utilities/export/atoms';
import DislocationExporter from '@/utilities/export/dislocations';
import MeshExporter from '@/utilities/export/mesh';
import logger from '@/logger';

class ExportHandler implements NodeHandler {
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

    async execute(node: IWorkflowNode, context: ExecutionContext): Promise<Record<string, any>> {
        const config = node.data.export!;
        const exposureNode = findAncestorByType(node.id, context.workflow, NodeType.EXPOSURE);
        if (!exposureNode) throw new Error('Export must be connected to an Exposure');

        const exposureOutput = context.outputs.get(exposureNode.id);
        if (!exposureOutput?.results) return { error: 'No exposure data available to export' };

        const exposureResults = exposureOutput.results as any[];
        const exportResults: any[] = [];

        for (const item of exposureResults) {
            if (item.error || !item.data) {
                exportResults.push({
                    index: item.index,
                    success: false,
                    error: 'Exposure item had error'
                });
                continue;
            }

            const objectName = `trajectory-${context.trajectoryId}/analysis-${context.analysisId}/glb/${item.frame ?? item.index}/${slugify(exposureNode.id)}.${config.type}`;

            try {
                await this.exportItem(
                    config.exporter as Exporter,
                    item.data,
                    objectName,
                    config.options || {}
                );
                exportResults.push({
                    index: item.index,
                    success: true,
                    objectPath: objectName,
                    exporter: config.exporter,
                    type: config.type
                });
            } catch (error: any) {
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

    private async exportItem(
        exporterType: Exporter,
        data: any,
        objectName: string,
        options: Record<string, any>
    ): Promise<void> {
        // For AtomisticExporter, check if data is already grouped by structure type
        if (exporterType === Exporter.ATOMISTIC) {
            const exporter = new AtomisticExporter();

            // If data has 'keys' array, it's the keyed schema format with atoms grouped by type
            if (data.keys && Array.isArray(data.keys)) {
                // Extract the grouped atoms(exclude 'keys' from the data)
                const groupedAtoms: Record<string, any[]> = {};
                for (const key of data.keys) {
                    if (data[key] && Array.isArray(data[key])) {
                        groupedAtoms[key] = data[key];
                    }
                }
                await exporter.exportAtomsTypeToGLBMinIO(groupedAtoms, objectName);
                return;
            }

            // If data is a string(file path), use original method
            if (typeof data === 'string') {
                await exporter.toGLBMinIO(data, objectName);
                return;
            }

            // If data is already an object with structure keys(legacy format)
            const structureKeys = Object.keys(data).filter(k =>
                Array.isArray(data[k]) && data[k].length > 0 && data[k][0]?.pos
            );
            if (structureKeys.length > 0) {
                await exporter.exportAtomsTypeToGLBMinIO(data, objectName);
                return;
            }

            throw new Error('AtomisticExporter: unsupported data format');
        }

        // For other exporters, use standard method
        const exporter = this.getExporter(exporterType);
        await exporter.toGLBMinIO(data, objectName, options);
    }

    private getExporter(exporterType: Exporter): any {
        switch (exporterType) {
            case Exporter.ATOMISTIC: return new AtomisticExporter();
            case Exporter.DISLOCATION: return new DislocationExporter();
            case Exporter.MESH: return new MeshExporter();
        }
    }
};

export default new ExportHandler();
