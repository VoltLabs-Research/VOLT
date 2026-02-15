import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { PreviewParticleFilterUseCase } from '@modules/trajectory/application/use-cases/particle-filter/PreviewParticleFilterUseCase';

@injectable()
export default class PreviewParticleFilterController extends BaseController<PreviewParticleFilterUseCase> {
    constructor(
        @inject(PreviewParticleFilterUseCase) useCase: PreviewParticleFilterUseCase
    ) {
        super(useCase);
    }
}
