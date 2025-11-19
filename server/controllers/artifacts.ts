import TrajectoryFS from '@/services/trajectory-fs';
import { getValueByPath, resolvePluginOutputDefinition, sanitizeModelName, templateReplace } from '@/utilities/plugins';
import { catchAsync } from '@/utilities/runtime';
import { statGLBObject } from '@/buckets/glbs';
import { Request, Response } from 'express';
import { getJSONFromBucket } from '@/config/minio';

export const listAnalysisArtifactFiles = catchAsync(async (req: Request, res: Response) => {
    const trajectory = res.locals.trajectory;
    const trajectoryId = trajectory._id.toString();
    const { analysisId, artifactKey } = req.params;
    
    if(!analysisId || !artifactKey){
        return res.status(400).json({
            status: 'error',
            data: { error: 'Invalid::Params' }
        });
    }

    const tfs = new TrajectoryFS(trajectoryId);
    const glbMap = await tfs.listAnalysisGlbKeys(analysisId);
    const normalizedKey = sanitizeModelName(artifactKey);
    const files = [];

    for(const [frame, types] of Object.entries(glbMap)){
        const frameNumber = Number(frame);
        for(const [rawType, objectName] of Object.entries(types)){
            if(sanitizeModelName(rawType || '') !== normalizedKey) continue;
            const stat = await statGLBObject(objectName);
            files.push({
                frame: frameNumber,
                model: rawType,
                objectName,
                size: stat.size,
                updatedAt: stat.lastModified.toISOString()
            });
        }
    }

    files.sort((a, b) => a.frame - b.frame);
    return res.status(200).json({
        status: 'success',
        data: {
            analysisId,
            artifactKey: normalizedKey,
            files
        }
    });
});

export const getAnalysisArtifactFrameData = catchAsync(async (req: Request, res: Response) => {
    const trajectory = res.locals.trajectory;
    const trajectoryId = trajectory._id.toString();

    const { analysisId, artifactKey, frame } = req.params;
    // Pagination params (TODO: duplicated code with api features?)
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(1000, Math.max(10, parseInt(req.query.limit as string) || 100));
    const config = await resolvePluginOutputDefinition(analysisId, artifactKey);

    const details = config?.output.details;
    if(!details){
        return res.status(404).json({
            status: 'error',
            data: { error: 'Artifact::DetailsNotConfigured' }
        });
    }

    if(details.type !== 'json'){
        return res.status(501).json({
            status: 'error',
            data: { error: 'Artifact::Details::UnsupportedType' }
        });
    }

    const baseObjectName = templateReplace(details.pathTemplate, {
        trajectoryId,
        analysisId,
        artifactKey,
        frame
    });

    const bucketName = details.bucket || `${config?.plugin.toLowerCase()}-${sanitizeModelName(artifactKey)}`;
    
    let payload: any;
    try{
        payload = await getJSONFromBucket(bucketName, baseObjectName);
    }catch(error){
        return res.status(404).json({
            status: 'error',
            data: { error: 'Artifact::FrameDataNotFound' }
        });
    }

    if(!Array.isArray(payload)){
        payload = (payload) ? ([payload]) : [];
    }

    const totalRecords = payload.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedRecords = payload.slice(startIndex, endIndex);
    const hasColumnProjection = Array.isArray(details.columns) && details.columns.length > 0;

    const rows = paginatedRecords.map((record: any, index: number) => {
        const base: Record<string, any> = {
            frame: Number(frame)
        };

        if(hasColumnProjection){
            for(const column of details.columns!){
                const fieldPath = column.field;
                const value = getValueByPath(record, fieldPath);
                base[fieldPath] = value;
            }
        }else if(record && typeof record === 'object'){
            Object.assign(base, record);
        }else{
            base['value'] = record;
        }
        return base;
    });

    return res.status(200).json({
        status: 'success',
        data: {
            columns: details.columns ?? null,
            rows,
            pagination: {
                page,
                limit,
                total: totalRecords,
                totalPages: Math.ceil(totalRecords / limit),
                hasMore: endIndex < totalRecords
            }
        }
    });
});