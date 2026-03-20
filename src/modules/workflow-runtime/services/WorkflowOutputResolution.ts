import { logger } from '@/core/logger';
import { isRecord, stringifyUnknown } from '@/shared/utils';

export const resolveWorkflowOutputReference = (
    ref: string,
    outputs: Map<string, Record<string, unknown>>
): unknown => {
    const parts = ref.split('.');
    const nodeId = parts[0];
    const propertyPath = parts.slice(1);
    const nodeOutput = outputs.get(nodeId);

    if (!nodeOutput) {
        logger.warn(`Workflow reference not found for node ${nodeId}`);
        return undefined;
    }

    if (propertyPath.length === 0) {
        return nodeOutput;
    }

    return propertyPath.reduce<unknown>((current, key) => {
        if (!isRecord(current)) {
            return undefined;
        }

        return current[key];
    }, nodeOutput);
};

export const resolveWorkflowTemplate = (
    template: string,
    outputs: Map<string, Record<string, unknown>>
): string => {
    return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, ref: string) => {
        const value = resolveWorkflowOutputReference(ref.trim(), outputs);
        return value !== undefined ? stringifyUnknown(value) : '';
    });
};
