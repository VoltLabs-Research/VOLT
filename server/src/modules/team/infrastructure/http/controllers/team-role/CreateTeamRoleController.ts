import { createController } from '@shared/infrastructure/http/controllers/createController';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { createTeamRoleInputSchema } from '@modules/team/application/dtos/team-role/CreateTeamRoleDTO';
import CreateTeamRoleUseCase from '@modules/team/application/use-cases/team-role/CreateTeamRoleUseCase';

const CreateTeamRoleController = createController(CreateTeamRoleUseCase, {
    statusCode: HttpStatus.Created,
    validationSchema: {
        params: createTeamRoleInputSchema.pick({ teamId: true }),
        body: createTeamRoleInputSchema.pick({ name: true, permissions: true, isSystem: true }),
        request: createTeamRoleInputSchema.pick({ userId: true })
    }
});

export default CreateTeamRoleController;
