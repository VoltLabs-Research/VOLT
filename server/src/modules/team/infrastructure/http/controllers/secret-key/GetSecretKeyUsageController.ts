import { createController } from '@shared/infrastructure/http/controllers/createController';
import { getSecretKeyUsageInputSchema } from '@modules/team/application/dtos/secret-key/GetSecretKeyUsageDTO';
import GetSecretKeyUsageUseCase from '@modules/team/application/use-cases/secret-key/GetSecretKeyUsageUseCase';

const GetSecretKeyUsageController = createController(GetSecretKeyUsageUseCase, {
    validationSchema: {
        params: getSecretKeyUsageInputSchema.pick({ teamId: true, secretKeyId: true }),
        query: getSecretKeyUsageInputSchema.pick({ days: true })
    }
});
export default GetSecretKeyUsageController;
