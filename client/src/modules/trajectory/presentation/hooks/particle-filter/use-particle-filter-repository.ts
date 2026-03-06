import useResolve from '@/shared/presentation/hooks/use-resolve';
import { TRAJECTORY_TOKENS } from '../../../infrastructure/di/tokens';
import type IParticleFilterRepository from '../../../domain/port/IParticleFilterRepository';

const useParticleFilterUseCases = () => {
    return {
        particleFilterRepository: useResolve<IParticleFilterRepository>(TRAJECTORY_TOKENS.ParticleFilterRepository)
    };
};

export default useParticleFilterUseCases;
