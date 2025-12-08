import { Request, Response, NextFunction } from 'express';
import RuntimeError from '@/utilities/runtime/runtime-error';
import DumpStorage from '@/services/dump-storage';
import storage from '@/services/storage';
import LammpsDumpParser from '@/parsers/lammps/dump-parser';
import AtomisticExporter from '@/utilities/export/atoms';
import { getModifierAnalysis, getModifierPerAtomProps, getPropertyByAtoms } from '@/utilities/plugins';
import { SYS_BUCKETS } from '@/config/minio';
import { catchAsync } from '@/utilities/runtime/runtime';
import { readLargeFile } from '@/utilities/fs';

export default class ColorCodingController{
    public getProperties = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { trajectoryId, analysisId } = req.params;
        const { timestep } = req.query;

        if(!timestep || !analysisId){
            return next(new RuntimeError('ColorCoding::MissingParams', 400));
        }

        const dumpPath = await DumpStorage.getDump(trajectoryId, String(timestep));
        if(!dumpPath){
            return next(new RuntimeError('ColorCoding::DumpNotFound', 404));
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

    public getStats = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { trajectoryId, analysisId } = req.params;
        const { timestep, property, type, exposureId } = req.query;

        if(!timestep || !property || !type){
            return next(new RuntimeError('ColorCoding::MissingParams', 400));
        }

        let min = Infinity;
        let max = -Infinity;

        if(type === 'modifier'){
            const modifierData = await getModifierAnalysis(trajectoryId, analysisId, String(exposureId), String(timestep));
            const atomsData = (modifierData as any).data || modifierData;
            const values = getPropertyByAtoms(atomsData, String(property));
            
            if(values){
                if(values instanceof Map){
                    for(const val of values.values()){
                        if(!isNaN(val) && isFinite(val)){
                            if(val < min) min = val;
                            if(val > max) max = val;
                        }
                    }
                }else{
                    for(let i = 0; i < values.length; i++){
                        const val = values[i];
                        if(!isNaN(val) && isFinite(val)){
                            if(val < min) min = val;
                            if(val > max) max = val;
                        }
                    }
                }
            }
        }else{
            const dumpPath = await DumpStorage.getDump(trajectoryId, String(timestep));
            if(!dumpPath){
                return next(new RuntimeError('ColorCoding::DumpNotFound', 404));
            }

            const parser = new LammpsDumpParser();
            const headerLines = await parser.getHeaderLines(dumpPath);
            const { headers } = parser.extractMetadata(headerLines);
            const colIdx = headers.indexOf(String(property));

            if(colIdx === -1){
                return next(new RuntimeError('ColorCoding::PropertyNotFound', 404));
            }

            let inAtomsSection = false;
            await readLargeFile(dumpPath, {
                maxLines: 0,
                onLine: (line) => {
                    if(line.startsWith('ITEM: ATOMS')){
                        inAtomsSection = true;
                        return;
                    }
                    if(!inAtomsSection) return;
                    if(line.startsWith('ITEM:')){
                        inAtomsSection = false;
                        return;
                    }

                    const parts = line.trim().split(/\s+/);
                    const val = parseFloat(parts[colIdx]);
                    if(!isNaN(val)){
                        if(val < min) min = val;
                        if(val > max) max = val;
                    }
                }
            });
        }

        if(min === Infinity) min = 0;
        if(max === -Infinity) max = 0;

        res.status(200).json({
            status: 'success',
            data: { min, max }
        });
    });

    public create = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { trajectoryId, analysisId } = req.params;
        const { timestep } = req.query;
        const { property, exposureId, startValue, endValue, gradient } = req.body;
        if(!timestep || !property || startValue === undefined || endValue === undefined || !gradient){
            return next(new RuntimeError('ColorCoding::MissingParams', 400));
        }

        const objectName = `trajectory-${trajectoryId}/analysis-${analysisId}/glb/${timestep}/color-coding/${exposureId || 'base'}/${property}/${startValue}-${endValue}/${gradient}.glb`;
        // already exists 
        if(await storage.exists(SYS_BUCKETS.MODELS, objectName)){
            return res.status(200).json({ status: 'success' });
        }

        // otherwise, it is not found, so generate
        const dumpPath = await DumpStorage.getDump(trajectoryId, String(timestep));
        if(!dumpPath){
            return next(new RuntimeError('ColorCoding::DumpNotFound', 404));
        }

        const exporter = new AtomisticExporter();
        let externalValues: Float32Array | Map<number, number> | undefined;

        if(exposureId){
            const modifierData = await getModifierAnalysis(trajectoryId, analysisId, exposureId, String(timestep));
            // Extract the 'data' array if it exists, otherwise use modifierData as is
            const atomsData = (modifierData as any).data || modifierData;
            externalValues = getPropertyByAtoms(atomsData, property);
        }

        await exporter.exportColoredByProperty(dumpPath, objectName, property, 
            Number(startValue), Number(endValue), gradient, {}, externalValues);    
        
        res.status(200).json({ status: 'success' });
    });

    public get = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { trajectoryId, analysisId } = req.params;
        const { property, startValue, endValue, gradient, timestep, exposureId } = req.query;
        const objectName = `trajectory-${trajectoryId}/analysis-${analysisId}/glb/${timestep}/color-coding/${exposureId || 'base'}/${property}/${startValue}-${endValue}/${gradient}.glb`;
        console.log(objectName);
        if(!await storage.exists(SYS_BUCKETS.MODELS, objectName)){
            return next(new RuntimeError('ColorCoding::NotFound', 404));
        }

        const stream = await storage.getStream(SYS_BUCKETS.MODELS, objectName);
        res.setHeader('Content-Type', 'model/gltf-binary');
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        
        stream.pipe(res);
    });
};