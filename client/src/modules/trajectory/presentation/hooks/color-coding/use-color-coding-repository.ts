import useResolve from '@/shared/presentation/hooks/use-resolve';
import { TRAJECTORY_TOKENS } from '../../../infrastructure/di/tokens';
import type IColorCodingRepository from '../../../domain/port/IColorCodingRepository';

const useColorCodingUseCases = () => {
    return {
        colorCodingRepository: useResolve<IColorCodingRepository>(TRAJECTORY_TOKENS.ColorCodingRepository)
    };
};

export default useColorCodingUseCases;
