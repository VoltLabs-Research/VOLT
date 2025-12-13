import { NextFunction, Request, Response } from 'express';
import { catchAsync, slugify } from '@/utilities/runtime/runtime';
import { getAnalysisQueue } from '@/queues';
import { Analysis } from '@/models';
import { AnalysisJob } from '@/types/queues/analysis-processing-queue';
import { SYS_BUCKETS } from '@/config/minio';
import { decode as decodeMsgpack } from '@msgpack/msgpack';
import { IWorkflowNode, IPlugin } from '@/types/models/modifier';
import { NodeType, PluginStatus } from '@/types/models/plugin';
import { v4 as uuidv4 } from 'uuid';
import Plugin from '@/models/plugin';
import RuntimeError from '@/utilities/runtime/runtime-error';
import DumpStorage from '@/services/dump-storage';
import storage from '@/services/storage';
import logger from '@/logger';
import multer from 'multer';
import path from 'path';
import BaseController from './base-controller';
import nodeRegistry from '@/services/nodes/node-registry';
import workflowValidator from '@/services/nodes/workflow-validator';
import {
    buildNodeMap,
    buildParentMap,
    loadExposuresParallel,
    resolveRow
} from '@/utilities/plugins/listing-resolver';

const binaryUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 100 * 1024 * 1024
    }
});

// TODO: dupicated code
const getValueByPath = (obj: any, path: string) => {
    if (!obj || !path) return undefined;
    if (!path.includes('.')) {
        return obj?.[path];
    }
    return path.split('.').reduce((acc: any, key: string) => (acc == null ? undefined : acc[key]), obj);
};

export default class PluginsController extends BaseController<IPlugin> {
    constructor() {
        super(Plugin, {
            fields: ['slug', 'workflow', 'status'],
            resourceName: 'Plugin'
        });
    }

    protected async onBeforeCreate(data: Partial<IPlugin>, req: Request): Promise<Partial<IPlugin>> {
        // auto-generate slug from modifier name if not provided
        if (!data.slug && data.workflow?.nodes) {
            const modifierNode = data.workflow.nodes.find((node: IWorkflowNode) => node.type === NodeType.MODIFIER);
            if (modifierNode?.data?.modifier?.name) {
                data.slug = slugify(modifierNode.data.modifier.name);
            }
        }

        // Validate workflow
        if (data.workflow) {
            const { valid, errors } = workflowValidator.validateStructure(data.workflow);
            data.validated = valid;
            data.validationErrors = errors;
        }

        return data;
    }

    protected async onBeforeUpdate(data: Partial<IPlugin>) {
        // Revalidate workflow on update
        if (data.workflow) {
            const { valid, errors } = workflowValidator.validateStructure(data.workflow);
            data.validated = valid;
            data.validationErrors = errors;
        }
        return data;
    }

    /**
     * Validate a workflow without saving
     */
    public validateWorkflow = catchAsync(async (req: Request, res: Response) => {
        const { workflow } = req.body;
        if (!workflow) {
            throw new RuntimeError('Plugin::Workflow::Required', 400);
        }

        const { valid, errors } = workflowValidator.validateStructure(workflow);

        res.status(200).json({
            status: 'success',
            data: { valid, errors }
        });
    });

    /**
     * Publish a plugin (change status from draft to published)
     */
    public publishPlugin = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;
        const plugin = await Plugin.findOne({ $or: [{ _id: id }, { slug: id }] });

        if (!plugin) {
            return next(new RuntimeError('Plugin::NotFound', 404));
        }

        if (!plugin.validated) {
            return next(new RuntimeError('Plugin::NotValid::CannotPublish', 400));
        }

        plugin.status = PluginStatus.PUBLISHED;
        await plugin.save();

        res.status(200).json({
            status: 'success',
            data: plugin
        });
    });

    /**
     * Get all published plugins
     */
    public getPublishedPlugins = catchAsync(async (req: Request, res: Response) => {
        const plugins = await Plugin.find({ status: PluginStatus.PUBLISHED }).lean();

        res.status(200).json({
            status: 'success',
            data: plugins
        });
    });

    /**
     * Get all node output schemas for template autocomplete
     */
    public getNodeSchemas = catchAsync(async (req: Request, res: Response) => {
        const schemas = nodeRegistry.getSchemas();

        res.status(200).json({
            status: 'success',
            data: schemas
        });
    });

    /**
     * Execute a plugin on a trajectory
     */
    public evaluatePlugin = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { pluginSlug, id: trajectoryId } = req.params;
        const { config, timestep } = req.body;
        const { trajectory } = res.locals;

        const plugin = await Plugin.findOne({
            slug: pluginSlug,
            status: PluginStatus.PUBLISHED
        });

        if (!plugin) {
            return next(new RuntimeError('Plugin::NotFound', 404));
        }

        if (!plugin.validated) {
            return next(new RuntimeError('Plugin::NotValid::CannotExecute', 400));
        }

        const analysis = await Analysis.create({
            plugin: plugin.slug,
            config,
            trajectory: trajectoryId
        });

        const analysisId = analysis._id.toString();
        let framesToProcess = trajectory!.frames;

        const argumentsNode = plugin.workflow.nodes.find((node: IWorkflowNode) => node.type === NodeType.ARGUMENTS);
        const jobs: AnalysisJob[] = [];
        const promises = framesToProcess.map(async ({ timestep }: any) => {
            const inputFile = await DumpStorage.getDump(trajectoryId, timestep);
            if (!inputFile) {
                return new RuntimeError('Trajectory::Dump::NotFound', 404);
            }

            const teamId = (trajectory.team && typeof trajectory.team !== 'string')
                ? trajectory.team.toString()
                : String(trajectory.team);

            const jobId = `${analysisId}-${timestep}`;
            jobs.push({
                jobId,
                teamId,
                trajectoryId,
                config,
                inputFile,
                analysisId,
                modifierId: plugin.slug,
                plugin: plugin.slug,
                name: plugin.modifier?.name || plugin.slug,
                message: `${trajectory.name} - Frame ${timestep}`
            });
        });

        await Promise.all(promises);

        const analysisQueue = getAnalysisQueue();
        analysisQueue.addJobs(jobs);

        res.status(200).json({
            status: 'success',
            data: { analysisId }
        });
    });

    /**
     * Get GLB model for an exposure
     */
    public getPluginExposureGLB = catchAsync(async (req: Request, res: Response) => {
        const { timestep, analysisId, exposureId } = req.params;
        const { trajectory } = res.locals;
        const trajectoryId = trajectory._id.toString();
        const exposureKey = slugify(exposureId);

        try {
            const objectName = `trajectory-${trajectoryId}/analysis-${analysisId}/glb/${timestep}/${exposureKey}.glb`;
            const stat = await storage.getStat(SYS_BUCKETS.MODELS, objectName);
            const stream = await storage.getStream(SYS_BUCKETS.MODELS, objectName);
            res.setHeader('Content-Type', 'model/gltf-binary');
            res.setHeader('Content-Length', stat.size);
            res.setHeader('Content-Disposition', `inline; filename="${exposureId}_${timestep}.glb"`);
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            stream.pipe(res);
        } catch (err) {
            logger.error(`[getPluginExposureGLB] Error: ${err}`);
            return res.status(404).json({
                status: 'error',
                data: { error: `GLB not found for exposure ${exposureId} at timestep ${timestep}` }
            });
        }
    });

    public getPluginExposureFile = catchAsync(async (req: Request, res: Response) => {
        const { timestep, analysisId, exposureId } = req.params;
        const filename = req.params.filename || 'file.msgpack';
        const { trajectory } = res.locals;
        const trajectoryId = trajectory._id.toString();

        try {
            const objectName = [
                'plugins',
                `trajectory-${trajectoryId}`,
                `analysis-${analysisId}`,
                exposureId,
                `timestep-${timestep}.msgpack`
            ].join('/');

            const stat = await storage.getStat(SYS_BUCKETS.PLUGINS, objectName);
            const stream = await storage.getStream(SYS_BUCKETS.PLUGINS, objectName);

            res.setHeader('Content-Length', stat.size);
            res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

            if (filename.endsWith('.msgpack')) {
                res.setHeader('Content-Type', 'application/x-msgpack');
            } else if (filename.endsWith('.json')) {
                res.setHeader('Content-Type', 'application/json');
            } else {
                res.setHeader('Content-Type', 'application/octet-stream');
            }

            stream.pipe(res);
        } catch (err: any) {
            logger.error(`[getPluginExposureFile] Error: ${err}`);
            return res.status(404).json({
                status: 'error',
                data: { error: `File not found for exposure ${exposureId} at timestep ${timestep}` }
            });
        }
    });

    /**
     * Get listing documents for a plugin
     */
    public getPluginListingDocuments = catchAsync(async (req: Request, res: Response) => {
        const { pluginSlug, listingSlug } = req.params;
        const trajectory = res.locals.trajectory;
        if (!trajectory) throw new RuntimeError('Trajectory::NotFound', 404);

        const trajectoryId = trajectory._id.toString();
        const pageNum = Math.max(1, +(req.query.page ?? 1) || 1);
        const limitNum = Math.min(200, Math.max(1, +(req.query.limit ?? 50) || 50));
        const sortAsc = String(req.query.sort ?? 'desc').toLowerCase() === 'asc';

        const [plugin, analyses] = await Promise.all([
            Plugin.findOne({ slug: pluginSlug }).lean(),
            Analysis.find({ trajectory: trajectoryId, plugin: pluginSlug })
                .select('_id config createdAt').lean()
        ]);

        if (!plugin) throw new RuntimeError('Plugin::NotFound', 404);

        const { nodes, edges } = plugin.workflow;
        const visualizersNode = nodes.find((node: IWorkflowNode) => node.type === NodeType.VISUALIZERS);
        const exposureNodes = nodes.filter((node: IWorkflowNode) => node.type === NodeType.EXPOSURE);

        const visualizersData = visualizersNode?.data?.visualizers || {};
        const displayName = visualizersData.listingTitle || pluginSlug;

        const listingDef = visualizersData.listing || {};
        const columns = Object.entries(listingDef).map(([path, label]) => ({ path, label: String(label) }));
        const exposureIds = exposureNodes.map((node: IWorkflowNode) => node.id);

        const meta = {
            displayName,
            listingSlug,
            pluginSlug,
            trajectoryName: trajectory.name || trajectoryId,
            columns
        };

        if (!analyses.length) {
            return res.status(200).json({
                status: 'success',
                data: { meta, rows: [], page: pageNum, limit: limitNum, total: 0, hasMore: false }
            });
        }

        const analysisMap = new Map(analyses.map((a: any) => [a._id.toString(), { ...a, trajectory }]));

        const timestepPromises = analyses.map(async (analysis: any) => {
            const prefix = `plugins/trajectory-${trajectoryId}/analysis-${analysis._id}/`;
            const seen = new Set<number>();
            for await (const key of storage.listByPrefix(SYS_BUCKETS.PLUGINS, prefix)) {
                const match = key.match(/timestep-(\d+)\.msgpack$/);
                if (match) seen.add(+match[1]);
            }
            return Array.from(seen).map((timestep) => ({
                analysisId: analysis._id.toString(),
                timestep
            }));
        });

        const allTimesteps = (await Promise.all(timestepPromises)).flat();
        allTimesteps.sort((a: any, b: any) => sortAsc ? a.timestep - b.timestep : b.timestep - a.timestep);

        const total = allTimesteps.length;
        const offset = (pageNum - 1) * limitNum;
        const pagedEntries = allTimesteps.slice(offset, offset + limitNum);

        if (!pagedEntries) {
            return res.status(200).json({
                status: 'success',
                data: { meta, rows: [], page: pageNum, limit: limitNum, total, hasMore: false }
            });
        }

        const nodeMap = buildNodeMap(nodes);
        const parentMap = buildParentMap(edges);

        const BATCH_SIZE = 10;
        const rows: any[] = [];

        for (let i = 0; i < pagedEntries.length; i += BATCH_SIZE) {
            const batch = pagedEntries.slice(i, i + BATCH_SIZE);

            const batchRows = await Promise.all(batch.map(async (entry) => {
                const exposureData = await loadExposuresParallel(
                    exposureIds, trajectoryId, entry.analysisId, entry.timestep);

                const context = {
                    nodeMap,
                    parentMap,
                    exposureData,
                    trajectory,
                    analysis: analysisMap.get(entry.analysisId),
                    timestep: entry.timestep
                };

                return {
                    _id: `${entry.analysisId}-${entry.timestep}`,
                    timestep: entry.timestep,
                    analysisId: entry.analysisId,
                    ...resolveRow(columns, context)
                };
            }));

            rows.push(...batchRows);
        }

        res.status(200).json({
            status: 'success',
            data: {
                meta,
                rows,
                page: pageNum,
                limit: limitNum,
                total,
                hasMore: offset + rows.length < total
            }
        });
    });

    /**
     * Get per-frame listing data
     */
    public getPerFrameListing = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { id: trajectoryId, analysisId, exposureId, timestep } = req.params;
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit as string) || 50));

        const objectName = [
            'plugins',
            `trajectory-${trajectoryId}`,
            `analysis-${analysisId}`,
            exposureId,
            `timestep-${timestep}.msgpack`
        ].join('/');

        try {
            const analysis = await Analysis.findById(analysisId);
            if (!analysis) {
                return next(new RuntimeError('Analysis::NotFound', 404));
            }

            const plugin = await Plugin.findOne({ slug: analysis.plugin });
            if (!plugin) {
                return next(new RuntimeError('Plugin::NotFound', 404));
            }

            const exposureNode = plugin.workflow.nodes.find((node: IWorkflowNode) => node.type === NodeType.EXPOSURE && node.id === exposureId);
            const iterableKey = exposureNode?.data?.exposure?.iterable || 'data';
            const buffer = await storage.getBuffer(SYS_BUCKETS.PLUGINS, objectName);
            const payload = decodeMsgpack(buffer) as any;

            let items: any[] = [];
            if (Array.isArray(payload)) {
                items = payload;
            } else if (payload[iterableKey] && Array.isArray(payload[iterableKey])) {
                items = payload[iterableKey];
            } else if (payload.data && Array.isArray(payload.data)) {
                items = payload.data;
            } else {
                // auto-detect
                for (const key in payload) {
                    if (Array.isArray(payload[key])) {
                        items = payload[key];
                        break;
                    }
                }
            }

            const total = items.length;
            const offset = (page - 1) * limit;
            const pagedItems = items.slice(offset, offset + limit);

            res.status(200).json({
                status: 'success',
                data: {
                    rows: pagedItems,
                    page,
                    limit,
                    total,
                    hasMore: offset + pagedItems.length < total
                }
            });
        } catch (err: any) {
            logger.error(`[getPerFrameListing] Error: ${err}`);
            return res.status(404).json({
                status: 'error',
                data: { error: `Data not found for analysis ${analysisId}` }
            });
        }
    });

    /**
     * Upload a binary file for a plugin
     * The binary is stored in MinIO and the path is saved in the plugin
     */
    public uploadBinaryMiddleware = binaryUpload.single('binary');

    public uploadBinary = catchAsync(async (req: Request, res: Response) => {
        const plugin = res.locals.plugin;
        if (!plugin) throw new RuntimeError('Plugin::NotLoaded', 500);

        if (!req.file) {
            throw new RuntimeError('Plugin::Binary::Required', 400);
        }

        const file = req.file;
        const fileExtension = path.extname(file.originalname) || '';
        const uniqueName = `${uuidv4()}${fileExtension}`;
        const objectPath = `plugin-binaries/${plugin._id}/${uniqueName}`;

        await storage.put(SYS_BUCKETS.PLUGINS, objectPath, file.buffer, {
            'Content-Type': file.mimetype || 'application/octet-stream',
            'x-amz-meta-original-name': file.originalname
        });

        logger.info(`[PluginsController] Binary uploaded: ${objectPath} (${file.size} bytes)`);

        res.status(200).json({
            status: 'success',
            data: {
                objectPath,
                fileName: file.originalname,
                size: file.size
            }
        });
    });

    /**
     * Delete a plugin's uploaded binary from MinIO
     */
    public deleteBinary = catchAsync(async (req: Request, res: Response) => {
        const plugin = res.locals.plugin;
        const { objectPath } = req.body;

        if (!plugin) throw new RuntimeError('Plugin::NotLoaded', 500);
        if (!objectPath) throw new RuntimeError('Plugin::Binary::PathRequired', 400);

        if (!objectPath.startsWith(`plugin-binaries/${plugin._id}/`)) {
            throw new RuntimeError('Plugin::Binary::InvalidPath', 403);
        }

        await storage.delete(SYS_BUCKETS.PLUGINS, objectPath);
        logger.info(`[PluginsController] Binary deleted: ${objectPath}`);

        res.status(200).json({
            status: 'success',
            message: 'Binary deleted successfully'
        });
    });
};