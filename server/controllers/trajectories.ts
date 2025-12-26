import { NextFunction, Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import BaseController from '@/controllers/base-controller';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { ErrorCodes } from '@/constants/error-codes';
import DumpStorage from '@/services/dump-storage';
import TrajectoryVFS from '@/services/trajectory-vfs';
import TrajectoryParserFactory from '@/parsers/factory';
import storage from '@/services/storage';
import processAndCreateTrajectory from '@/utilities/create-trajectory';
import archiver from 'archiver';
import { catchAsync } from '@/utilities/runtime/runtime';
import { getMetricsByTeamId } from '@/utilities/metrics/team';
import { Trajectory, Team, Analysis, Plugin } from '@/models';
import { SYS_BUCKETS } from '@/config/minio';
import { getAnyTrajectoryPreview, sendImage } from '@/utilities/raster';
import { NodeType } from '@/types/models/modifier';
import { findDescendantByType } from '@/utilities/plugins/workflow-utils';
import { decodeMultiStream } from '@/utilities/msgpack/msgpack-stream';

export default class TrajectoryController extends BaseController<any> {
    constructor() {
        super(Trajectory, {
            resourceName: 'Trajectory',
            fields: ['name', 'preview', 'isPublic', 'createdBy'],
            populate: [
                { path: 'createdBy', select: 'email firstName lastName' },
                { path: 'analysis' },
                { path: 'team', select: '_id name' }
            ]
        });
    }

    /**
     * Users can only see trajectories in teams they belong to.
     */
    protected async getFilter(req: Request): Promise<any> {
        const userId = (req as any).user.id;
        const { teamId } = req.query;

        let teamQuery: any = { members: userId };
        if (teamId && typeof teamId === 'string') {
            if (!isValidObjectId(teamId)) throw new RuntimeError(ErrorCodes.VALIDATION_INVALID_TEAM_ID, 400);
            teamQuery._id = teamId;
        }

        const userTeams = await Team.find(teamQuery).select('_id');

        // If filtering by specific team ID and user isn't in it, return impossible query
        if (teamId && userTeams.length === 0) return { _id: { $in: [] } };

        const teamIds = userTeams.map((team) => team._id);
        return { team: { $in: teamIds } };
    }

    /**
     * Cleanup resources(Dump, Temp Files) before deleting the DB record
     */
    protected async onBeforeDelete(doc: any, req: Request): Promise<void> {
        const trajectoryId = doc._id.toString();
        await DumpStorage.deleteDumps(trajectoryId);
    }

    public getTeamMetrics = catchAsync(async (req: Request, res: Response) => {
        const { teamId } = req.query;
        if (!teamId || typeof teamId !== 'string') {
            throw new RuntimeError(ErrorCodes.TRAJECTORY_TEAM_ID_REQUIRED, 400);
        }
        const metrics = await getMetricsByTeamId(teamId);
        res.status(200).json({ status: 'success', data: metrics });
    });

    public getSingleMetrics = catchAsync(async (req: Request, res: Response) => {
        const trajectory = res.locals.trajectory;
        const trajectoryId = trajectory._id.toString();
        const vfs = new TrajectoryVFS(trajectoryId);

        const rootEntries = await vfs.list(`trajectory-${trajectoryId}`);
        const vfsTotalSize = rootEntries.reduce((acc, entry) => acc + (entry.size || 0), 0);

        let pluginsSize = 0;
        for await (const key of storage.listByPrefix(SYS_BUCKETS.PLUGINS, `plugins/trajectory-${trajectoryId}/`)) {
            const stat = await storage.getStat(SYS_BUCKETS.PLUGINS, key);
            pluginsSize += stat.size;
        }

        res.status(200).json({
            status: 'success',
            data: {
                frames: { totalFrames: trajectory.frames?.length || 0 },
                files: { totalSizeBytes: vfsTotalSize + pluginsSize },
                analyses: { totalAnalyses: rootEntries.filter((e) => e.name.startsWith('analysis-')).length }
            }
        });
    });

    public getPreview = catchAsync(async (req: Request, res: Response) => {
        const trajectory = res.locals.trajectory;
        const result = await getAnyTrajectoryPreview(trajectory._id.toString());

        if (!result) {
            throw new RuntimeError(ErrorCodes.TRAJECTORY_FILE_NOT_FOUND, 404);
        }

        return sendImage(res, result.etag, result.buffer);
    });

    public getAtoms = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { analysisId } = req.params;
        const { timestep, exposureId, page: pageStr, pageSize: pageSizeStr } = req.query;
        const trajectoryId = res.locals.trajectory._id.toString();

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

        const [analysis, dumpPath] = await Promise.all([
            Analysis.findById(analysisId).lean(),
            DumpStorage.getDump(trajectoryId, String(timestep))
        ]);

        if (!analysis) return next(new RuntimeError(ErrorCodes.ANALYSIS_NOT_FOUND, 404));
        if (!dumpPath) return next(new RuntimeError(ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND, 404));

        const plugin = await Plugin.findOne({ slug: analysis.plugin }).lean();
        if (!plugin) return next(new RuntimeError(ErrorCodes.PLUGIN_NOT_FOUND, 404));

        const exposureNode = plugin.workflow.nodes.find((node: any) => node.type === NodeType.EXPOSURE && node.id === exposureId);
        if (!exposureNode) return next(new RuntimeError(ErrorCodes.PLUGIN_NODE_NOT_FOUND, 404));

        // Find schema and visualizer nodes connected to this specific exposure
        const schemaNode = findDescendantByType(String(exposureId), plugin.workflow, NodeType.SCHEMA);
        const visualizerNode = findDescendantByType(String(exposureId), plugin.workflow, NodeType.VISUALIZERS);

        // The visualizer node is not necessary, but the schema node is.
        if (!schemaNode) return next(new RuntimeError(ErrorCodes.PLUGIN_NODE_NOT_FOUND, 404));

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
            return res.status(200).json({
                status: 'success',
                data: [],
                properties: [],
                page,
                pageSize,
                total: totalAtoms,
                hasMore: false
            });
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

        res.status(200).json({
            status: 'success',
            data: rows,
            properties: Array.from(discoveredProps),
            page,
            pageSize,
            total: totalAtoms,
            hasMore: endIndex < totalAtoms
        })
    });

    public getGLB = catchAsync(async (req: Request, res: Response) => {
        const { timestep, analysisId } = req.params;
        const { type } = req.query as { type?: string };
        const trajectoryId = res.locals.trajectory._id.toString();
        const vfs = new TrajectoryVFS(trajectoryId);

        let virtualPath = '';
        if (analysisId === 'default' || !type) {
            virtualPath = `trajectory-${trajectoryId}/previews/timestep-${timestep}.glb`;
        } else {
            const glbFiles = await vfs.list(`trajectory-${trajectoryId}/analysis-${analysisId}/glb`);
            const match = glbFiles.find(f => f.name.includes(type) && f.name.includes(timestep));
            if (!match) throw new RuntimeError(ErrorCodes.TRAJECTORY_FILE_NOT_FOUND, 404);
            virtualPath = match.relPath;
        }

        const { stream, size, filename } = await vfs.getReadStream(virtualPath);
        res.setHeader('Content-Type', 'model/gltf-binary');
        res.setHeader('Content-Length', size);
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        if (analysisId === 'default') res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        stream.pipe(res);
    });

    public downloadGLBArchive = catchAsync(async (req: Request, res: Response) => {
        const trajectory = res.locals.trajectory;
        const trajectoryId = trajectory._id.toString();
        const { analysisId } = req.params;
        const vfs = new TrajectoryVFS(trajectoryId);

        const entries = await vfs.list(`trajectory-${trajectoryId}/analysis-${analysisId}/glb`);
        const frameFilter = req.query.frame ? String(req.query.frame) : null;

        const filesToZip = entries.filter((entry) => {
            if (entry.type !== 'file') return false;
            if (frameFilter && !entry.name.includes(frameFilter)) return false;
            return true;
        });

        if (!filesToZip.length) throw new RuntimeError(ErrorCodes.TRAJECTORY_FILES_NOT_FOUND, 404);

        const filename = String(trajectory.name || trajectoryId).replace(/[^a-z0-9_\-]+/gi, '_');
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}_${analysisId}.zip"`);

        const archive = archiver('zip', { zlib: { level: 0 } });

        archive.on('error', () => {
            if (!res.headersSent) res.status(500).end();
        });

        archive.pipe(res);

        for (const file of filesToZip) {
            const { stream } = await vfs.getReadStream(file.relPath);
            archive.append(stream, { name: `glb/${file.name}` });
        }

        await archive.finalize();
    });

    public create = catchAsync(async (req: Request, res: Response) => {
        const userId = (req as any).user._id;
        const { teamId, originalFolderName, uploadId } = req.body;

        let trajectoryName = req.body.name;
        if (!trajectoryName && originalFolderName && originalFolderName.length >= 4) {
            trajectoryName = originalFolderName;
        }
        if (!trajectoryName) trajectoryName = 'Untitled Trajectory';

        let trajectory;
        try {
            trajectory = await processAndCreateTrajectory({
                files: req.files as any[],
                teamId,
                userId: (req as any).user._id,
                trajectoryName,
                originalFolderName: req.body.originalFolderName,
                onProgress: (progress) => {
                    if (uploadId) {
                        const io = req.app.get('io');
                        io.to(`upload:${uploadId}`).emit('trajectory:upload-progress', {
                            uploadId,
                            progress
                        });
                        io.to(`user:${userId}`).emit('trajectory:upload-progress', {
                            uploadId,
                            progress
                        });
                    }
                }
            });
            console.log(trajectory);
            res.status(201).json({
                status: 'success',
                data: trajectory
            });
        } catch (error) {
            throw error;
        }
    });
};