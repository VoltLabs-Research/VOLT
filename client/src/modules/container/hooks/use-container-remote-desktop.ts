import xrdpService from '../api/service/xrdp-service';
import { buildBackendWebSocketUrl } from '@/app/core/http/utilities/backend-origin';
import { useCallback, useEffect, useRef, useState } from 'react';
import Guacamole from 'guacamole-common-js';
import type { Container } from '../api/entities/container';
import type { ContainerXrdpSession } from '../api/entities/container-xrdp-session';
import type { RefObject } from 'react';

type GuacamoleClient = InstanceType<typeof Guacamole.Client>;
type GuacamoleKeyboard = InstanceType<typeof Guacamole.Keyboard>;

interface RemoteDesktopCredentials {
    username: string;
    password: string;
};

interface RemoteDesktopViewport {
    width: number;
    height: number;
    dpi: number;
};

export enum RemoteDesktopConnectionState {
    Idle = 'idle',
    Connecting = 'connecting',
    Connected = 'connected',
    Error = 'error'
};

interface UseContainerRemoteDesktopReturn {
    credentials: RemoteDesktopCredentials;
    connectionState: RemoteDesktopConnectionState;
    displayElementRef: RefObject<HTMLDivElement | null>;
    errorMessage: string | null;
    expiresAt: string | null;
    focusDisplay: () => void;
    refreshViewport: () => void;
    setUsername: (username: string) => void;
    setPassword: (password: string) => void;
    connect: () => Promise<void>;
    disconnect: () => void;
};

const DEFAULT_VIEWPORT_WIDTH = 1280;
const DEFAULT_VIEWPORT_HEIGHT = 720;
const DEFAULT_VIEWPORT_DPI = 96;
const CONNECTED_GUACAMOLE_STATE = 3;
const DISCONNECTED_GUACAMOLE_STATE = 5;

const buildWebSocketUrl = (path: string): string => {
    return buildBackendWebSocketUrl(path);
};

const clearElement = (element: HTMLElement | null): void => {
    if (!element) {
        return;
    }

    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
};

const measureViewport = (element: HTMLDivElement | null): RemoteDesktopViewport => {
    const width = element?.clientWidth || DEFAULT_VIEWPORT_WIDTH;
    const height = element?.clientHeight || DEFAULT_VIEWPORT_HEIGHT;

    return {
        width,
        height,
        dpi: DEFAULT_VIEWPORT_DPI
    };
};

const useContainerRemoteDesktop = (container: Container): UseContainerRemoteDesktopReturn => {
    const displayElementRef = useRef<HTMLDivElement>(null);
    const clientRef = useRef<GuacamoleClient | null>(null);
    const keyboardRef = useRef<GuacamoleKeyboard | null>(null);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);
    const connectedRef = useRef(false);
    const viewportFrameRef = useRef<number | null>(null);
    const viewportSyncRef = useRef<() => void>(() => undefined);
    const [credentials, setCredentials] = useState<RemoteDesktopCredentials>({
        username: 'ubuntu',
        password: 'ubuntu'
    });
    const [session, setSession] = useState<ContainerXrdpSession | null>(null);
    const [connectionState, setConnectionState] = useState<RemoteDesktopConnectionState>(RemoteDesktopConnectionState.Idle);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [expiresAt, setExpiresAt] = useState<string | null>(null);

    const cancelScheduledViewportSync = useCallback(() => {
        if (viewportFrameRef.current === null) {
            return;
        }

        window.cancelAnimationFrame(viewportFrameRef.current);
        viewportFrameRef.current = null;
    }, []);

    const focusDisplay = useCallback(() => {
        displayElementRef.current?.focus({
            preventScroll: true
        });
    }, []);

    const refreshViewport = useCallback(() => {
        cancelScheduledViewportSync();

        viewportFrameRef.current = window.requestAnimationFrame(() => {
            viewportFrameRef.current = window.requestAnimationFrame(() => {
                viewportFrameRef.current = null;
                viewportSyncRef.current();
            });
        });
    }, [cancelScheduledViewportSync]);

    const disconnect = useCallback(() => {
        connectedRef.current = false;
        resizeObserverRef.current?.disconnect();
        resizeObserverRef.current = null;
        cancelScheduledViewportSync();

        if (keyboardRef.current) {
            keyboardRef.current.onkeydown = null;
            keyboardRef.current.onkeyup = null;
        }

        if (clientRef.current) {
            clientRef.current.disconnect();
            clientRef.current = null;
        }

        viewportSyncRef.current = () => undefined;

        clearElement(displayElementRef.current);
        setSession(null);
        setExpiresAt(null);
        setErrorMessage(null);
        setConnectionState(RemoteDesktopConnectionState.Idle);
    }, [cancelScheduledViewportSync]);

    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    useEffect(() => {
        if (!session) {
            return;
        }

        const displayElement = displayElementRef.current;
        const tunnel = new Guacamole.WebSocketTunnel(buildWebSocketUrl(session.websocketPath));
        const client = new Guacamole.Client(tunnel);
        let keyboard = keyboardRef.current;

        if (displayElement && !keyboard) {
            keyboard = new Guacamole.Keyboard(displayElement);
            keyboardRef.current = keyboard;
        }

        clientRef.current = client;

        clearElement(displayElement);
        displayElement?.appendChild(client.getDisplay().getElement());

        connectedRef.current = false;

        viewportSyncRef.current = () => {
            if (!connectedRef.current) {
                return;
            }

            const viewport = measureViewport(displayElementRef.current);
            client.sendSize(viewport.width, viewport.height);
        };

        const resizeObserver = new ResizeObserver(() => {
            refreshViewport();
        });
        resizeObserverRef.current = resizeObserver;

        const handleViewportChange = (): void => {
            refreshViewport();
        };

        const handleMouseDown = (state: Parameters<GuacamoleClient['sendMouseState']>[0]): void => {
            focusDisplay();
            client.sendMouseState(state);
        };

        const mouse = new Guacamole.Mouse(client.getDisplay().getElement());
        mouse.onmousedown = handleMouseDown;
        mouse.onmouseup = client.sendMouseState.bind(client);
        mouse.onmousemove = client.sendMouseState.bind(client);

        if (keyboard) {
            keyboard.onkeydown = (keysym: number) => {
                client.sendKeyEvent(1, keysym);
                return true;
            };
            keyboard.onkeyup = (keysym: number) => {
                client.sendKeyEvent(0, keysym);
            };
        }

        client.onerror = (status) => {
            setErrorMessage(status.message || 'Remote desktop connection failed');
            setConnectionState(RemoteDesktopConnectionState.Error);
        };
        tunnel.onerror = (status) => {
            setErrorMessage(status.message || 'Remote desktop websocket failed');
            setConnectionState(RemoteDesktopConnectionState.Error);
        };
        client.onstatechange = (state) => {
            if (state === CONNECTED_GUACAMOLE_STATE) {
                connectedRef.current = true;
                resizeObserver.observe(displayElementRef.current || document.body);
                window.addEventListener('resize', handleViewportChange);
                window.visualViewport?.addEventListener('resize', handleViewportChange);
                document.addEventListener('fullscreenchange', handleViewportChange);
                refreshViewport();
                focusDisplay();
                setConnectionState(RemoteDesktopConnectionState.Connected);
            }

            if (state === DISCONNECTED_GUACAMOLE_STATE) {
                connectedRef.current = false;
                setSession(null);
                setConnectionState((currentState) => {
                    if (currentState === RemoteDesktopConnectionState.Error) {
                        return currentState;
                    }

                    return RemoteDesktopConnectionState.Idle;
                });
            }
        };

        client.connect(`token=${encodeURIComponent(session.token)}`);

        return () => {
            connectedRef.current = false;
            resizeObserver.disconnect();
            window.removeEventListener('resize', handleViewportChange);
            window.visualViewport?.removeEventListener('resize', handleViewportChange);
            document.removeEventListener('fullscreenchange', handleViewportChange);
            cancelScheduledViewportSync();

            if (keyboardRef.current) {
                keyboardRef.current.onkeydown = null;
                keyboardRef.current.onkeyup = null;
            }

            viewportSyncRef.current = () => undefined;
            client.disconnect();
            clearElement(displayElement);
            clientRef.current = null;
        };
    }, [cancelScheduledViewportSync, focusDisplay, refreshViewport, session]);

    const connect = useCallback(async () => {
        if (!credentials.username.trim() || !credentials.password.trim()) {
            setErrorMessage('Username and password are required for XRDP access.');
            setConnectionState(RemoteDesktopConnectionState.Error);
            return;
        }

        disconnect();
        setConnectionState(RemoteDesktopConnectionState.Connecting);
        setErrorMessage(null);

        const viewport = measureViewport(displayElementRef.current);
        try {
            const nextSession = await xrdpService.createSession({
                teamId: container.team,
                containerId: container._id,
                username: credentials.username,
                password: credentials.password,
                width: viewport.width,
                height: viewport.height,
                dpi: viewport.dpi
            });

            setExpiresAt(nextSession.expiresAt);
            setSession(nextSession);
        } catch (error: unknown) {
            const description = error instanceof Error ? error.message : 'Failed to create XRDP session';
            setErrorMessage(description);
            setConnectionState(RemoteDesktopConnectionState.Error);
        }
    }, [container._id, container.team, credentials.password, credentials.username, disconnect]);

    const setUsername = useCallback((username: string) => {
        setCredentials((previousCredentials) => ({
            ...previousCredentials,
            username
        }));
    }, []);

    const setPassword = useCallback((password: string) => {
        setCredentials((previousCredentials) => ({
            ...previousCredentials,
            password
        }));
    }, []);

    return {
        credentials,
        connectionState,
        displayElementRef,
        errorMessage,
        expiresAt,
        focusDisplay,
        refreshViewport,
        setUsername,
        setPassword,
        connect,
        disconnect
    };
};

export default useContainerRemoteDesktop;
