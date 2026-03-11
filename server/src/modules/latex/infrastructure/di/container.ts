import { CreateLatexDocumentUseCase } from '@modules/latex/application/use-cases/CreateLatexDocumentUseCase';
import { DeleteLatexDocumentUseCase } from '@modules/latex/application/use-cases/DeleteLatexDocumentUseCase';
import { ListLatexDocumentsUseCase } from '@modules/latex/application/use-cases/ListLatexDocumentsUseCase';
import { UpdateLatexDocumentUseCase } from '@modules/latex/application/use-cases/UpdateLatexDocumentUseCase';
import { GetLatexDocumentUseCase } from '@modules/latex/application/use-cases/GetLatexDocumentUseCase';
import { UploadLatexAssetUseCase } from '@modules/latex/application/use-cases/UploadLatexAssetUseCase';
import { ListLatexAssetsUseCase } from '@modules/latex/application/use-cases/ListLatexAssetsUseCase';
import { DeleteLatexAssetUseCase } from '@modules/latex/application/use-cases/DeleteLatexAssetUseCase';
import LatexDocumentRepository from '@modules/latex/infrastructure/persistence/mongo/repositories/LatexDocumentRepository';
import LatexAssetRepository from '@modules/latex/infrastructure/persistence/mongo/repositories/LatexAssetRepository';
import LatexSocketModule from '@modules/latex/socket/LatexSocketModule';
import { LATEX_TOKENS } from './LatexTokens';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { registerModuleDependencies } from '@shared/infrastructure/di/registerModuleDependencies';

export const registerLatexDependencies = (): void => {
    registerModuleDependencies({
        singletons: [
            [LATEX_TOKENS.LatexDocumentRepository, LatexDocumentRepository],
            [LATEX_TOKENS.LatexAssetRepository, LatexAssetRepository],
            [LATEX_TOKENS.LatexSocketModule, LatexSocketModule],
            CreateLatexDocumentUseCase,
            ListLatexDocumentsUseCase,
            DeleteLatexDocumentUseCase,
            UpdateLatexDocumentUseCase,
            GetLatexDocumentUseCase,
            UploadLatexAssetUseCase,
            ListLatexAssetsUseCase,
            DeleteLatexAssetUseCase
        ],
        aliases: [
            [SOCKET_TOKENS.SocketModule, LATEX_TOKENS.LatexSocketModule]
        ]
    });
};
