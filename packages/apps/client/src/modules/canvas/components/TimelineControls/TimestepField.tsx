import { NumberField } from '@heroui/react';

interface TimestepFieldProps {
    value: number | undefined;
    timesteps: number[];
    onChange: (timestep: number) => void;
}

// One pill, as the dock's other fields: no hairlines between the steppers and the value.
const STEPPER_CLASS = 'h-7 w-6 rounded-full border-0 bg-transparent text-muted hover:text-foreground [&_svg]:size-3';

const nearestIndex = (timesteps: number[], wanted: number): number => {
    let best = 0;
    timesteps.forEach((timestep, index) => {
        if (Math.abs(timestep - wanted) < Math.abs(timesteps[best] - wanted)) best = index;
    });
    return best;
};

// The current timestep, as OVITO's spinner: type one to jump to the nearest, or step a frame at a time.
const TimestepField = ({ value, timesteps, onChange }: TimestepFieldProps) => {
    const index = value === undefined ? -1 : timesteps.indexOf(value);

    const handleChange = (next: number) => {
        if (!Number.isFinite(next) || timesteps.length === 0) return;
        // NumberField steps by 1, so a change of exactly 1 is a stepper or an arrow key: it moves one frame,
        // whatever the spacing. A typed timestep goes to the nearest one there is.
        if (value !== undefined && index >= 0 && Math.abs(next - value) === 1) {
            const target = Math.min(timesteps.length - 1, Math.max(0, index + Math.sign(next - value)));
            onChange(timesteps[target]);
            return;
        }
        onChange(timesteps[nearestIndex(timesteps, next)]);
    };

    return (
        <NumberField
            aria-label='Current timestep'
            value={value ?? Number.NaN}
            onChange={handleChange}
            isDisabled={timesteps.length === 0}
            formatOptions={{ useGrouping: false }}
            className='w-32 shrink-0 max-md:w-28'
        >
            <NumberField.Group className='h-7 min-h-7 grid-cols-[1.5rem_minmax(0,1fr)_1.5rem] rounded-full border-0 bg-foreground/5 shadow-none hover:bg-foreground/[0.08] focus-within:bg-foreground/[0.08]'>
                <NumberField.DecrementButton aria-label='Previous timestep' className={STEPPER_CLASS} />
                <NumberField.Input className='bg-transparent px-0 py-0 text-center text-xs tabular-nums sm:text-xs' />
                <NumberField.IncrementButton aria-label='Next timestep' className={STEPPER_CLASS} />
            </NumberField.Group>
        </NumberField>
    );
};

export default TimestepField;
