import LandingScreen from '@/modules/marketing/components/LandingScreen';
import LandingSteps from '@/modules/marketing/components/LandingSteps';
import { LandingScreenId } from '@/modules/marketing/contracts/screens';
import { Theme } from '@/shared/ui/hooks/use-theme';
import { usePinnedTrack } from '@/modules/marketing/hooks/use-pinned-track';

// Without the pin there is no walk through: the screen shows the analysis.
const UNPINNED_STEP = 1;

// What each of the viewer screen's steps shows (see landing-screens.ts).
const STEPS = [
    {
        title: 'Open a trajectory',
        body: 'Every frame of a LAMMPS dump, streamed from your server, drawn on your GPU, with your lab in it.',
        label: 'The VOLT viewer with the Shear Deformation sample open, 36,624 atoms, and two colleagues\u2019 cursors over it'
    },
    {
        title: 'Run an analysis',
        body: 'Coordination Analysis ran on the lab\u2019s workstation and colors each atom by its neighbor count.',
        label: 'The same scene colored by Coordination Analysis, with the analysis in the scene tree'
    },
    {
        title: 'Read the numbers',
        body: 'What the analysis measured, a row per frame beside the scene, ready to sort and export.',
        label: 'The coordination listing under the scene: cutoff, minimum, maximum and mean coordination for each frame'
    }
];

const LandingTour = () => {
    const { track, progress, isPinned, step: scrolledStep, style } = usePinnedTrack(STEPS.length);
    const step = isPinned ? scrolledStep : UNPINNED_STEP;

    return (
        <section id='viewer' aria-label='The viewer'>
            <div ref={track} className='landing-track' style={style}>
                <div className='landing-stage'>
                    <div className='landing-wrap landing-tour-frame'>
                        <LandingScreen
                            screen={LandingScreenId.Viewer}
                            step={step}
                            theme={Theme.Light}
                            label={STEPS[step].label}
                        />
                        <LandingSteps
                            steps={STEPS}
                            active={isPinned ? step : undefined}
                            progress={isPinned ? progress : undefined}
                        />
                    </div>
                </div>
            </div>
        </section>
    );
};

export default LandingTour;
