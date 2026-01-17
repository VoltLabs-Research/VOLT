import sshFileExplorerRoutes from './routes/ssh-file-explorer-routes';
import { HttpModule } from '@/src/shared/infrastructure/http/HttpModule';

export const SshFileExplorerHttpModule: HttpModule = {
    basePath: '/api/ssh-file-explorer',
    router: sshFileExplorerRoutes
};
