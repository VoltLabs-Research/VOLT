import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { HttpStatus } from '@shared/infrastructure/http/HttpStatus';
import { DeleteAccountInputDTO } from '@modules/auth/application/dtos/DeleteAccountDTO';
import DeleteAccountUseCase from '@modules/auth/application/use-cases/DeleteAccountUseCase';

@injectable()
export default class DeleteMyAccountController extends BaseController<DeleteAccountUseCase> {
    constructor(
        @inject(DeleteAccountUseCase) useCase: DeleteAccountUseCase
    ) {
        super(useCase, HttpStatus.Deleted);
    }
};