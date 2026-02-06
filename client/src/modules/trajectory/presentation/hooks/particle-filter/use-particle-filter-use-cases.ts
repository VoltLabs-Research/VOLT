import { useMemo } from 'react';
import { container } from 'tsyringe';
import { TRAJECTORY_TOKENS } from '../../../infrastructure/di/tokens';
import type IParticleFilterRepository from '../../../domain/ports/IParticleFilterRepository';

const useParticleFilterUseCases = () => {
    return useMemo(() => ({
        particleFilterRepository: container.resolve<IParticleFilterRepository>(TRAJECTORY_TOKENS.ParticleFilterRepository)
    }), []);
};

export default useParticleFilterUseCases;
