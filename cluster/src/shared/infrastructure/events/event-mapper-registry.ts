import type { DomainEventBridge } from '@shared/infrastructure/events/DomainEventBridge';

export type EventMapperSet = (bridge: DomainEventBridge) => void;
