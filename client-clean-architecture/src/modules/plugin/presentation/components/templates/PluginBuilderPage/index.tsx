import { useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import PluginBuilder from '../../organisms/PluginBuilder';
import usePluginBuilderStore from '../../../stores/use-plugin-builder-store';
import useLoadPlugin from '../../../hooks/use-load-plugin';
import useSearchParamsState from '@/shared/presentation/hooks/use-search-params';

const PluginBuilderPage = () => {
    const { searchParams } = useSearchParamsState();
    const pluginId = searchParams.get('id');

    const clearWorkflow = usePluginBuilderStore((state) => state.clearWorkflow);
    const loadPlugin = useLoadPlugin();

    useEffect(() => {
        if (pluginId) {
            loadPlugin(pluginId);
        } else {
            clearWorkflow();
        }
    }, [pluginId, loadPlugin, clearWorkflow]);

    return (
        <ReactFlowProvider>
            <PluginBuilder />
        </ReactFlowProvider>
    );
};

export default PluginBuilderPage;
