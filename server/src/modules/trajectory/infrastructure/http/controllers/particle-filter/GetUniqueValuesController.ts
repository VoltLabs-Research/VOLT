import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { GetParticleFilterUniqueValuesUseCase } from '@modules/trajectory/application/use-cases/particle-filter/GetParticleFilterUniqueValuesUseCase';

@injectable()
export default class GetUniqueValuesController extends BaseController<GetParticleFilterUniqueValuesUseCase> {
    constructor(
        @inject(GetParticleFilterUniqueValuesUseCase) useCase: GetParticleFilterUniqueValuesUseCase
    ) {
        super(useCase);
    }
}
