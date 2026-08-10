import type { DomainEventBridge } from '@shared/infrastructure/events/DomainEventBridge';

/** Binds a module's domain events to the frames the control plane receives. */
export type EventMapperSet = (bridge: DomainEventBridge) => void;

/**
 * Declares a mapper set.
 *
 * This used to push into a module-level array, so a set joined the bridge as a
 * side effect of its file being imported — and the only thing importing those
 * files was an autoloader that walked `shared/` and `modules/` at boot. When the
 * autoloader went away the array was empty, and the daemon came up reporting
 * `mounted 0 event mapper sets`: work still ran, but no job ever reported its
 * status, so the control plane's projection left every job sitting at `queued`.
 *
 * Returning the set without registering it makes the wiring a reference.
 * `EVENT_MAPPER_SETS` in `@core/bootstrap/event-mappers` names all of them, so a
 * set left out of that list reads as dead code rather than as an event that
 * silently stops arriving.
 */
export const defineEventMapperSet = (set: EventMapperSet): EventMapperSet => set;
