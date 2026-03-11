import { WHITEBOARD_TOKENS } from '@modules/whiteboards/infrastructure/di/WhiteboardTokens';
import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import Whiteboard from '@modules/whiteboards/domain/entities/Whiteboard';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject, injectable } from 'tsyringe';
import type { IUseCase } from '@shared/application/IUseCase';
import type { IWhiteboardRepository } from '@modules/whiteboards/domain/port/IWhiteboardRepository';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import type { CreateWhiteboardInputDTO, CreateWhiteboardOutputDTO } from '@modules/whiteboards/application/dtos/CreateWhiteboardDTO';

const EMPTY_STATE = Buffer.from(JSON.stringify({ elements: [], appState: {} }));

@injectable()
export class CreateWhiteboardUseCase implements IUseCase<CreateWhiteboardInputDTO, CreateWhiteboardOutputDTO, ApplicationError> {
    constructor(
        @inject(WHITEBOARD_TOKENS.WhiteboardRepository)
        private readonly whiteboardRepository: IWhiteboardRepository,

        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService
    ) {}

    async execute(input: CreateWhiteboardInputDTO): Promise<Result<CreateWhiteboardOutputDTO, ApplicationError>> {
        try {
            const whiteboard = await this.whiteboardRepository.create({
                team: input.teamId,
                createdBy: input.userId,
                title: input.title,
                payloadKey: '',
                createdAt: new Date(),
                updatedAt: new Date()
            });

            const payloadKey = `${input.teamId}/${whiteboard._id}/state.json`;

            await this.storageService.upload(
                SYS_BUCKETS.WHITEBOARDS,
                payloadKey,
                EMPTY_STATE,
                { 'Content-Type': 'application/json' }
            );

            const updated = await this.whiteboardRepository.updateById(whiteboard._id, {
                payloadKey
            } as Partial<Whiteboard['props']>);

            const finalWhiteboard = updated ?? whiteboard;

            return Result.ok({
                _id: finalWhiteboard._id,
                title: finalWhiteboard.props.title,
                payloadKey: payloadKey,
                createdAt: finalWhiteboard.props.createdAt,
                updatedAt: finalWhiteboard.props.updatedAt
            });
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to create whiteboard',
                500
            ));
        }
    }
};
