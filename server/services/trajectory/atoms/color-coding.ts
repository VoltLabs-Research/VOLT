
import DumpStorage from '@/services/trajectory/dump-storage';
import storage from '@/services/storage';
import AtomisticExporter from '@/utilities/export/atoms';
import { SYS_BUCKETS } from '@/config/minio';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { ErrorCodes } from '@/constants/error-codes';
import { Readable } from 'node:stream';
import AtomProperties from '@/services/trajectory/atoms/atom-properties';
import TrajectoryParserFactory from '@/parsers/factory';

export class ColorCodingService {
    private readonly atomProps: AtomProperties;

    constructor() {
        this.atomProps = new AtomProperties();
    }

    /**
     * Get available properties (headers) for a specific timestep and analysis.
     */
    async getProperties(trajectoryId: string, timestep: string | number, analysisId?: string) {
        const dumpPath = await DumpStorage.getDump(trajectoryId, String(timestep));
        if (!dumpPath) {
            throw new RuntimeError(ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND, 404);
        }

        const parsed = await TrajectoryParserFactory.parse(dumpPath, { properties: [] });
        const headers = parsed.metadata.headers || [];

        const modifierProps = analysisId
            ? await this.atomProps.getModifierPerAtomProps(String(analysisId))
            : {};

        return {
            base: headers,
            modifiers: modifierProps
        };
    }

    /**
     * Get min/max statistics for a specific property.
     */
    async getStats(
        trajectoryId: string,
        timestep: string | number,
        property: string,
        type: string,
        analysisId?: string,
        exposureId?: string
    ) {
        let min = Infinity;
        let max = -Infinity;

        if (type === 'modifier') {
            if (!exposureId || !analysisId) {
                throw new RuntimeError(ErrorCodes.COLOR_CODING_MISSING_PARAMS, 400);
            }

            const modifierData = await this.atomProps.getModifierAnalysis(
                String(trajectoryId),
                String(analysisId),
                String(exposureId),
                String(timestep)
            );

            const atomsData = (modifierData as any)?.data || modifierData;
            const stats = this.atomProps.getMinMaxFromData(atomsData, property);
            if (stats) {
                min = stats.min;
                max = stats.max;
            }
        } else {
            const dumpPath = await DumpStorage.getDump(String(trajectoryId), String(timestep));
            if (!dumpPath) {
                throw new RuntimeError(ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND, 404);
            }

            // Using TrajectoryParserFactory for consistency
            const parsed = await TrajectoryParserFactory.parse(dumpPath, { properties: [property] });

            // We need to extract the values from the parsed output.
            // LammpsNativeParser usually returns typed arrays on the root object for standard props
            // or in `properties` map for others.
            let values: Float32Array;
            const lowerProp = property.toLowerCase();

            if (lowerProp === 'type') values = new Float32Array(parsed.types);
            else if (lowerProp === 'x') {
                values = new Float32Array(parsed.positions.length / 3);
                for (let i = 0; i < values.length; i++) values[i] = parsed.positions[i * 3];
            }
            else if (lowerProp === 'y') {
                values = new Float32Array(parsed.positions.length / 3);
                for (let i = 0; i < values.length; i++) values[i] = parsed.positions[i * 3 + 1];
            }
            else if (lowerProp === 'z') {
                values = new Float32Array(parsed.positions.length / 3);
                for (let i = 0; i < values.length; i++) values[i] = parsed.positions[i * 3 + 2];
            }
            else {
                values = parsed.properties?.[property] || parsed.properties?.[lowerProp] || new Float32Array(0);
            }

            // Calculate min/max manually for consistency or reuse a util if available.
            // AtomProperties has getMinMaxNative which is imported from parsers/lammps/native-stats
            // But we don't have direct access to that utility here unless we expose it or import it.
            // Ideally we should import `getMinMaxNative` from `@/parsers/lammps/native-stats`.
            // However, keeping dependencies clean, let's just do a quick loop or use check.

            for (let i = 0; i < values.length; i++) {
                if (values[i] < min) min = values[i];
                if (values[i] > max) max = values[i];
            }
        }

        if (min === Infinity) min = 0;
        if (max === -Infinity) max = 0;

        return { min, max };
    }

    /**
     * Create or retrieve a colored GLB model.
     */
    async createColoredModel(
        trajectoryId: string,
        timestep: string | number,
        property: string,
        startValue: number,
        endValue: number,
        gradient: string,
        analysisId?: string,
        exposureId?: string
    ): Promise<string> {
        const analysisSegment = analysisId || 'no-analysis';
        const objectName =
            `trajectory-${trajectoryId}/analysis-${analysisSegment}/glb/${timestep}/color-coding/${exposureId || 'base'}/${property}/${startValue}-${endValue}/${gradient}.glb`;

        if (await storage.exists(SYS_BUCKETS.MODELS, objectName)) {
            return objectName;
        }

        const dumpPath = await DumpStorage.getDump(String(trajectoryId), String(timestep));
        if (!dumpPath) {
            throw new RuntimeError(ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND, 404);
        }

        const exporter = new AtomisticExporter();
        let externalValues: Float32Array | undefined;

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

        return objectName;
    }

    /**
     * Get a stream for the colored model.
     */
    async getModelStream(
        trajectoryId: string,
        timestep: string | number,
        property: string,
        startValue: number,
        endValue: number,
        gradient: string,
        analysisId?: string,
        exposureId?: string
    ): Promise<Readable> {
        const analysisSegment = analysisId || 'no-analysis';
        const objectName =
            `trajectory-${trajectoryId}/analysis-${analysisSegment}/glb/${timestep}/color-coding/${exposureId || 'base'}/${property}/${startValue}-${endValue}/${gradient}.glb`;

        if (!await storage.exists(SYS_BUCKETS.MODELS, objectName)) {
            throw new RuntimeError(ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND, 404);
        }

        return storage.getStream(SYS_BUCKETS.MODELS, objectName);
    }
}

export default new ColorCodingService();
