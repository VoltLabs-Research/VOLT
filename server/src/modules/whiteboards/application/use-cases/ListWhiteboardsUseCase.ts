import type { ListWhiteboardsInputDTO, ListWhiteboardsOutputDTO } from '@modules/whiteboards/application/dtos/ListWhiteboardsDTO';
import WhiteboardRepository from '@modules/whiteboards/infrastructure/persistence/mongo/repositories/WhiteboardRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { LAST_EDITED_BY_POPULATE } from '@shared/application/PopulatePresets';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';

@Singleton()
export class ListWhiteboardsUseCase implements IUseCase<ListWhiteboardsInputDTO, ListWhiteboardsOutputDTO, ApplicationError> {
    constructor(
        private readonly whiteboardRepository: WhiteboardRepository
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
}
