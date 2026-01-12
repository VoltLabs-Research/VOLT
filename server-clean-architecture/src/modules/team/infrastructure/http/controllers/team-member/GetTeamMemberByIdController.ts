import { injectable } from "tsyringe";
import { BaseController } from "@/src/shared/infrastructure/http/BaseController";
import GetTeamMemberByIdUseCase from "@/src/modules/team/application/use-cases/team-member/GetTeamMemberByIdUseCase";

@injectable()
export default class GetTeamMemberByIdController extends BaseController<GetTeamMemberByIdUseCase>{
    constructor(
        useCase: GetTeamMemberByIdUseCase
    ){
        super(useCase);
    }
};