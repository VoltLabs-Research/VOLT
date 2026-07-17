/**
 * Columns every persisted document exposes on the wire. VOLT serializes Mongo
 * `_id` to a string and Dates to ISO strings, so all three are strings here.
 */
export interface PersistedBase{
    _id: string;
    createdAt: string;
    updatedAt: string;
}
