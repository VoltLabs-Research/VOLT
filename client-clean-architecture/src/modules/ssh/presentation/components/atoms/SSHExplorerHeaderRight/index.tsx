import RefreshButton from '@/shared/presentation/components/RefreshButton';

interface SSHExplorerHeaderRightProps {
    onRefresh: () => void;
};

const SSHExplorerHeaderRight = ({ onRefresh }: SSHExplorerHeaderRightProps) => (
    <RefreshButton
        label='Refresh'
        variant='ghost'
        intent='neutral'
        onClick={onRefresh}
    />
);

export default SSHExplorerHeaderRight;
