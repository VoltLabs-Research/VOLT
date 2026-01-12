import { injectable } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import UpdateTeamByIdUseCase from '@/src/modules/team/application/use-cases/team/UpdateTeamByIdUseCase';

@injectable()
export default class UpdateTeamByIdController extends BaseController<UpdateTeamByIdUseCase>{
    constructor(
        useCase: UpdateTeamByIdUseCase
    ){
        super(useCase);
    }
};