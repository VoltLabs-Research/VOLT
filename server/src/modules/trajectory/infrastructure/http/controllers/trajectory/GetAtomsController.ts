import { injectable, inject } from 'tsyringe';
import { Request, Response, NextFunction } from 'express';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { ITrajectoryDumpStorageService } from '@modules/trajectory/domain/port/ITrajectoryDumpStorageService';
import { IAtomPropertiesService } from '@modules/trajectory/domain/port/IAtomPropertiesService';
import TrajectoryParserFactory from '@modules/trajectory/infrastructure/parsers/TrajectoryParserFactory';
import { RuntimeError } from '@core/exceptions/RuntimeError';
import { ErrorCodes } from '@core/constants/error-codes';
import BaseResponse from '@shared/infrastructure/http/BaseResponse';

interface AtomsQuery {
    timestep?: string;
    exposureId?: string;
    page?: string;
    limit?: string;
}

@injectable()
export default class GetAtomsController {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryDumpStorageService)
        private readonly dumpStorage: ITrajectoryDumpStorageService,

        @inject(TRAJECTORY_TOKENS.AtomPropertiesService)
        private readonly atomProps: IAtomPropertiesService
    ) {}

    public handle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { trajectoryId, analysisId } = req.params;
            const { timestep, exposureId, page = '1', limit = '100' } = req.query as AtomsQuery;

            if (!timestep) {
                throw new RuntimeError(ErrorCodes.VALIDATION_ID_REQUIRED, 400);
            }

            const pageNum = Math.max(1, parseInt(page, 10) || 1);
            const limitNum = Math.min(100000, Math.max(1, parseInt(limit, 10) || 100));

            const dumpFilePath = await this.dumpStorage.getDump(trajectoryId, timestep);
            if (!dumpFilePath) {
                throw new RuntimeError(ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND, 404);
            }

            const parsed = await TrajectoryParserFactory.parse(dumpFilePath, {
                includeIds: true,
                properties: []
            });

            const totalAtoms = parsed.ids?.length || parsed.positions.length / 3;
            const atomCount = parsed.ids?.length || parsed.positions.length / 3;

            let perAtomData: Map<number, any> | null = null;
            let perAtomProperties: string[] = [];

            const isDefaultAnalysis = !analysisId || analysisId === 'default';

            if (!isDefaultAnalysis && exposureId) {
                try {
                    const config = await this.atomProps.getExposureAtomConfig(analysisId, exposureId);
                    perAtomProperties = config.perAtomProperties;

                    if (perAtomProperties.length > 0) {
                        const modifierData = await this.atomProps.getModifierAnalysis(
                            trajectoryId,
                            analysisId,
                            exposureId,
                            timestep
                        );

                        if (Array.isArray(modifierData)) {
                            perAtomData = new Map();
                            for (const item of modifierData) {
                                if (item?.id !== undefined) {
                                    perAtomData.set(item.id, item);
                                }
                            }
                        }
                    }
                } catch {
                    perAtomProperties = [];
                    perAtomData = null;
                }
            }

            const startIdx = (pageNum - 1) * limitNum;
            const endIdx = Math.min(startIdx + limitNum, atomCount);

            const atoms: any[] = [];
            for (let i = startIdx; i < endIdx; i++) {
                const id = parsed.ids ? parsed.ids[i] : i + 1;
                const type = parsed.types[i];
                const x = parsed.positions[i * 3];
                const y = parsed.positions[i * 3 + 1];
                const z = parsed.positions[i * 3 + 2];

                const atom: any = { id, type, x, y, z };

                if (perAtomData && perAtomData.has(id)) {
                    const pluginData = perAtomData.get(id);
                    for (const prop of perAtomProperties) {
                        if (pluginData[prop] !== undefined) {
                            atom[prop] = pluginData[prop];
                        }
                    }
                }

                atoms.push(atom);
            }

            const totalPages = Math.ceil(totalAtoms / limitNum);

            return BaseResponse.paginated(
                res,
                {
                    data: atoms,
                    page: pageNum,
                    limit: limitNum,
                    total: totalAtoms,
                    totalPages
                },
                { properties: perAtomProperties }
            );
        } catch (error) {
            next(error);
        }
    };
}
