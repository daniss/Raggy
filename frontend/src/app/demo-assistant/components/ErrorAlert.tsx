'use client';

import React from 'react';
import { AlertCircle, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface ErrorAlertProps {
  title?: string;
  message: string;
  onDismiss?: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function ErrorAlert({ title = "Erreur", message, onDismiss, action }: ErrorAlertProps) {
  return (
    <Alert className="border-red-200 bg-red-50">
      <AlertCircle className="h-4 w-4 text-red-600" />
      <AlertDescription className="flex items-center justify-between">
        <div className="flex-1">
          <div className="font-semibold text-red-800">{title}</div>
          <div className="text-red-700 mt-1">{message}</div>
        </div>
        <div className="flex items-center gap-2">
          {action && (
            <Button
              variant="outline"
              size="sm"
              onClick={action.onClick}
              className="text-red-600 border-red-300 hover:bg-red-100"
            >
              {action.label}
            </Button>
          )}
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="h-6 w-6 p-0 text-red-600 hover:text-red-800 hover:bg-red-100"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}