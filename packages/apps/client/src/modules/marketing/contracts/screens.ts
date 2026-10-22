import type { VisualTheme } from '@/shared/ui/hooks/use-theme';

// The landing shows the app's own pages as screens: documents of their own that render the
// workspace's routes from fixtures, laid out at a large laptop's size (at which the canvas's
// dock has room for an analysis's tabs) and scaled into the page. They are as wide as a
// laptop's screen is to its height, so one fits the page's viewport whole.
export const SCREEN_DOCUMENT = '/landing-screen.html';

export const SCREEN_WIDTH = 1600;
export const SCREEN_HEIGHT = 900;

export enum LandingScreenId {
    Viewer = 'viewer',
    Dashboard = 'dashboard',
    Marketplace = 'marketplace',
    Builder = 'builder',
    Assistant = 'assistant',
    Clusters = 'clusters'
}

export enum ScreenMessageType {
    // From a screen: what it shows has settled, and it can be seen.
    Ready = 'volt:landing-screen:ready',
    // To a screen: which of its steps to show.
    Step = 'volt:landing-screen:step',
    // To a screen: whether it is in view, so it can rest when it is not.
    Active = 'volt:landing-screen:active'
}

export type ScreenMessage =
    | { type: ScreenMessageType.Ready }
    | { type: ScreenMessageType.Step; step: number }
    | { type: ScreenMessageType.Active; active: boolean };

export const isScreenMessage = (data: unknown): data is ScreenMessage => (
    typeof data === 'object'
    && data !== null
    && Object.values(ScreenMessageType).includes((data as { type?: ScreenMessageType }).type as ScreenMessageType)
);

export const resolveScreenUrl = (screen: LandingScreenId, theme: VisualTheme): string => (
    `${SCREEN_DOCUMENT}?${new URLSearchParams({ screen, theme })}`
);
