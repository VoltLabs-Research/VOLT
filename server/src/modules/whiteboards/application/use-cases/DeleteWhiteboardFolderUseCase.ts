import type { DeleteWhiteboardFolderInputDTO, DeleteWhiteboardFolderOutputDTO } from '@modules/whiteboards/application/dtos/DeleteWhiteboardFolderDTO';
import { DeleteWhiteboardUseCase } from '@modules/whiteboards/application/use-cases/DeleteWhiteboardUseCase';
import type Whiteboard from '@modules/whiteboards/domain/entities/Whiteboard';
import type { WhiteboardProps } from '@modules/whiteboards/domain/entities/Whiteboard';
import type WhiteboardFolder from '@modules/whiteboards/domain/entities/WhiteboardFolder';
import type { WhiteboardFolderProps } from '@modules/whiteboards/domain/entities/WhiteboardFolder';
import WhiteboardFolderRepository from '@modules/whiteboards/infrastructure/persistence/mongo/repositories/WhiteboardFolderRepository';
import WhiteboardRepository from '@modules/whiteboards/infrastructure/persistence/mongo/repositories/WhiteboardRepository';
import { DeleteCatalogFolderUseCase } from '@shared/application/catalog/DeleteCatalogFolderUseCase';
import type ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';

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
        
        whiteboardFolderRepository: WhiteboardFolderRepository,
        
        whiteboardRepository: WhiteboardRepository,
        
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
