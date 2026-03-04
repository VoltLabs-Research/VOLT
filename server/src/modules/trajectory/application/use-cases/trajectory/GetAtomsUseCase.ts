import { injectable, inject } from 'tsyringe';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { ITrajectoryDumpStorageService } from '@modules/trajectory/domain/port/ITrajectoryDumpStorageService';
import { IAtomPropertiesService, ExposureAtomConfig } from '@modules/trajectory/domain/port/IAtomPropertiesService';
import TrajectoryParserFactory from '@modules/trajectory/infrastructure/parsers/TrajectoryParserFactory';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { RuntimeError } from '@core/exceptions/RuntimeError';
import { ErrorCodes } from '@core/constants/error-codes';
import type { PaginatedResult } from '@shared/domain/ports/IBaseRepository';

export interface GetAtomsInput {
    trajectoryId: string;
    analysisId?: string;
    timestep?: string;
    exposureId?: string;
    page?: number;
    limit?: number;
}

export interface AtomRecord {
    id: number;
    type: number;
    x: number;
    y: number;
    z: number;
    [property: string]: number;
}

interface ExposureFetchResult {
    exposureName: string;
    properties: string[];
    data: unknown;
}

interface PropertyRenameMap {
    original: string;
    display: string;
}

@injectable()
export class GetAtomsUseCase implements IUseCase<GetAtomsInput, PaginatedResult<AtomRecord>, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryDumpStorageService)
        private readonly dumpStorage: ITrajectoryDumpStorageService,
        
        @inject(TRAJECTORY_TOKENS.AtomPropertiesService)
        private readonly atomProps: IAtomPropertiesService
    ) {}

    async execute(input: GetAtomsInput): Promise<Result<PaginatedResult<AtomRecord>, ApplicationError>> {
        try {
            const { trajectoryId, analysisId, timestep, exposureId } = input;
            const page = input.page ? Number(input.page) : 1;
            const limit = input.limit ? Number(input.limit) : 100;

            if (!timestep) {
                return Result.fail(new ApplicationError(ErrorCodes.VALIDATION_ID_REQUIRED, 'Timestep is required', 400));
            }

            const pageNum = Math.max(1, page);
            const limitNum = Math.min(100000, Math.max(1, limit));

            const dumpFilePath = await this.dumpStorage.getDump(trajectoryId, String(timestep));
            if (!dumpFilePath) {
                return Result.fail(new ApplicationError(ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND, 'Dump file not found', 404));
            }

            const parsed = await TrajectoryParserFactory.parse(dumpFilePath, {
                includeIds: true,
                properties: []
            });

            const totalAtoms = parsed.ids?.length || parsed.positions.length / 3;
            const atomCount = parsed.ids?.length || parsed.positions.length / 3;

            let perAtomData: Map<number, Record<string, number>> | null = null;
            let displayProperties: string[] = [];

            const isDefaultAnalysis = !analysisId || analysisId === 'default';
            let exposureIdsToFetch: string[] = [];

            if (!isDefaultAnalysis) {
                if (exposureId) {
                    exposureIdsToFetch = [exposureId];
                } else {
                    const exposurePropsMap = await this.atomProps.getModifierPerAtomProps(analysisId!);
                    exposureIdsToFetch = Object.entries(exposurePropsMap)
                        .filter(([, properties]) => Array.isArray(properties) && properties.length > 0)
                        .map(([candidateId]) => candidateId);
                }
            }

            if (!isDefaultAnalysis && exposureIdsToFetch.length > 0) {
                perAtomData = new Map();
                
                const fetchPromises = exposureIdsToFetch.map(async (currentExposureId): Promise<ExposureFetchResult | null> => {
                    const config = await this.atomProps.getExposureAtomConfig(analysisId!, currentExposureId);
                    if (config.perAtomProperties.length === 0) return null;

                    const modifierData = await this.atomProps.getModifierAnalysis(
                        trajectoryId,
                        analysisId!,
                        currentExposureId,
                        String(timestep)
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

                        const existing = perAtomData.get(item.id) ?? { id: item.id };
                        for (const rename of exposureRenames) {
                            const rawProp = rename.original === rename.display
                                ? rename.original
                                : rename.original;
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

            const startIdx = (pageNum - 1) * limitNum;
            const endIdx = Math.min(startIdx + limitNum, atomCount);

            const atoms: AtomRecord[] = [];
            for (let i = startIdx; i < endIdx; i++) {
                const id = parsed.ids ? parsed.ids[i] : i + 1;
                const type = parsed.types[i];
                const x = parsed.positions[i * 3];
                const y = parsed.positions[i * 3 + 1];
                const z = parsed.positions[i * 3 + 2];

                const atom: AtomRecord = { id, type, x, y, z };

                if (perAtomData?.has(id)) {
                    const pluginData = perAtomData.get(id)!;
                    for (const prop of displayProperties) {
                        if (pluginData[prop] !== undefined) {
                            atom[prop] = pluginData[prop];
                        }
                    }
                }

                atoms.push(atom);
            }

            const totalPages = Math.ceil(totalAtoms / limitNum);

            return Result.ok({
                data: atoms,
                page: pageNum,
                limit: limitNum,
                total: totalAtoms,
                totalPages,
                _meta: { properties: displayProperties }
            });
        } catch (error: unknown) {
            if (error instanceof RuntimeError) {
                return Result.fail(new ApplicationError(error.code, error.message, error.statusCode));
            }
            return Result.fail(new ApplicationError('INTERNAL_SERVER_ERROR', 'Internal server error', 500));
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
}
