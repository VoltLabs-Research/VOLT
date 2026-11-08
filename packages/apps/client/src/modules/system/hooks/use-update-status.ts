import { useEffect, useRef, useState } from 'react';
import { localStackMode } from '@/modules/local-stack/services/local-stack-mode';
import { updateStatusQuery } from '@/modules/system/hooks/queries';
import type { DesktopUpdateState, SystemUpdateStatus } from '@volt/contracts/modules/system/domain';

interface DesktopUpdateBridge{
    update?: {
        get: () => Promise<DesktopUpdateState>;
        apply: () => Promise<void>;
    };
    on?: (channel: 'app:update:state', cb: (state: DesktopUpdateState) => void) => () => void;
}

const desktopBridge = (): DesktopUpdateBridge | undefined =>
    (window as unknown as { volt?: DesktopUpdateBridge }).volt;

const STATUS_INTERVAL_MS = 30 * 60 * 1000;
const APPLYING_INTERVAL_MS = 5_000;

// The desktop app's own update, which its updater reports as it downloads.
export const useDesktopUpdate = (): { state: DesktopUpdateState; apply: () => Promise<void> } | null => {
    const bridge = desktopBridge();
    const [state, setState] = useState<DesktopUpdateState>({ status: 'idle' });

    useEffect(() => {
        if (!bridge?.update || !bridge.on) return;
        let active = true;
        void bridge.update.get().then((current) => {
            if (active) setState(current);
        }).catch(() => undefined);
        const off = bridge.on('app:update:state', setState);
        return () => {
            active = false;
            off();
        };
    }, [bridge]);

    if (!bridge?.update) return null;
    return { state, apply: bridge.update.apply };
};

// A self-hosted server's update. While one runs the server goes away and comes back on the new
// release; the page then reloads, so it runs the client that release serves.
export const useServerUpdate = (): SystemUpdateStatus | null => {
    const enabled = !localStackMode.isEnabled();
    const appliedFrom = useRef<string | null>(null);
    const { data } = updateStatusQuery(undefined, {
        enabled,
        retry: false,
        refetchOnWindowFocus: false,
        refetchInterval: (query) => {
            const status = query.state.data;
            // Keep asking while the server is down for its update, until it answers on the new release.
            if (status?.applying || appliedFrom.current) return APPLYING_INTERVAL_MS;
            return STATUS_INTERVAL_MS;
        }
    });

    useEffect(() => {
        if (!data) return;
        if (data.applying && !appliedFrom.current) appliedFrom.current = data.currentVersion ?? '';
        // An update that failed while the server stayed up leaves it on the same release.
        if (!data.applying && data.error) appliedFrom.current = null;
        if (appliedFrom.current !== null && !data.applying && data.currentVersion !== appliedFrom.current) {
            window.location.reload();
        }
    }, [data]);

    return enabled ? data ?? null : null;
};
