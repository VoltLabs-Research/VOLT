import { injectable, inject } from 'tsyringe';
import { Readable } from 'node:stream';
import { IStorageService } from '@shared/domain/ports/IStorageService';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { ITrajectoryDumpStorageService } from '@modules/trajectory/domain/port/ITrajectoryDumpStorageService';
import { IColorCodingService } from '@modules/trajectory/domain/port/IColorCodingService';
import { IAtomPropertiesService } from '@modules/trajectory/domain/port/IAtomPropertiesService';
import { IAtomisticExporter } from '@modules/trajectory/domain/port/exporters/AtomisticExporter';
import { SYS_BUCKETS } from '@core/config/minio';
import { RuntimeError } from '@core/exceptions/RuntimeError';
import { ErrorCodes } from '@core/constants/error-codes';
import TrajectoryParserFactory from '@modules/trajectory/infrastructure/parsers/TrajectoryParserFactory';
import nativeStats from '@modules/trajectory/infrastructure/native/NativeStats';

@injectable()
export default class ColorCodingService implements IColorCodingService {
    constructor(
        @inject(TRAJECTORY_TOKENS.AtomPropertiesService)
        private readonly atomProps: IAtomPropertiesService,

        @inject(TRAJECTORY_TOKENS.TrajectoryDumpStorageService)
        private readonly dumpStorage: ITrajectoryDumpStorageService,

        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService,

        @inject(TRAJECTORY_TOKENS.AtomisticExporter)
        private readonly atomisticExporter: IAtomisticExporter
    ) { }

    async getProperties(
        trajectoryId: string,
        timestep: string | number,
        analysisId?: string
    ): Promise<{ base: string[]; modifiers: Record<string, string[]> }> {
        const dumpPath = await this.dumpStorage.getDump(trajectoryId, String(timestep));
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

    async getStats(
        trajectoryId: string,
        timestep: string | number,
        property: string,
        type: string,
        analysisId?: string,
        exposureId?: string
    ): Promise<{ min: number; max: number }> {
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
            const dumpPath = await this.dumpStorage.getDump(String(trajectoryId), String(timestep));
            if (!dumpPath) {
                throw new RuntimeError(ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND, 404);
            }

            const parsed = await TrajectoryParserFactory.parse(dumpPath, { properties: [property] });

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

            for (let i = 0; i < values.length; i++) {
                if (values[i] < min) min = values[i];
                if (values[i] > max) max = values[i];
            }
        }

        if (min === Infinity) min = 0;
        if (max === -Infinity) max = 0;

        return { min, max };
    }

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

        if (await this.storageService.exists(SYS_BUCKETS.MODELS, objectName)) {
            return objectName;
        }

        const dumpPath = await this.dumpStorage.getDump(String(trajectoryId), String(timestep));
        if (!dumpPath) {
            throw new RuntimeError(ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND, 404);
        }

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

        await this.atomisticExporter.exportColoredByProperty(
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

        if (!await this.storageService.exists(SYS_BUCKETS.MODELS, objectName)) {
            throw new RuntimeError(ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND, 404);
        }

        return this.storageService.getStream(SYS_BUCKETS.MODELS, objectName);
    }
}
