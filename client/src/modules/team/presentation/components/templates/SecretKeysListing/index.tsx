import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PiKeyLight } from 'react-icons/pi';
import { RiFileCopyLine, RiShieldKeyholeLine, RiBarChartLine, RiLineChartLine } from 'react-icons/ri';
import { formatDistanceToNow } from 'date-fns';
import useGetSecretKeys from '@/modules/team/presentation/hooks/secret-key/use-get-secret-keys';
import useRevokeSecretKey from '@/modules/team/presentation/hooks/secret-key/use-revoke-secret-key';
import useDeleteSecretKey from '@/modules/team/presentation/hooks/secret-key/use-delete-secret-key';
import DocumentListing, { type ColumnConfig, createListSyncConfig } from '@/shared/presentation/components/DocumentListing';
import StatusBadge from '@/shared/presentation/components/StatusBadge';
import { openModal } from '@/shared/presentation/components/Modal';
import useListingActions from '@/shared/presentation/hooks/use-listing-actions';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { sileo } from 'sileo';
import SecretKeyCreationModal, { SECRET_KEY_CREATION_MODAL_ID } from '../../organisms/SecretKeyCreationModal';
import type { SecretKey } from '@/modules/team/domain/entities';
import { SECRET_KEY_ROUTES } from '@/modules/team/domain/constants';
import useKeyboardShortcut from '@/shared/presentation/hooks/use-keyboard-shortcut';
import Button from '@/shared/presentation/components/Button';
import './SecretKeysListing.css';

const LIST_SYNC = createListSyncConfig('secret-key');

const COLUMNS: ColumnConfig[] = [
    {
        key: 'name',
        title: 'Name',
        render: (v) => String(v),
        skeleton: { variant: 'text', width: 120 }
    },
    {
        key: 'keyPrefix',
        title: 'Prefix',
        render: (v) => <span className="secret-keys-listing-prefix-badge">{v as string}...</span>,
        skeleton: { variant: 'text', width: 80 }
    },
    {
        key: 'roleName',
        title: 'Role',
        render: (v) => String(v || 'Unknown Role'),
        skeleton: { variant: 'text', width: 100 }
    },
    {
        key: 'isActive',
        title: 'Status',
        render: (v) => (
            <StatusBadge status={(v as boolean) ? 'active' : 'revoked'} />
        ),
        skeleton: { variant: 'rounded', width: 70, height: 24 }
    },
    {
        key: 'createdAt',
        title: 'Created At',
        render: (v) => formatDistanceToNow(new Date(v as string), { addSuffix: true }),
        skeleton: { variant: 'text', width: 90 }
    },
    {
        key: 'lastUsedAt',
        title: 'Last Used',
        render: (v) => v ? formatDistanceToNow(new Date(v as string), { addSuffix: true }) : 'Never',
        skeleton: { variant: 'text', width: 90 }
    }
];

const SecretKeysListing = () => {
    const navigate = useNavigate();
    const getSecretKeys = useGetSecretKeys();
    const revokeSecretKey = useRevokeSecretKey();
    const deleteSecretKey = useDeleteSecretKey();

    const copySecretKeyPrefix = useCallback(async (key: SecretKey) => {
        const keyPrefix = String(key.keyPrefix || '').trim();
        if (!keyPrefix) {
            sileo.error({ title: 'No key prefix available to copy' });
            return;
        }

        try {
            await navigator.clipboard.writeText(keyPrefix);
            sileo.success({ title: 'Key prefix copied to clipboard' });
        } catch {
            sileo.error({ title: 'Failed to copy key prefix' });
        }
    }, []);

    const { getMenuOptions } = useListingActions<SecretKey>({
        actions: {
            viewUsage: {
                label: 'View Usage',
                icon: RiLineChartLine,
                handler: ({ item: key }) => navigate(SECRET_KEY_ROUTES.USAGE(key._id))
            },
            copy: {
                label: 'Copy Prefix',
                icon: RiFileCopyLine,
                handler: ({ item: key }) => copySecretKeyPrefix(key)
            },
            revoke: {
                label: 'Revoke Key',
                icon: RiShieldKeyholeLine,
                handler: async ({ item: key }) => {
                    await revokeSecretKey(key._id);
                },
                confirm: ({ selectedItems }) => (
                    selectedItems.length === 1
                        ? `Are you sure you want to revoke the secret key "${selectedItems[0].name}"? Any applications using this key will immediately lose access.`
                        : `Are you sure you want to revoke ${selectedItems.length} secret keys? Any applications using these keys will immediately lose access.`
                )
            },
            delete: {
                label: 'Delete',
                handler: async ({ item: key }) => {
                    await showPromise(deleteSecretKey(key._id), {
                        loading: { title: `Deleting "${key.name}"...` },
                        success: { title: `Secret key "${key.name}" deleted` },
                        error: { title: 'Failed to delete secret key' }
                    });
                },
                confirm: ({ selectedItems }) => (
                    selectedItems.length === 1
                        ? `Are you sure you want to permanently delete the secret key "${selectedItems[0].name}"? This action cannot be undone.`
                        : `Are you sure you want to permanently delete ${selectedItems.length} secret keys? This action cannot be undone.`
                )
            }
        }
    });

    const handleCreateKey = useCallback(() => {
        openModal(SECRET_KEY_CREATION_MODAL_ID);
    }, []);

    const getRowMenuOptions = useCallback((item: SecretKey, selectedKeys: SecretKey[]) => {
        const options = getMenuOptions(item, selectedKeys);
        if (item.isActive) {
            return options;
        }

        return options.filter((option) => option.label !== 'Revoke Key');
    }, [getMenuOptions]);

    useKeyboardShortcut('n', handleCreateKey);

    return (
        <>
            <DocumentListing<SecretKey>
                title='Secret Keys'
                columns={COLUMNS}
                fetchData={getSecretKeys}
                defaultLimit={20}
                getMenuOptions={getRowMenuOptions}
                emptyTitle='No secret keys found'
                emptyMessage='Create a secret key to authenticate your applications.'
                emptyIcon={<PiKeyLight size={32} />}
                emptyButtonText='Create new'
                onEmptyButtonClick={handleCreateKey}
                createNew={{
                    buttonTitle: 'Create new',
                    onCreate: handleCreateKey
                }}
                headerActions={
                    <Button
                        variant='ghost'
                        intent='neutral'
                        onClick={() => navigate(SECRET_KEY_ROUTES.METRICS)}
                        leftIcon={<RiBarChartLine size={18} />}
                    >
                        Metrics
                    </Button>
                }
                listSyncConfig={LIST_SYNC}
            />

            <SecretKeyCreationModal />
        </>
    );
};

export default SecretKeysListing;
