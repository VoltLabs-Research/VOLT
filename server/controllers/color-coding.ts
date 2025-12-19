import { Request, Response, NextFunction } from 'express';
import RuntimeError from '@/utilities/runtime/runtime-error';
import DumpStorage from '@/services/dump-storage';
import storage from '@/services/storage';
import LammpsDumpParser from '@/parsers/lammps/dump-parser';
import AtomisticExporter from '@/utilities/export/atoms';
import { getModifierAnalysis, getModifierPerAtomProps, getPropertyByAtoms, getMinMaxFromData } from '@/utilities/plugins';
import { SYS_BUCKETS } from '@/config/minio';
import { catchAsync } from '@/utilities/runtime/runtime';
import { ErrorCodes } from '@/constants/error-codes';

export default class ColorCodingController{
    public getProperties = catchAsync(async(req: Request, res: Response, next: NextFunction) => {
        const { trajectoryId, analysisId } = req.params;
        const { timestep } = req.query;

        if(!timestep || !analysisId){
            return next(new RuntimeError(ErrorCodes.COLOR_CODING_MISSING_PARAMS, 400));
        }

        const dumpPath = await DumpStorage.getDump(trajectoryId, String(timestep));
        if(!dumpPath){
            return next(new RuntimeError(ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND, 404));
        }

        const parser = new LammpsDumpParser();
        const headerLines = await parser.getHeaderLines(dumpPath);
        // base headers such as: ['id', 'x', 'y', 'z'] should be expected
        const { headers } = parser.extractMetadata(headerLines);
        const modifierProps = await getModifierPerAtomProps(analysisId.toString());

        return res.status(200).json({
            status: 'success',
            data: {
                base: headers,
                modifiers: modifierProps
            }
        });
    });

    public getStats = catchAsync(async(req: Request, res: Response, next: NextFunction) => {
        const { trajectoryId, analysisId } = req.params;
        const { timestep, property, type, exposureId } = req.query;

        if(!timestep || !property || !type){
            return next(new RuntimeError(ErrorCodes.COLOR_CODING_MISSING_PARAMS, 400));
        }

        let min = Infinity, max = -Infinity;
        const propName = String(property);

        if(type === 'modifier'){
            const modifierData = await getModifierAnalysis(trajectoryId, analysisId, String(exposureId), String(timestep));
            const atomsData = (modifierData as any).data || modifierData;
            const stats = getMinMaxFromData(atomsData, propName);
            if(stats){
                min = stats.min;
                max = stats.max;
            }
        }else{
            const dumpPath = await DumpStorage.getDump(trajectoryId, String(timestep));
            if(!dumpPath){
                return next(new RuntimeError(ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND, 404));
            }
            const parser = new LammpsDumpParser();
            const stats = await parser.getStatsForProperty(dumpPath, propName);
            min = stats.min;
            max = stats.max;
        }

        if(min === Infinity) min = 0;
        if(max === -Infinity) max = 0;

        res.status(200).json({ status: 'success', data: { min, max } });
    });

    public create = catchAsync(async(req: Request, res: Response, next: NextFunction) => {
        const { trajectoryId, analysisId } = req.params;
        const { timestep } = req.query;
        const { property, exposureId, startValue, endValue, gradient } = req.body;
        if(!timestep || !property || startValue === undefined || endValue === undefined || !gradient){
            return next(new RuntimeError(ErrorCodes.COLOR_CODING_MISSING_PARAMS, 400));
        }

        const objectName = `trajectory-${trajectoryId}/analysis-${analysisId}/glb/${timestep}/color-coding/${exposureId || 'base'}/${property}/${startValue}-${endValue}/${gradient}.glb`;
        // already exists
        if(await storage.exists(SYS_BUCKETS.MODELS, objectName)) {
            return res.status(200).json({ status: 'success' });
        }

        // otherwise, it is not found, so generate
        const dumpPath = await DumpStorage.getDump(trajectoryId, String(timestep));
        if(!dumpPath){
            return next(new RuntimeError(ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND, 404));
        }

        const exporter = new AtomisticExporter();
        let externalValues: Float32Array | undefined;

        if(exposureId){
            const modifierData = await getModifierAnalysis(trajectoryId, analysisId, exposureId, String(timestep));
            const atomsData = (modifierData as any).data || modifierData;
            externalValues = getPropertyByAtoms(atomsData, property);
        }

        await exporter.exportColoredByProperty(
            dumpPath,
            objectName,
            property,
            Number(startValue),
            Number(endValue),
            gradient,
            {},
            externalValues
        );

        res.status(200).json({ status: 'success' });
    });

    public get = catchAsync(async(req: Request, res: Response, next: NextFunction) => {
        const { trajectoryId, analysisId } = req.params;
        const { property, startValue, endValue, gradient, timestep, exposureId } = req.query;
        const objectName = `trajectory-${trajectoryId}/analysis-${analysisId}/glb/${timestep}/color-coding/${exposureId || 'base'}/${property}/${startValue}-${endValue}/${gradient}.glb`;
        console.log(objectName);
        if(!await storage.exists(SYS_BUCKETS.MODELS, objectName)) {
            return next(new RuntimeError(ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND, 404));
        }

        const stream = await storage.getStream(SYS_BUCKETS.MODELS, objectName);
        res.setHeader('Content-Type', 'model/gltf-binary');
        res.setHeader('Cache-Control', 'public, max-age=31536000');

        stream.pipe(res);
    });
};
