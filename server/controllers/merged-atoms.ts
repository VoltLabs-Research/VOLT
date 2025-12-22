import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '@/utilities/runtime/runtime';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { ErrorCodes } from '@/constants/error-codes';
import { Analysis, Plugin } from '@/models';
import { NodeType } from '@/types/models/plugin';
import { SYS_BUCKETS } from '@/config/minio';
import { decode } from '@msgpack/msgpack';
import DumpStorage from '@/services/dump-storage';
import TrajectoryParserFactory from '@/parsers/factory';
import storage from '@/services/storage';
import { findDescendantByType } from '@/utilities/plugins/workflow-utils';

export default class MergedAtomsController {
    public getAtoms = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { id: trajectoryId, analysisId } = req.params;
        const { timestep, exposureId, page: pageStr, pageSize: pageSizeStr } = req.query;

        if (!timestep || !exposureId) {
            return next(new RuntimeError(ErrorCodes.COLOR_CODING_MISSING_PARAMS, 400));
        }

        const trajectory = res.locals.trajectory;
        if (!trajectory) {
            return next(new RuntimeError(ErrorCodes.TRAJECTORY_NOT_FOUND, 404));
        }

        const page = Math.max(1, parseInt(String(pageStr) || '1', 10));
        const pageSize = Math.max(1, Math.min(10000, parseInt(String(pageSizeStr) || '1000', 10)));
        const startIndex = (page - 1) * pageSize;

        // Parallel: DB queries + dump path + plugin data
        const [analysis, dumpPath] = await Promise.all([
            Analysis.findById(analysisId).lean(),
            DumpStorage.getDump(trajectoryId, String(timestep))
        ]);

        if (!analysis) return next(new RuntimeError(ErrorCodes.ANALYSIS_NOT_FOUND, 404));
        if (!dumpPath) return next(new RuntimeError(ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND, 404));

        const plugin = await Plugin.findOne({ slug: analysis.plugin }).lean();
        if (!plugin) return next(new RuntimeError(ErrorCodes.PLUGIN_NOT_FOUND, 404));

        // Find exposure node first
        const exposureNode = plugin.workflow.nodes.find((n: any) => n.type === NodeType.EXPOSURE && n.id === exposureId);
        if (!exposureNode) return next(new RuntimeError(ErrorCodes.PLUGIN_NODE_NOT_FOUND, 404));

        // Find schema and visualizer nodes connected to this specific exposure
        const schemaNode = findDescendantByType(String(exposureId), plugin.workflow, NodeType.SCHEMA);
        const visualizerNode = findDescendantByType(String(exposureId), plugin.workflow, NodeType.VISUALIZERS);

        if (!schemaNode) return next(new RuntimeError(ErrorCodes.PLUGIN_NODE_NOT_FOUND, 404));

        const iterableKey = exposureNode?.data?.exposure?.iterable;
        const perAtomProperties: string[] = visualizerNode?.data?.visualizers?.perAtomProperties || [];
        const hasPerAtomProps = perAtomProperties.length > 0;

        // Parallel: parse dump + load plugin data
        const pluginDataPromise = hasPerAtomProps
            ? storage.getBuffer(SYS_BUCKETS.PLUGINS,
                `plugins/trajectory-${trajectoryId}/analysis-${analysisId}/${exposureId}/timestep-${timestep}.msgpack`)
                .catch(() => null)
            : Promise.resolve(null);

        const [parsed, pluginBuffer] = await Promise.all([
            TrajectoryParserFactory.parse(dumpPath, { includeIds: true }),
            pluginDataPromise
        ]);

        const totalAtoms = parsed.metadata.natoms;
        const endIndex = Math.min(startIndex + pageSize, totalAtoms);
        const rowCount = endIndex - startIndex;

        if (rowCount <= 0) {
            return res.status(200).json({ status: 'success', data: [], properties: [], page, pageSize, total: totalAtoms, hasMore: false });
        }

        // Build plugin data index
        let pluginIndex: Map<number, any> | null = null;
        if (pluginBuffer) {
            let pluginData = decode(pluginBuffer) as any;
            if (iterableKey && pluginData[iterableKey]) pluginData = pluginData[iterableKey];
            if (Array.isArray(pluginData)) {
                pluginIndex = new Map();
                for (let i = 0, len = pluginData.length; i < len; i++) {
                    const item = pluginData[i];
                    if (item.id !== undefined) pluginIndex.set(item.id, item);
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

        // Pre-extract arrays
        const positions = parsed.positions;
        const types = parsed.types;
        const ids = parsed.ids;

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

                        if (Array.isArray(value)) {
                            const keys = schemaKeysMap.get(prop);
                            if (keys) {
                                for (let k = 0; k < keys.length; k++) {
                                    const colName = `${prop} ${keys[k]}`;
                                    row[colName] = value[k];
                                    discoveredProps.add(colName);
                                }
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

        res.status(200).json({
            status: 'success',
            data: rows,
            properties: Array.from(discoveredProps),
            page,
            pageSize,
            total: totalAtoms,
            hasMore: endIndex < totalAtoms
        });
    });
}
