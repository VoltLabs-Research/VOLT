import type WhiteboardFolder from '@modules/whiteboards/domain/entities/WhiteboardFolder';
import type { WhiteboardFolderProps } from '@modules/whiteboards/domain/entities/WhiteboardFolder';
import type { IWhiteboardFolderRepository } from '@modules/whiteboards/domain/port/IWhiteboardFolderRepository';
import { WHITEBOARD_TOKENS } from '@modules/whiteboards/infrastructure/di/WhiteboardTokens';
import { UpdateCatalogFolderUseCase } from '@shared/application/catalog/UpdateCatalogFolderUseCase';
import { inject, injectable } from 'tsyringe';

@injectable()
export class UpdateWhiteboardFolderUseCase extends UpdateCatalogFolderUseCase<WhiteboardFolder, WhiteboardFolderProps> {
    constructor(
        @inject(WHITEBOARD_TOKENS.WhiteboardFolderRepository)
        whiteboardFolderRepository: IWhiteboardFolderRepository
    ) {
        super(whiteboardFolderRepository, { folderLabel: 'Whiteboard folder' });
    }
}
