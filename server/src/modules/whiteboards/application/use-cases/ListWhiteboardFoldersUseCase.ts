import { WHITEBOARD_TOKENS } from '@modules/whiteboards/infrastructure/di/WhiteboardTokens';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import type { IUseCase } from '@shared/application/IUseCase';
import type { IWhiteboardFolderRepository } from '@modules/whiteboards/domain/port/IWhiteboardFolderRepository';
import type {
    ListWhiteboardFoldersInputDTO,
    ListWhiteboardFoldersOutputDTO
} from '@modules/whiteboards/application/dtos/ListWhiteboardFoldersDTO';

@injectable()
export class ListWhiteboardFoldersUseCase implements IUseCase<ListWhiteboardFoldersInputDTO, ListWhiteboardFoldersOutputDTO, ApplicationError> {
    constructor(
        @inject(WHITEBOARD_TOKENS.WhiteboardFolderRepository)
        private readonly whiteboardFolderRepository: IWhiteboardFolderRepository
    ) {}

    async execute(input: ListWhiteboardFoldersInputDTO): Promise<Result<ListWhiteboardFoldersOutputDTO, ApplicationError>> {
        const page = Math.max(1, Number(input.page || 1));
        const limit = Math.max(1, Math.min(500, Number(input.limit || 500)));
        const parentId = input.parentId !== undefined ? input.parentId : null;

        const result = await this.whiteboardFolderRepository.findAllByTeamAndParent(
            input.teamId,
            parentId,
            { page, limit }
        );

        const value: ListWhiteboardFoldersOutputDTO = {
            ...result,
            data: result.data.map((folder) => ({
                _id: folder._id,
                title: folder.props.title,
                parent: folder.props.parent,
                createdAt: folder.props.createdAt,
                updatedAt: folder.props.updatedAt
            }))
        };

        return Result.ok(value);
    }
};
