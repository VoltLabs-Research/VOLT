/**
 * The sparkline's stroke colour, resolved at runtime.
 *
 * recharts needs a concrete colour string, not a `var()`, so the token has to be
 * read off the document rather than handed over as a class — which is why this is
 * the one place in the module that names a custom property in TypeScript.
 *
 * `--accent-green` / `--accent-red` were bravais names that survive only inside the
 * TEMPORARY compatibility shim in `index.css` (spec §5b.1). Left alone, this would
 * have kept the shim alive from JavaScript and then, on the day the shim is deleted,
 * silently fall through to the hardcoded green below — for BOTH directions, so a
 * falling trend would have drawn green. Repointed at the successor tokens, which are
 * real emitted properties on `:root` in both themes.
 *
 * The single fallback is bravais's own and is kept as-is: it is unreachable while
 * either token resolves.
 */
export const getTrendColor = (isPositiveTrend: boolean): string => {
    const colorVariable = isPositiveTrend ? '--success' : '--danger';
    return getComputedStyle(document.documentElement).getPropertyValue(colorVariable).trim() || '#30d158';
};
