import { injectable, inject } from 'tsyringe';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { IParticleFilterService } from '@modules/trajectory/domain/port/IParticleFilterService';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { ApplyParticleFilterActionInputDTO, ApplyParticleFilterActionOutputDTO } from '@modules/trajectory/application/dtos/generated-models';

const FILTER_OPERATORS = new Set(['==', '!=', '>', '>=', '<', '<=']);

@injectable()
export class ApplyParticleFilterActionUseCase implements IUseCase<ApplyParticleFilterActionInputDTO, ApplyParticleFilterActionOutputDTO, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.ParticleFilterService)
        private readonly particleFilterService: IParticleFilterService
    ) { }

    async execute(input: ApplyParticleFilterActionInputDTO): Promise<Result<ApplyParticleFilterActionOutputDTO, ApplicationError>> {
        const { trajectoryId, timestep, action, property, operator } = input;
        const value = Number(input.value);
        const hasMissingRequired = [trajectoryId, timestep, action, property, operator].some((value) => !value?.trim());

        if (hasMissingRequired || !Number.isFinite(value) || !FILTER_OPERATORS.has(operator)) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.COLOR_CODING_MISSING_PARAMS,
                'Missing required particle-filter parameters'
            ));
        }

        if (action !== 'delete' && action !== 'highlight') {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.PARTICLE_FILTER_INVALID_ACTION,
                'Invalid particle-filter action'
            ));
        }

        const result = await this.particleFilterService.applyAction(
            trajectoryId,
            timestep,
            action,
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
