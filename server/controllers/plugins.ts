import { NextFunction, Request, Response } from 'express';
import { catchAsync, slugify } from '@/utilities/runtime/runtime';
import { getAnalysisQueue } from '@/queues';
import { Analysis } from '@/models';
import PluginRegistry from '@/services/plugins/plugins-registry';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { AnalysisJob } from '@/types/queues/analysis-processing-queue';
import TrajectoryVFS from '@/services/trajectory-vfs';
import { getStream, statObject, listByPrefix, getObject } from '@/utilities/buckets';
import { SYS_BUCKETS } from '@/config/minio';
import ManifestService from '@/services/plugins/manifest-service';
import { decode as decodeMsgpack } from '@msgpack/msgpack';
import DumpStorage from '@/services/dump-storage';
import logger from '@/logger';

const getValueByPath = (obj: any, path: string) => {
    if (!obj || !path) return undefined;
    if (!path.includes('.')) {
        return obj?.[path];
    }
    return path.split('.').reduce((acc: any, key: string) => (acc == null ? undefined : acc[key]), obj);
};

const resolveValueByPath = (
    payload: any,
    path: string,
    reserved: Record<string, any>
) => {
    if (!path) return undefined;
    const [root, ...rest] = path.split('.');
    if (reserved[root]) {
        const subPath = rest.join('.');
        return subPath ? getValueByPath(reserved[root], subPath) : reserved[root];
    }

    return getValueByPath(payload, path);
};

// /api/plugins/:pluginId/modifier/:modifierId/trajectory/:trajectoryId { config }
export const evaluateModifier = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { pluginId, modifierId, id: trajectoryId } = req.params;
    const { config, timestep } = req.body;
    const { trajectory } = res.locals;

    const registry = new PluginRegistry();
    if (!registry.exists(pluginId) || !registry.modifierExists(pluginId, modifierId)) {
        return next(new RuntimeError('Plugin::Registry::NotFound', 404));
    }

    const analysis = await Analysis.create({
        plugin: pluginId,
        modifier: modifierId,
        config,
        trajectory: trajectoryId
    });

    const analysisId = analysis._id.toString();
    const trajectoryFS = new TrajectoryVFS(trajectoryId);

    // Get manifest to generate descriptive job name
    const manifest = await new ManifestService(pluginId).get();
    const modifierConfig = manifest?.modifiers?.[modifierId];

    // Try to get displayName from exposure matching modifierId, or use first exposure
    let modifierName = modifierId;
    if (modifierConfig?.exposure) {
        const exposure = modifierConfig.exposure[modifierId] || Object.values(modifierConfig.exposure)[0];
        modifierName = exposure?.displayName || modifierId;
    }

    const trajectoryName = trajectory?.name || trajectoryId;

    let framesToProcess = trajectory!.frames;

    if (modifierConfig?.singleFrameAnalysis) {
        if (timestep === undefined) {
            return next(new RuntimeError('Modifier::SingleFrameAnalysis::TimestepRequired', 400));
        }
        const targetFrame = framesToProcess.find((f: any) => f.timestep === Number(timestep));
        if (!targetFrame) {
            return next(new RuntimeError('Trajectory::Frame::NotFound', 404));
        }
        framesToProcess = [targetFrame];
    }

    const jobs: AnalysisJob[] = [];
    const promises = framesToProcess.map(async ({ timestep }: any) => {
        const inputFile = await DumpStorage.getDump(trajectoryId, timestep);
        if (!inputFile) {
            throw new RuntimeError('Trajectory::Dump::NotFound', 404);
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
            modifierId,
            plugin: pluginId,
            name: modifierName,
            message: `${trajectoryName} - Frame ${timestep}`
        });
    });

    await Promise.all(promises);

    const analysisQueue = getAnalysisQueue();
    analysisQueue.addJobs(jobs);

    res.status(200).json({
        status: 'success'
    })
});

export const getPluginExposureGLB = catchAsync(async (req: Request, res: Response) => {
    const { timestep, analysisId, exposureId } = req.params;
    const { trajectory } = res.locals;
    const trajectoryId = trajectory._id.toString();
    const exposureKey = slugify(exposureId);

    try {
        const objectName = `trajectory-${trajectoryId}/analysis-${analysisId}/glb/${timestep}/${exposureKey}.glb`;
        const stat = await statObject(objectName, SYS_BUCKETS.MODELS);
        const stream = await getStream(objectName, SYS_BUCKETS.MODELS);
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

export const getPluginExposureFile = catchAsync(async (req: Request, res: Response) => {
    const { timestep, analysisId, exposureId } = req.params;
    const filename = req.params.filename || 'file.msgpack'; // Default filename if not provided
    const { trajectory } = res.locals;
    const trajectoryId = trajectory._id.toString();
    const exposureKey = slugify(exposureId);

    try {
        // Files are stored as: plugins/trajectory-{id}/analysis-{id}/{exposureId}/timestep-{timestep}.msgpack
        const objectName = [
            'plugins',
            `trajectory-${trajectoryId}`,
            `analysis-${analysisId}`,
            exposureId,
            `timestep-${timestep}.msgpack`
        ].join('/');

        const stat = await statObject(objectName, SYS_BUCKETS.PLUGINS);
        const stream = await getStream(objectName, SYS_BUCKETS.PLUGINS);

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
    } catch (err) {
        logger.error(`[getPluginExposureFile] Error: ${err}`);
        return res.status(404).json({
            status: 'error',
            data: { error: `File not found for exposure ${exposureId} at timestep ${timestep}` }
        });
    }
});

export const getPluginListingDocuments = catchAsync(async (req: Request, res: Response) => {
    const { pluginId, listingKey } = req.params as { pluginId: string; listingKey: string };
    const trajectory = res.locals.trajectory;
    if (!trajectory) {
        throw new RuntimeError('Trajectory::NotFound', 404);
    }
    const trajectoryId = trajectory._id.toString();
    const pageNum = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? '50'), 10) || 50));
    const sortDir = String(req.query.sort ?? 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';

    const manifest = await new ManifestService(pluginId).get();
    const listingDef = manifest.listing?.[listingKey];
    if (!listingDef) {
        throw new RuntimeError('Plugin::Listing::NotFound', 404);
    }

    let queryModifier: any;
    let defaultExposureId: string;

    if (listingDef.modifiers && Array.isArray(listingDef.modifiers)) {
        queryModifier = { $in: listingDef.modifiers };
        // When using multiple modifiers, we can't easily derive a single exposure ID from the listing key
        // We'll handle exposure resolution per-analysis
        defaultExposureId = listingKey;
    } else {
        const [modifierId, ...rest] = listingKey.split('_');
        const exposureId = rest.length ? rest.join('_') : modifierId;
        queryModifier = modifierId;
        defaultExposureId = exposureId;
    }

    const analyses = await Analysis.find({
        trajectory: trajectoryId,
        plugin: pluginId,
        modifier: queryModifier
    })
        .select('_id plugin modifier trajectory config createdAt updatedAt')
        .lean();

    if (!analyses.length) {
        // Return empty result instead of error if no analyses found, 
        // to be consistent with empty lists
        return res.status(200).json({
            status: 'success',
            data: {
                meta: {
                    displayName: listingDef.aggregators?.displayName ?? listingKey,
                    listingKey,
                    pluginId,
                    listingUrl: listingDef.aggregators?.listingUrl ?? `/dashboard/trajectory/${trajectoryId}/plugin/${pluginId}/listing/${listingKey}`,
                    trajectoryName: trajectory?.name || trajectoryId,
                    columns: []
                },
                rows: [],
                page: pageNum,
                limit: limitNum,
                total: 0,
                hasMore: false
            }
        });
    }

    let columns: any[] = [];
    if (listingDef.columns && Array.isArray(listingDef.columns)) {
        columns = listingDef.columns.map((col: any) => ({
            path: col.key,
            label: col.label
        }));
    } else {
        columns = Object.entries(listingDef)
            .filter(([key]) => key !== 'aggregators' && key !== 'modifiers' && key !== 'perFrameListing' && key !== 'columns')
            .map(([path, label]) => ({
                path,
                label: typeof label === 'string' ? label : String(label)
            }));
    }

    const entryRecords: Array<{ key: string; analysis: any }> = [];

    for (const analysisDoc of analyses) {
        const analysisReserved = {
            ...analysisDoc,
            trajectory
        };

        // Resolve exposure ID for this analysis
        let exposureId = defaultExposureId;
        const modifierDef = manifest.modifiers?.[analysisDoc.modifier];

        if (modifierDef) {
            // If the default exposure ID (derived from listing key or fallback) exists in the modifier, use it
            if (modifierDef.exposure[exposureId]) {
                // exposureId is already correct
            } else {
                // Try to find a fallback
                // 1. If listingKey matches an exposure
                const [keyModId, ...rest] = listingKey.split('_');
                const derivedFromKey = rest.length ? rest.join('_') : keyModId;

                if (modifierDef.exposure[derivedFromKey]) {
                    exposureId = derivedFromKey;
                } else if (modifierDef.exposure[analysisDoc.modifier]) {
                    // 2. Fallback to modifier name
                    exposureId = analysisDoc.modifier;
                } else {
                    // 3. Fallback to the first exposure defined
                    const firstExposure = Object.keys(modifierDef.exposure)[0];
                    if (firstExposure) exposureId = firstExposure;
                }
            }
        }

        const exposureSlug = slugify(exposureId);

        const prefix = [
            'plugins',
            `trajectory-${trajectoryId}`,
            `analysis-${analysisDoc._id.toString()}`,
            exposureSlug
        ].join('/');

        const objectKeys = await listByPrefix(prefix, SYS_BUCKETS.PLUGINS);
        for (const key of objectKeys) {
            entryRecords.push({
                key,
                analysis: analysisReserved
            });
        }
    }

    const parseTimestep = (key: string) => {
        const match = key.match(/timestep-(\d+)/i);
        return match ? parseInt(match[1], 10) : 0;
    };

    const sortedEntries = entryRecords.sort((a, b) => {
        const aTime = parseTimestep(a.key);
        const bTime = parseTimestep(b.key);
        const delta = sortDir === 'asc' ? aTime - bTime : bTime - aTime;
        return delta !== 0 ? delta : a.key.localeCompare(b.key);
    });

    const total = sortedEntries.length;
    const offset = (pageNum - 1) * limitNum;
    const pagedEntries = sortedEntries.slice(offset, offset + limitNum);

    const rows = [];
    for (const { key, analysis: analysisReserved } of pagedEntries) {
        const buffer = await getObject(key, SYS_BUCKETS.PLUGINS);
        const payload = decodeMsgpack(buffer) as any;
        const row: Record<string, any> = { ...payload };

        const parsedTimestep =
            payload?.timestep ??
            row?.timestep ??
            (() => {
                const match = key.match(/timestep-(\d+)/i);
                return match ? Number(match[1]) : undefined;
            })();
        if (parsedTimestep !== undefined) {
            row.timestep = parsedTimestep;
            payload.timestep = parsedTimestep;
        }
        row._objectKey = key;
        row._id = row._id ?? row.timestep ?? key;
        row.analysis = analysisReserved;
        row.trajectory = trajectory;

        const reservedSources: Record<string, any> = {
            analysis: analysisReserved,
            trajectory
        };

        for (const col of columns) {
            const resolved = resolveValueByPath(payload, col.path, reservedSources);
            row[col.path] = resolved;
        }

        rows.push(row);
    }

    res.status(200).json({
        status: 'success',
        data: {
            meta: {
                displayName: listingDef.aggregators?.displayName ?? listingKey,
                listingKey,
                pluginId,
                listingUrl:
                    listingDef.aggregators?.listingUrl ??
                    `/dashboard/trajectory/${trajectoryId}/plugin/${pluginId}/listing/${listingKey}`,
                trajectoryName: (rows[0]?.trajectory?.name ?? trajectory?.name) || trajectoryId,
                columns
            },
            rows,
            page: pageNum,
            limit: limitNum,
            total,
            hasMore: offset + rows.length < total
        }
    });
});

export const getManifests = catchAsync(async (req: Request, res: Response) => {
    const registry = new PluginRegistry();
    const manifests = await registry.getManifests();
    const pluginIds = Object.keys(manifests);

    res.status(200).json({
        status: 'success',
        data: {
            manifests,
            pluginIds
        }
    });
});

export const getPerFrameListing = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
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

        const manifest = await new ManifestService(analysis.plugin).get();
        const modifier = manifest.modifiers[analysis.modifier];
        const exposure = modifier.exposure[exposureId];
        const iterableKey = exposure?.iterable || 'data';

        const buffer = await getObject(objectName, SYS_BUCKETS.PLUGINS);
        const payload = decodeMsgpack(buffer) as any;

        let items: any[] = [];
        if (Array.isArray(payload)) {
            items = payload;
        } else if (payload[iterableKey] && Array.isArray(payload[iterableKey])) {
            items = payload[iterableKey];
        } else if (payload.data && Array.isArray(payload.data)) {
            items = payload.data;
        } else {
            // Fallback: find first array property
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
    } catch (err) {
        logger.error(`[getPerFrameListing] Error: ${err}`);
        return res.status(404).json({
            status: 'error',
            data: { error: `Data not found for analysis ${analysisId}` }
        });
    }
});