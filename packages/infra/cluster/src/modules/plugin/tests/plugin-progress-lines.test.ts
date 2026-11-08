import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePluginProgressLine } from '@volt/contracts/modules/plugin/progress';
import { PluginStderrDemuxer } from '@modules/plugin/services/runtime/plugin-stderr-demuxer';
import type { PluginProgressDirective } from '@volt/contracts/modules/plugin/progress';

describe('parsePluginProgressLine', () => {
    test('reads a fraction, a percentage and done/total', () => {
        assert.deepEqual(parsePluginProgressLine('@volt:progress 0.42'), { progress: 0.42 });
        assert.deepEqual(parsePluginProgressLine('@volt:progress .5'), { progress: 0.5 });
        assert.deepEqual(parsePluginProgressLine('@volt:progress 42%'), { progress: 0.42 });
        assert.deepEqual(parsePluginProgressLine('@volt:progress 340/1000 Meshing cells'), {
            progress: 0.34,
            text: 'Meshing cells'
        });
    });

    test('clamps values outside 0..1', () => {
        assert.deepEqual(parsePluginProgressLine('@volt:progress 1.7'), { progress: 1 });
        assert.deepEqual(parsePluginProgressLine('@volt:progress 12/10'), { progress: 1 });
        assert.deepEqual(parsePluginProgressLine('@volt:progress 250%'), { progress: 1 });
    });

    test('reads a status, and drops the carriage return of a CRLF line', () => {
        assert.deepEqual(parsePluginProgressLine('@volt:status Indexing neighbours\r'), { text: 'Indexing neighbours' });
        assert.deepEqual(parsePluginProgressLine('@volt:progress 0.5\r'), { progress: 0.5 });
    });

    test('cuts a long text', () => {
        const directive = parsePluginProgressLine(`@volt:status ${'x'.repeat(500)}`);
        assert.equal(directive?.text?.length, 160);
        assert.ok(directive?.text?.endsWith('…'));
    });

    test('leaves what is not a directive it understands', () => {
        for (const line of [
            '@volt:progress',
            '@volt:progress nope',
            '@volt:progress 3/0',
            '@volt:progress -0.2',
            '@volt:progressive 0.5',
            '@volt:status',
            '@volt:status    ',
            ' @volt:progress 0.5',
            'done @volt:progress 0.5',
            '@volt:unknown 0.5'
        ]) {
            assert.equal(parsePluginProgressLine(line), null, line);
        }
    });
});

const collect = () => {
    const texts: string[] = [];
    const directives: PluginProgressDirective[] = [];
    const demuxer = new PluginStderrDemuxer({
        onText: (text) => texts.push(text),
        onDirective: (directive) => directives.push(directive)
    });
    return {
        demuxer,
        texts,
        directives
    };
};

describe('PluginStderrDemuxer', () => {
    test('takes directives out of the text and keeps the rest in order', () => {
        const { demuxer, texts, directives } = collect();
        demuxer.push(Buffer.from('starting\n@volt:progress 0.25 Meshing\nmidway\n@volt:status Writing\ndone\n'));
        demuxer.end();

        assert.deepEqual(texts, ['starting\n', 'midway\n', 'done\n']);
        assert.deepEqual(directives, [
            {
                progress: 0.25,
                text: 'Meshing'
            },
            { text: 'Writing' }
        ]);
    });

    test('joins a directive split across chunks', () => {
        const { demuxer, texts, directives } = collect();
        demuxer.push(Buffer.from('@volt:'));
        demuxer.push(Buffer.from('progr'));
        demuxer.push(Buffer.from('ess 3/4\nafter\n'));
        demuxer.end();

        assert.deepEqual(directives, [{ progress: 0.75 }]);
        assert.deepEqual(texts, ['after\n']);
    });

    test('sends plain text on before its line ends, so the log stays live', () => {
        const { demuxer, texts } = collect();
        demuxer.push(Buffer.from('compiling the'));
        assert.deepEqual(texts, ['compiling the']);
        demuxer.push(Buffer.from(' kernels @volt:progress 0.5\n'));
        assert.deepEqual(texts, ['compiling the', ' kernels @volt:progress 0.5\n']);
    });

    test('keeps a directive that does not parse in the log', () => {
        const { demuxer, texts, directives } = collect();
        demuxer.push(Buffer.from('@volt:progress soon\n'));
        demuxer.end();

        assert.deepEqual(texts, ['@volt:progress soon\n']);
        assert.deepEqual(directives, []);
    });

    test('reads a last directive without its line break when the stream ends', () => {
        const { demuxer, texts, directives } = collect();
        demuxer.push(Buffer.from('@volt:progress 100%'));
        assert.deepEqual(directives, []);
        demuxer.end();

        assert.deepEqual(directives, [{ progress: 1 }]);
        assert.deepEqual(texts, []);
    });

    test('decodes a character split across chunks', () => {
        const { demuxer, directives } = collect();
        const line = Buffer.from('@volt:status Construyendo la malla · paso ñ\n');
        const splitAt = line.indexOf(Buffer.from('ñ')) + 1;
        demuxer.push(line.subarray(0, splitAt));
        demuxer.push(line.subarray(splitAt));
        demuxer.end();

        assert.deepEqual(directives, [{ text: 'Construyendo la malla · paso ñ' }]);
    });
});
