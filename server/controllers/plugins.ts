import { NextFunction, Request, Response } from 'express';
import { catchAsync, slugify } from '@/utilities/runtime';
import { getAnalysisQueue } from '@/queues';
import { Analysis } from '@/models';
import PluginRegistry from '@/services/plugins/plugins-registry';
import RuntimeError from '@/utilities/runtime-error';
import { AnalysisJob } from '@/types/queues/analysis-processing-queue';
import TrajectoryFS from '@/services/trajectory-fs';
import { getStream, statObject, listByPrefix, getObject } from '@/utilities/buckets';
import { SYS_BUCKETS } from '@/config/minio';
import ManifestService from '@/services/plugins/manifest-service';
import { decode as decodeMsgpack } from '@msgpack/msgpack';

const getValueByPath = (obj: any, path: string) => {
    if(!obj || !path) return undefined;
    if(!path.includes('.')){
        return obj?.[path];
    }
    return path.split('.').reduce((acc: any, key: string) => (acc == null ? undefined : acc[key]), obj);
};

const resolveValueByPath = (
    payload: any,
    path: string,
    reserved: Record<string, any>
) => {
    if(!path) return undefined;
    const [root, ...rest] = path.split('.');
    if(reserved[root]){
        const subPath = rest.join('.');
        return subPath ? getValueByPath(reserved[root], subPath) : reserved[root];
    }

    return getValueByPath(payload, path);
};

// /api/plugins/:pluginId/modifier/:modifierId/trajectory/:trajectoryId { config }
export const evaluateModifier = catchAsync(async (req: Request, res: Response, next : NextFunction) => {
    const { pluginId, modifierId, id: trajectoryId } = req.params;
    const { config } = req.body;
    const { trajectory } = res.locals;

    const registry = new PluginRegistry();
    if(!registry.exists(pluginId) || !registry.modifierExists(pluginId, modifierId)){
        return next(new RuntimeError('Plugin::Registry::NotFound', 404));
    }

    const analysis = await Analysis.create({
        plugin: pluginId,
        modifier: modifierId,
        config,
        trajectory: trajectoryId
    });

    const analysisId = analysis._id.toString();
    const trajectoryFS = new TrajectoryFS(trajectoryId);
    const jobs: AnalysisJob[] = [];
    const promises = trajectory!.frames.map(async ({ timestep }: any) => {
        const inputFile = await trajectoryFS.getDump(timestep);
        if(!inputFile){
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
            plugin: pluginId
        });
    });
    
    await Promise.all(promises);
    console.log(jobs)

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

    try{
        const objectName = `trajectory-${trajectoryId}/analysis-${analysisId}/glb/${timestep}/${exposureKey}.glb`;
        const stat = await statObject(objectName, SYS_BUCKETS.MODELS);
        const stream = await getStream(objectName, SYS_BUCKETS.MODELS);
        res.setHeader('Content-Type', 'model/gltf-binary');
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Content-Disposition', `inline; filename="${exposureId}_${timestep}.glb"`);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        stream.pipe(res);
    }catch(err){
        console.error('[getPluginExposureGLB] Error:', err);
        return res.status(404).json({ 
            status: 'error', 
            data: { error: `GLB not found for exposure ${exposureId} at timestep ${timestep}` }
        });
    }
});

export const getPluginListingDocuments = catchAsync(async (req: Request, res: Response) => {
    const { pluginId, listingKey } = req.params as { pluginId: string; listingKey: string };
    const trajectory = res.locals.trajectory;
    if(!trajectory){
        throw new RuntimeError('Trajectory::NotFound', 404);
    }
    const trajectoryId = trajectory._id.toString();
    const pageNum = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? '50'), 10) || 50));
    const sortDir = String(req.query.sort ?? 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';

    const [modifierId, ...rest] = listingKey.split('_');
    const exposureId = rest.length ? rest.join('_') : modifierId;
    const exposureSlug = slugify(exposureId);

    const analyses = await Analysis.find({
        trajectory: trajectoryId,
        plugin: pluginId,
        modifier: modifierId
    })
        .select('_id plugin modifier trajectory config createdAt updatedAt')
        .lean();

    if(!analyses.length){
        throw new RuntimeError('Analysis::NotFound', 404);
    }

    const manifest = await new ManifestService(pluginId).get();
    const listingDef = manifest.listing?.[listingKey];
    if(!listingDef){
        throw new RuntimeError('Plugin::Listing::NotFound', 404);
    }

    const columns = Object.entries(listingDef)
        .filter(([key]) => key !== 'aggregators')
        .map(([path, label]) => ({
            path,
            label: typeof label === 'string' ? label : String(label)
        }));

    const entryRecords: Array<{ key: string; analysis: any }> = [];
    for(const analysisDoc of analyses){
        const analysisReserved = {
            ...analysisDoc,
            trajectory
        };
        const prefix = [
            'plugins',
            `trajectory-${trajectoryId}`,
            `analysis-${analysisDoc._id.toString()}`,
            exposureSlug
        ].join('/');

        const objectKeys = await listByPrefix(prefix, SYS_BUCKETS.PLUGINS);
        for(const key of objectKeys){
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
    for(const { key, analysis: analysisReserved } of pagedEntries){
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
        if(parsedTimestep !== undefined){
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

        for(const col of columns){
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