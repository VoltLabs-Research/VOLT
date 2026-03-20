import { WHITEBOARD_TOKENS } from '@modules/whiteboards/infrastructure/di/WhiteboardTokens';
import { DeleteWhiteboardUseCase } from '@modules/whiteboards/application/use-cases/DeleteWhiteboardUseCase';
import type WhiteboardFolder from '@modules/whiteboards/domain/entities/WhiteboardFolder';
import type Whiteboard from '@modules/whiteboards/domain/entities/Whiteboard';
import type { WhiteboardFolderProps } from '@modules/whiteboards/domain/entities/WhiteboardFolder';
import type { WhiteboardProps } from '@modules/whiteboards/domain/entities/Whiteboard';
import { inject, injectable } from 'tsyringe';
import { DeleteCatalogFolderUseCase } from '@shared/application/catalog/DeleteCatalogFolderUseCase';
import type ApplicationError from '@shared/application/errors/ApplicationErrors';
import type { IUseCase } from '@shared/application/IUseCase';
import type { DeleteWhiteboardFolderInputDTO, DeleteWhiteboardFolderOutputDTO } from '@modules/whiteboards/application/dtos/DeleteWhiteboardFolderDTO';
import type { IWhiteboardFolderRepository } from '@modules/whiteboards/domain/port/IWhiteboardFolderRepository';
import type { IWhiteboardRepository } from '@modules/whiteboards/domain/port/IWhiteboardRepository';

@injectable()
export class DeleteWhiteboardFolderUseCase
    extends DeleteCatalogFolderUseCase<
        WhiteboardFolder,
        WhiteboardFolderProps,
        Whiteboard,
        WhiteboardProps,
        DeleteWhiteboardFolderInputDTO,
        { userId: string }
    >
    implements IUseCase<DeleteWhiteboardFolderInputDTO, DeleteWhiteboardFolderOutputDTO, ApplicationError> {
    constructor(
        @inject(WHITEBOARD_TOKENS.WhiteboardFolderRepository)
        whiteboardFolderRepository: IWhiteboardFolderRepository,
        @inject(WHITEBOARD_TOKENS.WhiteboardRepository)
        whiteboardRepository: IWhiteboardRepository,
        @inject(DeleteWhiteboardUseCase)
        deleteWhiteboardUseCase: DeleteWhiteboardUseCase
    ) {
        super(
            whiteboardFolderRepository,
            whiteboardRepository,
            async (whiteboard, teamId, context) => {
                const result = await deleteWhiteboardUseCase.execute({
                    teamId,
                    whiteboardId: whiteboard._id,
                    userId: context.userId
                });

                if (!result.success) {
                    throw result.error;
                }
            },
            {
                folderLabel: 'Whiteboard folder',
                getDeleteContext: (input) => ({ userId: input.userId })
            }
        );
    }
}
