import { injectable, inject } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import { HttpStatus } from '@/src/shared/infrastructure/http/HttpStatus';
import { DeleteAccountInputDTO } from '../../../application/dtos/DeleteAccountDTO';
import DeleteAccountUseCase from '../../../application/use-cases/DeleteAccountUseCase';

@injectable()
export default class DeleteMyAccountController extends BaseController<DeleteAccountUseCase> {
    constructor(
        @inject(DeleteAccountUseCase) useCase: DeleteAccountUseCase
    ) {
        super(useCase, HttpStatus.Deleted);
    }
};