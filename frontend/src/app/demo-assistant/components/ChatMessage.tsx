'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion } from 'framer-motion';
import { 
  User, 
  Bot, 
  Copy, 
  Check,
  FileText,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { type Source } from '@/utils/api';
import SourceCard from '../../assistant/components/SourceCard';
import { renderTextWithCitations } from './CitationBubble';
import ThinkingIndicator from './ThinkingIndicator';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: Source[];
  isLoading?: boolean;
  responseTime?: number;
}

interface ChatMessageProps {
  message: Message;
  isLatest?: boolean;
  onOpenDocument?: (filename: string, highlightText?: string, citationContext?: any) => void;
  onCitationClick?: (source: Source, citation: number) => void;
  onCitationHover?: (citation: number) => void;
  onCitationLeave?: () => void;
  activeCitation?: number;
}

const ChatMessage = React.forwardRef<HTMLDivElement, ChatMessageProps>(({ 
  message, 
  isLatest = false, 
  onOpenDocument,
  onCitationClick,
  onCitationHover,
  onCitationLeave,
  activeCitation
}, ref) => {
  const [copied, setCopied] = useState(false);
  const [showSources, setShowSources] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isUser = message.type === 'user';

  return (
    <motion.div
      ref={ref}
      initial={isLatest ? { opacity: 0, y: 20 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "group relative",
        isUser ? "flex justify-end" : "flex justify-start"
      )}
    >
      <div className={cn(
        "flex gap-3 max-w-4xl mx-4 my-4",
        isUser ? "flex-row-reverse" : "flex-row"
      )}>
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center shadow-sm border-2",
            isUser 
              ? "bg-gradient-to-br from-blue-500 to-blue-600 border-blue-200" 
              : "bg-gradient-to-br from-purple-500 to-indigo-600 border-purple-200"
          )}>
            {isUser ? (
              <User className="w-5 h-5 text-white" />
            ) : (
              <Bot className="w-5 h-5 text-white" />
            )}
          </div>
        </div>

        {/* Content */}
        <div className={cn(
          "flex-1 min-w-0",
          isUser ? "items-end" : "items-start"
        )}>
          {/* Message bubble */}
          <div className={cn(
            "relative px-4 py-3 rounded-2xl shadow-sm border",
            isUser 
              ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white border-blue-200 rounded-br-md" 
              : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600 rounded-bl-md",
            "max-w-3xl"
          )}>
            {/* Header */}
            <div className={cn(
              "flex items-center gap-2 mb-2",
              isUser ? "justify-end" : "justify-start"
            )}>
              <span className={cn(
                "font-medium text-sm",
                isUser ? "text-blue-100" : "text-gray-900 dark:text-gray-100"
              )}>
                {isUser ? 'Vous' : 'Assistant IA'}
              </span>
              <span className={cn(
                "text-xs",
                isUser ? "text-blue-200" : "text-gray-500 dark:text-gray-400"
              )}>
                {message.timestamp.toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
                {!isUser && message.responseTime && (
                  <span className="ml-2 text-purple-600">
                    • {message.responseTime.toFixed(2)}s
                  </span>
                )}
              </span>
              {!isUser && message.sources && message.sources.length > 0 && (
                <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700 border-purple-200">
                  <FileText className="w-3 h-3 mr-1" />
                  {message.sources.length} source{message.sources.length > 1 ? 's' : ''}
                </Badge>
              )}
            </div>

            {/* Message content */}
            {message.isLoading ? (
              <ThinkingIndicator isVisible={true} />
            ) : (
              <div className={cn(
                "prose prose-sm max-w-none",
                isUser ? "prose-invert" : ""
              )}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => (
                      <h1 className={cn(
                        "text-xl font-bold mt-4 mb-3",
                        isUser ? "text-white" : "text-gray-900 dark:text-gray-100"
                      )}>{children}</h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className={cn(
                        "text-lg font-semibold mt-4 mb-2",
                        isUser ? "text-white" : "text-gray-900 dark:text-gray-100"
                      )}>{children}</h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className={cn(
                        "text-base font-semibold mt-3 mb-2",
                        isUser ? "text-white" : "text-gray-900 dark:text-gray-100"
                      )}>{children}</h3>
                    ),
                    p: ({ children }) => {
                      // Handle citations in paragraphs
                      if (typeof children === 'string' && message.sources && !isUser) {
                        const elementsWithCitations = renderTextWithCitations(
                          children,
                          message.sources,
                          onCitationClick,
                          onCitationHover,
                          onCitationLeave,
                          activeCitation
                        );
                        return (
                          <p className={cn(
                            "leading-relaxed mb-3",
                            isUser ? "text-white" : "text-gray-700 dark:text-gray-300"
                          )}>
                            {elementsWithCitations}
                          </p>
                        );
                      }
                      return (
                        <p className={cn(
                          "leading-relaxed mb-3",
                          isUser ? "text-white" : "text-gray-700 dark:text-gray-300"
                        )}>{children}</p>
                      );
                    },
                    ul: ({ children }) => (
                      <ul className="list-disc list-inside ml-4 mb-3 space-y-1">{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal list-inside ml-4 mb-3 space-y-1">{children}</ol>
                    ),
                    li: ({ children }) => (
                      <li className={cn(
                        isUser ? "text-white" : "text-gray-700 dark:text-gray-300"
                      )}>{children}</li>
                    ),
                    code: ({ children, className }) => {
                      const isInline = !className;
                      return isInline ? (
                        <code className={cn(
                          "px-1.5 py-0.5 rounded text-sm font-mono",
                          isUser 
                            ? "bg-blue-400/30 text-blue-100" 
                            : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                        )}>
                          {children}
                        </code>
                      ) : (
                        <code className="block bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                          {children}
                        </code>
                      );
                    },
                    strong: ({ children }) => (
                      <strong className={cn(
                        "font-semibold",
                        isUser ? "text-white" : "text-gray-900 dark:text-gray-100"
                      )}>{children}</strong>
                    ),
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            )}
          </div>

          {/* Actions */}
          {!isUser && !message.isLoading && (
            <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-7 text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 mr-1" />
                    Copié
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 mr-1" />
                    Copier
                  </>
                )}
              </Button>
              
              {message.sources && message.sources.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSources(!showSources)}
                  className="h-7 text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <FileText className="w-3 h-3 mr-1" />
                  {showSources ? 'Masquer' : 'Voir'} les sources
                </Button>
              )}
            </div>
          )}

          {/* Sources */}
          {!isUser && showSources && message.sources && message.sources.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 space-y-2"
            >
              {message.sources.map((source, index) => (
                <SourceCard 
                  key={index} 
                  source={source} 
                  index={index} 
                  onOpenDocument={onOpenDocument}
                />
              ))}
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
});

ChatMessage.displayName = 'ChatMessage';

export default ChatMessage;