import { ErrorCodes } from '@/constants/error-codes';
import { Analysis, Plugin } from '@/models';
import { SYS_BUCKETS } from '@/config/minio';
import { NodeType } from '@/types/models/modifier';
import { findDescendantByType } from '@/utilities/plugins/workflow-utils';
import { decodeMultiStream } from '@/utilities/msgpack/msgpack-stream';
import RuntimeError from '@/utilities/runtime/runtime-error';
import DumpStorage from '@/services/dump-storage';
import storage from '@/services/storage';
import TrajectoryParserFactory from '@/parsers/factory';

const getPopulatedFrameAtoms = async (
    trajectoryId: string,
    timestep: string,
    analysisId: string,
    exposureId: string,
    page: number,
    pageSize: number
) => {
    const startIndex = (page - 1) * pageSize;

    const [analysis, dumpPath] = await Promise.all([
        Analysis.findById(analysisId).lean(),
        DumpStorage.getDump(trajectoryId, timestep)
    ]);

    if (!analysis) throw new RuntimeError(ErrorCodes.ANALYSIS_NOT_FOUND, 404);
    if (!dumpPath) throw new RuntimeError(ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND, 404);

    const plugin = await Plugin.findOne({ slug: analysis.plugin }).lean();
    if (!plugin) throw new RuntimeError(ErrorCodes.PLUGIN_NOT_FOUND, 404);

    const exposureNode = plugin.workflow.nodes.find((node: any) => node.type === NodeType.EXPOSURE && node.id === exposureId);
    if (!exposureNode) throw new RuntimeError(ErrorCodes.PLUGIN_NODE_NOT_FOUND, 404);

    // Find schema and visualizer nodes connected to this specific exposure
    const schemaNode = findDescendantByType(String(exposureId), plugin.workflow, NodeType.SCHEMA as any);
    const visualizerNode = findDescendantByType(String(exposureId), plugin.workflow, NodeType.VISUALIZERS as any);

    // The visualizer node is not necessary, but the schema node is.
    if (!schemaNode) throw new RuntimeError(ErrorCodes.PLUGIN_NODE_NOT_FOUND, 404);

    const iterableKey = exposureNode?.data?.exposure?.iterable;
    const perAtomProperties: string[] = visualizerNode?.data?.visualizers?.perAtomProperties || [];

    const pluginDataPromise = (perAtomProperties.length > 0)
        ? storage.getStream(SYS_BUCKETS.PLUGINS, `plugins/trajectory-${trajectoryId}/analysis-${analysisId}/${exposureId}/timestep-${timestep}.msgpack`)
        : Promise.resolve(null);

    const [parsed, pluginStream] = await Promise.all([
        TrajectoryParserFactory.parse(dumpPath, { includeIds: true }),
        pluginDataPromise
    ]);

    const totalAtoms = parsed.metadata.natoms;
    const endIndex = Math.min(startIndex + pageSize, totalAtoms);
    const rowCount = endIndex - startIndex;

    if (rowCount <= 0) {
        return {
            data: [],
            properties: [],
            page,
            pageSize,
            total: totalAtoms,
            hasMore: false
        };
    }

    const { positions, types, ids } = parsed;

    // Build plugin data index
    let pluginIndex: Map<number, any> | null = null;
    if (pluginStream) {
        const targetIds = new Set<number>();
        for (let idx = 0; idx < rowCount; idx++) {
            const i = startIndex + idx;
            const atomId = ids ? ids[i] : i + 1;
            targetIds.add(atomId);
        }

        pluginIndex = new Map();
        const stream = pluginStream as unknown as AsyncIterable<Uint8Array>;

        for await (const msg of decodeMultiStream(stream)) {
            let pluginData = msg as any;
            if (iterableKey && pluginData?.[iterableKey]) pluginData = pluginData[iterableKey];
            if (!Array.isArray(pluginData)) continue;

            for (const item of pluginData) {
                if (item?.id === undefined) continue;
                if (targetIds.has(item.id)) {
                    pluginIndex.set(item.id, item);
                }
            }

            if (pluginIndex.size >= targetIds.size) {
                if (typeof (pluginStream as any).destroy === 'function') {
                    (pluginStream as any).destroy();
                }
                break;
            }
        }
    }

    // Pre-cache schema keys
    const schemaDefinition = schemaNode?.data?.schema?.definition?.data?.items;
    const schemaKeysMap = new Map<string, string[]>();
    if (schemaDefinition) {
        for (const prop of perAtomProperties) {
            const propDef = schemaDefinition[prop];
            if (propDef?.keys) schemaKeysMap.set(prop, propDef.keys);
        }
    }

    // Build rows
    const rows = new Array(rowCount);
    const discoveredProps = new Set<string>();

    for (let idx = 0; idx < rowCount; idx++) {
        const i = startIndex + idx;
        const base = i * 3;
        const atomId = ids ? ids[i] : i + 1;
        const row: any = {
            id: atomId,
            type: types?.[i],
            x: positions[base],
            y: positions[base + 1],
            z: positions[base + 2]
        };

        if (pluginIndex) {
            const item = pluginIndex.get(atomId);
            if (item) {
                for (const prop of perAtomProperties) {
                    const value = item[prop];
                    if (value === undefined) continue;

                    // If the property value is an array (e.g., deformationGradient), 
                    // each i-th element of the array has a corresponding title in keys.
                    if (Array.isArray(value)) {
                        const keys = schemaKeysMap.get(prop);
                        if (!keys?.length) continue;
                        for (const k in keys) {
                            const columnTitle = `${prop} ${keys[k]}`;
                            row[columnTitle] = value[k];
                            discoveredProps.add(columnTitle);
                        }
                    } else {
                        row[prop] = value;
                        discoveredProps.add(prop);
                    }
                }
            }
        }

        rows[idx] = row;
    }

    return {
        data: rows,
        properties: Array.from(discoveredProps),
        page,
        pageSize,
        total: totalAtoms,
        hasMore: endIndex < totalAtoms
    }
};

export default getPopulatedFrameAtoms;