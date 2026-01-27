import type { IAnalysisRepository } from '../../domain/repositories/IAnalysisRepository';

export class DeleteAnalysisConfigUseCase {
    constructor(private readonly analysisRepository: IAnalysisRepository) {}

    async execute(id: string): Promise<void> {
        await this.analysisRepository.deleteConfig(id);
    }
}
