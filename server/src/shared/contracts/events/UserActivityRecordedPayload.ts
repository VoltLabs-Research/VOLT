/**
 * Neutral payload contract for the `user-activity.recorded` domain event.
 *
 * Published by the team module's presence socket on heartbeat/disconnect flushes
 * and consumed by the daily-activity module, which owns the persistence of online
 * minutes. Hosting the payload TYPE here lets the emitter (team) publish a
 * `GenericDomainEvent` without importing `@modules/daily-activity` and lets the
 * consumer subscribe without importing the emitter. Pure type — no runtime
 * footprint.
 */
export interface UserActivityRecordedPayload {
    teamId: string;
    userId: string;
    minutes: number;
}
