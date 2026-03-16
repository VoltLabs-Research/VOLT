import { ContainerPortProxyService } from '@modules/container/infrastructure/services/ContainerPortProxyService';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { container } from 'tsyringe';

const proxyService = container.resolve(ContainerPortProxyService);

export default createHttpModule({
    basePath: '/api/container-port-proxy',
    routerOptions: { mergeParams: false },
    routes: (router) => {
        router.use('/:teamId/:containerId/:privatePort/*path', proxyService.proxyHttpRequest);
        router.use('/:teamId/:containerId/:privatePort', proxyService.proxyHttpRequest);
    }
});
