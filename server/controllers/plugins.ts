import mongoose from 'mongoose';
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
import storage from '@/services/storage';
import logger from '@/logger';
import multer from 'multer';
import path from 'path';
import archiver from 'archiver';
import unzipper from 'unzipper';
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

const zipUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 200 * 1024 * 1024
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
            fields: ['slug', 'workflow', 'status', 'team'],
            resourceName: 'Plugin',
            populate: [
                { path: 'team', select: 'name description' }
            ]
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
        console.log(data);
        // Auto-generate slug from modifier name on update
        if (data.workflow?.nodes) {
            const modifierNode = data.workflow.nodes.find((node: IWorkflowNode) => node.type === NodeType.MODIFIER);
            if (modifierNode?.data?.modifier?.name) {
                data.slug = slugify(modifierNode.data.modifier.name);
            }
        }

        // Revalidate workflow on update
        if (data.workflow) {
            logger.info(`[PluginsController] onBeforeUpdate: Received ${data.workflow.nodes?.length} nodes, ${data.workflow.edges?.length} edges`);
            const { valid, errors } = workflowValidator.validateStructure(data.workflow);
            logger.info(`[PluginsController] onBeforeUpdate: Validation result - valid: ${valid}, errors: ${JSON.stringify(errors)}`);
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
     * Publish a plugin(change status from draft to published)
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
        const { config, selectedFrameOnly, timestep } = req.body;
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

        const analysisId = new mongoose.Types.ObjectId();

        // Evaluate the workflow up to the forEach node to get the items
        const PluginWorkflowEngine = require('@/services/plugin-workflow-engine').default;
        const engine = new PluginWorkflowEngine();
        const forEachResult = await engine.evaluateForEachItems(
            plugin,
            trajectoryId,
            analysisId.toString(),
            config || {},
            { selectedFrameOnly, timestep }
        );

        if (!forEachResult || !forEachResult.items.length) {
            return next(new RuntimeError('Plugin::ForEach::NoItems', 400));
        }

        const { items } = forEachResult;

        // Create the analysis record
        await Analysis.create({
            _id: analysisId,
            plugin: plugin.slug,
            config,
            trajectory: trajectoryId,
            startedAt: new Date(),
            totalFrames: items.length
        });

        const teamId = (trajectory.team && typeof trajectory.team !== 'string')
            ? trajectory.team.toString()
            : String(trajectory.team);

        // Create one job per forEach item - each job processes a single item
        const jobs: AnalysisJob[] = items.map((item: any, index: number) => ({
            jobId: `${analysisId.toString()}-${index}`,
            teamId,
            trajectoryId,
            config,
            inputFile: item.path || '',
            analysisId: analysisId.toString(),
            timestep: item.timestep,
            modifierId: plugin.slug,
            plugin: plugin.slug,
            name: plugin.modifier?.name || plugin.slug,
            message: `${trajectory.name} - Item ${index + 1}/${items.length}`,
            forEachItem: item,
            forEachIndex: index
        }));

        const analysisQueue = getAnalysisQueue();
        analysisQueue.addJobs(jobs);

        res.status(200).json({
            status: 'success',
            data: { analysisId: analysisId.toString(), totalJobs: jobs.length }
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
     * Supports both single trajectory(via :id param) and all trajectories(via teamId query)
     */
    public getPluginListingDocuments = catchAsync(async (req: Request, res: Response) => {
        const { pluginSlug, listingSlug } = req.params;
        const trajectory = res.locals.trajectory; // May be undefined if no :id param
        const teamId = req.query.teamId as string;

        const pageNum = Math.max(1, +(req.query.page ?? 1) || 1);
        const limitNum = Math.min(200, Math.max(1, +(req.query.limit ?? 50) || 50));
        const sortAsc = String(req.query.sort ?? 'desc').toLowerCase() === 'asc';

        // Load plugin
        const plugin = await Plugin.findOne({ slug: pluginSlug }).lean();
        if (!plugin) throw new RuntimeError('Plugin::NotFound', 404);

        const { nodes, edges } = plugin.workflow;

        // Find visualizer connected to exposure matching listingSlug
        // Traverse: Exposure -> Schema -> Visualizers(by edges)
        const findVisualizerForExposure = (exposureName: string): IWorkflowNode | null => {
            // Find exposure node
            const exposureNode = nodes.find((n: IWorkflowNode) =>
                n.type === NodeType.EXPOSURE && n.data?.exposure?.name === exposureName
            );
            if (!exposureNode) return null;

            // BFS to find connected visualizer
            const visited = new Set<string>();
            const queue = [exposureNode.id];

            while (queue.length) {
                const currentId = queue.shift()!;
                if (visited.has(currentId)) continue;
                visited.add(currentId);

                // Find downstream nodes
                const outEdges = edges.filter((e: any) => e.source === currentId);
                for (const edge of outEdges) {
                    const targetNode = nodes.find((n: IWorkflowNode) => n.id === edge.target);
                    if (!targetNode) continue;
                    if (targetNode.type === NodeType.VISUALIZERS &&
                        targetNode.data?.visualizers?.listing &&
                        Object.keys(targetNode.data.visualizers.listing).length > 0) {
                        return targetNode;
                    }
                    queue.push(edge.target);
                }
            }
            return null;
        };

        const visualizersNode = findVisualizerForExposure(listingSlug);
        const exposureNodes = nodes.filter((node: IWorkflowNode) => node.type === NodeType.EXPOSURE);

        // Find the primary exposure node ID for this listing(the one matching listingSlug)
        const primaryExposureNode = nodes.find((n: IWorkflowNode) =>
            n.type === NodeType.EXPOSURE && n.data?.exposure?.name === listingSlug
        );
        const primaryExposureId = primaryExposureNode?.id;

        const visualizersData = visualizersNode?.data?.visualizers || {};
        const displayName = listingSlug;

        const listingDef = visualizersData.listing || {};
        const columns = Object.entries(listingDef).map(([path, label]) => ({ path, label: String(label) }));
        const exposureIds = exposureNodes.map((node: IWorkflowNode) => node.id);

        // Determine trajectories to query
        let trajectoryIds: string[] = [];
        let trajectoryMap = new Map<string, any>();

        if (trajectory) {
            // Single trajectory mode
            trajectoryIds = [trajectory._id.toString()];
            trajectoryMap.set(trajectory._id.toString(), trajectory);
        } else if (teamId) {
            // All trajectories for team
            const Trajectory = require('@/models/trajectory').default;
            const teamTrajectories = await Trajectory.find({ team: teamId }).select('_id name').lean();
            trajectoryIds = teamTrajectories.map((t: any) => t._id.toString());
            teamTrajectories.forEach((t: any) => trajectoryMap.set(t._id.toString(), t));
        } else {
            throw new RuntimeError('TeamID::Required', 400);
        }

        const meta = {
            displayName,
            listingSlug,
            pluginSlug,
            trajectoryName: trajectory?.name || 'All Trajectories',
            columns
        };

        if (!trajectoryIds.length) {
            return res.status(200).json({
                status: 'success',
                data: { meta, rows: [], page: pageNum, limit: limitNum, total: 0, hasMore: false }
            });
        }

        // Find analyses across all selected trajectories
        const analyses = await Analysis.find({
            trajectory: { $in: trajectoryIds },
            plugin: pluginSlug
        }).select('_id config createdAt trajectory').lean();

        if (!analyses.length) {
            return res.status(200).json({
                status: 'success',
                data: { meta, rows: [], page: pageNum, limit: limitNum, total: 0, hasMore: false }
            });
        }

        const analysisMap = new Map(analyses.map((a: any) => {
            const trajId = a.trajectory.toString();
            return [a._id.toString(), { ...a, trajectory: trajectoryMap.get(trajId) || { _id: trajId, name: trajId } }];
        }));

        // Collect timesteps from all analyses
        const timestepPromises = analyses.map(async (analysis: any) => {
            const trajId = analysis.trajectory.toString();
            const prefix = `plugins/trajectory-${trajId}/analysis-${analysis._id}/`;
            const seen = new Set<number>();
            for await (const key of storage.listByPrefix(SYS_BUCKETS.PLUGINS, prefix)) {
                const match = key.match(/timestep-(\d+)\.msgpack$/);
                if (match) seen.add(+match[1]);
            }
            return Array.from(seen).map((timestep) => ({
                analysisId: analysis._id.toString(),
                trajectoryId: trajId,
                timestep
            }));
        });

        const allTimesteps = (await Promise.all(timestepPromises)).flat();
        allTimesteps.sort((a: any, b: any) => sortAsc ? a.timestep - b.timestep : b.timestep - a.timestep);

        const total = allTimesteps.length;
        const offset = (pageNum - 1) * limitNum;
        const pagedEntries = allTimesteps.slice(offset, offset + limitNum);

        if (!pagedEntries.length) {
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
                    exposureIds, entry.trajectoryId, entry.analysisId, entry.timestep);

                // Skip if the primary exposure has no data (If-Statement may have filtered it)
                if (primaryExposureId && !exposureData.has(primaryExposureId)) {
                    return null;
                }

                const analysis = analysisMap.get(entry.analysisId);
                const context = {
                    nodeMap,
                    parentMap,
                    exposureData,
                    trajectory: analysis?.trajectory,
                    analysis,
                    timestep: entry.timestep
                };

                return {
                    _id: `${entry.analysisId}-${entry.timestep}`,
                    timestep: entry.timestep,
                    analysisId: entry.analysisId,
                    trajectoryId: entry.trajectoryId,
                    exposureId: primaryExposureId,
                    trajectoryName: analysis?.trajectory?.name || entry.trajectoryId,
                    ...resolveRow(columns, context)
                };
            }));

            rows.push(...batchRows.filter(row => row !== null));
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

        // Try to find path in the stored plugin first
        const entrypointNode = plugin.workflow.nodes.find((n: IWorkflowNode) => n.type === NodeType.ENTRYPOINT);
        let objectPath = entrypointNode?.data?.entrypoint?.binaryObjectPath;

        // If not in DB(e.g. unsaved draft), check request
        if (!objectPath) {
            objectPath = req.body?.objectPath || req.query?.objectPath;
        }

        if (!plugin) throw new RuntimeError('Plugin::NotLoaded', 500);
        if (!objectPath) throw new RuntimeError('Plugin::Binary::PathRequired', 400);

        if (!objectPath.toString().startsWith(`plugin-binaries/${plugin._id}/`)) {
            throw new RuntimeError('Plugin::Binary::InvalidPath', 403);
        }

        await storage.delete(SYS_BUCKETS.PLUGINS, objectPath.toString());

        // If we found it in the DB, we should clear it to keep DB consistent
        if (entrypointNode?.data?.entrypoint?.binaryObjectPath) {
            entrypointNode.data.entrypoint.binaryObjectPath = undefined;
            if (entrypointNode.data.entrypoint.binaryFileName) entrypointNode.data.entrypoint.binaryFileName = undefined;
            if (entrypointNode.data.entrypoint.binary) entrypointNode.data.entrypoint.binary = undefined;

            // Mark modified and save
            plugin.markModified('workflow');
            await plugin.save();
        }

        logger.info(`[PluginsController] Binary deleted: ${objectPath}`);

        res.status(200).json({
            status: 'success',
            message: 'Binary deleted successfully'
        });
    });

    /**
     * Export a plugin as a ZIP file containing plugin.json and binary
     */
    public exportPlugin = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;
        const plugin = await Plugin.findOne({ $or: [{ _id: id }, { slug: id }] }).lean();

        if (!plugin) {
            return next(new RuntimeError('Plugin::NotFound', 404));
        }

        // Prepare plugin data for export (exclude team-specific data)
        const exportData = {
            slug: plugin.slug,
            workflow: plugin.workflow,
            status: PluginStatus.DRAFT, // Always export as draft
            validated: plugin.validated,
            exportedAt: new Date().toISOString(),
            version: '1.0'
        };

        // Find entrypoint node for binary info
        const entrypointNode = plugin.workflow.nodes.find(
            (n: IWorkflowNode) => n.type === NodeType.ENTRYPOINT
        );
        const binaryObjectPath = entrypointNode?.data?.entrypoint?.binaryObjectPath;
        const binaryFileName = entrypointNode?.data?.entrypoint?.binaryFileName || 'binary';

        // Set response headers
        const pluginName = slugify(plugin.slug);
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${pluginName}.zip"`);

        // Create archive
        const archive = archiver('zip', { zlib: { level: 5 } });
        archive.pipe(res);

        // Add plugin.json
        archive.append(JSON.stringify(exportData, null, 2), { name: 'plugin.json' });

        // Add binary if exists
        if (binaryObjectPath) {
            try {
                const binaryStream = await storage.getStream(SYS_BUCKETS.PLUGINS, binaryObjectPath);
                archive.append(binaryStream, { name: `binary/${binaryFileName}` });
            } catch (err) {
                logger.warn(`[PluginsController] Binary not found during export: ${binaryObjectPath}`);
            }
        }

        await archive.finalize();
    });

    /**
     * Import a plugin from a ZIP file
     */
    public importPluginMiddleware = zipUpload.single('plugin');

    public importPlugin = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        if (!req.file) {
            return next(new RuntimeError('Plugin::Import::FileRequired', 400));
        }

        const teamId = req.body.teamId || req.query.teamId;

        // Parse ZIP file
        const directory = await unzipper.Open.buffer(req.file.buffer);

        // Find plugin.json
        const pluginJsonFile = directory.files.find((f: any) => f.path === 'plugin.json');
        if (!pluginJsonFile) {
            return next(new RuntimeError('Plugin::Import::InvalidZip', 400));
        }

        const pluginJsonBuffer = await pluginJsonFile.buffer();
        const importData = JSON.parse(pluginJsonBuffer.toString('utf-8'));

        if (!importData.workflow) {
            return next(new RuntimeError('Plugin::Import::InvalidFormat', 400));
        }

        // Generate unique slug
        const baseSlug = importData.slug || 'imported-plugin';
        const uniqueSlug = `${baseSlug}-${Date.now()}`;

        // Create the plugin first (without binary)
        const newPlugin = await Plugin.create({
            slug: uniqueSlug,
            workflow: importData.workflow,
            status: PluginStatus.DRAFT,
            team: teamId
        });

        // Find and upload binary if exists
        const binaryFile = directory.files.find((f: any) => f.path.startsWith('binary/'));
        if (binaryFile) {
            const binaryBuffer = await binaryFile.buffer();
            const binaryFileName = path.basename(binaryFile.path);
            const binaryObjectPath = `plugin-binaries/${newPlugin._id}/${uuidv4()}-${binaryFileName}`;

            await storage.put(SYS_BUCKETS.PLUGINS, binaryObjectPath, binaryBuffer, {
                'Content-Type': 'application/octet-stream',
                'x-amz-meta-original-name': binaryFileName
            });

            // Update entrypoint node with binary info
            const entrypointNode = newPlugin.workflow.nodes.find(
                (n: IWorkflowNode) => n.type === NodeType.ENTRYPOINT
            );
            if (entrypointNode?.data?.entrypoint) {
                entrypointNode.data.entrypoint.binaryObjectPath = binaryObjectPath;
                entrypointNode.data.entrypoint.binaryFileName = binaryFileName;
                newPlugin.markModified('workflow');
                await newPlugin.save();
            }

            logger.info(`[PluginsController] Imported binary: ${binaryObjectPath}`);
        }

        logger.info(`[PluginsController] Plugin imported: ${newPlugin.slug}`);

        res.status(201).json({
            status: 'success',
            data: newPlugin
        });
    });
};
