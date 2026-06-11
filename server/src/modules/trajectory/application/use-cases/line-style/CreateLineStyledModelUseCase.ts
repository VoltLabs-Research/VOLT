import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import {
    CreateLineStyledModelInputDTO,
    CreateLineStyledModelOutputDTO
} from '@modules/trajectory/application/dtos/line-style';
import type { ILineStyleService } from '@modules/trajectory/domain/port/line-style/ILineStyleService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
export class CreateLineStyledModelUseCase implements IUseCase<CreateLineStyledModelInputDTO, CreateLineStyledModelOutputDTO, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.LineStyleService)
        private readonly lineStyleService: ILineStyleService
    ) { }

    async execute(input: CreateLineStyledModelInputDTO): Promise<Result<CreateLineStyledModelOutputDTO, ApplicationError>> {
        const result = await this.lineStyleService.createStyledModel(
            input.trajectoryId,
            input.timestep,
            input.analysisId,
            input.exposureId,
            input.style ?? {}
        );

        return Result.ok(result);
    }
};
