import Select from '@/shared/presentation/components/Select';
import useTrajectorySelector from '../../../hooks/trajectory/use-trajectory-selector';

export interface TrajectorySelectorProps {
    value: string | null;
    onChange: (value: string | null) => void;
    placeholder?: string;
    allowEmpty?: boolean;
    emptyLabel?: string;
    disabled?: boolean;
    className?: string;
};

const TrajectorySelector = ({
    value,
    onChange,
    placeholder = 'Select trajectory...',
    allowEmpty = false,
    emptyLabel = 'All Trajectories',
    disabled = false,
    className
}: TrajectorySelectorProps) => {
    const { options, isLoading, loadMore } = useTrajectorySelector({
        allowEmpty,
        emptyLabel
    });

    const handleChange = (newValue: string) => {
        onChange(newValue === '' ? null : newValue);
    };

    return (
        <Select
            options={options}
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            disabled={disabled}
            className={className}
            isLoading={isLoading}
            onScrollEnd={loadMore}
        />
    );
};

export default TrajectorySelector;
