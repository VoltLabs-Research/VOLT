import { isRecord } from '@/shared/utils/type-guards';

/**
 * Human-facing presentation for AI tool calls in the conversation thread.
 *
 * The model calls tools by snake_case name; the raw name ("seek_frame") is not
 * something a user should read. This maps each tool to a verb phrase and groups
 * it, and — when the tool result carries a `summary` (our client tools and most
 * server tools return `{ summary }`) — prefers that concrete summary.
 */

export type ToolActionPhase = 'requested' | 'running' | 'done' | 'failed';

interface ToolPresentationConfig {
    /** Verb shown while running / once done, e.g. "Navigating" / "Navigated". */
    runningLabel: string;
    doneLabel: string;
    group: 'navigation' | 'viewer' | 'render' | 'data' | 'action';
}

const TOOL_PRESENTATION: Record<string, ToolPresentationConfig> = {
    navigate_to: { runningLabel: 'Navigating', doneLabel: 'Navigated', group: 'navigation' },
    open_in_viewer: { runningLabel: 'Opening the viewer', doneLabel: 'Opened the viewer', group: 'navigation' },
    open_panel: { runningLabel: 'Opening a panel', doneLabel: 'Opened a panel', group: 'navigation' },
    open_command_palette: { runningLabel: 'Opening the command palette', doneLabel: 'Toggled the command palette', group: 'navigation' },
    set_chat_surface: { runningLabel: 'Moving the assistant', doneLabel: 'Moved the assistant', group: 'navigation' },
    set_theme: { runningLabel: 'Switching theme', doneLabel: 'Switched theme', group: 'navigation' },
    switch_team: { runningLabel: 'Switching team', doneLabel: 'Switched team', group: 'action' },

    control_playback: { runningLabel: 'Controlling playback', doneLabel: 'Updated playback', group: 'viewer' },
    seek_frame: { runningLabel: 'Seeking', doneLabel: 'Jumped to frame', group: 'viewer' },
    set_playback: { runningLabel: 'Adjusting playback', doneLabel: 'Adjusted playback', group: 'viewer' },
    reset_camera: { runningLabel: 'Resetting the camera', doneLabel: 'Reset the camera', group: 'viewer' },
    set_camera_view: { runningLabel: 'Orienting the camera', doneLabel: 'Set the camera view', group: 'viewer' },
    focus_result: { runningLabel: 'Focusing a result', doneLabel: 'Focused a result', group: 'viewer' },
    get_viewer_state: { runningLabel: 'Reading the viewer', doneLabel: 'Read the viewer state', group: 'viewer' },
    set_visible_layers: { runningLabel: 'Toggling layers', doneLabel: 'Toggled layers', group: 'viewer' },
    set_appearance: { runningLabel: 'Adjusting appearance', doneLabel: 'Adjusted appearance', group: 'viewer' },
    set_environment: { runningLabel: 'Adjusting the environment', doneLabel: 'Adjusted the environment', group: 'viewer' },
    reset_view_settings: { runningLabel: 'Resetting view settings', doneLabel: 'Reset view settings', group: 'viewer' },

    render_scene_screenshot: { runningLabel: 'Rendering the scene', doneLabel: 'Rendered the scene', group: 'render' },

    global_search: { runningLabel: 'Searching', doneLabel: 'Searched', group: 'data' },
    compare_analyses: { runningLabel: 'Comparing analyses', doneLabel: 'Compared analyses', group: 'data' },
    summarize_analysis_run: { runningLabel: 'Summarizing the run', doneLabel: 'Summarized the run', group: 'data' }
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

export interface ToolCardPresentation {
    label: string;
    group: ToolPresentationConfig['group'] | 'unknown';
}

/**
 * Resolves the label + group for a tool-call card. When done, a concrete result
 * summary (e.g. "Navigated to Containers.") wins over the generic verb.
 */
export const presentToolCall = (
    toolName: string,
    phase: ToolActionPhase,
    result: unknown
): ToolCardPresentation => {
    const config = TOOL_PRESENTATION[toolName];
    const group = config?.group ?? 'unknown';

    if (phase === 'done') {
        const summary = extractResultSummary(result);
        if (summary) {
            return { label: summary, group };
        }
        return { label: config ? config.doneLabel : `Used ${humanizeToolName(toolName)}`, group };
    }

    if (phase === 'failed') {
        const summary = extractResultSummary(result);
        return { label: summary ?? `${humanizeToolName(toolName)} failed`, group };
    }

    if (phase === 'requested') {
        return { label: `Wants to ${config ? config.runningLabel.toLowerCase() : humanizeToolName(toolName).toLowerCase()}`, group };
    }

    return { label: config ? `${config.runningLabel}…` : `Using ${humanizeToolName(toolName)}…`, group };
};
