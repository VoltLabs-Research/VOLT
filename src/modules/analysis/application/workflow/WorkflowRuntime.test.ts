import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Task 5 deleted the plugin-ref filesystem cache (approved decision 3=a:
 * re-execute instead of caching). A full runtime test of
 * `executeNestedPluginWorkflow` would require executing a real plugin binary
 * (entrypoint) plus trajectory I/O, so this focused guard asserts — at the
 * source level — that the cache machinery is gone: no `plugin-ref-cache`
 * directory is ever computed, read, or written, and there is no longer a
 * `cached` short-circuit. pluginReferences are re-executed every time.
 */
const source = readFileSync(path.join(__dirname, 'WorkflowRuntime.ts'), 'utf8');

test('WorkflowRuntime references no plugin-ref-cache directory', () => {
    assert.ok(
        !source.includes('plugin-ref-cache'),
        'expected no plugin-ref-cache directory path to remain'
    );
});

test('WorkflowRuntime no longer defines the plugin-ref cache read/write helpers', () => {
    for (const symbol of ['restorePluginRefCache', 'persistPluginRefCache', 'cacheDir', 'cacheKey']) {
        assert.ok(!source.includes(symbol), `expected "${symbol}" to be deleted`);
    }
});

test('WorkflowRuntime no longer emits a cached plugin-ref stage branch', () => {
    assert.ok(!/stageStatus:\s*'cached'/.test(source), 'expected no cached stage report branch');
    assert.ok(!source.includes('cacheHit'), 'expected no cacheHit stage reporting');
});
