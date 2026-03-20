import { WHITEBOARD_TOKENS } from '@modules/whiteboards/infrastructure/di/WhiteboardTokens';
import { inject, injectable } from 'tsyringe';
import type WhiteboardFolder from '@modules/whiteboards/domain/entities/WhiteboardFolder';
import type { WhiteboardFolderProps } from '@modules/whiteboards/domain/entities/WhiteboardFolder';
import type { WhiteboardProps } from '@modules/whiteboards/domain/entities/Whiteboard';
import { MoveCatalogItemUseCase } from '@shared/application/catalog/MoveCatalogItemUseCase';
import type ApplicationError from '@shared/application/errors/ApplicationErrors';
import type { IUseCase } from '@shared/application/IUseCase';
import type { IWhiteboardRepository } from '@modules/whiteboards/domain/port/IWhiteboardRepository';
import type { IWhiteboardFolderRepository } from '@modules/whiteboards/domain/port/IWhiteboardFolderRepository';
import type {
    MoveWhiteboardInputDTO,
    MoveWhiteboardOutputDTO
} from '@modules/whiteboards/application/dtos/MoveWhiteboardDTO';

@injectable()
export class MoveWhiteboardUseCase
    extends MoveCatalogItemUseCase<MoveWhiteboardInputDTO, WhiteboardFolder, WhiteboardFolderProps, WhiteboardProps>
    implements IUseCase<MoveWhiteboardInputDTO, MoveWhiteboardOutputDTO, ApplicationError> {
    constructor(
        @inject(WHITEBOARD_TOKENS.WhiteboardRepository)
        whiteboardRepository: IWhiteboardRepository,

        @inject(WHITEBOARD_TOKENS.WhiteboardFolderRepository)
        whiteboardFolderRepository: IWhiteboardFolderRepository
    ) {
        super(whiteboardRepository, whiteboardFolderRepository, {
            folderLabel: 'Whiteboard folder',
            itemLabel: 'Whiteboard',
            getItemId: (input) => input.whiteboardId
        });
    }
};
