import LandingScreen from '@/modules/marketing/components/LandingScreen';
import LandingSteps from '@/modules/marketing/components/LandingSteps';
import { LandingScreenId } from '@/modules/marketing/contracts/screens';
import { REGISTRY_PACKAGE_COUNT } from '@/modules/marketing/utils/landing-registry';
import { stepNumber } from '@/modules/marketing/contracts/steps';
import { usePinnedTrack } from '@/modules/marketing/hooks/use-pinned-track';
import type { CSSProperties } from 'react';

// What the platform does, a chapter at a time, each beside the page of the app that does it.
const CHAPTERS = [
    {
        id: 'servers',
        title: 'Your servers',
        heading: 'The server does the work.',
        subheading: 'Your laptop only watches.',
        lead: 'Every simulation you upload and every analysis you run lives on the server you connect, and runs on the clusters enrolled in it, in the cloud or next to your HPC. The dashboard is a window onto them, from any browser.',
        screen: LandingScreenId.Clusters,
        label: 'The monitoring page of lab-workstation, a cluster of the team: its CPU, memory, disk and network over the last minute, and the load of each of its 16 cores'
    },
    {
        id: 'together',
        title: 'Together',
        heading: 'One lab, one workspace.',
        subheading: 'Everyone sees it move.',
        lead: 'The trajectories and folders your team keeps, who is online, the jobs each cluster is working through and how hard it is working: the dashboard is the lab, the same for everyone in it. Roles decide who can do what, and whiteboards and notebooks sit next to the data.',
        screen: LandingScreenId.Dashboard,
        label: 'The VOLT dashboard of a team: its folders and trajectories, two of them still processing, with the cluster’s load and the team’s presence in the bar below'
    },
    {
        id: 'plugins',
        title: 'Plugins',
        heading: 'Nothing is hardcoded.',
        subheading: 'Every analysis is a plugin.',
        lead: `Coordination, dislocations, strain, grains, structure identification: every analysis VOLT runs is a plugin from the registry, installed onto your clusters in one click and updated when its author publishes. ${REGISTRY_PACKAGE_COUNT} come from voltlabs, and anyone can add theirs.`,
        screen: LandingScreenId.Marketplace,
        label: 'The VOLT marketplace listing the voltlabs plugins, with Dislocation Analysis (opendxa) open and ready to install'
    },
    {
        id: 'build',
        title: 'Build your own',
        heading: 'Write the algorithm.',
        subheading: 'The community runs it.',
        lead: 'A plugin is your program and the workflow around it: the arguments it takes, the frames it runs on, and how its results become models, tables and charts. Draw the workflow in the builder, publish it with vpm, and it is in the marketplace for every team that studies the same problem.',
        screen: LandingScreenId.Builder,
        label: 'The VOLT plugin builder with the Coordination Analysis workflow: its arguments, the frames it iterates over, the binary it runs and the exposures it exports'
    },
    {
        id: 'assistant',
        title: 'VOLT AI',
        heading: 'Ask in plain words.',
        subheading: 'VOLT AI runs the analysis.',
        lead: 'It works with the same tools you do: it finds the trajectory, sets up the plugin, runs the pipeline on your cluster once you approve it, and answers with what the analysis measured.',
        screen: LandingScreenId.Assistant,
        label: 'VOLT AI answering in the app: it finds Shear Deformation, asks to run Coordination Analysis, runs it once approved and answers with the coordination counts, opened as a spreadsheet'
    }
];

const LandingShowcase = () => {
    const { track, progress, isPinned, step, style } = usePinnedTrack(CHAPTERS.length);

    return (
        <section>
            <div ref={track} className='landing-track' style={style}>
                {isPinned && CHAPTERS.map((chapter, index) => (
                    <span
                        key={chapter.id}
                        id={chapter.id}
                        className='landing-track-mark'
                        style={{ '--landing-step': index } as CSSProperties}
                    />
                ))}
                <div className='landing-stage'>
                    <div className='landing-wrap landing-showcase'>
                        <div className='landing-chapters'>
                            {CHAPTERS.map((chapter, index) => {
                                // Pinned, the chapters stack in one place: how many the shown one is away.
                                const away = isPinned ? index - step : 0;

                                return (
                                    <article
                                        key={chapter.id}
                                        id={isPinned ? undefined : chapter.id}
                                        className='landing-chapter'
                                        data-active={away === 0}
                                        style={{ '--landing-away': Math.sign(away) } as CSSProperties}
                                    >
                                        <div className='landing-chapter-copy'>
                                            <p className='landing-eyebrow landing-rise'>
                                                <span className='landing-mono'>{stepNumber(index)}</span>
                                                {chapter.title}
                                            </p>
                                            <h2 className='landing-heading landing-dual landing-rise'>
                                                <span>{chapter.heading}</span>
                                                <span>{chapter.subheading}</span>
                                            </h2>
                                            <p className='landing-lead landing-rise'>{chapter.lead}</p>
                                        </div>
                                        <LandingScreen
                                            screen={chapter.screen}
                                            label={chapter.label}
                                            isShown={away === 0}
                                            isKept={Math.abs(away) <= 1}
                                            className='landing-rise'
                                        />
                                    </article>
                                );
                            })}
                        </div>
                        {isPinned && <LandingSteps steps={CHAPTERS} active={step} progress={progress} isDecorative />}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default LandingShowcase;
