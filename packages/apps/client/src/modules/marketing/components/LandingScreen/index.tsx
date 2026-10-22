import { SCREEN_HEIGHT, SCREEN_WIDTH, ScreenMessageType, isScreenMessage, resolveScreenUrl } from '@/modules/marketing/contracts/screens';
import { Theme } from '@/shared/ui/hooks/use-theme';
import { useScreenPresence } from '@/modules/marketing/hooks/use-screen-presence';
import { useScreenTurn } from '@/modules/marketing/hooks/use-screen-turn';
import { cn } from '@heroui/react';
import { useEffect, useRef, useState } from 'react';
import type { LandingScreenId, ScreenMessage } from '@/modules/marketing/contracts/screens';
import type { CSSProperties } from 'react';
import type { VisualTheme } from '@/shared/ui/hooks/use-theme';

interface LandingScreenProps {
    screen: LandingScreenId;
    // What the screen shows, for whoever cannot see it.
    label: string;
    step?: number;
    // The app's theme in the screen; the frame takes its colors while the screen boots.
    theme?: VisualTheme;
    // Of screens stacked in one place: whether the page shows this one, and whether it keeps
    // it open, as the one before or after it, to show it at once.
    isShown?: boolean;
    isKept?: boolean;
    className?: string;
}

const post = (iframe: HTMLIFrameElement | null, message: ScreenMessage) => {
    iframe?.contentWindow?.postMessage(message, window.location.origin);
};

// How long a screen may keep its turn to boot before the next one starts anyway.
const BOOT_TIMEOUT_MS = 20_000;

// One of the app's pages, running in a document of its own from the landing's fixtures (see
// src/app/screen.tsx), laid out at a laptop's size and scaled into the page. It is a picture
// of the app: nothing in it takes focus or the pointer, so the page scrolls straight past.
const LandingScreen = ({ screen, label, step = 0, theme = Theme.Dark, isShown = true, isKept = true, className }: LandingScreenProps) => {
    const frame = useRef<HTMLDivElement>(null);
    const iframe = useRef<HTMLIFrameElement>(null);
    const presence = useScreenPresence(frame);
    const isNear = presence.isNear && isKept;
    const isVisible = presence.isVisible && isShown;
    const [scale, setScale] = useState(0);
    const [isStarted, setStarted] = useState(false);
    const [isReady, setReady] = useState(false);
    const [isLate, setLate] = useState(false);
    const hasTurn = useScreenTurn(isNear && !isReady && !isLate, isVisible);

    useEffect(() => {
        const element = frame.current;
        if (!element) {
            return;
        }

        const watcher = new ResizeObserver(() => setScale(element.clientWidth / SCREEN_WIDTH));
        watcher.observe(element);
        return () => watcher.disconnect();
    }, []);

    useEffect(() => {
        if (isNear && hasTurn) {
            setStarted(true);
        } else if (!isNear) {
            setStarted(false);
            setReady(false);
            setLate(false);
        }
    }, [isNear, hasTurn]);

    useEffect(() => {
        if (!isStarted || isReady) {
            return;
        }

        const receive = (event: MessageEvent) => {
            if (event.source === iframe.current?.contentWindow && event.origin === window.location.origin
                && isScreenMessage(event.data) && event.data.type === ScreenMessageType.Ready) {
                setReady(true);
            }
        };
        const timeout = window.setTimeout(() => setLate(true), BOOT_TIMEOUT_MS);

        window.addEventListener('message', receive);
        return () => {
            window.removeEventListener('message', receive);
            window.clearTimeout(timeout);
        };
    }, [isStarted, isReady]);

    useEffect(() => {
        if (isReady) {
            post(iframe.current, { type: ScreenMessageType.Step, step });
        }
    }, [isReady, step]);

    useEffect(() => {
        if (isReady) {
            post(iframe.current, { type: ScreenMessageType.Active, active: isVisible });
        }
    }, [isReady, isVisible]);

    return (
        <div
            ref={frame}
            role='img'
            aria-label={label}
            data-ready={isReady}
            data-theme={theme}
            className={cn('landing-screen', className)}
            style={{ '--landing-screen-scale': scale } as CSSProperties}
        >
            {isStarted && (
                <iframe
                    ref={iframe}
                    src={resolveScreenUrl(screen, theme)}
                    title={label}
                    width={SCREEN_WIDTH}
                    height={SCREEN_HEIGHT}
                    tabIndex={-1}
                    inert
                    aria-hidden='true'
                />
            )}
        </div>
    );
};

export default LandingScreen;
