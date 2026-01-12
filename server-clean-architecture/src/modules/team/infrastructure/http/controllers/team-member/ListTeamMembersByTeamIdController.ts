import { injectable } from "tsyringe";
import { BaseController } from "@/src/shared/infrastructure/http/BaseController";
import ListTeamMembersByTeamIdUseCase from "@/src/modules/team/application/use-cases/team-member/ListTeamMembersByTeamIdUseCase";

@injectable()
export default class ListTeamMembersByTeamIdController extends BaseController<ListTeamMembersByTeamIdUseCase>{
    constructor(
        useCase: ListTeamMembersByTeamIdUseCase
    ){
        super(useCase);
    }
};