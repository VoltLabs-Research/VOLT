import { NextFunction, Request, Response } from 'express';
import { catchAsync } from '@/utilities/runtime/runtime';
import { slugify } from '@/utilities/runtime/runtime';
import { Team } from '@/models';
import { IWorkflowNode, IPlugin } from '@/types/models/modifier';
import { NodeType, PluginStatus } from '@/types/models/plugin';
import { Resource } from '@/constants/resources';
import Plugin from '@/models/plugin/plugin';
import RuntimeError from '@/utilities/runtime/runtime-error';
import BaseController from './base-controller';
import nodeRegistry from '@/services/nodes/node-registry';
import workflowValidator from '@/services/nodes/workflow-validator';
import pluginStorageService from '@/services/plugin/storage';
import pluginExecutionService from '@/services/plugin/execution';
import pluginListingService from '@/services/plugin/listing';
import multer from 'multer';

const binaryUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 }
});

const zipUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 200 * 1024 * 1024 }
});

export default class PluginsController extends BaseController<IPlugin> {
    constructor() {
        super(Plugin, {
            fields: ['slug', 'workflow', 'status', 'team'],
            resource: Resource.PLUGIN,
            populate: [{ path: 'team', select: 'name description' }]
        });
    }

    protected async getFilter(req: Request): Promise<any> {
        const teamId = await this.getTeamId(req);
        const user = (req as any).user;

        if (teamId) {
            const team = await Team.findOne({ _id: teamId, members: user._id });
            if (!team) return { _id: { $in: [] } };
            return { team: teamId };
        }

        const userTeams = await Team.find({ members: user._id }).select('_id');
        const teamIds = userTeams.map((t: any) => t._id);

        return {
            $or: [
                { team: { $in: teamIds } },
                { status: PluginStatus.PUBLISHED }
            ]
        };
    }

    protected async onBeforeCreate(data: Partial<IPlugin>, req: Request): Promise<Partial<IPlugin>> {
        if (!data.slug && data.workflow?.nodes) {
            const modifierNode = data.workflow.nodes.find((node: IWorkflowNode) => node.type === NodeType.MODIFIER);
            if (modifierNode?.data?.modifier?.name) {
                data.slug = slugify(modifierNode.data.modifier.name);
            }
        }

        if (data.workflow) {
            const { valid, errors } = workflowValidator.validateStructure(data.workflow);
            data.validated = valid;
            data.validationErrors = errors;
        }

        if (req.body.teamId) {
            (data as any).team = req.body.teamId;
        }

        return data;
    }

    protected async onBeforeUpdate(data: Partial<IPlugin>, req: Request, currentDoc: IPlugin) {
        if (data.workflow?.nodes) {
            const modifierNode = data.workflow.nodes.find((node: IWorkflowNode) => node.type === NodeType.MODIFIER);
            if (modifierNode?.data?.modifier?.name) {
                data.slug = slugify(modifierNode.data.modifier.name);
            }
        }

        if (data.workflow) {
            const { valid, errors } = workflowValidator.validateStructure(data.workflow);
            data.validated = valid;
            data.validationErrors = errors;
        }

        if (data.status === PluginStatus.PUBLISHED && currentDoc.status !== PluginStatus.PUBLISHED) {
            const isValid = data.validated ?? currentDoc.validated;
            if (!isValid) {
                throw new RuntimeError('Plugin::NotValid::CannotPublish', 400);
            }
        }

        return data;
    }

    // === Utility Endpoints ===

    public validateWorkflow = catchAsync(async (req: Request, res: Response) => {
        const { workflow } = req.body;
        if (!workflow) throw new RuntimeError('Plugin::Workflow::Required', 400);

        const { valid, errors } = workflowValidator.validateStructure(workflow);
        res.status(200).json({ status: 'success', data: { valid, errors } });
    });

    public getNodeSchemas = catchAsync(async (req: Request, res: Response) => {
        const schemas = nodeRegistry.getSchemas();
        res.status(200).json({ status: 'success', data: schemas });
    });

    // === Execution ===

    public evaluatePlugin = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { pluginSlug, id: trajectoryId } = req.params;
        const { config, selectedFrameOnly, timestep } = req.body;
        const { trajectory } = res.locals;
        const userId = (req as any).user._id;

        try {
            const result = await pluginExecutionService.executePlugin(
                pluginSlug,
                trajectoryId,
                trajectory,
                userId,
                { config, selectedFrameOnly, timestep }
            );
            res.status(200).json({ status: 'success', data: result });
        } catch (err: any) {
            return next(new RuntimeError(err.message, 400));
        }
    });

    // === File Streaming ===

    public getPluginExposureGLB = catchAsync(async (req: Request, res: Response) => {
        const { timestep, analysisId, exposureId } = req.params;
        const { trajectory } = res.locals;

        try {
            await pluginListingService.streamExposureGLB(
                trajectory._id.toString(),
                analysisId,
                exposureId,
                timestep,
                res
            );
        } catch (err) {
            res.status(404).json({
                status: 'error',
                data: { error: `GLB not found for exposure ${exposureId} at timestep ${timestep}` }
            });
        }
    });

    public getPluginExposureChart = catchAsync(async (req: Request, res: Response) => {
        const { timestep, analysisId, exposureId } = req.params;
        const { trajectory } = res.locals;

        try {
            await pluginListingService.streamExposureChart(
                trajectory._id.toString(),
                analysisId,
                exposureId,
                timestep,
                res
            );
        } catch (err) {
            res.status(404).json({
                status: 'error',
                data: { error: `Chart not found for exposure ${exposureId} at timestep ${timestep}` }
            });
        }
    });

    public getPluginExposureFile = catchAsync(async (req: Request, res: Response) => {
        const { timestep, analysisId, exposureId } = req.params;
        const filename = req.params.filename || 'file.msgpack';
        const { trajectory } = res.locals;

        try {
            await pluginListingService.streamExposureFile(
                trajectory._id.toString(),
                analysisId,
                exposureId,
                timestep,
                filename,
                res
            );
        } catch (err) {
            res.status(404).json({
                status: 'error',
                data: { error: `File not found for exposure ${exposureId} at timestep ${timestep}` }
            });
        }
    });

    public getPluginListingDocuments = catchAsync(async (req: Request, res: Response) => {
        const { pluginSlug, listingSlug } = req.params;
        const teamId = String(req.query.teamId || '');
        const trajectory = res.locals.trajectory;

        try {
            const result = await pluginListingService.getListingDocuments({
                pluginSlug,
                listingSlug,
                teamId,
                trajectoryId: trajectory?._id?.toString(),
                limit: +(req.query.limit ?? 50) || 50,
                sortAsc: String(req.query.sort ?? 'desc').toLowerCase() === 'asc',
                afterCursor: String(req.query.after ?? '')
            });
            res.status(200).json({ status: 'success', data: result });
        } catch (err: any) {
            throw new RuntimeError(err.message, 400);
        }
    });

    public getPerFrameListing = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { id: trajectoryId, analysisId, exposureId, timestep } = req.params;

        try {
            const result = await pluginListingService.getPerFrameListing({
                trajectoryId,
                analysisId,
                exposureId,
                timestep,
                page: parseInt(req.query.page as string) || 1,
                limit: parseInt(req.query.limit as string) || 50
            });
            res.status(200).json({ status: 'success', data: result });
        } catch (err: any) {
            res.status(404).json({
                status: 'error',
                data: { error: `Data not found for analysis ${analysisId}` }
            });
        }
    });

    // === Binary Management ===

    public uploadBinaryMiddleware = binaryUpload.single('binary');

    public uploadBinary = catchAsync(async (req: Request, res: Response) => {
        const plugin = res.locals.plugin;
        if (!plugin) throw new RuntimeError('Plugin::NotLoaded', 500);
        if (!req.file) throw new RuntimeError('Plugin::Binary::Required', 400);

        const result = await pluginStorageService.uploadBinary(plugin._id.toString(), req.file);

        try {
            const validatedPlugin = await pluginStorageService.validateAndPublishPlugin(plugin._id.toString());
            res.status(200).json({ status: 'success', data: { ...result, plugin: validatedPlugin } });
        } catch (err: any) {
            throw new RuntimeError(err.message, 400);
        }
    });

    public deleteBinary = catchAsync(async (req: Request, res: Response) => {
        const plugin = res.locals.plugin;
        if (!plugin) throw new RuntimeError('Plugin::NotLoaded', 500);

        const objectPath = req.body?.objectPath || req.query?.objectPath;

        try {
            await pluginStorageService.deleteBinary(plugin, objectPath);
            res.status(200).json({ status: 'success', message: 'Binary deleted successfully' });
        } catch (err: any) {
            throw new RuntimeError(err.message, 400);
        }
    });

    // === Export/Import ===

    public exportPlugin = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;
        const plugin = await Plugin.findOne({ $or: [{ _id: id }, { slug: id }] }).lean();

        if (!plugin) return next(new RuntimeError('Plugin::NotFound', 404));

        await pluginStorageService.exportPlugin(plugin as any, res);
    });

    public exportAnalysisResults = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { pluginSlug, analysisId } = req.params;

        try {
            await pluginListingService.exportAnalysisResults(pluginSlug, analysisId, res);
        } catch (err: any) {
            return next(new RuntimeError(err.message, 500));
        }
    });

    public importPluginMiddleware = zipUpload.single('plugin');

    public importPlugin = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        if (!req.file) return next(new RuntimeError('Plugin::Import::FileRequired' as any, 400));

        const teamId = req.body.teamId || req.query.teamId;

        try {
            const result = await pluginStorageService.importPlugin(req.file.buffer, teamId);
            const validatedPlugin = await pluginStorageService.validateAndPublishPlugin(result.plugin._id.toString());
            res.status(201).json({ status: 'success', data: validatedPlugin });
        } catch (err: any) {
            return next(new RuntimeError(err.message, 400));
        }
    });
}
