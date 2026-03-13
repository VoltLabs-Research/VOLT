import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { GetAtomsInputDTO, AtomRecord } from '@modules/trajectory/application/dtos/trajectory/GetAtomsDTO';
import { IAtomPropertiesService } from '@modules/trajectory/domain/port/trajectory/IAtomPropertiesService';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

import { injectable, inject } from 'tsyringe';

import type { ITrajectoryReader } from '@modules/trajectory/domain/port/trajectory/ITrajectoryReader';
import type { IUseCase } from '@shared/application/IUseCase';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';

interface ExposureFetchResult {
    exposureName: string;
    properties: string[];
    data: unknown;
};

interface PropertyRenameMap {
    original: string;
    display: string;
};

type PerAtomRecord = Record<string, unknown> & {
    id: number;
};

@injectable()
export class GetAtomsUseCase implements IUseCase<GetAtomsInputDTO, PaginatedResult<AtomRecord>, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryReader)
        private readonly trajectoryReader: ITrajectoryReader,

        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepository: ITrajectoryRepository,

        @inject(TRAJECTORY_TOKENS.AtomPropertiesService)
        private readonly atomProps: IAtomPropertiesService
    ) {}

    async execute(input: GetAtomsInputDTO): Promise<Result<PaginatedResult<AtomRecord>, ApplicationError>> {
        try {
            const { trajectoryId, analysisId, timestep, exposureId } = input;
            const page = input.page ?? 1;
            const limit = input.limit ?? 100;
            const timestepKey = String(timestep);

            const pageNum = Math.max(1, page);
            const limitNum = Math.min(100000, Math.max(1, limit));

            const trajectory = await this.trajectoryRepository.findById(trajectoryId);
            const teamClusterId = trajectory?.props.teamCluster;
            const atomsPage = await this.trajectoryReader.readPage(
                teamClusterId,
                trajectoryId,
                timestep,
                pageNum,
                limitNum
            );

            const totalAtoms = atomsPage.totalAtoms;
            const nativeProperties = atomsPage.nativeProperties ?? [];

            let perAtomData: Map<number, PerAtomRecord> | null = null;
            let displayProperties: string[] = [];

            const isDefaultAnalysis = !analysisId || analysisId === 'default';
            let exposureIdsToFetch: string[] = [];
            const normalizedAnalysisId = isDefaultAnalysis ? null : analysisId;

            if (normalizedAnalysisId) {
                if (exposureId) {
                    exposureIdsToFetch = [exposureId];
                } else {
                    const exposurePropsMap = await this.atomProps.getModifierPerAtomProps(normalizedAnalysisId);
                    exposureIdsToFetch = Object.entries(exposurePropsMap)
                        .filter(([, properties]) => Array.isArray(properties) && properties.length > 0)
                        .map(([candidateId]) => candidateId);
                }
            }

            if (normalizedAnalysisId && exposureIdsToFetch.length > 0) {
                perAtomData = new Map();
                
                const fetchPromises = exposureIdsToFetch.map(async (currentExposureId): Promise<ExposureFetchResult | null> => {
                    const config = await this.atomProps.getExposureAtomConfig(normalizedAnalysisId, currentExposureId);
                    if (config.perAtomProperties.length === 0) return null;

                    const modifierData = await this.atomProps.getModifierAnalysis(
                        trajectoryId,
                        normalizedAnalysisId,
                        currentExposureId,
                        timestepKey
                    );

                    return {
                        exposureName: config.exposureName,
                        properties: config.perAtomProperties,
                        data: modifierData
                    };
                });

                const results = await Promise.all(fetchPromises);
                const validResults = results.filter((r): r is ExposureFetchResult => r !== null);
                const renameMap = this.buildPropertyRenameMap(validResults);
                displayProperties = renameMap.map((entry) => entry.display);

                for (const fetchResult of validResults) {
                    if (!Array.isArray(fetchResult.data)) continue;

                    const exposureRenames = renameMap.filter((entry) =>
                        fetchResult.properties.includes(entry.original.includes(': ')
                            ? entry.original.split(': ').slice(1).join(': ')
                            : entry.original)
                    );

                    for (const item of fetchResult.data) {
                        if (item?.id === undefined) continue;

                        const existing: PerAtomRecord = perAtomData.get(item.id) ?? { id: item.id };
                        for (const rename of exposureRenames) {
                            const sourceProp = fetchResult.properties.find((p) =>
                                rename.display === p || rename.display === `${fetchResult.exposureName}: ${p}`
                            );
                            if (sourceProp && item[sourceProp] !== undefined) {
                                existing[rename.display] = item[sourceProp];
                            }
                        }
                        perAtomData.set(item.id, existing);
                    }
                }
            }

            const atoms: AtomRecord[] = [];
            for (const atom of atomsPage.atoms) {
                const record: AtomRecord = {
                    id: atom.id,
                    type: atom.type,
                    x: atom.x,
                    y: atom.y,
                    z: atom.z
                };

                for (const prop of nativeProperties) {
                    if (atom[prop] !== undefined) {
                        record[prop] = atom[prop];
                    }
                }

                if (perAtomData?.has(atom.id)) {
                    const pluginData = perAtomData.get(atom.id)!;
                    for (const prop of displayProperties) {
                        const propertyValue = pluginData[prop];
                        if (propertyValue !== undefined) {
                            record[prop] = propertyValue;
                        }
                    }
                }

                atoms.push(record);
            }

            const totalPages = Math.ceil(totalAtoms / limitNum);

            return Result.ok({
                data: atoms,
                page: pageNum,
                limit: limitNum,
                total: totalAtoms,
                totalPages,
                _meta: { properties: [...nativeProperties, ...displayProperties] }
            });
        } catch (error: unknown) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(
                ApplicationError.internalServerError('Failed to retrieve trajectory atoms')
            );
        }
    }

    private buildPropertyRenameMap(results: ExposureFetchResult[]): PropertyRenameMap[] {
        const propertyOccurrences = new Map<string, number>();

        for (const fetchResult of results) {
            for (const prop of fetchResult.properties) {
                propertyOccurrences.set(prop, (propertyOccurrences.get(prop) || 0) + 1);
            }
        }

        const renameMap: PropertyRenameMap[] = [];

        for (const fetchResult of results) {
            for (const prop of fetchResult.properties) {
                const occurrenceCount = propertyOccurrences.get(prop) || 1;
                const needsPrefix = occurrenceCount > 1 && fetchResult.exposureName;
                const displayName = needsPrefix
                    ? `${fetchResult.exposureName}: ${prop}`
                    : prop;

                renameMap.push({
                    original: prop,
                    display: displayName
                });
            }
        }

        return renameMap;
    }
};
