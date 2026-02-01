import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ReactFlowProvider } from '@xyflow/react';
import PluginBuilder from '../../organisms/PluginBuilder';
import usePluginBuilderStore from '../../../stores/use-plugin-builder-store';
import useLoadPlugin from '../../../hooks/use-load-plugin';

const PluginBuilderPage = () => {
    const [searchParams] = useSearchParams();
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
