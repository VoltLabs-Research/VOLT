import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';

import AIToolController from '@shared/ai/AIToolController';
import { AITool, ClientAITool, getAITools } from '@shared/ai/tool';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';

const scope: AIToolScope = { teamId: 'team-1', userId: 'user-1' };

const greetParams = z.object({ name: z.string(), loud: z.boolean().optional().default(false) });
const removeParams = z.object({ id: z.string() });

class FixtureAIToolController extends AIToolController {
    @AITool({
        name: 'greet',
        description: 'Greets somebody.',
        parameters: greetParams
    })
    greet(input: z.infer<typeof greetParams> & AIToolScope) {
        return { greeting: input.loud ? `HI ${input.name}!` : `hi ${input.name}`, teamId: input.teamId };
    }

    @AITool({
        name: 'remove_thing',
        description: 'Removes a thing, asking first.',
        parameters: removeParams,
        needsApproval: (input) => input.id !== 'safe'
    })
    removeThing(input: z.infer<typeof removeParams>) {
        return { removed: input.id };
    }

    @ClientAITool({
        name: 'focus_ui',
        description: 'Focuses something in the browser.',
        parameters: z.object({ target: z.string() })
    })
    focusUi(): void {}
}

test('getAITools: collects every decorated method as a definition', () => {
    const definitions = getAITools(FixtureAIToolController);
    assert.deepEqual(definitions.map((definition) => definition.name).sort(), ['focus_ui', 'greet', 'remove_thing']);
});

test('buildTools: keys the tool set by declared name and carries the description', () => {
    const tools = new FixtureAIToolController().buildTools(scope);
    assert.deepEqual(Object.keys(tools).sort(), ['focus_ui', 'greet', 'remove_thing']);
    assert.equal(tools.greet.description, 'Greets somebody.');
    assert.equal(tools.greet.inputSchema, greetParams);
});

test('buildTools: executes the decorated method with input and scope merged into one object', async () => {
    const tools = new FixtureAIToolController().buildTools(scope);
    const execute = tools.greet.execute;
    assert.ok(execute, 'expected greet to be server-executed');

    const result = await execute({ name: 'ada', loud: true }, { toolCallId: 't1', messages: [] });
    assert.deepEqual(result, { greeting: 'HI ada!', teamId: 'team-1' });
});

test('buildTools: keeps the handler bound so private service fields stay reachable', async () => {
    const tools = new FixtureAIToolController().buildTools(scope);
    const { execute } = tools.greet;
    assert.ok(execute);
    const result = await execute({ name: 'ada', loud: false }, { toolCallId: 't2', messages: [] });
    assert.deepEqual(result, { greeting: 'hi ada', teamId: 'team-1' });
});

test('buildTools: client-executed tools are advertised without an execute handler', () => {
    const tools = new FixtureAIToolController().buildTools(scope);
    assert.equal(tools.focus_ui.execute, undefined);
    assert.equal(tools.focus_ui.description, 'Focuses something in the browser.');
});

test('buildTools: needsApproval is forwarded only when declared', async () => {
    const tools = new FixtureAIToolController().buildTools(scope);
    assert.equal(Object.prototype.hasOwnProperty.call(tools.greet, 'needsApproval'), false);

    const needsApproval = tools.remove_thing.needsApproval;
    assert.equal(typeof needsApproval, 'function');
    assert.equal(await (needsApproval as (input: unknown) => boolean)({ id: 'danger' }), true);
    assert.equal(await (needsApproval as (input: unknown) => boolean)({ id: 'safe' }), false);
});

test('buildTools: scope is captured per call, so two scopes do not share state', async () => {
    const controller = new FixtureAIToolController();
    const first = controller.buildTools({ teamId: 'team-a', userId: 'user-a' });
    const second = controller.buildTools({ teamId: 'team-b', userId: 'user-b' });

    const call = { toolCallId: 't3', messages: [] };
    assert.deepEqual(await first.greet.execute?.({ name: 'x', loud: false }, call), { greeting: 'hi x', teamId: 'team-a' });
    assert.deepEqual(await second.greet.execute?.({ name: 'x', loud: false }, call), { greeting: 'hi x', teamId: 'team-b' });
});

test('buildTools: scope wins over model-supplied input, so teamId cannot be spoofed', async () => {
    const tools = new FixtureAIToolController().buildTools(scope);
    const result = await tools.greet.execute?.(
        { name: 'ada', loud: false, teamId: 'attacker-team' } as never,
        { toolCallId: 't4', messages: [] }
    );
    assert.deepEqual(result, { greeting: 'hi ada', teamId: 'team-1' });
});

test('buildTools: a declared tool with no handler method fails loudly', () => {
    class BrokenAIToolController extends AIToolController {}
    const ctor = BrokenAIToolController as unknown as object;
    // Register a definition whose handler method does not exist on the class.
    AITool({ name: 'ghost', description: 'x', parameters: z.object({}) })(
        BrokenAIToolController.prototype,
        'missingHandler',
        {} as TypedPropertyDescriptor<() => unknown>
    );

    assert.equal(getAITools(ctor).length, 1);
    assert.throws(() => new BrokenAIToolController().buildTools(scope), /has no handler method/);
});
