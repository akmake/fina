import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/Button';

/**
 * Reusable confirmation dialog for destructive or important actions.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {string} [props.confirmLabel]      default "אישור"
 * @param {string} [props.cancelLabel]       default "ביטול"
 * @param {'default'|'destructive'} [props.variant]  default "destructive"
 * @param {() => void} props.onConfirm
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'אישור',
  cancelLabel = 'ביטול',
  variant = 'destructive',
  onConfirm,
}) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription className="mt-2">{description}</DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
          <Button variant={variant} onClick={handleConfirm}>
            {confirmLabel}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
