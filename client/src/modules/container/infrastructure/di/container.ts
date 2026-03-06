import { container } from 'tsyringe';
import { CONTAINER_TOKENS } from './tokens';
import ContainerRepository from '../repositories/ContainerRepository';
import type IContainerRepository from '../../domain/port/IContainerRepository';

export const ensureContainerDI = (): void => {
    container.register<IContainerRepository>(
        CONTAINER_TOKENS.ContainerRepository,
        ContainerRepository
    );
};
