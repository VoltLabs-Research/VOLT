import { LAST_EDITED_BY_POPULATE } from '@shared/application/PopulatePresets';
import { WHITEBOARD_TOKENS } from '@modules/whiteboards/infrastructure/di/WhiteboardTokens';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import type { IUseCase } from '@shared/application/IUseCase';
import type { IWhiteboardRepository } from '@modules/whiteboards/domain/port/IWhiteboardRepository';
import type { ListWhiteboardsInputDTO, ListWhiteboardsOutputDTO } from '@modules/whiteboards/application/dtos/ListWhiteboardsDTO';

@injectable()
export class ListWhiteboardsUseCase implements IUseCase<ListWhiteboardsInputDTO, ListWhiteboardsOutputDTO, ApplicationError> {
    constructor(
        @inject(WHITEBOARD_TOKENS.WhiteboardRepository)
        private readonly whiteboardRepository: IWhiteboardRepository
    ) {}

    async execute(input: ListWhiteboardsInputDTO): Promise<Result<ListWhiteboardsOutputDTO, ApplicationError>> {
        const page = Math.max(1, input.page ?? 1);
        const limit = Math.max(1, Math.min(500, input.limit ?? 500));

        let folderId: string | null | 'all';
        if (!input.folderId) {
            folderId = 'all';
        } else if (input.folderId === 'root') {
            folderId = null;
        } else {
            folderId = input.folderId;
        }

        const filter: Record<string, unknown> = { team: input.teamId };
        if (folderId !== 'all') {
            filter.folder = folderId;
        }

        const result = await this.whiteboardRepository.findAll({
            filter,
            page,
            limit,
            sort: { updatedAt: -1 },
            populate: LAST_EDITED_BY_POPULATE
        });

        const value: ListWhiteboardsOutputDTO = {
            ...result,
            data: result.data.map((whiteboard) => ({
                _id: whiteboard._id,
                title: whiteboard.props.title,
                folder: whiteboard.props.folder,
                payloadKey: whiteboard.props.payloadKey,
                thumbnailKey: whiteboard.props.thumbnailKey,
                lastEditedBy: whiteboard.props.lastEditedBy,
                createdAt: whiteboard.props.createdAt,
                updatedAt: whiteboard.props.updatedAt
            }))
        };

        return Result.ok(value);
    }
};
