import { createController } from '@shared/infrastructure/http/controllers/createController';
import { getSecretKeyTeamMetricsInputSchema } from '@modules/team/application/dtos/secret-key/GetSecretKeyTeamMetricsDTO';
import GetSecretKeyTeamMetricsUseCase from '@modules/team/application/use-cases/secret-key/GetSecretKeyTeamMetricsUseCase';

const GetSecretKeyTeamMetricsController = createController(GetSecretKeyTeamMetricsUseCase, {
    validationSchema: {
        params: getSecretKeyTeamMetricsInputSchema.pick({ teamId: true }),
        query: getSecretKeyTeamMetricsInputSchema.pick({ days: true })
    }
});
export default GetSecretKeyTeamMetricsController;
