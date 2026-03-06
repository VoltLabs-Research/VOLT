import { container } from 'tsyringe';
import { SYSTEM_TOKENS } from './tokens';
import SystemRepository from '../repositories/SystemRepository';
import type ISystemRepository from '../../domain/port/ISystemRepository';

export const ensureSystemDI = (): void => {
    container.register<ISystemRepository>(
        SYSTEM_TOKENS.SystemRepository,
        SystemRepository
    );
};
