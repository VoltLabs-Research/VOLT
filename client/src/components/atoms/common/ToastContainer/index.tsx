import React from 'react';
import { createPortal } from 'react-dom';
import { IoCloseOutline } from 'react-icons/io5';
import { MdError, MdCheckCircle, MdWarning, MdInfo } from 'react-icons/md';
import { useUIStore, type Toast, type ToastType } from '@/stores/slices/ui';
import './ToastContainer.css';
import Paragraph from '@/components/primitives/Paragraph';
import Container from '@/components/primitives/Container';
import Button from '@/components/primitives/Button';
import Tooltip from '@/components/atoms/common/Tooltip';

const getIcon = (type: ToastType) => {
  switch (type) {
    case 'error':
      return <MdError className='toast-icon f-shrink-0 font-size-4' />;
    case 'success':
      return <MdCheckCircle className='toast-icon f-shrink-0 font-size-4' />;
    case 'warning':
      return <MdWarning className='toast-icon f-shrink-0 font-size-4' />;
    case 'info':
      return <MdInfo className='toast-icon f-shrink-0 font-size-4' />;
    default:
      return null;
  }
};

const ToastEl: React.FC<{ toast: Toast }> = ({ toast }) => {
  const removeToast = useUIStore((s) => s.removeToast);

  return (
    <div className={`d-flex items-center content-between gap-1 toast toast-${toast.type} p-1`}>
      <div className='d-flex items-center gap-075 flex-1 toast-content'>
        {getIcon(toast.type)}
        <Paragraph className='toast-message font-size-2-5 color-primary'>{toast.message}</Paragraph>
      </div>
      <Tooltip content="Dismiss" placement="left">
        <Button
          variant='ghost'
          intent='neutral'
          iconOnly
          size='sm'
          onClick={() => removeToast(toast.id)}
          aria-label='Close notification'
        >
          <IoCloseOutline />
        </Button>
      </Tooltip>
    </div>
  );
};

const ToastContainer: React.FC = () => {
  const toasts = useUIStore((s) => s.toasts);
  const rootElement = document.getElementById('root');

  if (!rootElement || toasts.length === 0) {
    return null;
  }

  return createPortal(
    <Container className='p-fixed d-flex column gap-075 toast-container'>
      {toasts.map((toast) => (
        <ToastEl key={toast.id} toast={toast} />
      ))}
    </Container>,
    rootElement
  );
};

export default ToastContainer;
