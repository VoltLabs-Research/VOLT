import type { DomainEventBridge } from '@shared/infrastructure/events/DomainEventBridge';

/** Binds a module's domain events to the frames the control plane receives. */
export type EventMapperSet = (bridge: DomainEventBridge) => void;

const registered: EventMapperSet[] = [];

/**
 * Declares a mapper set, returning it so the declaration itself registers.
 *
 * Wrapping the declaration rather than calling this on a following line is
 * deliberate: a set that is written but never registered is silently inert, and
 * the failure looks like a missing event rather than missing wiring.
 */
export const registerEventMapperSet = (set: EventMapperSet): EventMapperSet => {
    registered.push(set);
    return set;
};

/**
 * Every mapper set the process has loaded.
 *
 * The daemon imports every file under `modules/` before it builds the bridge, so
 * this is complete by the time the bootstrap reads it — and the bootstrap names
 * no module.
 */
export const getRegisteredEventMapperSets = (): readonly EventMapperSet[] => registered;
