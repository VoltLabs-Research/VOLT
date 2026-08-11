import { statusBadgeClass } from '@/shared/ui/status-vocabulary';

/**
 * bravais's `StatusBadge`, reduced to what it actually painted: coloured,
 * uppercased text. It had no background and no border in any variant, which is why
 * a HeroUI `Chip` is the wrong replacement — a Chip adds a pill fill that was
 * never there.
 *
 * The status→tone table used to be copied in full into this file. It now lives
 * once in `@/shared/ui/status-vocabulary`, shared with the generic listing column
 * presets, because it is VOLT's domain vocabulary rather than this module's.
 */
interface ContainerStatusBadgeProps {
    status: string;
};

const ContainerStatusBadge = ({ status }: ContainerStatusBadgeProps) => (
    <span className={statusBadgeClass(status)}>{status}</span>
);

export default ContainerStatusBadge;
