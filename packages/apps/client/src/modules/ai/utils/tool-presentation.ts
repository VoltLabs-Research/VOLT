import { isRecord } from '@/shared/utils/type-guards';
import type { ToolActivity } from '@/modules/ai/utils/message-blocks';

interface ToolPresentationConfig {
    runningLabel: string;
    doneLabel: string;
    // What the card says while the tool waits for the user's approval.
    requestLabel?: string;
}

const TOOL_PRESENTATION: Record<string, ToolPresentationConfig> = {
    navigate_to: {
        runningLabel: 'Navigating',
        doneLabel: 'Navigated'
    },
    open_in_viewer: {
        runningLabel: 'Opening the viewer',
        doneLabel: 'Opened the viewer'
    },
    open_panel: {
        runningLabel: 'Opening a panel',
        doneLabel: 'Opened a panel'
    },
    open_command_palette: {
        runningLabel: 'Opening the command palette',
        doneLabel: 'Toggled the command palette'
    },
    set_chat_surface: {
        runningLabel: 'Moving the assistant',
        doneLabel: 'Moved the assistant'
    },
    set_theme: {
        runningLabel: 'Switching theme',
        doneLabel: 'Switched theme'
    },
    switch_team: {
        runningLabel: 'Switching team',
        doneLabel: 'Switched team'
    },

    control_playback: {
        runningLabel: 'Controlling playback',
        doneLabel: 'Updated playback'
    },
    seek_frame: {
        runningLabel: 'Seeking',
        doneLabel: 'Jumped to frame'
    },
    set_playback: {
        runningLabel: 'Adjusting playback',
        doneLabel: 'Adjusted playback'
    },
    reset_camera: {
        runningLabel: 'Resetting the camera',
        doneLabel: 'Reset the camera'
    },
    set_camera_view: {
        runningLabel: 'Orienting the camera',
        doneLabel: 'Set the camera view'
    },
    focus_result: {
        runningLabel: 'Focusing a result',
        doneLabel: 'Focused a result'
    },
    get_viewer_state: {
        runningLabel: 'Reading the viewer',
        doneLabel: 'Read the viewer state'
    },
    set_visible_layers: {
        runningLabel: 'Toggling layers',
        doneLabel: 'Toggled layers'
    },
    set_appearance: {
        runningLabel: 'Adjusting appearance',
        doneLabel: 'Adjusted appearance'
    },
    set_environment: {
        runningLabel: 'Adjusting the environment',
        doneLabel: 'Adjusted the environment'
    },
    reset_view_settings: {
        runningLabel: 'Resetting view settings',
        doneLabel: 'Reset view settings'
    },

    global_search: {
        runningLabel: 'Searching',
        doneLabel: 'Searched'
    },
    compare_analyses: {
        runningLabel: 'Comparing analyses',
        doneLabel: 'Compared analyses'
    },
    summarize_analysis_run: {
        runningLabel: 'Summarizing the run',
        doneLabel: 'Summarized the run'
    },
    context_compact: {
        runningLabel: 'Folding earlier messages into a summary',
        doneLabel: 'Folded earlier messages into a summary'
    },

    execute_pipeline: {
        runningLabel: 'Running the pipeline',
        doneLabel: 'Ran the pipeline',
        requestLabel: 'Wants to run the pipeline'
    }
};

export const humanizeToolName = (toolName: string): string => {
    const cleaned = toolName.replace(/_/gu, ' ').trim();
    return cleaned.length > 0 ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : 'Tool';
};

const summaryOf = (output: unknown): string | null => {
    if (!isRecord(output)) return null;

    const summary = output.summary;
    return typeof summary === 'string' && summary.trim().length > 0 ? summary.trim() : null;
};

// A tool that answered ok:false still produced output: it reads as a failure, not as done.
export const isFailedOutput = (output: unknown): boolean => isRecord(output) && output.ok === false;

export const presentRequest = (toolName: string): string => (
    TOOL_PRESENTATION[toolName]?.requestLabel ?? `Wants to ${humanizeToolName(toolName).toLowerCase()}`
);

export const presentActivity = ({ toolName, outcome }: ToolActivity): string => {
    const config = TOOL_PRESENTATION[toolName];

    switch (outcome.kind) {
        case 'awaiting':
            return presentRequest(toolName);
        case 'done':
            return summaryOf(outcome.output)
                ?? (isFailedOutput(outcome.output)
                    ? `${humanizeToolName(toolName)} failed`
                    : config?.doneLabel ?? `Used ${humanizeToolName(toolName)}`);
        case 'failed':
            return `${humanizeToolName(toolName)} failed`;
        case 'declined':
            return `Rejected ${humanizeToolName(toolName).toLowerCase()}. Nothing ran.`;
        default:
            return config ? `${config.runningLabel}…` : `Using ${humanizeToolName(toolName)}…`;
    }
};

export interface InputField {
    label: string;
    value: string;
}

const MAX_INPUT_FIELDS = 6;
const MAX_VALUE_CHARS = 120;

const clip = (text: string): string => (
    text.length > MAX_VALUE_CHARS ? `${text.slice(0, MAX_VALUE_CHARS - 1)}…` : text
);

const shownValueOf = (value: unknown): string | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') return value.trim() === '' ? null : clip(value.trim());
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);

    if (Array.isArray(value)) {
        if (value.length === 0) return null;

        const isFlat = value.every((item) => typeof item === 'string' || typeof item === 'number');
        return isFlat ? clip(value.join(', ')) : `${value.length} ${value.length === 1 ? 'item' : 'items'}`;
    }

    try {
        return clip(JSON.stringify(value));
    } catch {
        return null;
    }
};

const fieldLabelOf = (key: string): string => humanizeToolName(key.replace(/([a-z0-9])([A-Z])/gu, '$1_$2').toLowerCase());

// What an approval card shows of the call it asks about, so the user sees what they approve.
export const describeInput = (input: unknown): InputField[] => {
    if (!isRecord(input)) return [];

    return Object.entries(input).flatMap(([key, value]) => {
        const shown = shownValueOf(value);
        return shown === null ? [] : [{
            label: fieldLabelOf(key),
            value: shown
        }];
    }).slice(0, MAX_INPUT_FIELDS);
};
