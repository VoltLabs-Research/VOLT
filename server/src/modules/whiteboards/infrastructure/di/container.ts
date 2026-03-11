import WhiteboardRepository from '@modules/whiteboards/infrastructure/persistence/mongo/repositories/WhiteboardRepository';
import WhiteboardFolderRepository from '@modules/whiteboards/infrastructure/persistence/mongo/repositories/WhiteboardFolderRepository';
import WhiteboardSocketModule from '@modules/whiteboards/infrastructure/socket/WhiteboardSocketModule';
import { CreateWhiteboardUseCase } from '@modules/whiteboards/application/use-cases/CreateWhiteboardUseCase';
import { ListWhiteboardsUseCase } from '@modules/whiteboards/application/use-cases/ListWhiteboardsUseCase';
import { GetWhiteboardUseCase } from '@modules/whiteboards/application/use-cases/GetWhiteboardUseCase';
import { UpdateWhiteboardUseCase } from '@modules/whiteboards/application/use-cases/UpdateWhiteboardUseCase';
import { DeleteWhiteboardUseCase } from '@modules/whiteboards/application/use-cases/DeleteWhiteboardUseCase';
import { GetWhiteboardStateUseCase } from '@modules/whiteboards/application/use-cases/GetWhiteboardStateUseCase';
import { SaveWhiteboardStateUseCase } from '@modules/whiteboards/application/use-cases/SaveWhiteboardStateUseCase';
import { UploadWhiteboardAssetUseCase } from '@modules/whiteboards/application/use-cases/UploadWhiteboardAssetUseCase';
import { GetWhiteboardAssetUseCase } from '@modules/whiteboards/application/use-cases/GetWhiteboardAssetUseCase';
import { CreateWhiteboardFolderUseCase } from '@modules/whiteboards/application/use-cases/CreateWhiteboardFolderUseCase';
import { GetWhiteboardFolderUseCase } from '@modules/whiteboards/application/use-cases/GetWhiteboardFolderUseCase';
import { ListWhiteboardFoldersUseCase } from '@modules/whiteboards/application/use-cases/ListWhiteboardFoldersUseCase';
import { UpdateWhiteboardFolderUseCase } from '@modules/whiteboards/application/use-cases/UpdateWhiteboardFolderUseCase';
import { DeleteWhiteboardFolderUseCase } from '@modules/whiteboards/application/use-cases/DeleteWhiteboardFolderUseCase';
import { MoveWhiteboardUseCase } from '@modules/whiteboards/application/use-cases/MoveWhiteboardUseCase';
import { WHITEBOARD_TOKENS } from './WhiteboardTokens';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { registerModuleDependencies } from '@shared/infrastructure/di/registerModuleDependencies';

export const registerWhiteboardDependencies = (): void => {
    registerModuleDependencies({
        singletons: [
            [WHITEBOARD_TOKENS.WhiteboardRepository, WhiteboardRepository],
            [WHITEBOARD_TOKENS.WhiteboardFolderRepository, WhiteboardFolderRepository],
            [WHITEBOARD_TOKENS.WhiteboardSocketModule, WhiteboardSocketModule],
            CreateWhiteboardUseCase,
            ListWhiteboardsUseCase,
            GetWhiteboardUseCase,
            UpdateWhiteboardUseCase,
            DeleteWhiteboardUseCase,
            GetWhiteboardStateUseCase,
            SaveWhiteboardStateUseCase,
            UploadWhiteboardAssetUseCase,
            GetWhiteboardAssetUseCase,
            CreateWhiteboardFolderUseCase,
            GetWhiteboardFolderUseCase,
            ListWhiteboardFoldersUseCase,
            UpdateWhiteboardFolderUseCase,
            DeleteWhiteboardFolderUseCase,
            MoveWhiteboardUseCase
        ],
        aliases: [
            [SOCKET_TOKENS.SocketModule, WHITEBOARD_TOKENS.WhiteboardSocketModule]
        ]
    });
};
