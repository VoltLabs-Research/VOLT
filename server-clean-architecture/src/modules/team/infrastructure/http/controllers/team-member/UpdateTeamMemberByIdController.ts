import { injectable } from "tsyringe";
import { BaseController } from "@/src/shared/infrastructure/http/BaseController";
import UpdateTeamMemberByIdUseCase from "@/src/modules/team/application/use-cases/team-member/UpdateTeamMemberByIdUseCase";

@injectable()
export default class UpdateTeamMemberByIdController extends BaseController<UpdateTeamMemberByIdUseCase>{
    constructor(
        useCase: UpdateTeamMemberByIdUseCase
    ){
        super(useCase);
    }
};