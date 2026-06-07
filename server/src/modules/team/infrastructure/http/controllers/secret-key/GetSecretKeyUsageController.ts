import { createController } from '@shared/infrastructure/http/controllers/createController';
import GetSecretKeyUsageUseCase from '@modules/team/application/use-cases/secret-key/GetSecretKeyUsageUseCase';

const GetSecretKeyUsageController = createController(GetSecretKeyUsageUseCase, {
});
export default GetSecretKeyUsageController;
