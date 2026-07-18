import { TRAJECTORY_TOKENS } from '@modules/trajectory/di/TrajectoryTokens';
import {
    CreateLineStyledModelInputDTO,
    CreateLineStyledModelOutputDTO
} from '@modules/trajectory/dtos/line-style';
import type { ILineStyleService } from '@modules/trajectory/ports/line-style/ILineStyleService';
import { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
export class CreateLineStyledModelUseCase implements IUseCase<CreateLineStyledModelInputDTO, CreateLineStyledModelOutputDTO> {
    constructor(
        @inject(TRAJECTORY_TOKENS.LineStyleService)
        private readonly lineStyleService: ILineStyleService
    ) { }

    async execute(input: CreateLineStyledModelInputDTO): Promise<CreateLineStyledModelOutputDTO> {
        return this.lineStyleService.createStyledModel(
            input.trajectoryId,
            input.timestep,
            input.analysisId,
            input.exposureId,
            input.style ?? {}
        );
    }
};
