import remoteDesktopService from '../api/service/remote-desktop-service';
import { buildBackendUrl } from '@/app/core/http/utilities/backend-origin';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Container } from '../api/entities/container';
import type { RefObject } from 'react';

interface RemoteDesktopCredentials {
    password: string;
};

interface RemoteDesktopViewport {
    width: number;
    height: number;
    dpi: number;
};

interface RemoteDesktopFrameMessage {
    source: string;
    type: string;
    message?: string;
    clean?: boolean;
};

interface RemoteDesktopFrameMessageRecord {
    source?: unknown;
    type?: unknown;
};

interface UseContainerRemoteDesktopReturn {
    credentials: RemoteDesktopCredentials;
    connectionState: RemoteDesktopConnectionState;
    stageElementRef: RefObject<HTMLDivElement | null>;
    frameElementRef: RefObject<HTMLIFrameElement | null>;
    errorMessage: string | null;
    expiresAt: string | null;
    remoteDesktopUrl: string | null;
    focusDisplay: () => void;
    refreshViewport: () => void;
    handleFrameError: () => void;
    setPassword: (password: string) => void;
    connect: () => Promise<void>;
    disconnect: () => void;
};

export enum RemoteDesktopConnectionState {
    Idle = 'idle',
    Connecting = 'connecting',
    Connected = 'connected',
    Error = 'error'
};

const DEFAULT_VIEWPORT_WIDTH = 1280;
const DEFAULT_VIEWPORT_HEIGHT = 720;
const DEFAULT_VIEWPORT_DPI = 96;
const REMOTE_DESKTOP_FRAME_MESSAGE_SOURCE = 'volt:container-vnc';
const REMOTE_DESKTOP_FRAME_MESSAGE_TYPE_READY = 'ready';
const REMOTE_DESKTOP_FRAME_MESSAGE_TYPE_ERROR = 'error';
const REMOTE_DESKTOP_FRAME_MESSAGE_TYPE_DISCONNECTED = 'disconnected';

const isRemoteDesktopFrameMessage = (value: unknown): value is RemoteDesktopFrameMessage => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return false;
    }

    const data: RemoteDesktopFrameMessageRecord = value;
    return typeof data.source === 'string' && typeof data.type === 'string';
};

const measureViewport = (element: HTMLDivElement | null): RemoteDesktopViewport => {
    let width = DEFAULT_VIEWPORT_WIDTH;
    let height = DEFAULT_VIEWPORT_HEIGHT;

    if (element && element.clientWidth > 0) {
        width = element.clientWidth;
    }

    if (element && element.clientHeight > 0) {
        height = element.clientHeight;
    }

    return {
        width,
        height,
        dpi: DEFAULT_VIEWPORT_DPI
    };
};

const useContainerRemoteDesktop = (container: Container): UseContainerRemoteDesktopReturn => {
    const stageElementRef = useRef<HTMLDivElement>(null);
    const frameElementRef = useRef<HTMLIFrameElement>(null);
    const [credentials, setCredentials] = useState<RemoteDesktopCredentials>({
        password: ''
    });
    const [connectionState, setConnectionState] = useState<RemoteDesktopConnectionState>(RemoteDesktopConnectionState.Idle);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [expiresAt, setExpiresAt] = useState<string | null>(null);
    const [remoteDesktopUrl, setRemoteDesktopUrl] = useState<string | null>(null);
    const activeRemoteDesktopUrlRef = useRef<string | null>(null);
    const activeRemoteDesktopOriginRef = useRef<string | null>(null);

    const focusDisplay = useCallback(() => {
        frameElementRef.current?.focus({
            preventScroll: true
        });
    }, []);

    const refreshViewport = useCallback(() => {
        focusDisplay();
    }, [focusDisplay]);

    const disconnect = useCallback(() => {
        activeRemoteDesktopUrlRef.current = null;
        activeRemoteDesktopOriginRef.current = null;
        frameElementRef.current = null;
        setRemoteDesktopUrl(null);
        setExpiresAt(null);
        setErrorMessage(null);
        setConnectionState(RemoteDesktopConnectionState.Idle);
    }, []);

    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    const handleFrameError = useCallback(() => {
        activeRemoteDesktopUrlRef.current = null;
        activeRemoteDesktopOriginRef.current = null;
        setRemoteDesktopUrl(null);
        setExpiresAt(null);
        setConnectionState(RemoteDesktopConnectionState.Error);
        setErrorMessage('Failed to load the embedded remote desktop.');
    }, []);

    useEffect(() => {
        const handleRemoteDesktopMessage = (event: MessageEvent<unknown>): void => {
            const frameWindow = frameElementRef.current?.contentWindow;
            if (event.source !== frameWindow || !isRemoteDesktopFrameMessage(event.data)) {
                return;
            }

            if (event.data.source !== REMOTE_DESKTOP_FRAME_MESSAGE_SOURCE) {
                return;
            }

            if (!activeRemoteDesktopUrlRef.current) {
                return;
            }

            if (activeRemoteDesktopOriginRef.current && event.origin !== activeRemoteDesktopOriginRef.current) {
                return;
            }

            if (event.data.type === REMOTE_DESKTOP_FRAME_MESSAGE_TYPE_READY) {
                setConnectionState(RemoteDesktopConnectionState.Connected);
                setErrorMessage(null);
                focusDisplay();
                return;
            }

            if (event.data.type === REMOTE_DESKTOP_FRAME_MESSAGE_TYPE_ERROR) {
                setRemoteDesktopUrl(null);
                setExpiresAt(null);
                activeRemoteDesktopUrlRef.current = null;
                activeRemoteDesktopOriginRef.current = null;
                setConnectionState(RemoteDesktopConnectionState.Error);
                setErrorMessage(event.data.message || 'Failed to connect to the remote desktop.');
                return;
            }

            if (event.data.type === REMOTE_DESKTOP_FRAME_MESSAGE_TYPE_DISCONNECTED) {
                setRemoteDesktopUrl(null);
                setExpiresAt(null);
                activeRemoteDesktopUrlRef.current = null;
                activeRemoteDesktopOriginRef.current = null;
                setConnectionState(RemoteDesktopConnectionState.Error);
                setErrorMessage(event.data.message || 'Remote desktop disconnected.');
            }
        };

        window.addEventListener('message', handleRemoteDesktopMessage);

        return () => {
            window.removeEventListener('message', handleRemoteDesktopMessage);
        };
    }, [focusDisplay]);

    const connect = useCallback(async () => {
        if (!credentials.password.trim()) {
            setErrorMessage('Password is required for remote desktop access.');
            setConnectionState(RemoteDesktopConnectionState.Error);
            return;
        }

        disconnect();
        setConnectionState(RemoteDesktopConnectionState.Connecting);
        setErrorMessage(null);

        const viewport = measureViewport(stageElementRef.current);
        try {
            const nextSession = await remoteDesktopService.createSession({
                teamId: container.team,
                containerId: container._id,
                password: credentials.password,
                parentOrigin: window.location.origin,
                width: viewport.width,
                height: viewport.height,
                dpi: viewport.dpi
            });

            setExpiresAt(nextSession.expiresAt);
            activeRemoteDesktopUrlRef.current = buildBackendUrl(nextSession.noVncUrl);
            activeRemoteDesktopOriginRef.current = new URL(activeRemoteDesktopUrlRef.current).origin;
            setRemoteDesktopUrl(activeRemoteDesktopUrlRef.current);
        } catch (error: unknown) {
            const description = error instanceof Error ? error.message : 'Failed to create remote desktop session';
            setErrorMessage(description);
            setConnectionState(RemoteDesktopConnectionState.Error);
        }
    }, [container._id, container.team, credentials.password, disconnect]);

    const setPassword = useCallback((password: string) => {
        setErrorMessage(null);
        if (connectionState === RemoteDesktopConnectionState.Error) {
            setConnectionState(RemoteDesktopConnectionState.Idle);
        }

        setCredentials((previousCredentials) => ({
            ...previousCredentials,
            password
        }));
    }, [connectionState]);

    return {
        credentials,
        connectionState,
        stageElementRef,
        frameElementRef,
        errorMessage,
        expiresAt,
        remoteDesktopUrl,
        focusDisplay,
        refreshViewport,
        handleFrameError,
        setPassword,
        connect,
        disconnect
    };
};

export default useContainerRemoteDesktop;
