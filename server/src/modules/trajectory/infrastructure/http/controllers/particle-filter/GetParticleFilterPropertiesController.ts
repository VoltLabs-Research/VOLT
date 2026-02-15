import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { GetParticleFilterPropertiesUseCase } from '@modules/trajectory/application/use-cases/particle-filter/GetParticleFilterPropertiesUseCase';

@injectable()
export default class GetParticleFilterPropertiesController extends BaseController<GetParticleFilterPropertiesUseCase> {
    constructor(
        @inject(GetParticleFilterPropertiesUseCase) useCase: GetParticleFilterPropertiesUseCase
    ) {
        super(useCase);
    }
}
