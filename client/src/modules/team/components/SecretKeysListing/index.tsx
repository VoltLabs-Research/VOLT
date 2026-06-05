import Button from '@/shared/presentation/primitives/Button';
import Tag from '@/shared/presentation/primitives/Tag';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import { openModal } from '@/shared/presentation/primitives/Modal';
import { runAction } from '@/shared/presentation/actions/run-action';
import { dateColumn, statusColumn, userColumn } from '@/shared/presentation/utilities/column-presets';
import { copyTextToClipboard } from '@/shared/presentation/utilities/copy-to-clipboard';
import { createPromiseToastOptions } from '@/shared/presentation/utilities/toast-options';
import { SecretKeyCreationModal, SECRET_KEY_CREATION_MODAL_ID } from '../SecretKeyCreationModal';
import { useDeleteSecretKeyMutation, useRevokeSecretKeyMutation } from '@/modules/team/hooks/secret-key/queries';
import useSecretKeysListing from '@/modules/team/hooks/secret-key/use-secret-keys-listing';
import useKeyboardShortcut from '@/shared/presentation/hooks/use-keyboard-shortcut';
import useListingActions from '@/shared/presentation/hooks/use-listing-actions';
import useTip from '@/shared/tips/use-tip';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import { PiKeyLight } from 'react-icons/pi';
import { RiBarChartLine, RiFileCopyLine, RiLineChartLine, RiShieldKeyholeLine } from 'react-icons/ri';
import { useCallback } from 'react';
import { sileo } from 'sileo';
import type { SecretKey } from '@/modules/team/api/entities/secret-key/secret-key';
import type { SocketInvalidationConfig } from '@/shared/presentation/components/DocumentListing';
import type { ColumnConfig } from '@/shared/presentation/components/DocumentListingTable';
import { SOCKET_SECRET_KEY_EVENTS } from '@/modules/socket/events/team';
import { useNavigate } from 'react-router-dom';
const SECRET_KEYS_QUERY_KEY = ['secret-keys'] as const;

const SOCKET_INVALIDATION: SocketInvalidationConfig[] = [
    { event: SOCKET_SECRET_KEY_EVENTS.CREATED, queryKeys: [SECRET_KEYS_QUERY_KEY] },
    { event: SOCKET_SECRET_KEY_EVENTS.DELETED, queryKeys: [SECRET_KEYS_QUERY_KEY] }
];

type SecretKeyColumnSkeleton = NonNullable<ColumnConfig<SecretKey>['skeleton']>;

const NAME_COLUMN_SKELETON: SecretKeyColumnSkeleton = { variant: 'text', width: 120 };
const PREFIX_COLUMN_SKELETON: SecretKeyColumnSkeleton = { variant: 'text', width: 80 };
const ROLE_COLUMN_SKELETON: SecretKeyColumnSkeleton = { variant: 'text', width: 100 };
const getDeleteSecretKeyToastOptions = (key: SecretKey) => createPromiseToastOptions({
    loading: `Deleting "${key.name}"...`,
    success: `Secret key "${key.name}" deleted`,
    error: 'Failed to delete secret key'
});

const COLUMNS: ColumnConfig<SecretKey>[] = [
    {
        key: 'name',
        title: 'Name',
        render: (_value, key) => String(key.name),
        skeleton: NAME_COLUMN_SKELETON
    },
    {
        key: 'keyPrefix',
        title: 'Prefix',
        render: (_value, key) => <Tag tone='neutral' variant='soft' size='xs' shape='square' className='font-mono'>{key.keyPrefix}...</Tag>,
        skeleton: PREFIX_COLUMN_SKELETON
    },
    {
        key: 'roleName',
        title: 'Role',
        render: (_value, key) => String(key.roleName || 'Unknown Role'),
        skeleton: ROLE_COLUMN_SKELETON
    },
    statusColumn<SecretKey>('isActive', 'Status', {
        width: 70,
        resolveStatus: (_value, key) => key.isActive ? 'active' : 'revoked'
    }),
    userColumn<SecretKey>('createdBy', 'Created By'),
    dateColumn<SecretKey>('lastUsedAt', 'Last Used', {
        width: 110,
        sortable: false,
        fallback: 'Never',
        withTitle: true
    })
];

export default function SecretKeysListing() {
    useTip('secret-keys-quick-create');

    const navigate = useNavigate();
    const { canAccess } = useTeamPermissions();
    const canCreate = canAccess(['team-secret-key:create']);
    const selectedTeam = useSelectedTeam();
    const { queryKey, fetchData } = useSecretKeysListing(selectedTeam?._id);
    const revokeSecretKeyMutation = useRevokeSecretKeyMutation();
    const deleteSecretKeyMutation = useDeleteSecretKeyMutation();

    const copySecretKeyPrefix = useCallback(async (key: SecretKey) => {
        const keyPrefix = String(key.keyPrefix || '').trim();
        if (!keyPrefix) {
            sileo.error({ title: 'No key prefix available to copy' });
            return;
        }

        await copyTextToClipboard(keyPrefix, {
            successMessage: 'Key prefix copied to clipboard',
            errorMessage: 'Failed to copy key prefix'
        });
    }, []);

    const { getMenuOptions } = useListingActions<SecretKey>({
        actions: {
            viewUsage: {
                label: 'View Usage',
                icon: RiLineChartLine,
                handler: ({ item: key }) => navigate(`/dashboard/secret-keys/${key._id}/usage`),
                requiredPermission: 'team-secret-key:read'
            },
            copy: {
                label: 'Copy Prefix',
                icon: RiFileCopyLine,
                handler: ({ item: key }) => copySecretKeyPrefix(key),
                requiredPermission: 'team-secret-key:read'
            },
            revoke: {
                label: 'Revoke Key',
                icon: RiShieldKeyholeLine,
                handler: async ({ item: key }) => {
                    if (!selectedTeam?._id) return;
                    await revokeSecretKeyMutation.mutateAsync({ teamId: selectedTeam._id, secretKeyId: key._id });
                },
                confirm: ({ selectedItems }) => (
                    selectedItems.length === 1
                        ? `Are you sure you want to revoke the secret key "${selectedItems[0].name}"? Any applications using this key will immediately lose access.`
                        : `Are you sure you want to revoke ${selectedItems.length} secret keys? Any applications using these keys will immediately lose access.`
                ),
                requiredPermission: 'team-secret-key:update'
            },
            delete: {
                label: 'Delete',
                handler: async ({ item: key }) => {
                    await runAction({
                        action: () => {
                            if (!selectedTeam?._id) return Promise.resolve();
                            return deleteSecretKeyMutation.mutateAsync({ teamId: selectedTeam._id, secretKeyId: key._id });
                        },
                        toast: getDeleteSecretKeyToastOptions(key)
                    });
                },
                confirm: ({ selectedItems }) => (
                    selectedItems.length === 1
                        ? `Are you sure you want to permanently delete the secret key "${selectedItems[0].name}"? This action cannot be undone.`
                        : `Are you sure you want to permanently delete ${selectedItems.length} secret keys? This action cannot be undone.`
                ),
                requiredPermission: 'team-secret-key:delete'
            }
        }
    });

    const handleCreateKey = useCallback(() => {
        openModal(SECRET_KEY_CREATION_MODAL_ID);
    }, []);

    const handleOpenMetrics = useCallback(() => {
        navigate('/dashboard/secret-keys/metrics');
    }, [navigate]);

    const handleOpenSecretKey = useCallback((secretKeyId: string) => {
        navigate(`/dashboard/secret-keys/${secretKeyId}`);
    }, [navigate]);

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
                queryKey={queryKey}
                columns={COLUMNS}
                fetchData={fetchData}
                defaultLimit={20}
                getMenuOptions={getRowMenuOptions}
                onItemClick={(secretKey) => {
                    handleOpenSecretKey(secretKey._id);
                    return true;
                }}
                emptyTitle='No secret keys found'
                emptyMessage='Create a secret key to authenticate your applications.'
                emptyIcon={<PiKeyLight size={32} />}
                emptyButtonText='Create new'
                onEmptyButtonClick={handleCreateKey}
                createNew={canCreate ? {
                    buttonTitle: 'Create new',
                    onCreate: handleCreateKey
                } : undefined}
                headerActions={(
                    <Button
                        variant='ghost'
                        intent='neutral'
                        onClick={handleOpenMetrics}
                        leftIcon={<RiBarChartLine size={18} />}
                    >
                        Metrics
                    </Button>
                )}
                socketInvalidation={SOCKET_INVALIDATION}
            />

            <SecretKeyCreationModal />
        </>
    );
}
