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

        <div className={cn('flex w-full min-w-0 flex-col gap-3', className)}>
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
            <CopyableField
                className='min-w-0'
                value={installCommand}
                successMessage='Install command copied'
            />
        </div>
    );
};

export default ClusterInstallCommandPicker;
