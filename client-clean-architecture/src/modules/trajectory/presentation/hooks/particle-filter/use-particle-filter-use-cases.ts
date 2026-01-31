import { useMemo } from 'react';
import { container } from 'tsyringe';
import type GetFilterPropertiesUseCase from '../../../application/use-cases/particle-filter/GetFilterPropertiesUseCase';
import type PreviewFilterUseCase from '../../../application/use-cases/particle-filter/PreviewFilterUseCase';
import type ApplyFilterUseCase from '../../../application/use-cases/particle-filter/ApplyFilterUseCase';
import type GetFilteredGlbUseCase from '../../../application/use-cases/particle-filter/GetFilteredGlbUseCase';
import { TRAJECTORY_TOKENS } from '../../../infrastructure/di/tokens';

const useParticleFilterUseCases = () => {
    return useMemo(() => ({
        getFilterPropertiesUseCase: container.resolve<GetFilterPropertiesUseCase>(TRAJECTORY_TOKENS.GetFilterPropertiesUseCase),
        previewFilterUseCase: container.resolve<PreviewFilterUseCase>(TRAJECTORY_TOKENS.PreviewFilterUseCase),
        applyFilterUseCase: container.resolve<ApplyFilterUseCase>(TRAJECTORY_TOKENS.ApplyFilterUseCase),
        getFilteredGlbUseCase: container.resolve<GetFilteredGlbUseCase>(TRAJECTORY_TOKENS.GetFilteredGlbUseCase)
    }), []);
};

export default useParticleFilterUseCases;
