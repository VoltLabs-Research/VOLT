import DumpStorage from '@/services/trajectory/dump-storage';
import storage from '@/services/storage';
import AtomisticExporter from '@/utilities/export/atoms';
import exporter from '@/utilities/export/exporter';
import { SYS_BUCKETS } from '@/config/minio';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { ErrorCodes } from '@/constants/error-codes';
import AtomProperties, { FilterExpression } from '@/services/trajectory/atom-properties';
import TrajectoryParserFactory from '@/parsers/factory';
import { Readable } from 'node:stream';

// Highlight color (bright magenta/pink to stand out)
const HIGHLIGHT_COLOR = [1.0, 0.2, 0.6]; // RGB normalized
const DEFAULT_COLOR = [0.8, 0.8, 0.8]; // Light gray for non-selected

export class ParticleFilterService {
    private readonly atomProps: AtomProperties;

    constructor() {
        this.atomProps = new AtomProperties();
    }

    /**
     * Get available properties for filtering
     */
    async getProperties(trajectoryId: string, timestep: string | number, analysisId?: string) {
        const dumpPath = await DumpStorage.getDump(trajectoryId, String(timestep));
        if (!dumpPath) {
            throw new RuntimeError(ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND, 404);
        }

        const parsed = await TrajectoryParserFactory.parse(dumpPath, { properties: [] });
        const dumpHeaders = parsed.metadata.headers || [];

        const modifierProps = analysisId
            ? await this.atomProps.getModifierPerAtomProps(String(analysisId))
            : {};

        return {
            dump: dumpHeaders,
            perAtom: modifierProps
        };
    }

    /**
     * Evaluate filter expression and return match count
     */
    async preview(
        trajectoryId: string,
        timestep: string | number,
        expression: FilterExpression,
        analysisId?: string,
        exposureId?: string
    ) {
        const result = await this.atomProps.evaluateFilterExpression(
            trajectoryId,
            analysisId ? String(analysisId) : undefined,
            exposureId ? String(exposureId) : null,
            String(timestep),
            expression
        );

        return {
            matchCount: result.matchCount,
            totalAtoms: result.mask.length
        };
    }

    /**
     * Apply filter action and generate GLB
     */
    async applyAction(
        trajectoryId: string,
        timestep: string | number,
        action: 'delete' | 'highlight',
        expression: FilterExpression,
        analysisId?: string,
        exposureId?: string
    ) {
        const filterResult = await this.atomProps.evaluateFilterExpression(
            trajectoryId,
            analysisId ? String(analysisId) : undefined,
            exposureId ? String(exposureId) : null,
            String(timestep),
            expression
        );

        const dumpPath = await DumpStorage.getDump(trajectoryId, String(timestep));
        if (!dumpPath) {
            throw new RuntimeError(ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND, 404);
        }

        const parsed = await TrajectoryParserFactory.parse(dumpPath);
        const exposurePart = exposureId ? String(exposureId) : 'dump';
        const analysisSegment = analysisId || 'no-analysis';
        const objectName = `trajectory-${trajectoryId}/analysis-${analysisSegment}/glb/${timestep}/particle-filter/${exposurePart}/${expression.property}-${expression.operator}-${expression.value}-${action}.glb`;

        let buffer: Buffer;
        let atomsResult: number;

        if (action === 'delete') {
            const inverseMask = new Uint8Array(filterResult.mask.length);
            for (let i = 0; i < filterResult.mask.length; i++) {
                inverseMask[i] = filterResult.mask[i] ? 0 : 1;
            }

            const filtered = this.atomProps.filterByMask(parsed.positions, parsed.types, inverseMask);

            if (filtered.count === 0) {
                throw new RuntimeError(ErrorCodes.PARTICLE_FILTER_ALL_DELETED, 400);
            }

            buffer = exporter.generateGLB(
                filtered.positions,
                filtered.types,
                parsed.min,
                parsed.max
            );
            atomsResult = filtered.count;
        } else {
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

        return {
            fileId: objectName,
            atomsResult,
            action
        };
    }

    /**
     * Get filtered model stream
     */
    async getModelStream(
        trajectoryId: string,
        timestep: string | number,
        property: string,
        operator: string,
        value: string | number,
        action?: string,
        analysisId?: string,
        exposureId?: string
    ): Promise<Readable> {
        const exposurePart = exposureId ? String(exposureId) : 'dump';
        const actionPart = action ? `-${action}` : '-delete';
        const analysisSegment = analysisId || 'no-analysis';
        const objectName = `trajectory-${trajectoryId}/analysis-${analysisSegment}/glb/${timestep}/particle-filter/${exposurePart}/${property}-${operator}-${value}${actionPart}.glb`;

        if (!await storage.exists(SYS_BUCKETS.MODELS, objectName)) {
            throw new RuntimeError(ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND, 404);
        }

        return storage.getStream(SYS_BUCKETS.MODELS, objectName);
    }
}

export default new ParticleFilterService();
