import { StringDecoder } from 'node:string_decoder';
import {
    PLUGIN_DIRECTIVE_PREFIX,
    parsePluginProgressLine,
    type PluginProgressDirective
} from '@volt/contracts/modules/plugin/progress';

// A line this long is a log line, whatever it starts with.
const MAX_HELD_LINE_LENGTH = 4096;

export interface PluginStderrDemuxerHandlers {
    onText: (text: string) => void;
    onDirective: (directive: PluginProgressDirective) => void;
}

const mayBecomeDirective = (partialLine: string): boolean =>
    partialLine.startsWith(PLUGIN_DIRECTIVE_PREFIX) || PLUGIN_DIRECTIVE_PREFIX.startsWith(partialLine);

/*
 * Splits a plugin's stderr into the text of its log and its @volt: directives. Text goes on as soon
 * as it arrives, so the log stays live; the only thing held back is the start of a line that may
 * still turn out to be a directive, until its line break comes.
 */
export class PluginStderrDemuxer {
    private readonly decoder = new StringDecoder('utf8');
    private heldLine = '';
    private atLineStart = true;

    public constructor(private readonly handlers: PluginStderrDemuxerHandlers) {}

    public push(chunk: Buffer): void {
        this.consume(this.decoder.write(chunk), false);
    }

    // The stream ended: what is still held is a last line without its line break.
    public end(): void {
        this.consume(this.decoder.end(), true);
    }

    private consume(incoming: string, final: boolean): void {
        const input = this.heldLine + incoming;
        this.heldLine = '';
        let text = '';
        let cursor = 0;

        const flushText = (): void => {
            if (text) {
                this.handlers.onText(text);
                text = '';
            }
        };

        while (cursor < input.length) {
            const lineBreak = input.indexOf('\n', cursor);

            if (!this.atLineStart) {
                if (lineBreak === -1) {
                    text += input.slice(cursor);
                    break;
                }
                text += input.slice(cursor, lineBreak + 1);
                cursor = lineBreak + 1;
                this.atLineStart = true;
                continue;
            }

            if (lineBreak === -1) {
                const partialLine = input.slice(cursor);
                const directive = final ? parsePluginProgressLine(partialLine) : null;
                if (directive) {
                    flushText();
                    this.handlers.onDirective(directive);
                } else if (!final && partialLine.length < MAX_HELD_LINE_LENGTH && mayBecomeDirective(partialLine)) {
                    this.heldLine = partialLine;
                } else {
                    text += partialLine;
                    this.atLineStart = false;
                }
                break;
            }

            const line = input.slice(cursor, lineBreak);
            const directive = line.startsWith(PLUGIN_DIRECTIVE_PREFIX) ? parsePluginProgressLine(line) : null;
            if (directive) {
                flushText();
                this.handlers.onDirective(directive);
            } else {
                text += input.slice(cursor, lineBreak + 1);
            }
            cursor = lineBreak + 1;
        }

        flushText();
    }
}
