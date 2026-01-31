import { createUseCasesHook } from '@/shared/presentation/hooks/create-use-cases-hook';
import { TRAJECTORY_TOKENS } from '../../../infrastructure/di/tokens';
import type GetFilterPropertiesUseCase from '../../../application/use-cases/particle-filter/GetFilterPropertiesUseCase';
import type PreviewFilterUseCase from '../../../application/use-cases/particle-filter/PreviewFilterUseCase';
import type ApplyFilterUseCase from '../../../application/use-cases/particle-filter/ApplyFilterUseCase';
import type GetFilteredGlbUseCase from '../../../application/use-cases/particle-filter/GetFilteredGlbUseCase';

const useParticleFilterUseCases = createUseCasesHook({
    getFilterPropertiesUseCase: TRAJECTORY_TOKENS.GetFilterPropertiesUseCase,
    previewFilterUseCase: TRAJECTORY_TOKENS.PreviewFilterUseCase,
    applyFilterUseCase: TRAJECTORY_TOKENS.ApplyFilterUseCase,
    getFilteredGlbUseCase: TRAJECTORY_TOKENS.GetFilteredGlbUseCase
}) as () => {
    getFilterPropertiesUseCase: GetFilterPropertiesUseCase;
    previewFilterUseCase: PreviewFilterUseCase;
    applyFilterUseCase: ApplyFilterUseCase;
    getFilteredGlbUseCase: GetFilteredGlbUseCase;
};

export default useParticleFilterUseCases;
