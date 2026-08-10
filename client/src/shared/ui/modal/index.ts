/**
 * The modal system's public surface.
 *
 * A call site migrating off the old design system points its
 * `Modal` / `openModal` / `closeModal` / `resetModal` import at
 * `@/shared/ui/modal` and changes nothing else — the prop names and the function
 * signatures are unchanged. The one adjustment: `Modal` was a *default* export
 * there and is a named one here, matching the rest of the migrated tree.
 *
 * `useIsModalOpen` and `useModalTopLayerRoot` are the two hooks a caller may need:
 * the first to react to a modal's state without rendering it (a drawer that pauses
 * a subscription while hidden), the second only for a floating surface positioned
 * with `@floating-ui/react` rather than by HeroUI — everything from
 * `@heroui/react` is redirected automatically. `useModalStore` is exported for the
 * rare case that needs a custom selector; prefer `useIsModalOpen`.
 */
export { Modal } from '@/shared/ui/modal/Modal';
export { closeModal, openModal, resetModal, useIsModalOpen, useModalStore } from '@/shared/ui/modal/use-modal-store';
export { useModalTopLayerRoot } from '@/shared/ui/modal/top-layer';
