'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  MessageCircle, 
  X, 
  Send, 
  Loader2, 
  FileText,
  ExternalLink,
  Minimize2,
  Maximize2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { chatApi, type ChatResponse, type Source, handleApiError } from '@/utils/api';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorAlert } from '@/components/ErrorAlert';
import { useRetry } from '@/hooks/useRetry';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: Source[];
  isLoading?: boolean;
  responseTime?: number; // Add response time to message interface
}

interface ChatWidgetProps {
  className?: string;
  defaultPosition?: 'bottom-right' | 'bottom-left';
  theme?: 'light' | 'dark';
}

export default function ChatWidget({ 
  className = '', 
  defaultPosition = 'bottom-right',
  theme = 'light' 
}: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: 'Bonjour ! Je suis votre assistant IA. Comment puis-je vous aider aujourd\'hui ?',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [conversationId, setConversationId] = useState<string>();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Use retry hook for chat messages
  const { retry: retryMessage, isRetrying } = useRetry();

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when widget opens
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    const loadingMessage: Message = {
      id: (Date.now() + 1).toString(),
      type: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true
    };

    setMessages(prev => [...prev, userMessage, loadingMessage]);
    setInputValue('');
    setIsLoading(true);
    setError(null);

    try {
      const response: ChatResponse = await chatApi.sendMessage({
        question: userMessage.content,
        conversation_id: conversationId
      });

      setConversationId(response.conversation_id);

      const assistantMessage: Message = {
        id: loadingMessage.id,
        type: 'assistant',
        content: response.answer,
        timestamp: new Date(),
        sources: response.sources,
        isLoading: false,
        responseTime: response.response_time // Store response time
      };

      setMessages(prev => prev.map(msg => 
        msg.id === loadingMessage.id ? assistantMessage : msg
      ));

    } catch (error) {
      const errorMsg = handleApiError(error);
      setError(errorMsg);
      
      const errorMessage: Message = {
        id: loadingMessage.id,
        type: 'assistant',
        content: `Désolé, une erreur s'est produite : ${errorMsg}`,
        timestamp: new Date(),
        isLoading: false
      };

      setMessages(prev => prev.map(msg => 
        msg.id === loadingMessage.id ? errorMessage : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleRetryLastMessage = () => {
    const lastUserMessage = messages
      .slice()
      .reverse()
      .find(msg => msg.type === 'user');
    
    if (lastUserMessage) {
      setInputValue(lastUserMessage.content);
      retryMessage(handleSendMessage);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleWidget = () => {
    console.log('Chat widget toggle clicked', { isOpen, isMinimized });
    setIsOpen(!isOpen);
    setIsMinimized(false);
  };

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  const TypingIndicator = () => (
    <div className="flex items-center space-x-2 text-muted-foreground">
      <LoadingSpinner size="sm" />
      <span className="text-sm">Assistant écrit...</span>
    </div>
  );

  const MessageBubble = ({ message }: { message: Message }) => (
    <div className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[85%] ${message.type === 'user' ? 'ml-2' : 'mr-2'}`}>
        <div
          className={`rounded-2xl px-3 py-2 shadow-sm break-words ${
            message.type === 'user'
              ? 'bg-blue-500 text-white rounded-br-md'
              : 'bg-gray-100 text-gray-900 rounded-bl-md'
          }`}
        >
          {message.isLoading ? (
            <TypingIndicator />
          ) : (
            <div className="markdown-content">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // Custom styling for markdown elements
                  h3: ({ children }) => (
                    <h3 className="text-base font-bold text-current mt-3 mb-2 first:mt-0">{children}</h3>
                  ),
                  h4: ({ children }) => (
                    <h4 className="text-sm font-semibold text-current mt-2 mb-1">{children}</h4>
                  ),
                  p: ({ children }) => (
                    <p className="text-sm leading-relaxed mb-2 last:mb-0">{children}</p>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold text-current">{children}</strong>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside ml-2 space-y-1 mb-2 text-sm">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside ml-2 space-y-1 mb-2 text-sm">{children}</ol>
                  ),
                  li: ({ children }) => (
                    <li className="text-sm leading-relaxed">{children}</li>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-2 border-gray-300 pl-3 ml-2 italic text-sm opacity-80">{children}</blockquote>
                  ),
                  code: ({ children }) => (
                    <code className="bg-gray-200 text-gray-800 px-1 py-0.5 rounded text-xs font-mono">{children}</code>
                  ),
                  pre: ({ children }) => (
                    <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto mb-2">{children}</pre>
                  )
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
        
        {message.sources && message.sources.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {message.sources.map((source, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                className="h-6 text-xs"
                onClick={() => setSelectedSource(source)}
              >
                <FileText className="w-3 h-3 mr-1" />
                Source {index + 1}
                <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
            ))}
          </div>
        )}
        
        <p className={`text-xs text-muted-foreground mt-1 ${
          message.type === 'user' ? 'text-right' : 'text-left'
        }`}>
          {message.timestamp.toLocaleTimeString('fr-FR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
          {message.type === 'assistant' && message.responseTime && (
            <span className="ml-2 text-blue-600">
              • ça a pris {message.responseTime.toFixed(2)} seconde{message.responseTime !== 1 ? 's' : ''}
            </span>
          )}
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Chat Widget */}
      <div 
        className={`fixed ${
          defaultPosition === 'bottom-right' ? 'bottom-6 right-6' : 'bottom-6 left-6'
        } ${className}`} 
        style={{ zIndex: 9999 }}
      >
        
        {/* Chat Button - Simplified without AnimatePresence */}
        {!isOpen && (
          <div className="relative">
            <Button
              onClick={toggleWidget}
              size="lg"
              className="rounded-full w-14 h-14 shadow-lg hover:shadow-xl transition-shadow"
            >
              <MessageCircle className="w-6 h-6" />
            </Button>
            
            {/* Pulse animation */}
            <div className="absolute inset-0 rounded-full bg-accent opacity-20 animate-ping pointer-events-none"></div>
          </div>
        )}

        {/* Chat Window - Simplified */}  
        {isOpen && (
          <div className="absolute bottom-0 right-0 mb-2">
              <Card className={`w-96 shadow-2xl ${
                isMinimized ? 'h-auto' : 'h-[600px]'
              } flex flex-col`}>
                
                {/* Header */}
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <h3 className="font-semibold">Assistant IA</h3>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleMinimize}
                      className="h-6 w-6 p-0"
                    >
                      {isMinimized ? (
                        <Maximize2 className="h-3 w-3" />
                      ) : (
                        <Minimize2 className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleWidget}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </CardHeader>

                {!isMinimized && (
                  <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
                    {/* Error Alert */}
                    {error && (
                      <div className="p-4 pb-2">
                        <ErrorAlert 
                          title="Erreur de chat"
                          message={error}
                          onDismiss={() => setError(null)}
                          action={{
                            label: "Réessayer",
                            onClick: handleRetryLastMessage
                          }}
                        />
                      </div>
                    )}
                    
                    {/* Messages */}
                    <ScrollArea className="flex-1 p-4 scrollbar-thin overflow-y-auto">
                      <div className="space-y-2">
                        {messages.map((message) => (
                          <MessageBubble key={message.id} message={message} />
                        ))}
                        <div ref={messagesEndRef} />
                      </div>
                    </ScrollArea>

                    {/* Input */}
                    <div className="p-4 border-t">
                      <div className="flex space-x-2">
                        <Input
                          ref={inputRef}
                          value={inputValue}
                          onChange={(e) => setInputValue(e.target.value)}
                          onKeyPress={handleKeyPress}
                          placeholder="Tapez votre message..."
                          disabled={isLoading}
                          className="flex-1"
                        />
                        <Button
                          onClick={handleSendMessage}
                          disabled={!inputValue.trim() || isLoading}
                          size="icon"
                        >
                          {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
          </div>
        )}
      </div>

      {/* Source Modal */}
      <Dialog open={!!selectedSource} onOpenChange={() => setSelectedSource(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Source du document</DialogTitle>
          </DialogHeader>
          
          {selectedSource && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                {selectedSource.metadata.filename && (
                  <div>
                    <strong>Fichier:</strong> {selectedSource.metadata.filename}
                  </div>
                )}
                {selectedSource.metadata.page && (
                  <div>
                    <strong>Page:</strong> {selectedSource.metadata.page}
                  </div>
                )}
                {selectedSource.score && (
                  <div>
                    <strong>Pertinence:</strong> {Math.round(selectedSource.score * 100)}%
                  </div>
                )}
              </div>
              
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Extrait:</h4>
                <div className="markdown-content">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h3: ({ children }) => (
                        <h3 className="text-base font-bold text-gray-900 mt-3 mb-2 first:mt-0">{children}</h3>
                      ),
                      h4: ({ children }) => (
                        <h4 className="text-sm font-semibold text-gray-900 mt-2 mb-1">{children}</h4>
                      ),
                      p: ({ children }) => (
                        <p className="text-sm leading-relaxed mb-2 last:mb-0 text-gray-700">{children}</p>
                      ),
                      strong: ({ children }) => (
                        <strong className="font-semibold text-gray-900">{children}</strong>
                      ),
                      ul: ({ children }) => (
                        <ul className="list-disc list-inside ml-2 space-y-1 mb-2 text-sm">{children}</ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="list-decimal list-inside ml-2 space-y-1 mb-2 text-sm">{children}</ol>
                      ),
                      li: ({ children }) => (
                        <li className="text-sm leading-relaxed text-gray-700">{children}</li>
                      ),
                      code: ({ children }) => (
                        <code className="bg-gray-200 text-gray-800 px-1 py-0.5 rounded text-xs font-mono">{children}</code>
                      )
                    }}
                  >
                    {selectedSource.content}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}