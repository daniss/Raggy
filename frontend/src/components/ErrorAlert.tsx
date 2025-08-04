'use client';

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ErrorAlertProps {
  error?: string | Error;
  message?: string;
  onDismiss?: () => void;
  title?: string;
  className?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const ErrorAlert: React.FC<ErrorAlertProps> = ({ 
  error,
  message,
  onDismiss, 
  title = "Erreur",
  className,
  action
}) => {
  const errorMessage = message || (typeof error === 'string' ? error : error?.message || 'Une erreur inconnue s\'est produite');

  return (
    <Alert variant="destructive" className={className}>
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <div className="flex-1">
          <p className="font-medium">{title}</p>
          <p className="text-sm mt-1">{errorMessage}</p>
          {action && (
            <Button
              variant="outline"
              size="sm"
              onClick={action.onClick}
              className="mt-2 h-auto py-1 px-2 text-xs"
            >
              {action.label}
            </Button>
          )}
        </div>
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="h-auto p-1 hover:bg-destructive-foreground/10"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
};

export default ErrorAlert;
export { ErrorAlert };