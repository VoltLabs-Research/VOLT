import type { EventMapperSet } from '@shared/infrastructure/events/event-mapper-registry';
import { registerRuntimeEventMappers } from '@shared/infrastructure/events/register-runtime-event-mappers';
import { registerAnalysisEventMappers } from '@modules/analysis/events/register-analysis-event-mappers';
import { registerContainerEventMappers } from '@modules/container/events/register-container-event-mappers';
import { registerPluginEventMappers } from '@modules/plugin/events/register-plugin-event-mappers';
import { registerTrajectoryEventMappers } from '@modules/trajectory/events/register-trajectory-event-mappers';

export const EVENT_MAPPER_SETS: readonly EventMapperSet[] = [
    registerRuntimeEventMappers,
    registerAnalysisEventMappers,
    registerContainerEventMappers,
    registerPluginEventMappers,
    registerTrajectoryEventMappers
];
