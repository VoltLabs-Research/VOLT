import { Button, cn } from '@heroui/react';
import { Download, LoaderCircle, RefreshCw, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { runAction } from '@/shared/ui/actions/run-action';
import { readStoredString, writeStoredString } from '@/shared/utils/local-storage';
import { applySystemUpdate } from '@/modules/system/hooks/queries';
import { useDesktopUpdate, useServerUpdate } from '@/modules/system/hooks/use-update-status';
import type { SystemUpdateStatus } from '@volt/contracts/modules/system/domain';

const DISMISSED_KEY = 'volt:update-notice:dismissed';

interface NoticeProps {
    icon: LucideIcon;
    spin?: boolean;
    action?: ReactNode;
    children: ReactNode;
}

// Pollium's NoticeBar: a thin band across the window, above the header. In the desktop app it is
// also part of what drags the frameless window, so its own controls opt out.
const Notice = ({ icon: Icon, spin = false, action, children }: NoticeProps) => (
    <div role='status' className='volt-drag-region flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1.5 border-b border-foreground/10 bg-foreground/[0.04] px-4 py-2 text-sm text-foreground'>
        <p className='flex min-w-0 items-center gap-2'>
            <Icon aria-hidden='true' className={cn('size-4 shrink-0 text-warning', spin && 'animate-spin motion-reduce:animate-none')} />
            <span>{children}</span>
        </p>
        {action ? <span className='flex items-center gap-1'>{action}</span> : null}
    </div>
);

const pillClass = 'h-7 min-w-0 rounded-full px-3 text-xs';

const Progress = ({ percent }: { percent: number }) => (
    <span className='flex items-center gap-2'>
        <span className='h-1 w-28 overflow-hidden rounded-full bg-foreground/10' role='progressbar' aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label='Download progress'>
            <span className='block h-full rounded-full bg-foreground transition-[width] duration-300' style={{ width: `${percent}%` }} />
        </span>
        <span className='text-xs text-muted tabular-nums'>{percent}%</span>
    </span>
);

// "Later" hides a release's notice for this browser; a newer release shows again.
const useDismissal = (version: string | null) => {
    const [dismissed, setDismissed] = useState(() => readStoredString(DISMISSED_KEY));
    return {
        isDismissed: version !== null && dismissed === version,
        dismiss: () => {
            if (!version) return;
            writeStoredString(DISMISSED_KEY, version);
            setDismissed(version);
        }
    };
};

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;

const DesktopUpdateNotice = ({ update }: { update: NonNullable<ReturnType<typeof useDesktopUpdate>> }) => {
    const { state } = update;
    const version = state.status === 'idle' ? null : state.version;
    const { isDismissed, dismiss } = useDismissal(version);
    if (state.status === 'idle' || isDismissed) return null;

    const later = (
        <Button variant='ghost' size='sm' className={pillClass} onPress={dismiss}>Later</Button>
    );

    if (state.status === 'downloading') {
        return (
            <Notice icon={Download} action={<Progress percent={state.percent} />}>
                Downloading VOLT {state.version}
            </Notice>
        );
    }

    if (state.status === 'ready') {
        return (
            <Notice
                icon={RefreshCw}
                action={<>{later}<Button variant='primary' size='sm' className={pillClass} onPress={() => void update.apply()}>Restart now</Button></>}
            >
                VOLT {state.version} is ready. Restart to update.
            </Notice>
        );
    }

    return (
        <Notice
            icon={Download}
            action={<>{later}<Button variant='primary' size='sm' className={pillClass} onPress={() => void update.apply()}>Download</Button></>}
        >
            VOLT {state.version} is available.
        </Notice>
    );
};

const applyServerUpdate = async (status: SystemUpdateStatus): Promise<void> => {
    await runAction({
        confirm: {
            title: `Update to VOLT ${status.latest?.version}?`,
            description: 'This server restarts on the new release, and so do the clusters installed on other machines. Running jobs stop. It takes a few minutes; the page reloads when it is back.',
            confirmText: 'Update now'
        },
        action: applySystemUpdate
    });
};

const ServerUpdateNotice = ({ status }: { status: SystemUpdateStatus }) => {
    const version = status.latest?.version ?? null;
    const { isDismissed, dismiss } = useDismissal(version);

    if (status.applying) {
        return (
            <Notice icon={LoaderCircle} spin>
                Updating VOLT to {version}. The server restarts with its clusters; this page reloads when it is back.
            </Notice>
        );
    }

    if (status.error) {
        return (
            <Notice
                icon={TriangleAlert}
                action={status.canApply ? <Button variant='primary' size='sm' className={pillClass} onPress={() => void applyServerUpdate(status)}>Try again</Button> : undefined}
            >
                {status.error}
            </Notice>
        );
    }

    if (status.updateAvailable && !isDismissed) {
        if (!status.canApply) {
            return (
                <Notice icon={Download}>
                    VOLT {version} is available. The account that deployed this server can update it.
                </Notice>
            );
        }

        return (
            <Notice
                icon={Download}
                action={<>
                    <Button variant='ghost' size='sm' className={pillClass} onPress={dismiss}>Later</Button>
                    <Button variant='primary' size='sm' className={pillClass} onPress={() => void applyServerUpdate(status)}>Update now</Button>
                </>}
            >
                VOLT {version} is available.
            </Notice>
        );
    }

    // The server already runs the release; clusters on other machines follow when they report in.
    if (status.clustersBehind > 0 && status.currentVersion) {
        return (
            <Notice icon={LoaderCircle} spin>
                Updating {plural(status.clustersBehind, 'cluster')} to VOLT {status.currentVersion}.
            </Notice>
        );
    }

    return null;
};

// "New version available": the desktop app's own update there, and the server's (with its
// clusters) for a browser on a self-hosted deployment.
const UpdateNoticeBar = () => {
    const desktop = useDesktopUpdate();
    const server = useServerUpdate();

    if (desktop) return <DesktopUpdateNotice update={desktop} />;
    if (server) return <ServerUpdateNotice status={server} />;
    return null;
};

export default UpdateNoticeBar;
