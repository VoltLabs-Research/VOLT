import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import {
    GetDislocationStyledModelStreamInputDTO,
    GetDislocationStyledModelStreamOutputDTO
} from '@modules/trajectory/application/dtos/dislocation-style';
import type {
    DislocationStyleSpec,
    IDislocationStyleService
} from '@modules/trajectory/domain/port/dislocation-style/IDislocationStyleService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

import type { StreamableOutput } from '@shared/infrastructure/http/controllers/BaseStreamController';

const parseStyle = (style: string | undefined): DislocationStyleSpec => {
    if (!style) {
        return {};
    }

    try {
        return JSON.parse(style) as DislocationStyleSpec;
    } catch {
        throw ApplicationError.badRequest(
            'DISLOCATION_STYLE_INVALID',
            'The "style" query parameter must be a JSON-encoded dislocation style.'
        );
    }
};

@Singleton()
export class GetDislocationStyledModelStreamUseCase implements IUseCase<GetDislocationStyledModelStreamInputDTO, StreamableOutput, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.DislocationStyleService)
        private readonly dislocationStyleService: IDislocationStyleService
    ) { }

    async execute(input: GetDislocationStyledModelStreamInputDTO): Promise<Result<StreamableOutput, ApplicationError>> {
        const response = await this.dislocationStyleService.getModelStreamResponse(
            input.trajectoryId,
            input.timestep,
            input.analysisId,
            input.exposureId,
            parseStyle(input.style)
        );

        return Result.ok(response satisfies GetDislocationStyledModelStreamOutputDTO & StreamableOutput);
    }
};
