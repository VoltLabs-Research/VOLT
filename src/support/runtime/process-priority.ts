import os from 'node:os';

import { logger } from '@/core/logger';

const DEFAULT_PLANE_PROCESS_PRIORITY = -5;
const MIN_PROCESS_PRIORITY = -20;
const MAX_PROCESS_PRIORITY = 19;
const DISABLED_PRIORITY_VALUES = new Set(['off', 'disable', 'disabled', 'none']);
const warnedLabels = new Set<string>();

const resolvePreferredPlaneProcessPriority = (): number | null => {
    const raw = process.env.TEAM_CLUSTER_PLANE_PROCESS_PRIORITY?.trim();
    if (!raw) {
        return DEFAULT_PLANE_PROCESS_PRIORITY;
    }

    if (DISABLED_PRIORITY_VALUES.has(raw.toLowerCase())) {
        return null;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
        return DEFAULT_PLANE_PROCESS_PRIORITY;
    }

    return Math.max(MIN_PROCESS_PRIORITY, Math.min(MAX_PROCESS_PRIORITY, Math.trunc(parsed)));
};

const preferredPlaneProcessPriority = resolvePreferredPlaneProcessPriority();

export const applyPreferredPlaneProcessPriority = (
    pid: number | undefined,
    label: string
): void => {
    if (!pid || preferredPlaneProcessPriority === null) {
        return;
    }

    try {
        os.setPriority(pid, preferredPlaneProcessPriority);
    } catch (error) {
        if (warnedLabels.has(label)) {
            return;
        }

        warnedLabels.add(label);
        logger.warn(
            `Failed to raise process priority for ${label} pid=${pid}: ${error instanceof Error ? error.message : String(error)}`
        );
    }
};
