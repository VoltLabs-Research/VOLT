import RefreshButton from '@/shared/presentation/components/RefreshButton';

interface SSHExplorerHeaderRightProps {
    onRefresh: () => void;
    isRefreshing?: boolean;
};

const SSHExplorerHeaderRight = ({ onRefresh, isRefreshing = false }: SSHExplorerHeaderRightProps) => (
    <RefreshButton
        label='Refresh'
        variant='ghost'
        intent='neutral'
        onClick={onRefresh}
        isLoading={isRefreshing}
    />
);

export default SSHExplorerHeaderRight;
