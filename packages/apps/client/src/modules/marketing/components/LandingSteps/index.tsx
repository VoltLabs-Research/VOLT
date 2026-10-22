import { stepNumber } from '@/modules/marketing/contracts/steps';
import { motion, useTransform } from 'framer-motion';
import type { MotionValue } from 'framer-motion';

interface LandingStep {
    title: string;
    body?: string;
}

interface LandingStepsProps {
    steps: LandingStep[];
    // The step shown; without one, as when nothing is pinned, every step is.
    active?: number;
    // How far the page has scrolled through the steps, drawn as a rule over each.
    progress?: MotionValue<number>;
    // When the steps only index what the page already says.
    isDecorative?: boolean;
}

const StepProgress = ({ progress, index, count }: { progress: MotionValue<number>; index: number; count: number }) => {
    const scaleX = useTransform(progress, [index / count, (index + 1) / count], [0, 1]);
    return <motion.span aria-hidden='true' className='landing-steps-progress' style={{ scaleX }} />;
};

const LandingSteps = ({ steps, active, progress, isDecorative }: LandingStepsProps) => (
    <ol aria-hidden={isDecorative} className='landing-steps'>
        {steps.map((step, index) => (
            <li key={step.title} className='landing-note' data-active={active === undefined || index === active}>
                {progress && <StepProgress progress={progress} index={index} count={steps.length} />}
                <span className='landing-mono'>{stepNumber(index)}</span>
                <h3>{step.title}</h3>
                {step.body && <p>{step.body}</p>}
            </li>
        ))}
    </ol>
);

export default LandingSteps;
