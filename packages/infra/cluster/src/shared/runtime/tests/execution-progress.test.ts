import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createAnalysisJobProgressTracker } from '@shared/runtime/execution-progress';
import type { AnalysisJobProgressReport } from '@volt/contracts/modules/cluster/daemon-events';

const JOB = {
    jobId: 'pipeline-1:analysis-1',
    analysisId: 'analysis-1',
    name: 'Dislocation Analysis',
    teamId: 'team-1',
    trajectoryId: 'trajectory-1',
    timestep: 400
};

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const track = (expectedSteps: number, minIntervalMs = 0) => {
    const reports: AnalysisJobProgressReport[] = [];
    const tracker = createAnalysisJobProgressTracker({
        reporter: {
            reportAnalysisProgress: async (report) => {
                reports.push(report);
            }
        },
        job: JOB,
        expectedSteps,
        minIntervalMs
    });
    return {
        tracker,
        reports
    };
};

const progressOf = (reports: AnalysisJobProgressReport[]): Array<number | undefined> =>
    reports.map((report) => report.progress);

describe('createAnalysisJobProgressTracker', () => {
    test('reports the job it tracks with the value and text', () => {
        const { tracker, reports } = track(1);
        tracker.beginStep()({
            progress: 0.4,
            text: 'Meshing'
        });

        assert.deepEqual(reports, [{
            ...JOB,
            progress: 0.4,
            progressText: 'Meshing'
        }]);
    });

    test('a status alone gives a text and no value', () => {
        const { tracker, reports } = track(1);
        tracker.beginStep()({ text: 'Indexing neighbours' });

        assert.deepEqual(reports, [{
            ...JOB,
            progressText: 'Indexing neighbours'
        }]);
    });

    test('composes the steps of a job as equal shares', () => {
        const { tracker, reports } = track(2);
        const first = tracker.beginStep();
        first({ progress: 0.5 });
        first({ progress: 1 });
        const second = tracker.beginStep();
        second({ progress: 0.5 });

        assert.deepEqual(progressOf(reports), [0.25, 0.5, 0.75]);
    });

    test('never goes back, within a step or when more steps run than expected', () => {
        const { tracker, reports } = track(1);
        const first = tracker.beginStep();
        first({ progress: 0.8 });
        first({ progress: 0.3 });
        tracker.beginStep()({ progress: 0.2 });

        assert.deepEqual(progressOf(reports), [0.8]);
    });

    test('a step that ended does not report over the one running now', () => {
        const { tracker, reports } = track(2);
        const first = tracker.beginStep();
        tracker.beginStep()({ progress: 0.5 });
        first({
            progress: 1,
            text: 'late'
        });

        assert.deepEqual(reports, [{
            ...JOB,
            progress: 0.75
        }]);
    });

    test('the text of a step does not carry over to the next one', () => {
        const { tracker, reports } = track(2);
        tracker.beginStep()({
            progress: 1,
            text: 'Nested plugin'
        });
        tracker.beginStep()({ progress: 0.5 });

        assert.deepEqual(reports.map((report) => report.progressText), ['Nested plugin', undefined]);
    });

    test('sends at most one report per interval, ending with the latest value', async () => {
        const { tracker, reports } = track(1, 50);
        const step = tracker.beginStep();
        for (let index = 1; index <= 10; index += 1) {
            step({ progress: index / 10 });
        }
        assert.deepEqual(progressOf(reports), [0.1]);

        await wait(200);
        assert.deepEqual(progressOf(reports), [0.1, 1]);
        tracker.close();
    });

    test('sends nothing still pending once it is closed', async () => {
        const { tracker, reports } = track(1, 40);
        const step = tracker.beginStep();
        step({ progress: 0.1 });
        step({ progress: 0.9 });
        tracker.close();
        step({ progress: 1 });

        await wait(80);
        assert.deepEqual(progressOf(reports), [0.1]);
    });
});
