import { Request, Response, NextFunction } from 'express';
import RuntimeError from '@/utilities/runtime/runtime-error';
import DumpStorage from '@/services/trajectory/dump-storage';
import storage from '@/services/storage';
import AtomisticExporter from '@/utilities/export/atoms';
import exporter from '@/utilities/export/exporter';
import { SYS_BUCKETS } from '@/config/minio';
import { catchAsync } from '@/utilities/runtime/runtime';
import { ErrorCodes } from '@/constants/error-codes';
import BaseController from '@/controllers/base-controller';
import { Resource } from '@/constants/resources';
import { Trajectory } from '@/models';
import AtomProperties, { FilterExpression } from '@/services/trajectory/atom-properties';
import TrajectoryParserFactory from '@/parsers/factory';

// Highlight color (bright magenta/pink to stand out)
const HIGHLIGHT_COLOR = [1.0, 0.2, 0.6]; // RGB normalized
const DEFAULT_COLOR = [0.8, 0.8, 0.8]; // Light gray for non-selected

export default class ParticleFilterController extends BaseController<any> {
    private readonly atomProps: AtomProperties;

    constructor() {
        super(Trajectory, { resource: Resource.PARTICLE_FILTER });
        this.atomProps = new AtomProperties();
    }

    /**
     * Get available properties for filtering (dump + per-atom properties)
     */
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

        const parsed = await TrajectoryParserFactory.parse(dumpPath, { properties: [] });
        const dumpHeaders = parsed.metadata.headers || [];

        // Only fetch modifier properties if analysisId is provided
        const modifierProps = analysisId
            ? await this.atomProps.getModifierPerAtomProps(String(analysisId))
            : {};

        return res.status(200).json({
            status: 'success',
            data: {
                dump: dumpHeaders,
                perAtom: modifierProps
            }
        });
    });

    /**
     * Evaluate filter expression and return match count (preview)
     */
    public preview = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { trajectoryId, analysisId } = req.params;
        const { timestep, property, operator, value, exposureId } = req.query;

        if (!timestep || !property || !operator || value === undefined) {
            return next(new RuntimeError(ErrorCodes.COLOR_CODING_MISSING_PARAMS, 400));
        }

        const expression: FilterExpression = {
            property: String(property),
            operator: operator as any,
            value: Number(value)
        };

        const result = await this.atomProps.evaluateFilterExpression(
            trajectoryId,
            analysisId ? String(analysisId) : undefined,
            exposureId ? String(exposureId) : null,
            String(timestep),
            expression
        );

        return res.status(200).json({
            status: 'success',
            data: {
                matchCount: result.matchCount,
                totalAtoms: result.mask.length
            }
        });
    });

    /**
     * Apply filter action (delete or highlight filtered particles and generate GLB)
     */
    public applyAction = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { trajectoryId, analysisId } = req.params;
        const { timestep, action } = req.query;
        const { property, operator, value, exposureId } = req.body;

        if (!timestep || !action || !property || !operator || value === undefined) {
            return next(new RuntimeError(ErrorCodes.COLOR_CODING_MISSING_PARAMS, 400));
        }

        if (action !== 'delete' && action !== 'highlight') {
            return next(new RuntimeError(ErrorCodes.PARTICLE_FILTER_INVALID_ACTION, 400));
        }

        const expression: FilterExpression = {
            property: String(property),
            operator: operator as any,
            value: Number(value)
        };

        // Evaluate filter
        const filterResult = await this.atomProps.evaluateFilterExpression(
            trajectoryId,
            analysisId ? String(analysisId) : undefined,
            exposureId ? String(exposureId) : null,
            String(timestep),
            expression
        );

        // Get dump data
        const dumpPath = await DumpStorage.getDump(trajectoryId, String(timestep));
        if (!dumpPath) {
            return next(new RuntimeError(ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND, 404));
        }

        const parsed = await TrajectoryParserFactory.parse(dumpPath);
        const exposurePart = exposureId ? String(exposureId) : 'dump';
        const analysisSegment = analysisId || 'no-analysis';
        const objectName = `trajectory-${trajectoryId}/analysis-${analysisSegment}/glb/${timestep}/particle-filter/${exposurePart}/${property}-${operator}-${value}-${action}.glb`;

        let buffer: Buffer;
        let atomsResult: number;

        if (action === 'delete') {
            // Filter particles (keep those NOT matching the expression)
            const inverseMask = new Uint8Array(filterResult.mask.length);
            for (let i = 0; i < filterResult.mask.length; i++) {
                inverseMask[i] = filterResult.mask[i] ? 0 : 1;
            }

            const filtered = this.atomProps.filterByMask(parsed.positions, parsed.types, inverseMask);

            if (filtered.count === 0) {
                return next(new RuntimeError(ErrorCodes.PARTICLE_FILTER_ALL_DELETED, 400));
            }

            // Generate GLB with filtered data but original bounds
            buffer = exporter.generateGLB(
                filtered.positions,
                filtered.types,
                parsed.min,
                parsed.max
            );
            atomsResult = filtered.count;
        } else {
            // Highlight: color matching atoms differently
            const atomCount = parsed.positions.length / 3;
            const colors = new Float32Array(atomCount * 3);

            for (let i = 0; i < atomCount; i++) {
                const isMatch = filterResult.mask[i] === 1;
                const color = isMatch ? HIGHLIGHT_COLOR : DEFAULT_COLOR;
                colors[i * 3] = color[0];
                colors[i * 3 + 1] = color[1];
                colors[i * 3 + 2] = color[2];
            }

            buffer = exporter.generatePointCloudGLB(
                parsed.positions,
                colors,
                parsed.min,
                parsed.max
            );
            atomsResult = filterResult.matchCount;
        }

        await storage.put(SYS_BUCKETS.MODELS, objectName, buffer, { 'Content-Type': 'model/gltf-binary' });

        return res.status(200).json({
            status: 'success',
            data: {
                fileId: objectName,
                atomsResult,
                action
            }
        });
    });

    /**
     * Get filtered GLB file
     */
    public get = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { trajectoryId, analysisId } = req.params;
        const { property, operator, value, timestep, exposureId, action } = req.query;

        const exposurePart = exposureId ? String(exposureId) : 'dump';
        const actionPart = action ? `-${action}` : '-delete';
        const analysisSegment = analysisId || 'no-analysis';
        const objectName = `trajectory-${trajectoryId}/analysis-${analysisSegment}/glb/${timestep}/particle-filter/${exposurePart}/${property}-${operator}-${value}${actionPart}.glb`;

        if (!await storage.exists(SYS_BUCKETS.MODELS, objectName)) {
            return next(new RuntimeError(ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND, 404));
        }

        const stream = await storage.getStream(SYS_BUCKETS.MODELS, objectName);
        res.setHeader('Content-Type', 'model/gltf-binary');
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        stream.pipe(res);
    });
}
