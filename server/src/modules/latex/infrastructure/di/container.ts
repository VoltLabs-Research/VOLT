import { container } from 'tsyringe';
import { CreateLatexDocumentUseCase } from '@modules/latex/application/use-cases/CreateLatexDocumentUseCase';
import { DeleteLatexDocumentUseCase } from '@modules/latex/application/use-cases/DeleteLatexDocumentUseCase';
import { ListLatexDocumentsUseCase } from '@modules/latex/application/use-cases/ListLatexDocumentsUseCase';
import { UpdateLatexDocumentUseCase } from '@modules/latex/application/use-cases/UpdateLatexDocumentUseCase';
import { GetLatexDocumentUseCase } from '@modules/latex/application/use-cases/GetLatexDocumentUseCase';
import { UploadLatexAssetUseCase } from '@modules/latex/application/use-cases/UploadLatexAssetUseCase';
import { ListLatexAssetsUseCase } from '@modules/latex/application/use-cases/ListLatexAssetsUseCase';
import { DeleteLatexAssetUseCase } from '@modules/latex/application/use-cases/DeleteLatexAssetUseCase';
import { UpdateLatexAssetUseCase } from '@modules/latex/application/use-cases/UpdateLatexAssetUseCase';
import { ExportLatexDocumentTexUseCase } from '@modules/latex/application/use-cases/ExportLatexDocumentTexUseCase';
import { ExportLatexDocumentZipUseCase } from '@modules/latex/application/use-cases/ExportLatexDocumentZipUseCase';
import { ImportLatexDocumentUseCase } from '@modules/latex/application/use-cases/ImportLatexDocumentUseCase';
import { CompileLatexDocumentUseCase } from '@modules/latex/application/use-cases/CompileLatexDocumentUseCase';
import { ListLatexFilesUseCase } from '@modules/latex/application/use-cases/ListLatexFilesUseCase';
import { CreateLatexFileUseCase } from '@modules/latex/application/use-cases/CreateLatexFileUseCase';
import { UpdateLatexFileUseCase } from '@modules/latex/application/use-cases/UpdateLatexFileUseCase';
import { DeleteLatexFileUseCase } from '@modules/latex/application/use-cases/DeleteLatexFileUseCase';
import { SetLatexFileEntrypointUseCase } from '@modules/latex/application/use-cases/SetLatexFileEntrypointUseCase';
import { CreateLatexFolderUseCase } from '@modules/latex/application/use-cases/CreateLatexFolderUseCase';
import { GetLatexFolderUseCase } from '@modules/latex/application/use-cases/GetLatexFolderUseCase';
import { ListLatexFoldersUseCase } from '@modules/latex/application/use-cases/ListLatexFoldersUseCase';
import { UpdateLatexFolderUseCase } from '@modules/latex/application/use-cases/UpdateLatexFolderUseCase';
import { DeleteLatexFolderUseCase } from '@modules/latex/application/use-cases/DeleteLatexFolderUseCase';
import { MoveLatexDocumentUseCase } from '@modules/latex/application/use-cases/MoveLatexDocumentUseCase';
import LatexDocumentRepository from '@modules/latex/infrastructure/persistence/mongo/repositories/LatexDocumentRepository';
import LatexAssetRepository from '@modules/latex/infrastructure/persistence/mongo/repositories/LatexAssetRepository';
import LatexFileRepository from '@modules/latex/infrastructure/persistence/mongo/repositories/LatexFileRepository';
import LatexFolderRepository from '@modules/latex/infrastructure/persistence/mongo/repositories/LatexFolderRepository';
import LatexSocketModule from '@modules/latex/socket/LatexSocketModule';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import * as latexAiTools from '@modules/latex/application/ai-tools';
import { LATEX_TOKENS } from './LatexTokens';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { registerModuleDependencies } from '@shared/infrastructure/di/registerModuleDependencies';
import type { ClassProvider } from 'tsyringe';

const LATEX_AI_TOOL_CLASSES: ClassProvider<unknown>[] = Object.values(latexAiTools).map((useClass) => ({ useClass }));

export const registerLatexDependencies = (): void => {
    registerModuleDependencies({
        singletons: [
            [LATEX_TOKENS.LatexDocumentRepository, LatexDocumentRepository],
            [LATEX_TOKENS.LatexAssetRepository, LatexAssetRepository],
            [LATEX_TOKENS.LatexFileRepository, LatexFileRepository],
            [LATEX_TOKENS.LatexFolderRepository, LatexFolderRepository],
            [LATEX_TOKENS.LatexSocketModule, LatexSocketModule],
            CreateLatexDocumentUseCase,
            ListLatexDocumentsUseCase,
            DeleteLatexDocumentUseCase,
            UpdateLatexDocumentUseCase,
            GetLatexDocumentUseCase,
            UploadLatexAssetUseCase,
            ListLatexAssetsUseCase,
            DeleteLatexAssetUseCase,
            UpdateLatexAssetUseCase,
            ExportLatexDocumentTexUseCase,
            ExportLatexDocumentZipUseCase,
            ImportLatexDocumentUseCase,
            CompileLatexDocumentUseCase,
            ListLatexFilesUseCase,
            CreateLatexFileUseCase,
            UpdateLatexFileUseCase,
            DeleteLatexFileUseCase,
            SetLatexFileEntrypointUseCase,
            CreateLatexFolderUseCase,
            GetLatexFolderUseCase,
            ListLatexFoldersUseCase,
            UpdateLatexFolderUseCase,
            DeleteLatexFolderUseCase,
            MoveLatexDocumentUseCase
        ],
        aliases: [
            [SOCKET_TOKENS.SocketModule, LATEX_TOKENS.LatexSocketModule]
        ]
    });

    // AI Tools
    for (const toolClassProvider of LATEX_AI_TOOL_CLASSES) {
        container.register(AI_TOKENS.AITool, toolClassProvider);
    }
};
