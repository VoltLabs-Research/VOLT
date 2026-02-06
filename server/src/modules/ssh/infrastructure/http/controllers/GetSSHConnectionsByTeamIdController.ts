import { injectable, inject, delay } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { GetSSHConnectionsByTeamIdUseCase } from '@modules/ssh/application/use-cases/GetSSHConnectionsByTeamIdUseCase';

@injectable()
export default class GetSSHConnectionsByTeamIdController extends BaseController<GetSSHConnectionsByTeamIdUseCase> {
    constructor(
        @inject(delay(() => GetSSHConnectionsByTeamIdUseCase)) useCase: GetSSHConnectionsByTeamIdUseCase
    ) {
        super(useCase);
    }
};