import { injectable, inject } from 'tsyringe';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { IParticleFilterService } from '@modules/trajectory/domain/port/IParticleFilterService';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { PreviewParticleFilterInputDTO, PreviewParticleFilterOutputDTO } from '@modules/trajectory/application/dtos/generated-models';

const FILTER_OPERATORS = new Set(['==', '!=', '>', '>=', '<', '<=']);

@injectable()
export class PreviewParticleFilterUseCase implements IUseCase<PreviewParticleFilterInputDTO, PreviewParticleFilterOutputDTO, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.ParticleFilterService)
        private readonly particleFilterService: IParticleFilterService
    ) { }

    async execute(input: PreviewParticleFilterInputDTO): Promise<Result<PreviewParticleFilterOutputDTO, ApplicationError>> {
        const { trajectoryId, timestep, property, operator } = input;
        const value = Number(input.value);
        const hasMissingRequired = [trajectoryId, timestep, property, operator].some((value) => !value?.trim());

        if (hasMissingRequired || !Number.isFinite(value) || !FILTER_OPERATORS.has(operator)) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.COLOR_CODING_MISSING_PARAMS,
                'Missing required particle-filter parameters'
            ));
        }

        const result = await this.particleFilterService.preview(
            trajectoryId,
            timestep,
            {
                property,
                operator,
                value
            },
            input.analysisId,
            input.exposureId
        );

        return Result.ok(result);
    }
}
