import { Service } from '@/core/decorators/service';

@Service('filterEvaluator')
export class FilterEvaluator {
    previewFilter(_payload: unknown): Promise<never> {
        return Promise.reject(new Error('FilterEvaluator.previewFilter is not implemented'));
    }

    exportColoredModel(_payload: unknown): Promise<never> {
        return Promise.reject(new Error('FilterEvaluator.exportColoredModel is not implemented'));
    }

    exportParticleFilterModel(_payload: unknown): Promise<never> {
        return Promise.reject(new Error('FilterEvaluator.exportParticleFilterModel is not implemented'));
    }
}
