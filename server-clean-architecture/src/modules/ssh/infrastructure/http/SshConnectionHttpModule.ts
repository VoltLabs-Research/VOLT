import sshConnectionRoutes from './routes/ssh-connection-routes';
import { HttpModule } from '@/src/shared/infrastructure/http/HttpModule';

export const SshConnectionHttpModule: HttpModule = {
    basePath: '/api/ssh-connections',
    router: sshConnectionRoutes
};
