import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { GetLineModelRangesStreamInputDTO } from '@modules/trajectory/application/dtos/line-style';
import { parseLineStyle } from '@modules/trajectory/application/use-cases/line-style/GetLineStyledModelStreamUseCase';
import type { ILineStyleService } from '@modules/trajectory/domain/port/line-style/ILineStyleService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

import type { StreamableOutput } from '@shared/infrastructure/http/controllers/BaseStreamController';

@Singleton()
export class GetLineModelRangesStreamUseCase implements IUseCase<GetLineModelRangesStreamInputDTO, StreamableOutput, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.LineStyleService)
        private readonly lineStyleService: ILineStyleService
    ) { }

    async execute(input: GetLineModelRangesStreamInputDTO): Promise<Result<StreamableOutput, ApplicationError>> {
        const response = await this.lineStyleService.getRangesStreamResponse(
            input.trajectoryId,
            input.timestep,
            input.analysisId,
            input.exposureId,
            input.style ? parseLineStyle(input.style) : undefined
        );

        return Result.ok(response satisfies StreamableOutput);
    }
};
