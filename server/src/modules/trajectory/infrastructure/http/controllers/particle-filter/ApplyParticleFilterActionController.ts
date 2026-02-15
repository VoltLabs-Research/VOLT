import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { ApplyParticleFilterActionUseCase } from '@modules/trajectory/application/use-cases/particle-filter/ApplyParticleFilterActionUseCase';

@injectable()
export default class ApplyParticleFilterActionController extends BaseController<ApplyParticleFilterActionUseCase> {
    constructor(
        @inject(ApplyParticleFilterActionUseCase) useCase: ApplyParticleFilterActionUseCase
    ) {
        super(useCase);
    }
}
