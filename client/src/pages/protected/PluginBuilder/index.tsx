import { ReactFlowProvider } from '@xyflow/react';
import PluginBuilder from '@/components/organisms/plugins/PluginBuilder';

const PluginBuilderPage = () => {
    return (
        <ReactFlowProvider>
            <PluginBuilder />
        </ReactFlowProvider>
    );
};

export default PluginBuilderPage;