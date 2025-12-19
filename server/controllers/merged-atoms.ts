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

export default class MergedAtomsController {
    public getAtoms = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { id: trajectoryId, analysisId } = req.params;
        const { timestep, exposureId, page: pageStr, pageSize: pageSizeStr } = req.query;

        if (!timestep || !exposureId) {
            return next(new RuntimeError(ErrorCodes.COLOR_CODING_MISSING_PARAMS, 400));
        }

        const page = Math.max(1, parseInt(String(pageStr) || '1', 10));
        const pageSize = Math.max(1, Math.min(10000, parseInt(String(pageSizeStr) || '1000', 10)));
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;

        const trajectory = res.locals.trajectory;
        if (!trajectory) {
            return next(new RuntimeError(ErrorCodes.TRAJECTORY_NOT_FOUND, 404));
        }

        const analysis = await Analysis.findById(analysisId);
        if (!analysis) {
            return next(new RuntimeError(ErrorCodes.ANALYSIS_NOT_FOUND, 404));
        }

        const plugin = await Plugin.findOne({ slug: analysis.plugin });
        if (!plugin) {
            return next(new RuntimeError(ErrorCodes.PLUGIN_NOT_FOUND, 404));
        }

        const exposureNode = plugin.workflow.nodes.find(
            (n: any) => n.type === NodeType.EXPOSURE && n.id === exposureId
        );
        const iterableKey = exposureNode?.data?.exposure?.iterable;

        const schemaNode = plugin.workflow.nodes.find((n: any) => n.type === NodeType.SCHEMA);
        if (!schemaNode) {
            return next(new RuntimeError(ErrorCodes.PLUGIN_NODE_NOT_FOUND, 404));
        }

        const visualizerNode = plugin.workflow.nodes.find(
            (n: any) => n.type === NodeType.VISUALIZERS && n.data?.visualizers?.perAtomProperties?.length
        );
        const perAtomProperties: string[] = visualizerNode?.data?.visualizers?.perAtomProperties || [];

        const dumpPath = await DumpStorage.getDump(trajectoryId, String(timestep));
        if (!dumpPath) {
            return next(new RuntimeError(ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND, 404));
        }

        const parsed = await TrajectoryParserFactory.parse(dumpPath, { includeIds: true });
        const totalAtoms = parsed.metadata.natoms;
        const limit = Math.min(endIndex, totalAtoms);

        const schemaKeysCache: Map<string, string[]> = new Map();
        const schemaDefinition = schemaNode?.data?.schema?.definition?.data?.items;
        if (schemaDefinition) {
            for (const prop of perAtomProperties) {
                const propDef = schemaDefinition[prop];
                if (propDef?.keys) {
                    schemaKeysCache.set(prop, propDef.keys);
                }
            }
        }

        let pluginDataByAtomId: Map<number, any> | null = null;

        if (perAtomProperties.length > 0) {
            try {
                const key = `plugins/trajectory-${trajectoryId}/analysis-${analysisId}/${exposureId}/timestep-${timestep}.msgpack`;
                const buffer = await storage.getBuffer(SYS_BUCKETS.PLUGINS, key);
                let pluginData = decode(buffer) as any;

                if (iterableKey && pluginData[iterableKey]) {
                    pluginData = pluginData[iterableKey];
                }

                if (Array.isArray(pluginData)) {
                    pluginDataByAtomId = new Map();
                    const len = pluginData.length;
                    for (let i = 0; i < len; i++) {
                        const item = pluginData[i];
                        if (item.id !== undefined) {
                            pluginDataByAtomId.set(item.id, item);
                        }
                    }
                }
            } catch (err) {
                console.warn(`[MergedAtoms] Could not load plugin data: ${err}`);
            }
        }

        const propertySet = new Set<string>();
        const finalPerAtomProperties: string[] = [];

        const rowCount = limit - startIndex;
        const rows = new Array(rowCount);

        const positions = parsed.positions;
        const types = parsed.types;
        const ids = parsed.ids;
        const hasIds = ids !== undefined;
        const hasTypes = types !== undefined;
        const hasPluginData = pluginDataByAtomId !== null;
        const propsLen = perAtomProperties.length;

        for (let idx = 0; idx < rowCount; idx++) {
            const i = startIndex + idx;
            const base = i * 3;
            const atomId = hasIds ? ids![i] : i + 1;

            const row: any = {
                id: atomId,
                type: hasTypes ? types![i] : undefined,
                x: positions[base],
                y: positions[base + 1],
                z: positions[base + 2]
            };

            if (hasPluginData) {
                const pluginItem = pluginDataByAtomId!.get(atomId);
                if (pluginItem) {
                    for (let p = 0; p < propsLen; p++) {
                        const prop = perAtomProperties[p];
                        const value = pluginItem[prop];

                        if (Array.isArray(value)) {
                            const keys = schemaKeysCache.get(prop);
                            if (keys) {
                                const keysLen = keys.length;
                                for (let k = 0; k < keysLen; k++) {
                                    const columnName = `${prop} ${keys[k]}`;
                                    row[columnName] = value[k];
                                    if (!propertySet.has(columnName)) {
                                        propertySet.add(columnName);
                                        finalPerAtomProperties.push(columnName);
                                    }
                                }
                            }
                        } else if (value !== undefined) {
                            row[prop] = value;
                            if (!propertySet.has(prop)) {
                                propertySet.add(prop);
                                finalPerAtomProperties.push(prop);
                            }
                        }
                    }
                }
            }

            rows[idx] = row;
        }

        res.status(200).json({
            status: 'success',
            data: rows,
            properties: finalPerAtomProperties,
            page,
            pageSize,
            total: totalAtoms,
            hasMore: endIndex < totalAtoms
        });
    });
}

