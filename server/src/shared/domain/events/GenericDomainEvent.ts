import { BaseDomainEvent } from './BaseDomainEvent';

/**
 * Neutral, generic domain event for CROSS-MODULE emission.
 *
 * A module sometimes needs to publish an event that another module OWNS (e.g.
 * the cluster daemon completing a job publishes `job.status.changed`, owned by
 * the jobs module). Constructing the owner's concrete event class would couple
 * the emitter to `@modules/<owner>`. Instead, publish a `GenericDomainEvent`
 * with the neutral name constant (`DOMAIN_EVENTS.*`) and the neutral payload
 * type (`@shared/contracts/events/*Payload`):
 *
 * ```ts
 * await eventBus.publish(
 *   new GenericDomainEvent(DOMAIN_EVENTS.JobStatusChanged, payload)
 * );
 * ```
 *
 * The bus dispatches by `name` (string), so subscribers — including the owner
 * module's `subscribeHandler('job.status.changed', ...)` registrations — receive it
 * identically to the owner-constructed class. Runtime behaviour is unchanged; only
 * the static import of the owner's event class is removed.
 */
export class GenericDomainEvent<T> extends BaseDomainEvent<T> {
    constructor(name: string, payload: T) {
        super(name, payload);
    }
}
