/**
 * Maps every domain event name to its payload type.
 *
 * Each module augments this from `modules/<module>/events/events.d.ts`, declaring
 * only the events it emits. Because the interface is global, any module can
 * subscribe to any event with `@Event('name')` and get the payload typed for
 * free — and a name that nothing emits is a compile error rather than a handler
 * that silently never fires.
 */
interface EventMap {}
