import { container } from 'tsyringe';
import { DAILY_ACTIVITY_TOKENS } from './tokens';
import DailyActivityRepository from '../repositories/DailyActivityRepository';
import type IDailyActivityRepository from '../../domain/port/IDailyActivityRepository';

export const ensureDailyActivityDI = (): void => {
    container.register<IDailyActivityRepository>(
        DAILY_ACTIVITY_TOKENS.DailyActivityRepository,
        DailyActivityRepository
    );
};
