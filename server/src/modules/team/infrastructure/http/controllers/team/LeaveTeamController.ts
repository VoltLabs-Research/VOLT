import { injectable, inject } from 'tsyringe';
import LeaveTeamUseCase from '@modules/team/application/use-cases/team/LeaveTeamUseCase';
import { BaseController } from '@shared/infrastructure/http/BaseController';

@injectable()
export default class LeaveTeamController extends BaseController<LeaveTeamUseCase> {
    constructor(
        @inject(LeaveTeamUseCase)
        useCase: LeaveTeamUseCase
    ) {
        super(useCase);
    }
};