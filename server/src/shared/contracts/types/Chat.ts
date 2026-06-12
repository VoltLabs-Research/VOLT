/**
 * Neutral, cross-module structural types for the Chat domain participant shape.
 * Extracted from `@modules/chat/domain/entities/chat/Chat` during the
 * detachable-modules migration so consumers (dashboard, …) reference the
 * participant union without importing `@modules/chat`. The entity file
 * re-exports every name below so existing importers compile unchanged.
 *
 * Pure structural types — no runtime footprint, no `@modules/*` import.
 */
export interface ChatIdentifierValue {
    toString(): string;
}

export interface ChatUserReference {
    _id?: ChatIdentifierValue;
    toString(): string;
}

export type ChatParticipant = string | ChatUserReference;
