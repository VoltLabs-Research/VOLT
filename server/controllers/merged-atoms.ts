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

/**
 * Controller for serving merged atoms data (LAMMPS dump + per-atom properties from plugins)
 */
export default class MergedAtomsController {
    /**
     * GET /api/trajectories/:trajectoryId/analysis/:analysisId/merged-atoms
     * Query: timestep, exposureId, page, pageSize
     * 
     * Returns merged atom data:
     * - Base columns from LAMMPS dump: id, type, x, y, z
     * - Per-atom property columns from plugin data
     */
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

        // Get trajectory from middleware (already verified by checkTeamMembershipForTrajectory)
        const trajectory = res.locals.trajectory;
        if (!trajectory) {
            return next(new RuntimeError(ErrorCodes.TRAJECTORY_NOT_FOUND, 404));
        }

        // Verify analysis exists
        const analysis = await Analysis.findById(analysisId);
        if (!analysis) {
            return next(new RuntimeError(ErrorCodes.ANALYSIS_NOT_FOUND, 404));
        }

        // Get plugin and find relevant nodes
        const plugin = await Plugin.findOne({ slug: analysis.plugin });
        if (!plugin) {
            return next(new RuntimeError(ErrorCodes.PLUGIN_NOT_FOUND, 404));
        }

        // Find exposure node to get iterable path
        const exposureNode = plugin.workflow.nodes.find(
            (n: any) => n.type === NodeType.EXPOSURE && n.id === exposureId
        );
        const iterableKey = exposureNode?.data?.exposure?.iterable;

        // Find visualizer node to get perAtomProperties
        const visualizerNode = plugin.workflow.nodes.find(
            (n: any) => n.type === NodeType.VISUALIZERS && n.data?.visualizers?.perAtomProperties?.length
        );
        const perAtomProperties: string[] = visualizerNode?.data?.visualizers?.perAtomProperties || [];

        // Parse LAMMPS dump for base atom data
        const dumpPath = await DumpStorage.getDump(trajectoryId, String(timestep));
        if (!dumpPath) {
            return next(new RuntimeError(ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND, 404));
        }

        const parsed = await TrajectoryParserFactory.parse(dumpPath, { includeIds: true });
        const totalAtoms = parsed.metadata.natoms;
        const limit = Math.min(endIndex, totalAtoms);

        // Fetch plugin data from MinIO
        let pluginData: any = null;
        let pluginDataByAtomId: Map<number, any> = new Map();

        if (perAtomProperties.length > 0) {
            try {
                const key = `plugins/trajectory-${trajectoryId}/analysis-${analysisId}/${exposureId}/timestep-${timestep}.msgpack`;
                const buffer = await storage.getBuffer(SYS_BUCKETS.PLUGINS, key);
                pluginData = decode(buffer);
                console.log(Object.keys(pluginData))
                console.log(Object.values(pluginData).slice(0, 10));

                // Unwrap using iterable key if specified
                if (iterableKey && pluginData[iterableKey]) {
                    pluginData = pluginData[iterableKey];
                }

                // Build a map by atom ID for fast lookup
                if (Array.isArray(pluginData)) {
                    for (const item of pluginData) {
                        if (item.id !== undefined) {
                            pluginDataByAtomId.set(item.id, item);
                        }
                    }
                }
            } catch (err) {
                // Plugin data may not exist for this frame, continue without it
                console.warn(`[MergedAtoms] Could not load plugin data: ${err}`);
            }
        }

        // Build merged rows
        const rows: any[] = [];
        for (let i = startIndex; i < limit; i++) {
            const base = i * 3;
            const atomId = parsed.ids ? parsed.ids[i] : i + 1; // LAMMPS IDs are 1-indexed

            const row: any = {
                id: atomId,
                type: parsed.types ? parsed.types[i] : undefined,
                x: parsed.positions[base],
                y: parsed.positions[base + 1],
                z: parsed.positions[base + 2]
            };

            // Add per-atom properties from plugin data
            const pluginItem = pluginDataByAtomId.get(atomId);
            if (pluginItem) {
                for (const prop of perAtomProperties) {
                    const value = pluginItem[prop];
                    if (Array.isArray(value)) {
                        // Calculate magnitude for vector properties
                        let sum = 0;
                        for (const v of value) sum += v * v;
                        row[prop] = Math.sqrt(sum);
                    } else {
                        row[prop] = value;
                    }
                }
            }

            rows.push(row);
        }

        res.status(200).json({
            status: 'success',
            data: rows,
            properties: perAtomProperties,
            page,
            pageSize,
            total: totalAtoms,
            hasMore: endIndex < totalAtoms
        });
    });
}
