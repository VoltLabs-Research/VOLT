import { injectable } from "tsyringe";
import { BaseController } from "@/src/shared/infrastructure/http/BaseController";
import { HttpStatus } from "@/src/shared/infrastructure/http/HttpStatus";
import DeleteTeamMemberByIdUseCase from "@/src/modules/team/application/use-cases/team-member/DeleteTeamMemberByIdUseCase";

@injectable()
export default class DeleteTeamMemberByIdController extends BaseController<DeleteTeamMemberByIdUseCase>{
    constructor(
        useCase: DeleteTeamMemberByIdUseCase
    ){
        super(useCase, HttpStatus.Deleted);
    }
};