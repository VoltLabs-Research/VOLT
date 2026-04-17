export type RuntimeProgressMessageStage = 'accepted' | 'queued' | 'running' | 'completed' | 'failed';

export type RuntimeProgressMessageValue =
    | string
    | number
    | boolean
    | null
    | RuntimeProgressMessageArray
    | RuntimeProgressMessageObject;

export interface RuntimeProgressMessageObject {
    [key: string]: RuntimeProgressMessageValue;
}

export type RuntimeProgressMessageArray = RuntimeProgressMessageValue[];

export interface RuntimeProgressMessagePayload {
    action: string;
    payload?: RuntimeProgressMessageObject;
    stage: RuntimeProgressMessageStage;
    timestamp: string;
}

export interface RuntimeProgressMessage extends RuntimeProgressMessagePayload {
    type: 'runtime-progress';
}

export const createRuntimeProgressMessage = (payload: RuntimeProgressMessagePayload): RuntimeProgressMessage => ({
    type: 'runtime-progress',
    ...payload
});
