import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import { SceneArtifactSourceType } from '@modules/trajectory/domain/entities/scene-artifacts/SceneArtifact';
import { IAtomPropertiesService, FilterExpression } from '@modules/trajectory/domain/port/trajectory/IAtomPropertiesService';
import { IParticleFilterService } from '@modules/trajectory/domain/port/particle-filter/IParticleFilterService';
import { ISceneArtifactRepository } from '@modules/trajectory/domain/port/scene-artifacts/ISceneArtifactRepository';
import { ITrajectoryDumpStorageService } from '@modules/trajectory/domain/port/trajectory/ITrajectoryDumpStorageService';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { buildParticleFilterObjectName } from '@modules/trajectory/infrastructure/utilities/trajectory/minio-path-builder';
import { normalizeAnalysisId, extractModifierAtomData } from '@modules/trajectory/infrastructure/utilities/trajectory/modifier-data';
import { recordSceneArtifact } from '@modules/trajectory/infrastructure/utilities/scene-artifacts/record-scene-artifact';
import { IStorageService } from '@shared/domain/port/IStorageService';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import nativeExporter from '@modules/trajectory/infrastructure/native/trajectory/NativeExporter';
import nativeStats from '@modules/trajectory/infrastructure/native/trajectory/NativeStats';
import TrajectoryParserFactory from '@modules/trajectory/infrastructure/parsers/trajectory/TrajectoryParserFactory';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

import { Readable } from 'node:stream';
import { injectable, inject } from 'tsyringe';

const buildDumpNotFoundError = (): ApplicationError => {
    return ApplicationError.notFound(
        ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND,
        'Trajectory dump not found'
    );
};

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
        private readonly storageService: IStorageService,

        @inject(TRAJECTORY_TOKENS.SceneArtifactRepository)
        private readonly sceneArtifactRepository: ISceneArtifactRepository
    ) { }

    async getProperties(
        trajectoryId: string,
        timestep: string | number,
        analysisId?: string
    ): Promise<{ dump: string[]; perAtom: Record<string, string[]> }> {
        const resolvedAnalysisId = normalizeAnalysisId(analysisId);
        const dumpPath = await this.dumpStorage.getDump(trajectoryId, String(timestep));
        if (!dumpPath) {
            throw buildDumpNotFoundError();
        }

        const parsed = await TrajectoryParserFactory.parse(dumpPath, { properties: [] });
        const dumpHeaders = parsed.metadata.headers || [];

        const modifierProps = resolvedAnalysisId
            ? await this.atomProps.getModifierPerAtomProps(String(resolvedAnalysisId))
            : {};

        return {
            dump: dumpHeaders,
            perAtom: modifierProps
        };
    }

    async getUniqueValues(
        trajectoryId: string,
        timestep: string | number,
        property: string,
        maxValues: number = 100,
        analysisId?: string,
        exposureId?: string
    ): Promise<number[]> {
        const resolvedAnalysisId = normalizeAnalysisId(analysisId);

        if (exposureId && resolvedAnalysisId) {
            const modifierData = await this.atomProps.getModifierAnalysis(
                String(trajectoryId),
                String(resolvedAnalysisId),
                String(exposureId),
                String(timestep)
            );
            const atomsData = extractModifierAtomData(modifierData);
            if (!atomsData) return [];

            const uniqueSet = new Set<number>();
            for (const atom of atomsData) {
                if (atom[property] !== undefined && uniqueSet.size < maxValues) {
                    uniqueSet.add(Number(atom[property]));
                }
            }
            return Array.from(uniqueSet).sort((a, b) => a - b);
        }

        const dumpPath = await this.dumpStorage.getDump(trajectoryId, String(timestep));
        if (!dumpPath) {
            throw buildDumpNotFoundError();
        }

        const parsed = await TrajectoryParserFactory.parse(dumpPath, { properties: [] });
        const headers = parsed.metadata.headers || [];
        const propIdx = headers.indexOf(property);

        if (propIdx === -1) {
            return [];
        }

        return nativeStats.getUniqueValuesForProperty(dumpPath, propIdx, maxValues);
    }

    async preview(
        trajectoryId: string,
        timestep: string | number,
        expression: FilterExpression,
        analysisId?: string,
        exposureId?: string
    ): Promise<{ matchCount: number; totalAtoms: number }> {
        const resolvedAnalysisId = normalizeAnalysisId(analysisId);
        const result = await this.atomProps.evaluateFilterExpression(
            trajectoryId,
            resolvedAnalysisId,
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
        const resolvedAnalysisId = normalizeAnalysisId(analysisId);
        const filterResult = await this.atomProps.evaluateFilterExpression(
            trajectoryId,
            resolvedAnalysisId,
            exposureId ? String(exposureId) : null,
            String(timestep),
            expression
        );

        const dumpPath = await this.dumpStorage.getDump(trajectoryId, String(timestep));
        if (!dumpPath) {
            throw buildDumpNotFoundError();
        }

        const parsed = await TrajectoryParserFactory.parse(dumpPath);
        const objectName = buildParticleFilterObjectName(
            trajectoryId,
            resolvedAnalysisId,
            timestep,
            exposureId,
            expression.property,
            expression.operator,
            expression.value,
            action
        );

        let buffer: Buffer;
        let atomsResult: number;

        if (action === 'delete') {
            const inverseMask = new Uint8Array(filterResult.mask.length);
            for (let i = 0; i < filterResult.mask.length; i++) {
                inverseMask[i] = filterResult.mask[i] ? 0 : 1;
            }

            const filtered = this.atomProps.filterByMask(parsed.positions, parsed.types, inverseMask);

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

        await this.storageService.upload(SYS_BUCKETS.MODELS, objectName, buffer, { 'Content-Type': 'model/gltf-binary' });

        await recordSceneArtifact(this.sceneArtifactRepository, {
            trajectory: String(trajectoryId),
            analysis: resolvedAnalysisId,
            sourceType: SceneArtifactSourceType.ParticleFilter,
            timestep: Number(timestep),
            objectName,
            params: {
                property: String(expression.property),
                operator: String(expression.operator),
                value: Number(expression.value),
                action,
                exposureId
            },
            displayName: `PF · ${expression.property} ${expression.operator} ${expression.value} · ${action} · t=${timestep}`,
            metadata: {
                analysisId: resolvedAnalysisId || null,
                exposureId: exposureId || null,
                atomsResult,
                totalAtoms: filterResult.mask.length
            }
        });

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
        const actionPart = action || 'delete';
        const objectName = buildParticleFilterObjectName(
            trajectoryId,
            normalizeAnalysisId(analysisId),
            timestep,
            exposureId,
            property,
            operator,
            value,
            actionPart
        );

        if (!await this.storageService.exists(SYS_BUCKETS.MODELS, objectName)) {
            throw buildDumpNotFoundError();
        }

        return this.storageService.getStream(SYS_BUCKETS.MODELS, objectName);
    }
};
