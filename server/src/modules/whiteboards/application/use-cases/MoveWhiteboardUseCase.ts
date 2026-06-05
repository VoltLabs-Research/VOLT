import type WhiteboardFolderRepository from '@modules/whiteboards/infrastructure/persistence/mongo/repositories/WhiteboardFolderRepository';
import { WHITEBOARD_TOKENS } from '@modules/whiteboards/infrastructure/di/WhiteboardTokens';
import type { IWhiteboardRepository } from '@modules/whiteboards/domain/port/IWhiteboardRepository';
import type {
    MoveWhiteboardInputDTO,
    MoveWhiteboardOutputDTO
} from '@modules/whiteboards/application/dtos/MoveWhiteboardDTO';
import type { WhiteboardProps } from '@modules/whiteboards/domain/entities/Whiteboard';
import type WhiteboardFolder from '@modules/whiteboards/domain/entities/WhiteboardFolder';
import type { WhiteboardFolderProps } from '@modules/whiteboards/domain/entities/WhiteboardFolder';
import { MoveCatalogItemUseCase } from '@shared/application/catalog/MoveCatalogItemUseCase';
import type ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
export class MoveWhiteboardUseCase
    extends MoveCatalogItemUseCase<MoveWhiteboardInputDTO, WhiteboardFolder, WhiteboardFolderProps, WhiteboardProps>
    implements IUseCase<MoveWhiteboardInputDTO, MoveWhiteboardOutputDTO, ApplicationError> {
    constructor(
        @inject(WHITEBOARD_TOKENS.WhiteboardRepository) whiteboardRepository: IWhiteboardRepository,
        @inject(WHITEBOARD_TOKENS.WhiteboardFolderRepository) whiteboardFolderRepository: WhiteboardFolderRepository
    ) {
        super(whiteboardRepository, whiteboardFolderRepository, {
            folderLabel: 'Whiteboard folder',
            itemLabel: 'Whiteboard',
            getItemId: (input) => input.whiteboardId
        });
    }
}
