// How a plugin tells VOLT how far along it is: lines of its own on stderr, which VOLT takes out of
// the run's log and shows as the job's progress.
//
//     @volt:progress 0.42                  a fraction of the work, 0..1
//     @volt:progress 42%                   a percentage
//     @volt:progress 340/1000 Meshing      done/total, then what it is doing
//     @volt:status Indexing neighbours     what it is doing, without a value
//
// stderr works for every runtime VOLT runs a plugin in (an executable, a Python script, a wasm
// build in the browser), and any language can write a line to it. A line has to start with the
// directive; anything else, and a directive whose value does not parse, stays in the log.

export const PLUGIN_PROGRESS_DIRECTIVE = '@volt:progress';
export const PLUGIN_STATUS_DIRECTIVE = '@volt:status';
export const PLUGIN_DIRECTIVE_PREFIX = '@volt:';

// Longer texts are cut: the text is a status line, not a log.
export const PLUGIN_PROGRESS_TEXT_MAX_LENGTH = 160;

export interface PluginProgressDirective {
    // 0..1; absent for @volt:status.
    progress?: number;
    text?: string;
}

const clampFraction = (value: number): number => Math.min(1, Math.max(0, value));

const parseProgressValue = (token: string): number | null => {
    const ratio = /^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/.exec(token);
    if (ratio) {
        const total = Number(ratio[2]);
        return total > 0 ? clampFraction(Number(ratio[1]) / total) : null;
    }

    const percent = /^(\d+(?:\.\d+)?)%$/.exec(token);
    if (percent) {
        return clampFraction(Number(percent[1]) / 100);
    }

    if (/^\d+(?:\.\d+)?$/.test(token) || /^\.\d+$/.test(token)) {
        return clampFraction(Number(token));
    }

    return null;
};

const normalizeText = (text: string): string | undefined => {
    const trimmed = text.trim();
    if (!trimmed) {
        return undefined;
    }

    return trimmed.length > PLUGIN_PROGRESS_TEXT_MAX_LENGTH
        ? `${trimmed.slice(0, PLUGIN_PROGRESS_TEXT_MAX_LENGTH - 1)}…`
        : trimmed;
};

const readDirectiveBody = (line: string, directive: string): string | null => {
    if (!line.startsWith(directive)) {
        return null;
    }

    const rest = line.slice(directive.length);
    if (rest.length > 0 && rest[0] !== ' ' && rest[0] !== '\t') {
        return null;
    }

    return rest;
};

// One line without its line break; null when it is not a directive VOLT understands.
export const parsePluginProgressLine = (line: string): PluginProgressDirective | null => {
    const trimmedLine = line.endsWith('\r') ? line.slice(0, -1) : line;

    const progressBody = readDirectiveBody(trimmedLine, PLUGIN_PROGRESS_DIRECTIVE);
    if (progressBody !== null) {
        const body = progressBody.trimStart();
        const separator = body.search(/\s/);
        const token = separator === -1 ? body : body.slice(0, separator);
        const progress = parseProgressValue(token);
        if (progress === null) {
            return null;
        }

        const text = separator === -1 ? undefined : normalizeText(body.slice(separator));
        return text === undefined ? { progress } : { progress, text };
    }

    const statusBody = readDirectiveBody(trimmedLine, PLUGIN_STATUS_DIRECTIVE);
    if (statusBody !== null) {
        const text = normalizeText(statusBody);
        return text === undefined ? null : { text };
    }

    return null;
};
