import { WHITEBOARD_TOKENS } from '@modules/whiteboards/infrastructure/di/WhiteboardTokens';
import type { IWhiteboardFolderRepository } from '@modules/whiteboards/domain/port/IWhiteboardFolderRepository';
import type { IWhiteboardRepository } from '@modules/whiteboards/domain/port/IWhiteboardRepository';
import type { DeleteWhiteboardFolderInputDTO, DeleteWhiteboardFolderOutputDTO } from '@modules/whiteboards/application/dtos/DeleteWhiteboardFolderDTO';
import { DeleteWhiteboardUseCase } from '@modules/whiteboards/application/use-cases/DeleteWhiteboardUseCase';
import type Whiteboard from '@modules/whiteboards/domain/entities/Whiteboard';
import type { WhiteboardProps } from '@modules/whiteboards/domain/entities/Whiteboard';
import type WhiteboardFolder from '@modules/whiteboards/domain/entities/WhiteboardFolder';
import type { WhiteboardFolderProps } from '@modules/whiteboards/domain/entities/WhiteboardFolder';
import { DeleteCatalogFolderUseCase } from '@shared/application/catalog/DeleteCatalogFolderUseCase';
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
    implements IUseCase<DeleteWhiteboardFolderInputDTO, DeleteWhiteboardFolderOutputDTO> {
    constructor(
        @inject(WHITEBOARD_TOKENS.WhiteboardFolderRepository) whiteboardFolderRepository: IWhiteboardFolderRepository,
        @inject(WHITEBOARD_TOKENS.WhiteboardRepository) whiteboardRepository: IWhiteboardRepository,
        deleteWhiteboardUseCase: DeleteWhiteboardUseCase
    ) {
        super(
            whiteboardFolderRepository,
            whiteboardRepository,
            async (whiteboard, teamId, context) => {
                await deleteWhiteboardUseCase.execute({
                    teamId,
                    whiteboardId: whiteboard._id,
                    userId: context.userId
                });
            },
            {
                folderLabel: 'Whiteboard folder',
                getDeleteContext: (input) => ({ userId: input.userId })
            }
        );
    }
}
