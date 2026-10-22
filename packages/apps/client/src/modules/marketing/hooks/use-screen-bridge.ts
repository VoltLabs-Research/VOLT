import queryClient from '@/shared/query/query-client';
import { ScreenMessageType, isScreenMessage } from '@/modules/marketing/contracts/screens';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ScreenMessage } from '@/modules/marketing/contracts/screens';
import type { LandingScreenScenario } from '@/modules/marketing/utils/landing-screens';

const CHECK_MS = 150;
const QUIET_CHECKS = 3;
const GIVE_UP_MS = 12_000;

// The app's route loaders, shown while a page's code or its team's access is on its way.
const ROUTE_LOADER = '[role="status"][aria-label^="Loading"], [role="status"][aria-label^="Checking"]';

const post = (message: ScreenMessage) => {
    window.parent.postMessage(message, window.location.origin);
};

const isSettled = (scenario: LandingScreenScenario): boolean => (
    queryClient.isFetching() === 0
    && document.fonts.status === 'loaded'
    && !document.querySelector(ROUTE_LOADER)
    && (scenario.isSettled?.() ?? true)
);

// A screen's side of the page: it goes where the page asks, plays its people while it is in
// view, performs what it shows once the page first shows it, and says when it has settled
// enough to be shown.
export const useScreenBridge = (scenario: LandingScreenScenario): void => {
    const navigate = useNavigate();
    const [isActive, setActive] = useState(true);
    const [isShown, setShown] = useState(false);

    useEffect(() => {
        const receive = (event: MessageEvent) => {
            if (event.source !== window.parent || event.origin !== window.location.origin || !isScreenMessage(event.data)) {
                return;
            }

            const message = event.data;
            if (message.type === ScreenMessageType.Step) {
                navigate(scenario.steps[message.step] ?? scenario.steps[0], { replace: true });
            } else if (message.type === ScreenMessageType.Active) {
                setActive(message.active);
                setShown((wasShown) => wasShown || message.active);
            }
        };

        window.addEventListener('message', receive);
        return () => window.removeEventListener('message', receive);
    }, [navigate, scenario]);

    useEffect(() => (isActive ? scenario.play?.() : undefined), [isActive, scenario]);

    useEffect(() => (isShown ? scenario.perform?.() : undefined), [isShown, scenario]);

    useEffect(() => {
        const startedAt = performance.now();
        let quiet = 0;

        const timer = window.setInterval(() => {
            quiet = isSettled(scenario) ? quiet + 1 : 0;
            if (quiet >= QUIET_CHECKS || performance.now() - startedAt > GIVE_UP_MS) {
                window.clearInterval(timer);
                post({ type: ScreenMessageType.Ready });
            }
        }, CHECK_MS);

        return () => window.clearInterval(timer);
    }, [scenario]);
};
