import type { DaemonJobEvent, DaemonStreamEvent } from '@volt/contracts/modules/cluster/daemon-events';

export type TeamClusterDaemonServerEventMessage = DaemonJobEvent | DaemonStreamEvent;
