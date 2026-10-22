const DASHBOARD_PREFIX = '/dashboard';

// A section that keeps one page across its own routes: opening another conversation swaps the
// thread, not the page.
const NESTED_LAYOUTS: ReadonlyArray<RegExp> = [
    /^\/dashboard\/ai(?=\/|$)/u
];

// Which dashboard page a path shows, or null outside the dashboard. Moving to another page
// remounts the outlet and runs the page transition; moving within one does neither.
export const dashboardPageKey = (pathname: string): string | null => {
    if (!pathname.startsWith(DASHBOARD_PREFIX)) return null;

    for (const layout of NESTED_LAYOUTS) {
        const match = pathname.match(layout);
        if (match) return match[0];
    }

    return pathname;
};
