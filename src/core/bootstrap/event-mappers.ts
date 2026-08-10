import type { EventMapperSet } from '@shared/infrastructure/events/event-mapper-registry';
import { registerRuntimeEventMappers } from '@shared/infrastructure/events/register-runtime-event-mappers';
import { registerAnalysisEventMappers } from '@modules/analysis/events/register-analysis-event-mappers';
import { registerContainerEventMappers } from '@modules/container/events/register-container-event-mappers';
import { registerPluginEventMappers } from '@modules/plugin/events/register-plugin-event-mappers';
import { registerTrajectoryEventMappers } from '@modules/trajectory/events/register-trajectory-event-mappers';

/**
 * Every domain-event mapper set the daemon mounts, named.
 *
 * Sets used to enter a module-level array as a side effect of being imported,
 * which worked only because the daemon imported all 233 files under `shared/` and
 * `modules/` at boot. Removing that autoloader left nothing importing these five
 * files, so the bridge mounted zero of them: jobs ran to completion but never
 * reported it, and the control plane's projection held every job at `queued`
 * indefinitely — which reads in the UI as a queue that has stopped moving.
 *
 * Adding a set is now two lines — the file, and its name here.
 */
export const EVENT_MAPPER_SETS: readonly EventMapperSet[] = [
    registerRuntimeEventMappers,
    registerAnalysisEventMappers,
    registerContainerEventMappers,
    registerPluginEventMappers,
    registerTrajectoryEventMappers
];
