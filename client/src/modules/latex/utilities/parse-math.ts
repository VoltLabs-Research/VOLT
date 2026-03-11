/** Segment of parsed LaTeX content — either a math expression or plain text. */
export interface LatexSegment {
    type: 'inline-math' | 'block-math' | 'text';
    content: string;
};

/**
 * Parses a LaTeX source string into an ordered list of segments.
 *
 * Recognised delimiters (in order of precedence):
 * - `$$...$$` — display math
 * - `\[...\]` — display math
 * - `\begin{equation}...\end{equation}` — display math environment
 * - `\begin{align}...\end{align}` — display math environment
 * - `\begin{align*}...\end{align*}` — display math environment
 * - `\begin{gather}...\end{gather}` — display math environment
 * - `$...$` — inline math
 * - `\(...\)` — inline math
 *
 * Everything else is returned as plain text.
 */
export const parseLatexSegments = (source: string): LatexSegment[] => {
    const segments: LatexSegment[] = [];

    const displayPattern =
        /\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]|\\begin\{(equation\*?|align\*?|gather\*?|multline\*?)\}([\s\S]*?)\\end\{\3\}/g;

    const inlinePattern = /\$((?:[^$\\]|\\.)+?)\$|\\\(([\s\S]*?)\\\)/g;

    const displayMatches: Array<{ index: number; end: number; math: string }> = [];
    let m: RegExpExecArray | null;

    while ((m = displayPattern.exec(source)) !== null) {
        const math = m[1] ?? m[2] ?? m[4] ?? '';
        displayMatches.push({ index: m.index, end: m.index + m[0].length, math });
    }

    const allMatches: Array<{ index: number; end: number; math: string; display: boolean }> = [
        ...displayMatches.map((x) => ({ ...x, display: true }))
    ];

    // Collect inline matches that don't overlap with display matches
    const isInsideDisplay = (start: number, end: number): boolean =>
        displayMatches.some((d) => start >= d.index && end <= d.end);

    while ((m = inlinePattern.exec(source)) !== null) {
        if (isInsideDisplay(m.index, m.index + m[0].length)) continue;
        const math = m[1] ?? m[2] ?? '';
        allMatches.push({ index: m.index, end: m.index + m[0].length, math, display: false });
    }

    allMatches.sort((a, b) => a.index - b.index);

    let cursor = 0;

    for (const match of allMatches) {
        if (match.index > cursor) {
            const text = source.slice(cursor, match.index);
            if (text.trim()) {
                segments.push({ type: 'text', content: text });
            }
        }

        segments.push({
            type: match.display ? 'block-math' : 'inline-math',
            content: match.math.trim()
        });

        cursor = match.end;
    }

    if (cursor < source.length) {
        const remaining = source.slice(cursor);
        if (remaining.trim()) {
            segments.push({ type: 'text', content: remaining });
        }
    }

    return segments;
};
