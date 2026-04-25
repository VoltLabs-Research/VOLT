import { AuthenticationType } from '@shared/infrastructure/http/middleware/authentication';
import { GetPublicCanvasAtomsUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasAtomsUseCase';
import { createAtomsBinaryController } from '@modules/trajectory/infrastructure/http/controllers/atoms-binary-controller';

export default createAtomsBinaryController(GetPublicCanvasAtomsUseCase, {
    extendInput: (req, input) => ({
        ...input,
        userId: req.authType === AuthenticationType.User ? req.userId : undefined
    })
});
