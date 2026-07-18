import { WHITEBOARD_TOKENS } from '@modules/whiteboards/di/WhiteboardTokens';
import type { IWhiteboardRepository } from '@modules/whiteboards/ports/IWhiteboardRepository';
import type { ListWhiteboardsInputDTO, ListWhiteboardsOutputDTO } from '@modules/whiteboards/dtos/ListWhiteboardsDTO';
import type { IUseCase } from '@shared/application/IUseCase';
import { LAST_EDITED_BY_POPULATE } from '@shared/infrastructure/persistence/mongo/PopulatePresets';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
export class ListWhiteboardsUseCase implements IUseCase<ListWhiteboardsInputDTO, ListWhiteboardsOutputDTO> {
    constructor(
        @inject(WHITEBOARD_TOKENS.WhiteboardRepository) private readonly whiteboardRepository: IWhiteboardRepository
    ) {}

    async execute(input: ListWhiteboardsInputDTO): Promise<ListWhiteboardsOutputDTO> {
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

        return value;
    }
}
