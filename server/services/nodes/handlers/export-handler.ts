import { Exporter, NodeType } from '@/types/models/plugin';
import { IWorkflowNode } from '@/types/models/modifier';
import { NodeHandler, ExecutionContext } from '@/services/nodes/node-registry';
import { T, NodeOutputSchema } from '@/services/nodes/schema-types';
import { findAncestorByType, getNestedValue } from '@/utilities/plugins/workflow-utils';
import { decodeMultiStream, decodeMultiStreamFromFile } from '@/utilities/msgpack/msgpack-stream';
import { SYS_BUCKETS } from '@/config/minio';
import { slugify } from '@/utilities/runtime/runtime';
import AtomisticExporter from '@/utilities/export/atoms';
import DislocationExporter from '@/utilities/export/dislocations';
import MeshExporter from '@/utilities/export/mesh';
import logger from '@/logger';
import storage from '@/services/storage';

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

    private async readChunkedData(
        iterable: AsyncIterable<unknown>,
        iterableKey?: string
    ): Promise<any>{
        let data: any = null;
        for await (const msg of iterable){
            const chunkData = iterableKey ? getNestedValue(msg as any, iterableKey) : msg;
            data = this.mergeChunkedValue(data, chunkData);
        }
        return data;
    }

    private async loadExposureData(
        item: any,
        iterableKey?: string
    ): Promise<any>{
        if(item?.localPath){
            return this.readChunkedData(decodeMultiStreamFromFile(item.localPath), iterableKey);
        }

        if(item?.storageKey){
            const stream = await storage.getStream(SYS_BUCKETS.PLUGINS, item.storageKey);
            return this.readChunkedData(decodeMultiStream(stream as AsyncIterable<Uint8Array>), iterableKey);
        }

        return null;
    }

    async execute(node: IWorkflowNode, context: ExecutionContext): Promise<Record<string, any>> {
        const config = node.data.export!;
        const exposureNode = findAncestorByType(node.id, context.workflow, NodeType.EXPOSURE);
        if (!exposureNode) throw new Error('Export must be connected to an Exposure');

        const exposureOutput = context.outputs.get(exposureNode.id);
        if (!exposureOutput?.results) return { error: 'No exposure data available to export' };

        const exposureResults = exposureOutput.results as any[];
        const exportResults: any[] = [];
        const iterableKey = exposureNode.data?.exposure?.iterable;

        for (const item of exposureResults) {
            let data = item.data;

            if (!item.error && (data === undefined || data === null)) {
                data = await this.loadExposureData(item, iterableKey);
            }

            if (item.error || !data) {
                exportResults.push({
                    index: item.index,
                    success: false,
                    error: item.error || 'Exposure item had no data'
                });
                continue;
            }

            const objectName = `trajectory-${context.trajectoryId}/analysis-${context.analysisId}/glb/${item.frame ?? item.index}/${slugify(exposureNode.id)}.${config.type}`;

            try {
                await this.exportItem(
                    config.exporter as Exporter,
                    data,
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
