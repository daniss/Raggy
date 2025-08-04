'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Paperclip,
  Mic,
  StopCircle,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export default function ChatInput({ 
  onSendMessage, 
  disabled = false,
  placeholder = "Posez votre question sur vos documents...",
  className 
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    // TODO: Implement voice recording functionality
  };

  return (
    <form 
      onSubmit={handleSubmit}
      className={cn("bg-white border-t", className)}
    >
      <div className="max-w-4xl mx-auto p-4">
        <div className="relative flex items-end gap-2">
          {/* Textarea container */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              rows={1}
              className={cn(
                "w-full resize-none rounded-lg border border-gray-300 bg-white px-4 py-3 pr-12",
                "placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "min-h-[52px] max-h-[200px] transition-all duration-200"
              )}
              style={{ height: 'auto' }}
            />
            
            {/* Character count */}
            {message.length > 0 && (
              <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                {message.length}/1000
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {/* Attachment button */}
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={disabled}
              className="h-[52px] w-[52px]"
              title="Joindre un fichier (bientôt disponible)"
            >
              <Paperclip className="h-5 w-5" />
            </Button>

            {/* Voice button */}
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={toggleRecording}
              disabled={disabled}
              className={cn(
                "h-[52px] w-[52px]",
                isRecording && "bg-red-50 border-red-300 hover:bg-red-100"
              )}
              title={isRecording ? "Arrêter l'enregistrement" : "Enregistrement vocal (bientôt disponible)"}
            >
              {isRecording ? (
                <StopCircle className="h-5 w-5 text-red-600" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </Button>

            {/* Send button */}
            <Button
              type="submit"
              disabled={!message.trim() || disabled}
              className="h-[52px] px-6"
            >
              {disabled ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Envoi...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5 mr-2" />
                  Envoyer
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Helper text */}
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
          <span>
            Appuyez sur <kbd className="px-1.5 py-0.5 bg-gray-100 rounded">Entrée</kbd> pour envoyer, 
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded ml-1">Maj+Entrée</kbd> pour une nouvelle ligne
          </span>
          <span>
            Vos données sont sécurisées et privées
          </span>
        </div>
      </div>
    </form>
  );
}