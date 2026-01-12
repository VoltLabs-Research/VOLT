import { injectable } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import FindActivityByTeamIdUseCase from '../../../application/use-cases/FindActivityByTeamIdUseCase';

@injectable()
export default class FindActivityByTeamIdController extends BaseController<FindActivityByTeamIdUseCase>{
    constructor(
        useCase: FindActivityByTeamIdUseCase
    ){
        super(useCase);
    }
};