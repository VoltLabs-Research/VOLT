import { injectable, inject } from 'tsyringe';
import { BaseStreamController } from '@shared/infrastructure/http/BaseStreamController';
import GetTrajectoryGLBUseCase, { type GetTrajectoryGLBOutput } from '@modules/trajectory/application/use-cases/trajectory/GetTrajectoryGLBUseCase';

@injectable()
export default class GetTrajectoryGLBController extends BaseStreamController<GetTrajectoryGLBUseCase> {
    constructor(
        @inject(GetTrajectoryGLBUseCase)
        useCase: GetTrajectoryGLBUseCase
    ){
        super(useCase);
    }

    protected override getHeaders(resultValue: GetTrajectoryGLBOutput): Record<string, string> {
        return {
            'Content-Type': 'model/gltf-binary',
            'Content-Length': String(resultValue.size),
            'Content-Disposition': `attachment; filename="${resultValue.objectName}"`,
            'Cache-Control': 'public, max-age=31536000, immutable'
        };
    }
}
