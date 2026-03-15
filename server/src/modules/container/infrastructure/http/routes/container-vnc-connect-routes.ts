import controllers from '@modules/container/infrastructure/http/controllers';
import { ContainerVncGatewayService } from '@modules/container/infrastructure/services/ContainerVncGatewayService';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import express from 'express';
import path from 'node:path';
import { container } from 'tsyringe';

const vncGatewayService = container.resolve(ContainerVncGatewayService);
const noVncPackageRoot = path.dirname(require.resolve('@novnc/novnc/package.json'));

export default createHttpModule({
    basePath: '/api/container-vnc',
    routes: (router) => {
        router.get('/connect-client.js', (_req, res) => {
            res.setHeader('Cache-Control', 'no-store');
            res.type('application/javascript');
            res.send(vncGatewayService.getConnectClientScript());
        });
        router.use('/novnc', express.static(noVncPackageRoot));
        router.get('/:teamId/:containerId/connect', controllers.getVncConnectPage.handle);
    }
});
