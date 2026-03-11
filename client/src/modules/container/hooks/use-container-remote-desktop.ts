import xrdpService from '../api/service/xrdp-service';
import { useCallback, useEffect, useRef, useState } from 'react';
import Guacamole from 'guacamole-common-js';
import type { Container } from '../api/entities/container';
import type { ContainerXrdpSession } from '../api/entities/container-xrdp-session';
import type { RefObject } from 'react';

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
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}${path}`;
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
    const clientRef = useRef<InstanceType<typeof Guacamole.Client> | null>(null);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);
    const [credentials, setCredentials] = useState<RemoteDesktopCredentials>({
        username: 'ubuntu',
        password: 'ubuntu'
    });
    const [session, setSession] = useState<ContainerXrdpSession | null>(null);
    const [connectionState, setConnectionState] = useState<RemoteDesktopConnectionState>(RemoteDesktopConnectionState.Idle);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [expiresAt, setExpiresAt] = useState<string | null>(null);

    const disconnect = useCallback(() => {
        resizeObserverRef.current?.disconnect();
        resizeObserverRef.current = null;

        if (clientRef.current) {
            clientRef.current.disconnect();
            clientRef.current = null;
        }

        clearElement(displayElementRef.current);
        setSession(null);
        setExpiresAt(null);
        setErrorMessage(null);
        setConnectionState(RemoteDesktopConnectionState.Idle);
    }, []);

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
        const keyboard = new Guacamole.Keyboard(document);

        clientRef.current = client;

        clearElement(displayElement);
        displayElement?.appendChild(client.getDisplay().getElement());

        const sendViewportSize = () => {
            const viewport = measureViewport(displayElementRef.current);
            client.sendSize(viewport.width, viewport.height);
        };

        const resizeObserver = new ResizeObserver(() => {
            sendViewportSize();
        });
        resizeObserver.observe(displayElementRef.current || document.body);
        resizeObserverRef.current = resizeObserver;

        const mouse = new Guacamole.Mouse(client.getDisplay().getElement());
        mouse.onmousedown = client.sendMouseState.bind(client);
        mouse.onmouseup = client.sendMouseState.bind(client);
        mouse.onmousemove = client.sendMouseState.bind(client);

        keyboard.onkeydown = (keysym: number) => {
            client.sendKeyEvent(1, keysym);
            return true;
        };
        keyboard.onkeyup = (keysym: number) => {
            client.sendKeyEvent(0, keysym);
        };

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
                sendViewportSize();
                setConnectionState(RemoteDesktopConnectionState.Connected);
            }

            if (state === DISCONNECTED_GUACAMOLE_STATE) {
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
            resizeObserver.disconnect();
            client.disconnect();
            clearElement(displayElement);
            clientRef.current = null;
        };
    }, [session]);

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
        setUsername,
        setPassword,
        connect,
        disconnect
    };
};

export default useContainerRemoteDesktop;
