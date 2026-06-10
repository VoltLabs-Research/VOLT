import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import {
    CreateDislocationStyledModelInputDTO,
    CreateDislocationStyledModelOutputDTO
} from '@modules/trajectory/application/dtos/dislocation-style';
import type { IDislocationStyleService } from '@modules/trajectory/domain/port/dislocation-style/IDislocationStyleService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
export class CreateDislocationStyledModelUseCase implements IUseCase<CreateDislocationStyledModelInputDTO, CreateDislocationStyledModelOutputDTO, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.DislocationStyleService)
        private readonly dislocationStyleService: IDislocationStyleService
    ) { }

    async execute(input: CreateDislocationStyledModelInputDTO): Promise<Result<CreateDislocationStyledModelOutputDTO, ApplicationError>> {
        const result = await this.dislocationStyleService.createStyledModel(
            input.trajectoryId,
            input.timestep,
            input.analysisId,
            input.exposureId,
            input.style ?? {}
        );

        return Result.ok(result);
    }
};
