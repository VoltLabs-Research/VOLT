
export interface ChatIdentifierValue {
    toString(): string;
}

export interface ChatUserReference {
    _id?: ChatIdentifierValue;
    toString(): string;
}

export type ChatParticipant = string | ChatUserReference;
