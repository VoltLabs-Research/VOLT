import { injectable } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import ListUserTeamsUseCase from '@/src/modules/team/application/use-cases/team/ListUserTeamsUseCase';

@injectable()
export default class ListUserTeamsController extends BaseController<ListUserTeamsUseCase>{
    constructor(
        useCase: ListUserTeamsUseCase
    ){
        super(useCase);
    }
};