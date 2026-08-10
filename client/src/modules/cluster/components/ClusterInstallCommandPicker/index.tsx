import { ToggleButton, ToggleButtonGroup, cn } from '@heroui/react';
import CopyableField from '@/shared/ui/components/CopyableField';
import {
    CLUSTER_INSTALL_PLATFORM_OPTIONS,
    ClusterInstallPlatform,
    buildClusterInstallCommand,
    getDefaultClusterInstallPlatform,
    isClusterInstallPlatform
} from '@/modules/cluster/utils/build-cluster-install-command';
import { useMemo, useState } from 'react';

interface ClusterInstallCommandPickerProps {
    clusterId: string | null;
    enrollmentToken: string | null;
    className?: string;
};

const ClusterInstallCommandPicker = ({
    clusterId,
    enrollmentToken,
    className = ''
}: ClusterInstallCommandPickerProps) => {
    const [activePlatform, setActivePlatform] = useState<ClusterInstallPlatform>(getDefaultClusterInstallPlatform);

    const installCommand = useMemo(() => {
        if (!clusterId || !enrollmentToken) {
            return '';
        }

        return buildClusterInstallCommand(clusterId, enrollmentToken, activePlatform);
    }, [activePlatform, clusterId, enrollmentToken]);

    return (
        /*
         * `w-full min-w-0` was `.cluster-install-command-picker` — the whole of the
         * deleted sheet apart from its reach into CopyableField below.
         */
        <div className={cn('flex w-full min-w-0 flex-col gap-3', className)}>
            {/*
              * bravais's `SegmentedTabs` was a `role='tablist'` wired to no panel: it
              * picked a platform, it did not switch a view. Spec §4c therefore sends
              * it to `ToggleButtonGroup` rather than `Tabs`. `disallowEmptySelection`
              * reproduces the fully-controlled single-active behaviour — there was no
              * way to deselect a segment — and `ariaLabel` becomes the DOM-cased
              * `aria-label`.
              *
              * Two knock-on changes worth knowing: the control is now a `role='group'`
              * of `aria-pressed` buttons instead of tabs wired to nothing, and arrow
              * keys move between segments, which `SegmentedTabs` never implemented.
              * The framer-motion sliding pill goes with it; HeroUI paints the selected
              * segment itself.
              */}
            <ToggleButtonGroup
                aria-label='Cluster host operating system'
                selectionMode='single'
                disallowEmptySelection
                selectedKeys={[activePlatform]}
                onSelectionChange={(keys) => {
                    for (const key of keys) {
                        const nextPlatform = String(key);

                        if (isClusterInstallPlatform(nextPlatform)) {
                            setActivePlatform(nextPlatform);
                        }
                    }
                }}
                size='sm'
                fullWidth
            >
                {CLUSTER_INSTALL_PLATFORM_OPTIONS.map((option) => (
                    <ToggleButton key={option.id} id={option.id}>
                        {option.label}
                    </ToggleButton>
                ))}
            </ToggleButtonGroup>

            {/*
              * `.cluster-install-command-picker .copyable-field { min-width: 0 }`,
              * expressed through the `className` CopyableField already merges with
              * `cn` instead of reaching into shared/ui by class name.
              */}
            <CopyableField
                className='min-w-0'
                value={installCommand}
                successMessage='Install command copied'
            />
        </div>
    );
};

export default ClusterInstallCommandPicker;
