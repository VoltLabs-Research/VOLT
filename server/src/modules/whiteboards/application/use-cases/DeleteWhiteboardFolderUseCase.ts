import type WhiteboardFolderRepository from '@modules/whiteboards/infrastructure/persistence/mongo/repositories/WhiteboardFolderRepository';
import { WHITEBOARD_TOKENS } from '@modules/whiteboards/infrastructure/di/WhiteboardTokens';
import type { IWhiteboardRepository } from '@modules/whiteboards/domain/port/IWhiteboardRepository';
import type { DeleteWhiteboardFolderInputDTO, DeleteWhiteboardFolderOutputDTO } from '@modules/whiteboards/application/dtos/DeleteWhiteboardFolderDTO';
import { DeleteWhiteboardUseCase } from '@modules/whiteboards/application/use-cases/DeleteWhiteboardUseCase';
import type Whiteboard from '@modules/whiteboards/domain/entities/Whiteboard';
import type { WhiteboardProps } from '@modules/whiteboards/domain/entities/Whiteboard';
import type WhiteboardFolder from '@modules/whiteboards/domain/entities/WhiteboardFolder';
import type { WhiteboardFolderProps } from '@modules/whiteboards/domain/entities/WhiteboardFolder';
import { DeleteCatalogFolderUseCase } from '@shared/application/catalog/DeleteCatalogFolderUseCase';
import type ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
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
        @inject(WHITEBOARD_TOKENS.WhiteboardFolderRepository) whiteboardFolderRepository: WhiteboardFolderRepository,
        @inject(WHITEBOARD_TOKENS.WhiteboardRepository) whiteboardRepository: IWhiteboardRepository,
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
