import { COMPUTE_TOKENS, PLUGIN_USECASE_TOKENS } from '@shared/contracts/tokens';
import type { IAnalysisRepository } from '@shared/contracts/ports';
import { ErrorCodes } from '@core/constants/error-codes';
import type { GetPluginExposureGLBOutputDTO } from '@shared/contracts/dtos';
import type { IGetPluginExposureGLBUseCase } from '@shared/contracts/ports';
import { TrajectoryReadAccessService } from '@modules/trajectory/services/TrajectoryReadAccessService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

interface GetPublicCanvasPluginExposureGLBInput {
    trajectoryId: string;
    analysisId: string;
    exposureId: string;
    timestep: string;
    userId?: string;
    acceptEncoding?: string;
};

@Singleton()
export class GetPublicCanvasPluginExposureGLBUseCase implements IUseCase<
    GetPublicCanvasPluginExposureGLBInput,
    GetPluginExposureGLBOutputDTO
> {
    constructor(
        
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        
        @inject(COMPUTE_TOKENS.AnalysisRepository) private readonly analysisRepository: IAnalysisRepository,


        @inject(PLUGIN_USECASE_TOKENS.GetPluginExposureGLBUseCase) private readonly getPluginExposureGLBUseCase: IGetPluginExposureGLBUseCase
    ) {}

    async execute(input: GetPublicCanvasPluginExposureGLBInput): Promise<GetPluginExposureGLBOutputDTO> {
        await this.trajectoryReadAccessService.assertReadable(input.trajectoryId, input.userId);

        const analysis = await this.analysisRepository.findById(input.analysisId);
        if (!analysis) {
            throw ApplicationError.notFound(
                ErrorCodes.ANALYSIS_NOT_FOUND,
                'Analysis not found'
            );
        }

        if (String(analysis.props.trajectory) !== input.trajectoryId) {
            throw ApplicationError.badRequest(
                ErrorCodes.TRAJECTORY_ANALYSIS_MISMATCH,
                'Analysis does not belong to the requested trajectory'
            );
        }

        return this.getPluginExposureGLBUseCase.execute({
            teamId: String(analysis.props.team),
            trajectoryId: input.trajectoryId,
            analysisId: input.analysisId,
            exposureId: input.exposureId,
            timestep: input.timestep,
            acceptEncoding: input.acceptEncoding
        });
    }
};
