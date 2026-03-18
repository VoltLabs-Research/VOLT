import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { GetFilteredModelStreamInputDTO, GetFilteredModelStreamOutputDTO } from '@modules/trajectory/application/dtos/particle-filter';
import { IParticleFilterService, ParticleFilterCombinator } from '@modules/trajectory/domain/port/particle-filter/IParticleFilterService';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

import { injectable, inject } from 'tsyringe';

import type { StreamableOutput } from '@shared/infrastructure/http/controllers/BaseStreamController';

const resolveFilterOperator = (operator: string | undefined): '==' | '!=' | '>' | '>=' | '<' | '<=' => {
    switch (operator) {
        case '!=':
        case '>':
        case '>=':
        case '<':
        case '<=':
            return operator;
        case '==':
        default:
            return '==';
    }
};

@injectable()
export class GetFilteredModelStreamUseCase implements IUseCase<GetFilteredModelStreamInputDTO, StreamableOutput, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.ParticleFilterService)
        private readonly particleFilterService: IParticleFilterService
    ) { }

    async execute(input: GetFilteredModelStreamInputDTO): Promise<Result<StreamableOutput, ApplicationError>> {
        const stream = await this.particleFilterService.getModelStream(
            input.trajectoryId,
            input.timestep,
            {
                combinator: input.combinator || ParticleFilterCombinator.And,
                conditions: input.conditions && input.conditions.length > 0
                    ? input.conditions
                    : [{
                        property: input.property || '',
                        operator: resolveFilterOperator(input.operator),
                        value: Number(input.value ?? 0),
                        ...(input.exposureId ? { exposureId: input.exposureId } : {})
                    }]
            },
            input.action,
            input.analysisId
        );

        return Result.ok({ stream } satisfies GetFilteredModelStreamOutputDTO & StreamableOutput);
    }
};
