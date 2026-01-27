import type { IRasterRepository } from '../../domain/repositories/IRasterRepository';

export class GenerateRasterUseCase {
    constructor(private readonly rasterRepository: IRasterRepository) {}

    async execute(id: string): Promise<any> {
        return this.rasterRepository.generateGLB(id);
    }
}
