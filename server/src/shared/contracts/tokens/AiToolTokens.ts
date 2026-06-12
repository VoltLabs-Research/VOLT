/**
 * Neutral, cross-module DI token symbol for AI TOOLS.
 *
 * Part of the `shared/contracts` layer (see ECOSYSTEM "VOLT Apps" migration):
 * the `AITool` collection token has the highest fan-in of any DI symbol in the
 * server — feature modules across the codebase register their tools via
 * `@CollectionMember(...)` against it. Living here means a feature module can
 * obtain the token without `import`ing `@modules/ai`. The neutral `AITool`
 * interface already lives at `@shared/application/ai/AITool`.
 *
 * The key is the SAME `Symbol.for('AITool')` used historically by
 * `AI_TOKENS.AITool`, so collection registration is byte-identical at runtime.
 */
export const AI_TOOL_TOKENS = Object.freeze({
    AITool: Symbol.for('AITool')
});
