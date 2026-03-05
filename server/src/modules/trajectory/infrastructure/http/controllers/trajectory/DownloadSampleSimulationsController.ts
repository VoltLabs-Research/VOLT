import { injectable, inject } from 'tsyringe';
import { BaseStreamController } from '@shared/infrastructure/http/BaseStreamController';
import DownloadSampleSimulationsUseCase from '@modules/trajectory/application/use-cases/trajectory/DownloadSampleSimulationsUseCase';
import type { DownloadSampleSimulationsOutputDTO } from '@modules/trajectory/application/dtos/trajectory/DownloadSampleSimulationsDTO';

@injectable()
export default class DownloadSampleSimulationsController extends BaseStreamController<DownloadSampleSimulationsUseCase> {
    constructor(
        @inject(DownloadSampleSimulationsUseCase)
        useCase: DownloadSampleSimulationsUseCase
    ) {
        super(useCase);
    }

    protected override getHeaders(resultValue: DownloadSampleSimulationsOutputDTO): Record<string, string> {
        return {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="${resultValue.filename}"`
        };
    }
}
