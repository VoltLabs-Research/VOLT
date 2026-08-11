import logger from '@shared/infrastructure/logger';
import { Client } from 'pg';
import { v4 } from 'uuid';
import DomainEventSpoolEntry from '@shared/infrastructure/persistence/models/DomainEventSpoolEntry';
import type { EventName } from '@shared/events/EventGroup';
import type { IDomainEvent } from '@shared/domain/events/IDomainEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';

/**
 * One channel carries every event, with the name inside the envelope.
 *
 * Per-event channels would mean quoting names like `secret-key.deleted` into
 * Postgres identifiers and issuing a fresh LISTEN whenever a handler registers.
 * A single channel costs a name check on events nobody handles — negligible at
 * these volumes — and buys a listener whose subscription set never changes.
 */
const CHANNEL = 'volt_domain_events';

/**
 * NOTIFY payloads are capped at 8000 bytes and exceeding it raises at emit time.
 * Anything near the ceiling is parked in a table and announced by reference, so
 * a large event degrades to an extra round trip instead of an error.
 */
const INLINE_PAYLOAD_LIMIT_BYTES = 6_000;

const RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

interface EventEnvelope {
    name: string;
    eventId: string;
    occurredOn: string;
    /** Present when the payload was parked; the body is then read from the spool. */
    spoolId?: string;
    payload?: unknown;
}

const isPostgresUrl = (url: string | undefined): boolean =>
    Boolean(url) && !url!.startsWith('sqlite:');

/**
 * Domain event bus over Postgres LISTEN/NOTIFY.
 *
 * The listener holds its own connection rather than borrowing from the pool: a
 * LISTEN is a property of one session, so a pooled connection would stop
 * delivering the moment it was recycled.
 *
 * When the configured database is not Postgres the bus dispatches in-process
 * instead. That is the correct behaviour for a single-process deployment, not a
 * degraded one — cross-process fan-out is the only thing NOTIFY was providing.
 */
class PostgresEventBus {
    private readonly handlers = new Map<string, IEventHandler<IDomainEvent>[]>();
    private listener: Client | null = null;
    private listenerReady: Promise<void> | null = null;
    private reconnectDelayMs = RECONNECT_DELAY_MS;
    private stopped = false;

    private get distributed(): boolean {
        return isPostgresUrl(process.env.DATABASE_URL);
    }

    async emit<K extends EventName>(name: K, payload: EventMap[K]): Promise<void> {
        const event: IDomainEvent<EventMap[K]> = {
            name,
            payload,
            eventId: v4(),
            occurredOn: new Date()
        };

        if (!this.distributed) {
            await this.dispatch(event);
            return;
        }

        const inline: EventEnvelope = {
            name,
            eventId: event.eventId,
            occurredOn: event.occurredOn.toISOString(),
            payload
        };

        let serialized = JSON.stringify(inline);
        if (Buffer.byteLength(serialized, 'utf8') > INLINE_PAYLOAD_LIMIT_BYTES) {
            /* An opaque `jsonb` column does not survive TypeORM's deep-partial
               mapping of the insert literal, so the shape is asserted here. */
            await DomainEventSpoolEntry.getRepository().insert({
                id: event.eventId,
                name,
                payload: payload as Record<string, unknown>
            } as never);

            serialized = JSON.stringify({
                name,
                eventId: event.eventId,
                occurredOn: inline.occurredOn,
                spoolId: event.eventId
            } satisfies EventEnvelope);
        }

        /*
         * pg_notify rather than a NOTIFY statement: the channel and payload bind
         * as parameters, so neither needs escaping into the statement text.
         */
        await DomainEventSpoolEntry.getRepository().manager.query(
            'SELECT pg_notify($1, $2)',
            [CHANNEL, serialized]
        );
    }

    async subscribe<T extends IDomainEvent>(eventName: string, handler: IEventHandler<T>): Promise<void> {
        const existing = this.handlers.get(eventName);
        if (existing) {
            existing.push(handler as unknown as IEventHandler<IDomainEvent>);
        } else {
            this.handlers.set(eventName, [handler as unknown as IEventHandler<IDomainEvent>]);
        }

        logger.info(`@event-bus: ${handler.label ?? handler.constructor.name} registered for ${eventName}`);

        /*
         * Awaited so a handler registered during bootstrap cannot miss an event
         * emitted immediately afterwards.
         */
        if (this.distributed) {
            await this.ensureListener();
        }
    }

    async close(): Promise<void> {
        this.stopped = true;
        const listener = this.listener;
        this.listener = null;
        this.listenerReady = null;

        if (listener) {
            await listener.end().catch(() => undefined);
        }
    }

    private ensureListener(): Promise<void> {
        if (!this.listenerReady) {
            this.listenerReady = this.openListener();
        }

        return this.listenerReady;
    }

    private async openListener(): Promise<void> {
        const client = new Client({
            connectionString: process.env.DATABASE_URL,
            application_name: 'volt-event-bus'
        });

        client.on('notification', (message) => {
            if (message.channel !== CHANNEL || !message.payload) return;
            void this.receive(message.payload);
        });

        /*
         * A dropped listener is silent — no error surfaces at the emit side — so
         * reconnection is driven from here rather than left to the next publish.
         */
        client.on('error', (error: Error) => {
            logger.error(`@event-bus: listener connection failed: ${error.message}`);
            this.scheduleReconnect();
        });

        client.on('end', () => {
            if (!this.stopped) this.scheduleReconnect();
        });

        await client.connect();
        await client.query(`LISTEN ${CHANNEL}`);

        this.listener = client;
        this.reconnectDelayMs = RECONNECT_DELAY_MS;
        logger.info(`@event-bus: listening on ${CHANNEL}`);
    }

    private scheduleReconnect(): void {
        if (this.stopped || this.listenerReady === null) return;

        this.listener = null;
        this.listenerReady = null;

        const delay = this.reconnectDelayMs;
        this.reconnectDelayMs = Math.min(delay * 2, MAX_RECONNECT_DELAY_MS);

        setTimeout(() => {
            if (this.stopped) return;

            this.ensureListener().catch((error: Error) => {
                logger.error(`@event-bus: listener reconnect failed: ${error.message}`);
            });
        }, delay).unref();
    }

    private async receive(raw: string): Promise<void> {
        let envelope: EventEnvelope;
        try {
            envelope = JSON.parse(raw) as EventEnvelope;
        } catch (error) {
            logger.error(`@event-bus: unparseable notification: ${error}`);
            return;
        }

        /* Nothing here handles it, so the parked body can go without being read. */
        if (!this.handlers.has(envelope.name)) {
            if (envelope.spoolId) {
                await DomainEventSpoolEntry.delete({ id: envelope.spoolId }).catch(() => undefined);
            }

            return;
        }

        let payload = envelope.payload;
        if (envelope.spoolId) {
            const spooled = await DomainEventSpoolEntry.findOneBy({ id: envelope.spoolId });
            if (!spooled) {
                logger.error(`@event-bus: spooled payload ${envelope.spoolId} for ${envelope.name} is gone`);
                return;
            }

            payload = spooled.payload;
            await DomainEventSpoolEntry.delete({ id: envelope.spoolId }).catch(() => undefined);
        }

        await this.dispatch({
            name: envelope.name,
            payload,
            eventId: envelope.eventId,
            occurredOn: new Date(envelope.occurredOn)
        } as IDomainEvent);
    }

    private async dispatch(event: IDomainEvent): Promise<void> {
        const handlers = this.handlers.get(event.name);
        if (!handlers || handlers.length === 0) return;

        /* Snapshot: a handler may register another while this batch is running. */
        const snapshot = handlers.slice();
        const results = await Promise.allSettled(snapshot.map((handler) => handler.handle(event)));

        results.forEach((result, index) => {
            if (result.status !== 'rejected') return;

            const handler = snapshot[index];
            logger.error(
                result.reason,
                `@event-bus: ${handler.label ?? handler.constructor.name} for "${event.name}" rejected`
            );
        });
    }
}

export default new PostgresEventBus();
