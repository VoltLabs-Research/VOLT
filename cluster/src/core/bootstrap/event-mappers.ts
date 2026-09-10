import type { EventMapperSet } from '@shared/events/DomainEventBridge';
import { registerRuntimeEventMappers } from '@shared/events/register-runtime-event-mappers';
import { registerAnalysisEventMappers } from '@modules/analysis/events/register-analysis-event-mappers';
import { registerExposureEventMappers } from '@modules/system/events/register-exposure-event-mappers';
import { registerPluginEventMappers } from '@modules/plugin/events/register-plugin-event-mappers';
import { registerTrajectoryEventMappers } from '@modules/trajectory/events/register-trajectory-event-mappers';

export const EVENT_MAPPER_SETS: readonly EventMapperSet[] = [
    registerRuntimeEventMappers,
    registerAnalysisEventMappers,
    registerExposureEventMappers,
    registerPluginEventMappers,
    registerTrajectoryEventMappers
];
