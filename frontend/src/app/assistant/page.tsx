'use client';

import React, { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { 
  Sparkles,
  AlertCircle,
  Info,
  FileText,
  RefreshCw,
  X,
  Bot
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import DocumentSidebar from './components/DocumentSidebar';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import DocumentPreview from '@/components/DocumentPreview';
import StaticFileViewer from '@/components/StaticFileViewer';
import { chatApi, organizationApi, handleApiError, type ChatResponse, type Source } from '@/utils/api';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorAlert } from '@/components/ErrorAlert';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: Source[];
  isLoading?: boolean;
  responseTime?: number; // Add response time to message interface
}

export default function AssistantPage() {
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: `Bonjour ! Je suis votre assistant IA. Posez-moi des questions sur vos documents.`,
      timestamp: new Date()
    }
  ]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string>();
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [previewDocument, setPreviewDocument] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  
  // Static file viewer state
  const [staticFileViewer, setStaticFileViewer] = useState<{
    isOpen: boolean;
    filename: string;
    highlightText?: string;
    citationContext?: any;
  }>({
    isOpen: false,
    filename: ''
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Load organization on mount
  useEffect(() => {
    loadOrganization();
  }, []);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadOrganization = async () => {
    try {
      const org = await organizationApi.getCurrentOrganization();
      setOrganizationId(org.id);
    } catch (err) {
      console.error('Failed to load organization:', err);
      setError('Impossible de charger votre organisation');
    } finally {
      setIsInitializing(false);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: content.trim(),
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
    setIsLoading(true);
    setError(null);

    try {
      const startTime = Date.now();
      let accumulatedContent = '';
      let finalSources: Source[] = [];
      let currentConversationId = '';
      
      // Get auth token for streaming request
      const supabase = (await import('@/utils/supabase')).createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || '';

      // Send the streaming request
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/v1/chat/stream`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache'
          },
          body: JSON.stringify({
            question: userMessage.content,
            conversation_id: conversationId
          })
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                switch (data.type) {
                  case 'start':
                    currentConversationId = data.conversation_id;
                    break;
                    
                  case 'token':
                    accumulatedContent += data.content;
                    // Update message content in real-time
                    setMessages(prev => prev.map(msg => 
                      msg.id === loadingMessage.id 
                        ? { ...msg, content: accumulatedContent }
                        : msg
                    ));
                    break;
                    
                  case 'sources':
                    finalSources = data.sources;
                    break;
                    
                  case 'complete':
                    const responseTime = Date.now() - startTime;
                    console.log(`Streaming RAG Response time: ${responseTime}ms`);
                    
                    setConversationId(currentConversationId);
                    
                    const finalMessage: Message = {
                      id: loadingMessage.id,
                      type: 'assistant',
                      content: accumulatedContent,
                      timestamp: new Date(),
                      sources: finalSources,
                      isLoading: false,
                      responseTime: data.response_time
                    };

                    setMessages(prev => prev.map(msg => 
                      msg.id === loadingMessage.id ? finalMessage : msg
                    ));
                    break;
                    
                  case 'error':
                    throw new Error(data.message || 'Une erreur est survenue');
                }
              } catch (parseError) {
                console.warn('Failed to parse SSE data:', parseError);
              }
            }
          }
        }
      }

    } catch (error) {
      const errorMsg = handleApiError(error);
      setError(errorMsg);
      
      const errorMessage: Message = {
        id: loadingMessage.id,
        type: 'assistant',
        content: `Désolé, une erreur s'est produite : ${errorMsg}

Veuillez réessayer ou contacter le support si le problème persiste.`,
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

  const handleRetry = () => {
    const lastUserMessage = messages
      .slice()
      .reverse()
      .find(msg => msg.type === 'user');
    
    if (lastUserMessage) {
      handleSendMessage(lastUserMessage.content);
    }
  };

  const handleDocumentSelect = (doc: any) => {
    setSelectedDocument(doc);
    
    // Add a context message about the selected document
    const contextMessage: Message = {
      id: Date.now().toString(),
      type: 'assistant',
      content: `J'ai bien noté que vous consultez le document **${doc.filename}**. N'hésitez pas à me poser des questions spécifiques sur ce document !`,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, contextMessage]);
  };

  const handleDocumentPreview = (doc: any) => {
    setPreviewDocument(doc);
    setShowPreview(true);
  };

  const handleClosePreview = () => {
    setShowPreview(false);
    setPreviewDocument(null);
  };

  const handleOpenStaticDocument = (filename: string, highlightText?: string, citationContext?: any) => {
    setStaticFileViewer({
      isOpen: true,
      filename,
      highlightText,
      citationContext
    });
  };

  const handleCloseStaticViewer = () => {
    setStaticFileViewer({
      isOpen: false,
      filename: ''
    });
  };

  if (isInitializing) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Chargement de votre assistant IA...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Document Sidebar */}
      <DocumentSidebar
        onDocumentSelect={handleDocumentSelect}
        onDocumentPreview={handleDocumentPreview}
        selectedDocumentId={selectedDocument?.id}
        className="hidden lg:flex"
      />

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Mobile Document Button */}
        <div className="lg:hidden p-4 border-b bg-white/80 backdrop-blur-sm flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMobileSidebar(true)}
            className="w-full border-gray-200 hover:border-gray-300 hover:bg-gray-50"
          >
            <FileText className="w-4 h-4 mr-2" />
            Voir les documents ({selectedDocument ? selectedDocument.filename : 'Aucun sélectionné'})
          </Button>
        </div>

        {/* Messages */}
        <ScrollArea ref={scrollAreaRef} className="flex-1">
          <div className="w-full min-h-full">
            {/* Welcome message for empty state */}
            {messages.length === 1 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 flex items-center justify-center min-h-full"
              >
                <div className="max-w-2xl mx-auto text-center">
                  <div className="mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                      <Bot className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                      Bienvenue dans votre Assistant IA
                    </h2>
                    <p className="text-gray-600 mb-6">
                      Posez-moi des questions sur vos documents. Je suis là pour vous aider à trouver les informations dont vous avez besoin.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Messages list */}
            <div className="py-4">
              <AnimatePresence mode="popLayout">
                {messages.map((message, index) => (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    isLatest={index === messages.length - 1}
                    onOpenDocument={handleOpenStaticDocument}
                  />
                ))}
              </AnimatePresence>
            </div>

            {/* Error display */}
            {error && (
              <div className="px-6 pb-4">
                <div className="max-w-4xl mx-auto">
                  <ErrorAlert
                    title="Erreur de communication"
                    message={error}
                    onDismiss={() => setError(null)}
                    action={{
                      label: "Réessayer",
                      onClick: handleRetry
                    }}
                  />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <ChatInput
          onSendMessage={handleSendMessage}
          disabled={isLoading}
          placeholder={
            selectedDocument 
              ? `Posez une question sur "${selectedDocument.filename}"...`
              : "Posez votre question sur vos documents..."
          }
        />
      </div>

      {/* Document Preview Modal */}
      <DocumentPreview
        document={previewDocument}
        isOpen={showPreview}
        onClose={handleClosePreview}
      />

      {/* Static File Viewer Modal */}
      <StaticFileViewer
        filename={staticFileViewer.filename}
        isOpen={staticFileViewer.isOpen}
        onClose={handleCloseStaticViewer}
        highlightText={staticFileViewer.highlightText}
        citationContext={staticFileViewer.citationContext}
      />
    </div>
  );
}