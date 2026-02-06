import { injectable, inject, delay } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { UpdateGroupAdminsUseCase } from '@modules/chat/application/use-cases/chat/UpdateGroupAdminsUseCase';

@injectable()
export default class UpdateGroupAdminsController extends BaseController<UpdateGroupAdminsUseCase> {
    constructor(
        @inject(delay(() => UpdateGroupAdminsUseCase))
        useCase: UpdateGroupAdminsUseCase
    ) {
        super(useCase);
    }
};