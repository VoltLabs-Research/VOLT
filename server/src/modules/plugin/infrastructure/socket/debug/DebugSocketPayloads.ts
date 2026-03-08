import type { ErrorCode } from '@core/constants/error-codes';

export interface DebugStartPayload {
    pluginId: string;
    trajectoryId: string;
    timestep: number;
    config: Record<string, unknown>;
};

export interface DebugSocketErrorPayload {
    sessionId?: string;
    error: string;
    code: ErrorCode;
    message: ErrorCode;
    details?: string;
};

export interface DebugNodeErrorPayload {
    sessionId: string;
    nodeId: string;
    nodeType: string;
    error: string;
    code: ErrorCode;
    details?: string;
    stack?: string;
};
