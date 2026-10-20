import { isRecord } from '@/shared/utils/type-guards';
import type { ToolUIPart } from 'ai';

export type ToolActionPhase = 'requested' | 'running' | 'done' | 'failed';

interface ToolPresentationConfig {
    runningLabel: string;
    doneLabel: string;
}

const TOOL_ACTION_PHASE: Record<ToolUIPart['state'], ToolActionPhase> = {
    'input-streaming': 'running',
    'input-available': 'running',
    'approval-requested': 'requested',
    'approval-responded': 'done',
    'output-available': 'done',
    'output-error': 'failed',
    'output-denied': 'failed'
};

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

    render_scene_screenshot: {
        runningLabel: 'Rendering the scene',
        doneLabel: 'Rendered the scene'
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

    execute_pipeline: {
        runningLabel: 'Running the pipeline',
        doneLabel: 'Ran the pipeline'
    }
};

const humanizeToolName = (toolName: string): string => {
    const cleaned = toolName.replace(/_/gu, ' ').trim();
    return cleaned.length > 0 ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : 'tool';
};

const extractResultSummary = (result: unknown): string | null => {
    if (!isRecord(result)) {
        return null;
    }
    const summary = result.summary;
    return typeof summary === 'string' && summary.trim().length > 0 ? summary.trim() : null;
};

export const resolveToolActionPhase = (state: ToolUIPart['state']): ToolActionPhase => TOOL_ACTION_PHASE[state];

export const presentToolCall = (
    toolName: string,
    phase: ToolActionPhase,
    result: unknown
): string => {
    const config = TOOL_PRESENTATION[toolName];

    if (phase === 'done') {
        return extractResultSummary(result)
            ?? (config ? config.doneLabel : `Used ${humanizeToolName(toolName)}`);
    }

    if (phase === 'failed') {
        return extractResultSummary(result) ?? `${humanizeToolName(toolName)} failed`;
    }

    if (phase === 'requested') {
        return `Wants to ${config ? config.runningLabel.toLowerCase() : humanizeToolName(toolName).toLowerCase()}`;
    }

    return config ? `${config.runningLabel}…` : `Using ${humanizeToolName(toolName)}…`;
};
