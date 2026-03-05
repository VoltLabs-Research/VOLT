import { injectable, inject } from 'tsyringe';
import { BaseStreamController } from '@shared/infrastructure/http/BaseStreamController';
import GetTrajectoryGLBUseCase from '@modules/trajectory/application/use-cases/trajectory/GetTrajectoryGLBUseCase';
import type { GetTrajectoryGLBOutputDTO } from '@modules/trajectory/application/dtos/trajectory/GetTrajectoryGLBDTO';

@injectable()
export default class GetTrajectoryGLBController extends BaseStreamController<GetTrajectoryGLBUseCase> {
    constructor(
        @inject(GetTrajectoryGLBUseCase)
        useCase: GetTrajectoryGLBUseCase
    ){
        super(useCase);
    }

    protected override getHeaders(resultValue: GetTrajectoryGLBOutputDTO): Record<string, string> {
        return {
            'Content-Type': 'model/gltf-binary',
            'Content-Length': String(resultValue.size),
            'Content-Disposition': `attachment; filename="${resultValue.objectName}"`,
            'Cache-Control': 'public, max-age=31536000, immutable'
        };
    }
}
