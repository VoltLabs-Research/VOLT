import { Request, Response, NextFunction } from 'express';
import RuntimeError from '@/utilities/runtime/runtime-error';
import DumpStorage from '@/services/trajectory/dump-storage';
import storage from '@/services/storage';
import LammpsDumpParser from '@/parsers/lammps/dump-parser';
import AtomisticExporter from '@/utilities/export/atoms';
import { SYS_BUCKETS } from '@/config/minio';
import { catchAsync } from '@/utilities/runtime/runtime';
import { ErrorCodes } from '@/constants/error-codes';
import BaseController from '@/controllers/base-controller';
import { Resource } from '@/constants/resources';
import { Trajectory } from '@/models';
import AtomProperties from '@/services/trajectory/atom-properties';

export default class ColorCodingController extends BaseController<any> {
    private readonly atomProps: AtomProperties;

    constructor() {
        super(Trajectory, { resource: Resource.COLOR_CODING });
        this.atomProps = new AtomProperties();
    }

    public getProperties = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { trajectoryId, analysisId } = req.params;
        const { timestep } = req.query;

        if (!timestep) {
            return next(new RuntimeError(ErrorCodes.COLOR_CODING_MISSING_PARAMS, 400));
        }

        const dumpPath = await DumpStorage.getDump(trajectoryId, String(timestep));
        if (!dumpPath) {
            return next(new RuntimeError(ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND, 404));
        }

        const parser = new LammpsDumpParser();
        const result = parser.parse(dumpPath, { properties: [] });
        const headers = result.metadata.headers || [];

        // Only fetch modifier properties if analysisId is provided
        const modifierProps = analysisId
            ? await this.atomProps.getModifierPerAtomProps(String(analysisId))
            : {};

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

        if (!timestep || !property || !type) {
            return next(new RuntimeError(ErrorCodes.COLOR_CODING_MISSING_PARAMS, 400));
        }

        let min = Infinity;
        let max = -Infinity;

        const propName = String(property);

        if (type === 'modifier') {
            if (!exposureId || !analysisId) {
                return next(new RuntimeError(ErrorCodes.COLOR_CODING_MISSING_PARAMS, 400));
            }

            const modifierData = await this.atomProps.getModifierAnalysis(
                String(trajectoryId),
                String(analysisId),
                String(exposureId),
                String(timestep)
            );

            const atomsData = (modifierData as any)?.data || modifierData;

            const stats = this.atomProps.getMinMaxFromData(atomsData, propName);
            if (stats) {
                min = stats.min;
                max = stats.max;
            }
        } else {
            const dumpPath = await DumpStorage.getDump(String(trajectoryId), String(timestep));
            if (!dumpPath) {
                return next(new RuntimeError(ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND, 404));
            }

            const parser = new LammpsDumpParser();
            const stats = await parser.getStatsForProperty(dumpPath, propName);
            min = stats.min;
            max = stats.max;
        }

        if (min === Infinity) min = 0;
        if (max === -Infinity) max = 0;

        return res.status(200).json({ status: 'success', data: { min, max } });
    });

    public create = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { trajectoryId, analysisId } = req.params;
        const { timestep } = req.query;
        const { property, exposureId, startValue, endValue, gradient } = req.body;

        if (!timestep || !property || startValue === undefined || endValue === undefined || !gradient) {
            return next(new RuntimeError(ErrorCodes.COLOR_CODING_MISSING_PARAMS, 400));
        }

        // Use 'no-analysis' path segment when no analysis is provided
        const analysisSegment = analysisId || 'no-analysis';
        const objectName =
            `trajectory-${trajectoryId}/analysis-${analysisSegment}/glb/${timestep}/color-coding/${exposureId || 'base'}/${property}/${startValue}-${endValue}/${gradient}.glb`;

        if (await storage.exists(SYS_BUCKETS.MODELS, objectName)) {
            return res.status(200).json({ status: 'success' });
        }

        const dumpPath = await DumpStorage.getDump(String(trajectoryId), String(timestep));
        if (!dumpPath) {
            return next(new RuntimeError(ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND, 404));
        }

        const exporter = new AtomisticExporter();
        let externalValues: Float32Array | undefined;

        // Only fetch modifier data if both analysisId and exposureId are provided
        if (exposureId && analysisId) {
            const modifierData = await this.atomProps.getModifierAnalysis(
                String(trajectoryId),
                String(analysisId),
                String(exposureId),
                String(timestep)
            );

            const atomsData = (modifierData as any)?.data || modifierData;

            externalValues = this.atomProps.toFloat32ByAtomId(atomsData, String(property));
        }

        await exporter.exportColoredByProperty(
            dumpPath,
            objectName,
            String(property),
            Number(startValue),
            Number(endValue),
            String(gradient),
            externalValues
        );

        return res.status(200).json({ status: 'success' });
    });

    public get = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { trajectoryId, analysisId } = req.params;
        const { property, startValue, endValue, gradient, timestep, exposureId } = req.query;

        const analysisSegment = analysisId || 'no-analysis';
        const objectName =
            `trajectory-${trajectoryId}/analysis-${analysisSegment}/glb/${timestep}/color-coding/${exposureId || 'base'}/${property}/${startValue}-${endValue}/${gradient}.glb`;

        if (!await storage.exists(SYS_BUCKETS.MODELS, objectName)) {
            return next(new RuntimeError(ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND, 404));
        }

        const stream = await storage.getStream(SYS_BUCKETS.MODELS, objectName);
        res.setHeader('Content-Type', 'model/gltf-binary');
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        stream.pipe(res);
    });
}
