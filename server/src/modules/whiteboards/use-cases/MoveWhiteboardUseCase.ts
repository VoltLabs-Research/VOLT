import { WHITEBOARD_TOKENS } from '@modules/whiteboards/di/WhiteboardTokens';
import type { IWhiteboardFolderRepository } from '@modules/whiteboards/ports/IWhiteboardFolderRepository';
import type { IWhiteboardRepository } from '@modules/whiteboards/ports/IWhiteboardRepository';
import type {
    MoveWhiteboardInputDTO,
    MoveWhiteboardOutputDTO
} from '@modules/whiteboards/dtos/MoveWhiteboardDTO';
import type { WhiteboardProps } from '@modules/whiteboards/entities/Whiteboard';
import type WhiteboardFolder from '@modules/whiteboards/entities/WhiteboardFolder';
import type { WhiteboardFolderProps } from '@modules/whiteboards/entities/WhiteboardFolder';
import { MoveCatalogItemUseCase } from '@shared/application/catalog/MoveCatalogItemUseCase';
import type { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
export class MoveWhiteboardUseCase
    extends MoveCatalogItemUseCase<MoveWhiteboardInputDTO, WhiteboardFolder, WhiteboardFolderProps, WhiteboardProps>
    implements IUseCase<MoveWhiteboardInputDTO, MoveWhiteboardOutputDTO> {
    constructor(
        @inject(WHITEBOARD_TOKENS.WhiteboardRepository) whiteboardRepository: IWhiteboardRepository,
        @inject(WHITEBOARD_TOKENS.WhiteboardFolderRepository) whiteboardFolderRepository: IWhiteboardFolderRepository
    ) {
        super(whiteboardRepository, whiteboardFolderRepository, {
            folderLabel: 'Whiteboard folder',
            itemLabel: 'Whiteboard',
            getItemId: (input) => input.whiteboardId
        });
    }
}
