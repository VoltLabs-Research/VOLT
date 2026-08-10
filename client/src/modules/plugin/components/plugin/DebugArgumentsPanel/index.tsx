import { Button, IconButton } from '@voltstack/bravais';
import { NodeType } from '@volt/contracts/modules/plugin/enums';
import ArgumentFieldsRenderer from '@/modules/plugin/components/plugin/ArgumentFieldsRenderer';
import useDebugTrajectorySelector from '@/modules/plugin/hooks/plugin/use-debug-trajectory-selector';
import { usePluginBuilderStore } from '@/modules/plugin/store/plugin/use-plugin-builder-store';
import { usePluginDebugStore } from '@/modules/plugin/store/plugin/use-plugin-debug-store';
import {
    collectVisibleDefaultArgumentValues,
    getUserConfigurableArguments
} from '@/modules/plugin/utils/plugin/argument-values';
import { X, Play, Settings2 } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import './DebugArgumentsPanel.css';

interface DebugArgumentsPanelProps {
    onStart: () => void;
    canStart: boolean;
}

const DebugArgumentsPanel = ({ onStart, canStart }: DebugArgumentsPanelProps) => {
    const nodes = usePluginBuilderStore((s) => s.nodes);
    const {
        debugConfig,
        showArgumentsPanel,
        setDebugConfigField,
        setDebugConfig,
        setShowArgumentsPanel,
        isDebugging,
        isStarting
    } = usePluginDebugStore();

    const { selectedTrajectory } = useDebugTrajectorySelector();

    // Memoised: identity is load-bearing as a dependency of the defaults effect below.
    const configurableArgs = useMemo(() => {
        const argsDefinitions = nodes.find((n) => n.type === NodeType.ARGUMENTS)?.data.arguments?.arguments;
        return argsDefinitions ? getUserConfigurableArguments(argsDefinitions) : [];
    }, [nodes]);

    useEffect(() => {
        if (configurableArgs.length === 0) return;

        const defaultConfig = collectVisibleDefaultArgumentValues(configurableArgs, debugConfig);
        const newConfig: Record<string, unknown> = { ...debugConfig };
        let hasChanges = false;

        for (const [key, value] of Object.entries(defaultConfig)) {
            if (newConfig[key] === undefined) {
                newConfig[key] = value;
                hasChanges = true;
            }
        }

        if (hasChanges) {
            setDebugConfig(newConfig);
        }
    }, [configurableArgs, debugConfig, setDebugConfig]);

    const handleStartClick = () => {
        setShowArgumentsPanel(false);
        onStart();
    };

    if (configurableArgs.length === 0 || !showArgumentsPanel) return null;

    return (
        <div className='flex flex-col rounded-xl absolute z-10 center-x panel-floating overflow-hidden debug-arguments-panel bg-surface border border-border'>
            <div className='flex flex-row items-center justify-between shrink-0 debug-arguments-panel-header'>
                <div className='flex flex-row items-center gap-2'>
                    <Settings2 size={14} />
                    <p className='text-sm font-semibold'>
                        Debug Arguments
                    </p>
                </div>
                <IconButton
                    variant='ghost'
                    size='sm'
                    onClick={() => setShowArgumentsPanel(false)}
                >
                    <X size={14} />
                </IconButton>
            </div>

            <div className='flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto debug-arguments-panel-body'>
                <ArgumentFieldsRenderer
                    arguments={configurableArgs}
                    values={debugConfig}
                    onChange={setDebugConfigField}
                    frameOptions={(selectedTrajectory?.frames ?? []).map((frame, index) => ({
                        value: String(frame.timestep),
                        title: `Frame ${index + 1} (t=${frame.timestep})`
                    }))}
                />
            </div>

            <div className='shrink-0 debug-arguments-panel-footer'>
                <Button
                    variant='outline'
                    intent='white'
                    size='sm'
                    block
                    onClick={handleStartClick}
                    disabled={!canStart || isDebugging || isStarting}
                >
                    <Play size={12} />
                    Start Debug
                </Button>
            </div>
        </div>
    );
};

export default DebugArgumentsPanel;
