import type { DomainEventBridge } from '@shared/infrastructure/events/DomainEventBridge';

/** Binds a module's domain events to the frames the control plane receives. */
export type EventMapperSet = (bridge: DomainEventBridge) => void;
