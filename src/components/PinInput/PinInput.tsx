import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Input } from '../ui/input';
import { Lock, X } from 'lucide-react';

interface PinInputProps {
  isOpen: boolean;
  onClose: () => void;
  onPinEntered: (pin: string) => void;
  title?: string;
  description?: string;
  processingStatus?: string;
}

export default function PinInput({ 
  isOpen, 
  onClose, 
  onPinEntered, 
  title = "Enter PIN",
  description = "Please enter your 6-digit PIN to authorize this action",
  processingStatus = ""
}: PinInputProps) {
  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Only allow digits
    if (value.length <= 6) {
      setPin(value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length === 6) {
      setIsSubmitting(true);
      try {
        await onPinEntered(pin);
        setPin('');
        onClose();
      } catch (error) {
        console.error('PIN submission error:', error);
        // Keep the dialog open on error
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleClose = () => {
    setPin('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md !fixed !left-1/2 !top-1/3 !-translate-x-1/2 !-translate-y-1/2">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
          <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <Lock className="h-4 w-4 text-blue-600" />
            <span className="text-sm text-blue-600">
              After entering your PIN, you'll be prompted to tap your card
            </span>
          </div>
          
          {processingStatus && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <Lock className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-600">
                {processingStatus}
              </span>
            </div>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="pin" className="text-sm font-medium">
              6-Digit PIN
            </label>
            <Input
              ref={inputRef}
              id="pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pin}
              onChange={handlePinChange}
              placeholder="000000"
              maxLength={6}
              className="text-center text-2xl tracking-widest"
              autoComplete="off"
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground text-center">
              {pin.length}/6 digits
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pin.length !== 6 || isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? 'Processing...' : 'Submit'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
