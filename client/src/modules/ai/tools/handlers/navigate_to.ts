import { resolveDestination } from '@/modules/ai/tools/navigation-destinations';
import type { ClientToolHandler, ClientToolResult } from '@/modules/ai/tools/types';

interface NavigateToInput {
    destination?: string;
    params?: Record<string, string>;
    query?: Record<string, string>;
}

/**
 * Navigates the user to an in-app page. The destination is resolved against the
 * route allowlist (security boundary — only known logical destinations, never
 * arbitrary URLs). Returns the resolved path + page title, or a structured
 * error the model can recover from.
 */
const navigateTo: ClientToolHandler<NavigateToInput> = {
    name: 'navigate_to',

    run(input, ctx): ClientToolResult {
        const destination = typeof input.destination === 'string' ? input.destination : '';
        const resolved = resolveDestination(destination, input.params ?? {}, input.query ?? {});

        if (!resolved.ok || !resolved.path) {
            return {
                ok: false,
                summary: 'Could not navigate there.',
                reason: 'invalid_destination',
                hint: resolved.error
            };
        }

        ctx.navigate(resolved.path);

        return {
            ok: true,
            summary: resolved.title ? `Navigated to ${resolved.title}.` : `Navigated to ${resolved.path}.`,
            data: { path: resolved.path, title: resolved.title }
        };
    },

    describeEffect(_input, result) {
        if (!result.ok) {
            return { label: 'Navigation failed', icon: 'navigate' };
        }
        const title = (result.data as { title?: string } | undefined)?.title;
        return { label: title ? `Navigated to ${title}` : 'Navigated', icon: 'navigate' };
    }
};

export default navigateTo;
