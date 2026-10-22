import { useState, type ReactNode } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  tone?: 'primary' | 'danger';
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
  children?: ReactNode;
  confirmDisabled?: boolean;
}

export function ConfirmDialog({ open, title, description, confirmLabel = 'Confirmar', tone = 'primary', onConfirm, onClose, children, confirmDisabled }: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={handleConfirm} loading={loading} disabled={confirmDisabled}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description && <div className="text-sm text-grafite/80">{description}</div>}
      {children && <div className="mt-4">{children}</div>}
    </Modal>
  );
}
