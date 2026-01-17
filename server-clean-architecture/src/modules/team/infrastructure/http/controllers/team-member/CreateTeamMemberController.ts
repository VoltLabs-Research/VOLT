import { injectable, inject } from "tsyringe";
import { BaseController } from "@/src/shared/infrastructure/http/BaseController";
import { HttpStatus } from "@/src/shared/infrastructure/http/HttpStatus";
import CreateTeamMemberUseCase from "@/src/modules/team/application/use-cases/team-member/CreateTeamMemberUseCase";

@injectable()
export default class CreateTeamMemberController extends BaseController<CreateTeamMemberUseCase> {
    constructor(
        @inject(CreateTeamMemberUseCase) useCase: CreateTeamMemberUseCase
    ) {
        super(useCase, HttpStatus.Created);
    }
};