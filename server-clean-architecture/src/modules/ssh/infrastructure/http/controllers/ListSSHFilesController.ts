import { injectable, inject } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import ListSSHFilesUseCase from '../../../application/use-cases/ListSSHFilesUseCase';
import { AuthenticatedRequest } from '@/src/shared/infrastructure/http/middleware/authentication';

@injectable()
export default class ListSSHFilesController extends BaseController<ListSSHFilesUseCase> {
    constructor(
        @inject(ListSSHFilesUseCase)
        useCase: ListSSHFilesUseCase
    ) {
        super(useCase);
    }

    protected getParams(req: AuthenticatedRequest): any {
        return {
            sshConnectionId: req.query.connectionId as string,
            path: req.query.path as string
        };
    }
}
