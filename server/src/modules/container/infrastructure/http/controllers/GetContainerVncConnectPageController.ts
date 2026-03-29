import { GetContainerVncConnectPageUseCase } from '@modules/container/application/use-cases/GetContainerVncConnectPageUseCase';
import { containerValidation } from '@modules/container/infrastructure/http/validation/container-schemas';
import { createController } from '@shared/infrastructure/http/controllers/createController';

export default createController(GetContainerVncConnectPageUseCase, {
    validationSchema: containerValidation.getVncConnectPage,
    handleSuccess: (_req, res, value) => {
        res.removeHeader('X-Frame-Options');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Content-Security-Policy', value.contentSecurityPolicy);
        res.send(value.html);
    }
});
