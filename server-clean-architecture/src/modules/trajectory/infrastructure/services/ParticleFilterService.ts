import { injectable, inject } from 'tsyringe';
import { Readable } from 'node:stream';
import { IStorageService } from '@shared/domain/ports/IStorageService';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { ITrajectoryDumpStorageService } from '@modules/trajectory/domain/port/ITrajectoryDumpStorageService';
import { IParticleFilterService } from '@modules/trajectory/domain/port/IParticleFilterService';
import { IAtomPropertiesService, FilterExpression } from '@modules/trajectory/domain/port/IAtomPropertiesService';
import { SYS_BUCKETS } from '@core/config/minio';
import { RuntimeError } from '@core/exceptions/RuntimeError';
import { ErrorCodes } from '@core/constants/error-codes';
import TrajectoryParserFactory from '@modules/trajectory/infrastructure/parsers/TrajectoryParserFactory';
import nativeExporter from '@modules/trajectory/infrastructure/native/NativeExporter';
import { formatValueForPath } from '@shared/infrastructure/utils/formatValue';

const HIGHLIGHT_COLOR = [1.0, 0.2, 0.6];
const DEFAULT_COLOR = [0.8, 0.8, 0.8];

@injectable()
export default class ParticleFilterService implements IParticleFilterService {
    constructor(
        @inject(TRAJECTORY_TOKENS.AtomPropertiesService)
        private readonly atomProps: IAtomPropertiesService,

        @inject(TRAJECTORY_TOKENS.TrajectoryDumpStorageService)
        private readonly dumpStorage: ITrajectoryDumpStorageService,

        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService
    ) { }

    async getProperties(
        trajectoryId: string,
        timestep: string | number,
        analysisId?: string
    ): Promise<{ dump: string[]; perAtom: Record<string, string[]> }> {
        const dumpPath = await this.dumpStorage.getDump(trajectoryId, String(timestep));
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

    async preview(
        trajectoryId: string,
        timestep: string | number,
        expression: FilterExpression,
        analysisId?: string,
        exposureId?: string
    ): Promise<{ matchCount: number; totalAtoms: number }> {
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

    async applyAction(
        trajectoryId: string,
        timestep: string | number,
        action: 'delete' | 'highlight',
        expression: FilterExpression,
        analysisId?: string,
        exposureId?: string
    ): Promise<{ fileId: string; atomsResult: number; action: string }> {
        const filterResult = await this.atomProps.evaluateFilterExpression(
            trajectoryId,
            analysisId ? String(analysisId) : undefined,
            exposureId ? String(exposureId) : null,
            String(timestep),
            expression
        );

        const dumpPath = await this.dumpStorage.getDump(trajectoryId, String(timestep));
        if (!dumpPath) {
            throw new RuntimeError(ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND, 404);
        }

        const parsed = await TrajectoryParserFactory.parse(dumpPath);
        const exposurePart = exposureId ? String(exposureId) : 'dump';
        const analysisSegment = analysisId || 'no-analysis';
        const formattedValue = formatValueForPath(Number(expression.value));
        const objectName = `trajectory-${trajectoryId}/analysis-${analysisSegment}/glb/${timestep}/particle-filter/${exposurePart}/${expression.property}-${expression.operator}-${formattedValue}-${action}.glb`;

        let buffer: Buffer;
        let atomsResult: number;

        if (action === 'delete') {
            const inverseMask = new Uint8Array(filterResult.mask.length);
            for (let i = 0; i < filterResult.mask.length; i++) {
                inverseMask[i] = filterResult.mask[i] ? 0 : 1;
            }

            const filtered = this.atomProps.filterByMask(parsed.positions, parsed.types, inverseMask);

            //if (filtered.count === 0) {
            //    throw new RuntimeError(ErrorCodes.PARTICLE_FILTER_ALL_DELETED, 400);
            //}

            buffer = nativeExporter.generateGLB(
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

            buffer = nativeExporter.generatePointCloudGLB(
                parsed.positions,
                colors,
                parsed.min,
                parsed.max
            );
            atomsResult = filterResult.matchCount;
        }  

        console.log('UPLOAD TO STORAGE SERVER:', objectName)
        await this.storageService.upload(SYS_BUCKETS.MODELS, objectName, buffer, { 'Content-Type': 'model/gltf-binary' });

        return {
            fileId: objectName,
            atomsResult,
            action
        };
    }

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
        const actionPart = action || 'delete';
        const analysisSegment = analysisId || 'no-analysis';
        const formattedValue = typeof value === 'number' ? formatValueForPath(value) : String(value);
        const objectName = `trajectory-${trajectoryId}/analysis-${analysisSegment}/glb/${timestep}/particle-filter/${exposurePart}/${property}-${operator}-${formattedValue}-${actionPart}.glb`;

        console.log('OBJECT NAME:', objectName);
        if (!await this.storageService.exists(SYS_BUCKETS.MODELS, objectName)) {
            throw new RuntimeError(ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND, 404);
        }

        return this.storageService.getStream(SYS_BUCKETS.MODELS, objectName);
    }
}
