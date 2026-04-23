import type {
    MoveWhiteboardInputDTO,
    MoveWhiteboardOutputDTO
} from '@modules/whiteboards/application/dtos/MoveWhiteboardDTO';
import type { WhiteboardProps } from '@modules/whiteboards/domain/entities/Whiteboard';
import type WhiteboardFolder from '@modules/whiteboards/domain/entities/WhiteboardFolder';
import type { WhiteboardFolderProps } from '@modules/whiteboards/domain/entities/WhiteboardFolder';
import WhiteboardFolderRepository from '@modules/whiteboards/infrastructure/persistence/mongo/repositories/WhiteboardFolderRepository';
import WhiteboardRepository from '@modules/whiteboards/infrastructure/persistence/mongo/repositories/WhiteboardRepository';
import { MoveCatalogItemUseCase } from '@shared/application/catalog/MoveCatalogItemUseCase';
import type ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';

@Singleton()
export class MoveWhiteboardUseCase
    extends MoveCatalogItemUseCase<MoveWhiteboardInputDTO, WhiteboardFolder, WhiteboardFolderProps, WhiteboardProps>
    implements IUseCase<MoveWhiteboardInputDTO, MoveWhiteboardOutputDTO, ApplicationError> {
    constructor(
        
        whiteboardRepository: WhiteboardRepository,

        
        whiteboardFolderRepository: WhiteboardFolderRepository
    ) {
        super(whiteboardRepository, whiteboardFolderRepository, {
            folderLabel: 'Whiteboard folder',
            itemLabel: 'Whiteboard',
            getItemId: (input) => input.whiteboardId
        });
    }
};
