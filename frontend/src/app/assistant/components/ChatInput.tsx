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
  };

  return (
    <div className={cn("bg-gradient-to-r from-gray-50 to-white border-t border-gray-200", className)}>
      <div className="w-full p-6">
        <form onSubmit={handleSubmit} className="relative">
          <div className="flex items-end gap-3">
            {/* Textarea container */}
            <div className="flex-1 relative">
              <div className="relative rounded-2xl border border-gray-300 bg-white shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all duration-200">
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={placeholder}
                  disabled={disabled}
                  rows={1}
                  className={cn(
                    "w-full resize-none rounded-2xl bg-transparent px-4 py-4 pr-16",
                    "placeholder:text-gray-400 focus:outline-none",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    "min-h-[56px] max-h-[200px] transition-all duration-200"
                  )}
                  style={{ height: 'auto' }}
                />
                
                {/* Character count */}
                {message.length > 0 && (
                  <div className="absolute bottom-3 right-4 text-xs text-gray-400">
                    {message.length}/1000
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {/* Attachment button */}
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={disabled}
                className="h-[56px] w-[56px] rounded-2xl border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                title="Joindre un fichier (bientôt disponible)"
              >
                <Paperclip className="h-5 w-5 text-gray-600" />
              </Button>

              {/* Voice button */}
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={toggleRecording}
                disabled={disabled}
                className={cn(
                  "h-[56px] w-[56px] rounded-2xl border-gray-300",
                  isRecording 
                    ? "bg-red-50 border-red-300 hover:bg-red-100" 
                    : "hover:border-gray-400 hover:bg-gray-50"
                )}
                title={isRecording ? "Arrêter l'enregistrement" : "Enregistrement vocal (bientôt disponible)"}
              >
                {isRecording ? (
                  <StopCircle className="h-5 w-5 text-red-600" />
                ) : (
                  <Mic className="h-5 w-5 text-gray-600" />
                )}
              </Button>

              {/* Send button */}
              <Button
                type="submit"
                disabled={!message.trim() || disabled}
                className={cn(
                  "h-[56px] px-6 rounded-2xl",
                  "bg-gray-900 hover:bg-gray-800 text-white",
                  "shadow-lg hover:shadow-xl transition-all duration-200",
                  "disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:bg-gray-400"
                )}
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
        </form>

        {/* Helper text */}
        <div className="mt-3 flex items-center justify-end text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            Vos données sont sécurisées et privées
          </span>
        </div>
      </div>
    </div>
  );
}