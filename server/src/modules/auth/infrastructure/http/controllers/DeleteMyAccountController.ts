import { createController } from '@shared/infrastructure/http/controllers/createController';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import DeleteAccountUseCase from '@modules/auth/application/use-cases/DeleteAccountUseCase';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';

export default createController(DeleteAccountUseCase, {
    statusCode: HttpStatus.NoContent,
    extendParams: (req: AuthenticatedRequest, params: Record<string, unknown>) => ({
        ...params,
        userId: req.userId
    })
});
