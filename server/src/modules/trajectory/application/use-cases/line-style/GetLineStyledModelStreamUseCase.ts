import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import {
    GetLineStyledModelStreamInputDTO,
    GetLineStyledModelStreamOutputDTO
} from '@modules/trajectory/application/dtos/line-style';
import type {
    ILineStyleService,
    LineStyleSpec
} from '@modules/trajectory/domain/port/line-style/ILineStyleService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

import type { StreamableOutput } from '@shared/infrastructure/http/controllers/BaseStreamController';

export const parseLineStyle = (style: string | undefined): LineStyleSpec => {
    if (!style) {
        return {};
    }

    try {
        return JSON.parse(style) as LineStyleSpec;
    } catch {
        throw ApplicationError.badRequest(
            'LINE_STYLE_INVALID',
            'The "style" query parameter must be a JSON-encoded line style.'
        );
    }
};

@Singleton()
export class GetLineStyledModelStreamUseCase implements IUseCase<GetLineStyledModelStreamInputDTO, StreamableOutput, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.LineStyleService)
        private readonly lineStyleService: ILineStyleService
    ) { }

    async execute(input: GetLineStyledModelStreamInputDTO): Promise<Result<StreamableOutput, ApplicationError>> {
        const response = await this.lineStyleService.getModelStreamResponse(
            input.trajectoryId,
            input.timestep,
            input.analysisId,
            input.exposureId,
            parseLineStyle(input.style)
        );

        return Result.ok(response satisfies GetLineStyledModelStreamOutputDTO & StreamableOutput);
    }
};
