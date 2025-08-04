'use client';

import React, { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { 
  Sparkles,
  AlertCircle,
  Info,
  RefreshCw,
  FileText,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import DocumentSidebar from './components/DocumentSidebar';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
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
}

export default function AssistantPage() {
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: `Bonjour ! Je suis votre assistant IA privé. 
      
Je peux vous aider à explorer et comprendre vos documents internes. Posez-moi des questions sur :

- 📄 Le contenu de vos documents
- 📊 Les données et informations clés
- 🔍 La recherche d'informations spécifiques
- 💡 L'analyse et la synthèse de vos contenus

Comment puis-je vous aider aujourd'hui ?`,
      timestamp: new Date()
    }
  ]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string>();
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  
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
        isLoading: false
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
    <div className="flex h-full bg-gray-50">
      {/* Mobile Sidebar Overlay */}
      {showMobileSidebar && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div 
            className="fixed inset-0 bg-gray-600 bg-opacity-75" 
            onClick={() => setShowMobileSidebar(false)} 
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
            <div className="absolute top-4 right-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowMobileSidebar(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <DocumentSidebar
              onDocumentSelect={(doc) => {
                handleDocumentSelect(doc);
                setShowMobileSidebar(false);
              }}
              selectedDocumentId={selectedDocument?.id}
              className="flex"
            />
          </div>
        </div>
      )}

      {/* Document Sidebar */}
      <DocumentSidebar
        onDocumentSelect={handleDocumentSelect}
        selectedDocumentId={selectedDocument?.id}
        className="hidden lg:flex"
      />

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Mobile Document Button */}
        <div className="lg:hidden p-4 border-b bg-white">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMobileSidebar(true)}
            className="w-full"
          >
            <FileText className="w-4 h-4 mr-2" />
            Voir les documents ({selectedDocument ? selectedDocument.filename : 'Aucun sélectionné'})
          </Button>
        </div>

        {/* Messages */}
        <ScrollArea ref={scrollAreaRef} className="flex-1">
          <div className="max-w-4xl mx-auto">
            {/* Welcome message for empty state */}
            {messages.length === 1 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-8"
              >
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-8 h-8 text-purple-600" />
                  </div>
                  <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                    Bienvenue dans votre Assistant IA
                  </h2>
                  <p className="text-gray-600 max-w-md mx-auto">
                    Explorez vos documents internes et obtenez des réponses instantanées grâce à l'intelligence artificielle.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Conseil :</strong> Sélectionnez un document dans la barre latérale pour des questions ciblées.
                    </AlertDescription>
                  </Alert>
                  
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Sécurité :</strong> Vos données restent privées et isolées dans votre organisation.
                    </AlertDescription>
                  </Alert>
                </div>

                {/* Example questions */}
                <div className="mt-8">
                  <p className="text-sm text-gray-500 text-center mb-4">
                    Essayez ces exemples de questions :
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {[
                      "Résume les points clés de nos documents",
                      "Quelles sont nos procédures principales ?",
                      "Trouve les informations sur [sujet]",
                      "Compare les données entre documents"
                    ].map((question, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={() => handleSendMessage(question)}
                        className="text-xs"
                      >
                        {question}
                      </Button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Messages list */}
            <AnimatePresence mode="popLayout">
              {messages.map((message, index) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  isLatest={index === messages.length - 1}
                />
              ))}
            </AnimatePresence>

            {/* Error display */}
            {error && (
              <div className="p-6">
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
    </div>
  );
}