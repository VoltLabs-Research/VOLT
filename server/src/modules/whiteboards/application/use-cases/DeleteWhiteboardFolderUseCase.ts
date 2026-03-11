import type { WhiteboardProps } from '@modules/whiteboards/domain/entities/Whiteboard';
import Whiteboard from '@modules/whiteboards/domain/entities/Whiteboard';
import type WhiteboardFolder from '@modules/whiteboards/domain/entities/WhiteboardFolder';
import type { WhiteboardFolderProps } from '@modules/whiteboards/domain/entities/WhiteboardFolder';
import type { IWhiteboardFolderRepository } from '@modules/whiteboards/domain/port/IWhiteboardFolderRepository';
import type { IWhiteboardRepository } from '@modules/whiteboards/domain/port/IWhiteboardRepository';
import { DeleteWhiteboardUseCase } from '@modules/whiteboards/application/use-cases/DeleteWhiteboardUseCase';
import { WHITEBOARD_TOKENS } from '@modules/whiteboards/infrastructure/di/WhiteboardTokens';
import { DeleteCatalogFolderUseCase } from '@shared/application/catalog/DeleteCatalogFolderUseCase';
import { inject, injectable } from 'tsyringe';

@injectable()
export class DeleteWhiteboardFolderUseCase extends DeleteCatalogFolderUseCase<WhiteboardFolder, WhiteboardFolderProps, Whiteboard, WhiteboardProps> {
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
            async (whiteboard, teamId) => {
                const result = await deleteWhiteboardUseCase.execute({
                    teamId,
                    whiteboardId: whiteboard._id
                });

                if (!result.success) {
                    throw result.error;
                }
            },
            { folderLabel: 'Whiteboard folder' }
        );
    }
}
