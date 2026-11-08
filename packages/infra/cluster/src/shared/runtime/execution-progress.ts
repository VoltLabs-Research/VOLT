import { logger } from '@shared/logger';
import type { AnalysisJobProgressReport, AnalysisJobReport } from '@volt/contracts/modules/cluster/daemon-events';
import type { PluginProgressDirective } from '@volt/contracts/modules/plugin/progress';

interface AnalysisProgressReporter {
    reportAnalysisProgress(input: AnalysisJobProgressReport): Promise<void>;
}

interface AnalysisJobProgressTrackerOptions {
    reporter: AnalysisProgressReporter;
    job: AnalysisJobReport;
    // How many plugin processes the job runs, one after another: its entrypoints and those of the
    // plugins it calls. Each one is an equal share of the job.
    expectedSteps: number;
    minIntervalMs?: number;
}

export interface AnalysisJobProgressTracker {
    // The next plugin process of the job starts; its directives go to the handler this returns.
    beginStep(): (directive: PluginProgressDirective) => void;
    // The job is over: nothing it still has pending is sent.
    close(): void;
}

// Once a second is enough to see a bar move, and it keeps a busy cluster's reports cheap.
const DEFAULT_MIN_INTERVAL_MS = 1_000;
const PROGRESS_RESOLUTION = 1_000;

const roundProgress = (value: number): number => Math.round(value * PROGRESS_RESOLUTION) / PROGRESS_RESOLUTION;

/*
 * A job's progress from the plugin processes it runs, the way OVITO's sub-steps compose it: step i
 * of n at fraction f is (i + f) / n of the job. It never goes back, and it is only reported once a
 * plugin has said something, so a plugin that reports nothing leaves the job without a value.
 */
export const createAnalysisJobProgressTracker = (
    options: AnalysisJobProgressTrackerOptions
): AnalysisJobProgressTracker => {
    const expectedSteps = Math.max(1, options.expectedSteps);
    const minIntervalMs = options.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
    let stepIndex = -1;
    let stepFraction = 0;
    let progress: number | undefined;
    let text: string | undefined;
    let sent: { progress?: number; text?: string } | null = null;
    let lastSentAt = 0;
    let timer: NodeJS.Timeout | null = null;
    let closed = false;

    const send = (): void => {
        timer = null;
        if (closed) return;
        if (sent && sent.progress === progress && sent.text === text) return;

        sent = {
            progress,
            text
        };
        lastSentAt = Date.now();
        options.reporter.reportAnalysisProgress({
            ...options.job,
            ...(progress !== undefined ? { progress } : {}),
            ...(text !== undefined ? { progressText: text } : {})
        }).catch((error: unknown) => {
            logger.warn({
                err: error,
                jobId: options.job.jobId
            }, 'Failed to report analysis job progress');
        });
    };

    const schedule = (): void => {
        if (closed || timer) return;
        const wait = lastSentAt + minIntervalMs - Date.now();
        if (wait <= 0) {
            send();
            return;
        }
        timer = setTimeout(send, wait);
        timer.unref();
    };

    return {
        beginStep() {
            stepIndex += 1;
            const step = stepIndex;
            stepFraction = 0;
            // What the last process was doing no longer describes this one.
            text = undefined;

            return (directive) => {
                // A step that already ended reports nothing over the one that runs now.
                if (closed || step !== stepIndex) return;

                if (directive.progress !== undefined) {
                    stepFraction = Math.max(stepFraction, directive.progress);
                    const overall = Math.min(1, (step + stepFraction) / Math.max(expectedSteps, step + 1));
                    progress = roundProgress(Math.max(progress ?? 0, overall));
                }
                if (directive.text !== undefined) {
                    text = directive.text;
                }
                schedule();
            };
        },
        close() {
            closed = true;
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
        }
    };
};
