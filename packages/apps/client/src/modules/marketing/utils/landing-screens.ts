import socketService from '@/modules/socket/services/socket-service';
import { LandingScreenId } from '@/modules/marketing/contracts/screens';
import { COORDINATION_ANALYSIS_ID, COORDINATION_PLUGIN_ID, COORDINATION_PRIMARY_EXPOSURE_ID, COORDINATION_WORKFLOW } from '@/modules/marketing/utils/landing-coordination';
import { FEATURED_PACKAGE } from '@/modules/marketing/utils/landing-registry';
import { LANDING_CONVERSATION_ID, LANDING_PROMPT } from '@/modules/marketing/utils/landing-conversation';
import { PLAYS_CONVERSATION } from '@/modules/marketing/utils/landing-assistant';
import { LANDING_JOB_GROUPS, clusterHistoryUntil, clusterMetricsAt } from '@/modules/marketing/utils/landing-cluster';
import { LANDING_COLLEAGUES, LANDING_OWNER, LANDING_PEOPLE } from '@/modules/marketing/utils/landing-peers';
import { SHEAR_DEFORMATION_ID } from '@/modules/marketing/utils/landing-trajectories';
import { SOCKET_CANVAS_LOBBY_EVENTS, SOCKET_CANVAS_WORKSPACE_EVENTS } from '@/modules/socket/events/canvas';
import { LANDING_CLUSTER_ID } from '@/modules/marketing/utils/landing-workspace';
import { setClusterHistoryQueryData, setClusterMetricsQueryData } from '@/modules/cluster/hooks/queries';
import { setTeamJobsGroupsQueryData } from '@/modules/jobs/hooks/queries';
import { useClusterStore } from '@/modules/cluster/store/use-cluster-store';
import { useEditorStore } from '@/modules/canvas/store/editor';

export interface LandingScreenScenario {
    // The app's routes the screen shows, in the order the page walks through them.
    steps: string[];
    // What the people in the screen, and its server, do while it is in view; returns how to stop.
    play?: () => () => void;
    // What someone does in the screen once the page first shows it; returns how to stop.
    perform?: () => () => void;
    // Whether what the screen shows has settled, past its data having arrived.
    isSettled?: () => boolean;
}

const CANVAS = `/canvas/${SHEAR_DEFORMATION_ID}`;

const CHECK_MS = 250;
const CURSOR_MS = 50;
const LOBBY_MS = 2000;
const METRICS_MS = 1000;

const every = (ms: number, tick: () => void): (() => void) => {
    tick();
    const timer = window.setInterval(tick, ms);
    return () => window.clearInterval(timer);
};

// Two of the lab in the scene, as the server relays them: in its lobby, and their pointers
// over the viewport, in the 0 to 1 coordinates cursors travel in.
const playLab = (): (() => void) => {
    const stopLobby = every(LOBBY_MS, () => {
        socketService.deliver(SOCKET_CANVAS_LOBBY_EVENTS.UPDATE, LANDING_PEOPLE);
    });

    const stopCursors = every(CURSOR_MS, () => {
        const seconds = performance.now() / 1000;
        for (const colleague of LANDING_COLLEAGUES) {
            const { x, y, rx, ry, fx, fy, phase } = colleague.path;
            socketService.deliver(SOCKET_CANVAS_WORKSPACE_EVENTS.CURSOR, {
                trajectoryId: SHEAR_DEFORMATION_ID,
                ownerId: LANDING_OWNER.id,
                userId: colleague.id,
                firstName: colleague.firstName,
                lastName: colleague.lastName,
                x: x + rx * Math.sin(seconds * fx + phase),
                y: y + ry * Math.sin(seconds * fy + phase * 0.7)
            });
        }
    });

    return () => {
        stopLobby();
        stopCursors();
    };
};

// What the cluster reports while it works through the team's queue: the minute before, as the
// server sends it to a page that asks, and a report a second from then on.
const playCluster = (): (() => void) => {
    useClusterStore.getState().setConnected(true);
    setTeamJobsGroupsQueryData(LANDING_JOB_GROUPS);
    setClusterHistoryQueryData(clusterHistoryUntil(Date.now(), METRICS_MS), LANDING_CLUSTER_ID);
    return every(METRICS_MS, () => setClusterMetricsQueryData([clusterMetricsAt(Date.now())]));
};

const BUILDER_NODE = '.react-flow__node';
const BUILDER_PANE = '.react-flow__pane';
const button = (label: string) => document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
const buttonWithText = (text: string) => [...document.querySelectorAll('button')].find((element) => element.textContent?.trim() === text);
// How far the graph is dragged clear of the palette that floats over the canvas's left edge,
// and how far a turn of the wheel zooms it out, clear of the toolbars above and below it.
const PALETTE_CLEARANCE_PX = 200;
const WHEEL_NOTCH_PX = 60;

interface ScreenAction {
    // Whether the screen is ready for it.
    when?: () => boolean;
    // How long a person takes, once it is, before doing it.
    pauseMs?: number;
    // Does it, or one more piece of it: false until it is done.
    run: () => boolean | void;
}

// Does each action in turn once the screen is ready for it, as a person in it would.
const actOut = (actions: ScreenAction[], tickMs: number, onDone?: () => void): (() => void) => {
    let index = 0;
    let readySince: number | null = null;

    const timer = window.setInterval(() => {
        const action = actions[index];
        if (!action || !(action.when?.() ?? true)) {
            readySince = null;
            return;
        }

        readySince ??= performance.now();
        if (performance.now() - readySince < (action.pauseMs ?? 0) || action.run() === false) {
            return;
        }

        index += 1;
        readySince = null;
        if (index === actions.length) {
            window.clearInterval(timer);
            onDone?.();
        }
    }, tickMs);

    return () => window.clearInterval(timer);
};

const scrollWheel = (target: Element, x: number, y: number, deltaY: number) => {
    target.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, deltaY }));
};

const drag = (target: Element, x: number, y: number, dx: number) => {
    const at = (clientX: number, buttons: number) => ({ bubbles: true, cancelable: true, view: window, clientX, clientY: y, button: 0, buttons });
    target.dispatchEvent(new MouseEvent('mousedown', at(x, 1)));
    window.dispatchEvent(new MouseEvent('mousemove', at(x + dx / 2, 1)));
    window.dispatchEvent(new MouseEvent('mousemove', at(x + dx, 1)));
    window.dispatchEvent(new MouseEvent('mouseup', at(x + dx, 0)));
};

let isWorkflowFitted = false;

const onPane = (act: (pane: Element, bounds: DOMRect) => void) => () => {
    const pane = document.querySelector(BUILDER_PANE);
    if (pane) {
        act(pane, pane.getBoundingClientRect());
    }
};

// The builder fits a workflow it opens to the nodes it measures first, which can be two of
// them, under a palette that floats over the canvas. Once every node is drawn the screen does
// what a person opening the plugin would: the toolbar's "Fit to view", a turn of the wheel
// out from the middle, and a drag to clear the palette.
const BUILDER_ACTIONS: ScreenAction[] = [
    {
        when: () => document.querySelectorAll(BUILDER_NODE).length >= COORDINATION_WORKFLOW.nodes.length && Boolean(button('Fit to view')),
        run: () => button('Fit to view')?.click()
    },
    { run: onPane((pane, bounds) => scrollWheel(pane, bounds.left + bounds.width / 2, bounds.top + bounds.height / 2, WHEEL_NOTCH_PX)) },
    { run: onPane((pane, bounds) => drag(pane, bounds.left + bounds.width * 0.6, bounds.top + bounds.height * 0.85, PALETTE_CLEARANCE_PX)) }
];

const playBuilder = (): (() => void) => (
    isWorkflowFitted ? () => undefined : actOut(BUILDER_ACTIONS, CHECK_MS, () => {
        isWorkflowFitted = true;
    })
);

const TYPE_MS = 38;
const composer = () => document.querySelector<HTMLTextAreaElement>('textarea[placeholder="Ask anything"]');

// What the composer shows, set the way typing does, so the app's state follows it.
const typeInto = (field: HTMLTextAreaElement, value: string) => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
};

const isAnswering = () => Boolean(button('Stop generating'));

// The answer's table, opened beside the conversation once the assistant is done.
const OPEN_ANSWER: ScreenAction = {
    when: () => Boolean(buttonWithText('Open spreadsheet')) && !isAnswering(),
    pauseMs: 900,
    run: () => buttonWithText('Open spreadsheet')?.click()
};

// Someone asks VOLT AI the landing's question and approves the pipeline it wants to run.
const CONVERSATION_ACTIONS: ScreenAction[] = [
    {
        when: () => Boolean(composer() && !composer()?.disabled),
        pauseMs: 700,
        run: () => {
            const field = composer();
            if (!field) {
                return false;
            }
            typeInto(field, LANDING_PROMPT.slice(0, field.value.length + 1));
            return field.value.length >= LANDING_PROMPT.length;
        }
    },
    { when: () => !button('Send message')?.disabled, pauseMs: 420, run: () => button('Send message')?.click() },
    // The card takes an answer once the turn that raised it has ended.
    { when: () => buttonWithText('Approve')?.disabled === false, pauseMs: 1200, run: () => buttonWithText('Approve')?.click() },
    OPEN_ANSWER
];

let hasConversationPlayed = false;

// Once only: the screen keeps the conversation it played for as long as it stays open.
const performConversation = (): (() => void) => (
    hasConversationPlayed ? () => undefined : actOut(PLAYS_CONVERSATION ? CONVERSATION_ACTIONS : [OPEN_ANSWER], TYPE_MS, () => {
        hasConversationPlayed = true;
    })
);

const isModelShown = (): boolean => {
    const { isModelLoading, currentTimestep } = useEditorStore.getState();
    return !isModelLoading && currentTimestep !== undefined;
};

const SCENARIOS: Record<LandingScreenId, LandingScreenScenario> = {
    [LandingScreenId.Viewer]: {
        steps: [
            CANVAS,
            `${CANVAS}?analysisId=${COORDINATION_ANALYSIS_ID}`,
            `${CANVAS}?analysisId=${COORDINATION_ANALYSIS_ID}&timelineExposure=${COORDINATION_PRIMARY_EXPOSURE_ID}`
        ],
        play: playLab,
        isSettled: isModelShown
    },
    [LandingScreenId.Dashboard]: {
        steps: ['/dashboard'],
        play: playCluster
    },
    [LandingScreenId.Marketplace]: {
        steps: [`/dashboard/plugins/marketplace?package=${encodeURIComponent(FEATURED_PACKAGE)}`],
        play: playCluster
    },
    [LandingScreenId.Builder]: {
        steps: [`/plugins/builder?id=${COORDINATION_PLUGIN_ID}`],
        play: playBuilder,
        isSettled: () => isWorkflowFitted
    },
    [LandingScreenId.Assistant]: {
        steps: [`/dashboard/ai/${LANDING_CONVERSATION_ID}`],
        play: playCluster,
        perform: performConversation
    },
    [LandingScreenId.Clusters]: {
        steps: [`/dashboard/clusters/${LANDING_CLUSTER_ID}`],
        play: playCluster
    }
};

export const resolveLandingScreen = (screen: string | null): LandingScreenScenario => (
    SCENARIOS[screen as LandingScreenId] ?? SCENARIOS[LandingScreenId.Dashboard]
);
