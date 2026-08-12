import stringify from 'safe-stable-stringify';

import type { WorkflowValue } from '@shared/contracts/types/workflow.types';

const CLI_ARGUMENTS_TOKEN_PREFIX = '__volt_cli_args__:';

export const encodeCliArgumentsToken = (argumentsArray: string[]): string => {
    const payload = JSON.stringify(argumentsArray);
    const encodedPayload = Buffer.from(payload, 'utf8').toString('base64url');

    return `${CLI_ARGUMENTS_TOKEN_PREFIX}${encodedPayload}`;
};

export const decodeCliArgumentsToken = (value: string): string[] | null => {
    if (!value.startsWith(CLI_ARGUMENTS_TOKEN_PREFIX)) {
        return null;
    }

    const encodedPayload = value.slice(CLI_ARGUMENTS_TOKEN_PREFIX.length);
    if (!encodedPayload.length) {
        return null;
    }

    try {
        const payload = Buffer.from(encodedPayload, 'base64url').toString('utf8');
        const parsed = JSON.parse(payload) as string[];
        if (!Array.isArray(parsed)) {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
};

export const stringifyWorkflowValue = (value: WorkflowValue): string =>
    typeof value === 'string' ? value : stringify(value) ?? '';
