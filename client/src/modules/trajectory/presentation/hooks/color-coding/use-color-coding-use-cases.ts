import { useMemo } from 'react';
import { container } from 'tsyringe';
import { TRAJECTORY_TOKENS } from '../../../infrastructure/di/tokens';
import type IColorCodingRepository from '../../../domain/port/IColorCodingRepository';

const useColorCodingUseCases = () => {
    return useMemo(() => ({
        colorCodingRepository: container.resolve<IColorCodingRepository>(TRAJECTORY_TOKENS.ColorCodingRepository)
    }), []);
};

export default useColorCodingUseCases;
