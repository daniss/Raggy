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
  Bot,
  Clock,
  Shield,
  ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import { handleApiError, type ChatResponse, type Source } from '@/utils/api';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorAlert } from '@/components/ErrorAlert';
import Link from 'next/link';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: Source[];
  isLoading?: boolean;
  responseTime?: number;
}

interface DemoSession {
  token: string;
  email: string;
  company: string;
  documents?: any[];
  sampleQuestions?: string[];
  expiresAt: number;
}

export default function DemoAssistantPage() {
  const [demoSession, setDemoSession] = useState<DemoSession | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string>();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Load demo session on mount
  useEffect(() => {
    loadDemoSession();
  }, []);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadDemoSession = () => {
    try {
      const storedSession = localStorage.getItem('demoSession');
      if (!storedSession) {
        // Redirect to demo page if no session
        window.location.href = '/demo';
        return;
      }

      const session = JSON.parse(storedSession);
      
      // Check if session is expired
      if (Date.now() > session.expiresAt) {
        localStorage.removeItem('demoSession');
        window.location.href = '/demo';
        return;
      }

      setDemoSession(session);
      
      // Set initial welcome message with demo context
      const welcomeMessage: Message = {
        id: '1',
        type: 'assistant',
        content: `Bienvenue dans votre sandbox de démo, **${session.company}** ! 

Je suis votre assistant IA personnel. Vous pouvez me poser des questions sur les documents pré-chargés :

• **Guide_Conformite_RGPD.pdf** - Obligations légales RGPD
• **Manuel_Procedures_RH_2024.pdf** - Procédures RH et recrutement  
• **Contrat_Type_Client.docx** - Modèles de contrats commerciaux
• **Analyse_Fiscale_2024.xlsx** - Calculs fiscaux et crédits d'impôt
• **Documentation_Technique_Produit.pdf** - Spécifications techniques

Posez-moi n'importe quelle question sur ces documents !`,
        timestamp: new Date()
      };
      
      setMessages([welcomeMessage]);
      
    } catch (error) {
      console.error('Failed to load demo session:', error);
      window.location.href = '/demo';
    } finally {
      setIsInitializing(false);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isLoading || !demoSession) return;

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

      // Send the streaming request with demo session token
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/v1/demo/chat/stream`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Demo-Session': demoSession.token,
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
                    console.log('Sources received:', finalSources);
                    break;
                    
                  case 'complete':
                    const responseTime = Date.now() - startTime;
                    console.log(`Demo RAG Response time: ${responseTime}ms`);
                    
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

Veuillez réessayer ou retourner à la page de démo si le problème persiste.`,
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

  const handleSampleQuestion = (question: string) => {
    handleSendMessage(question);
  };

  if (isInitializing) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Chargement de votre démo...</p>
        </div>
      </div>
    );
  }

  if (!demoSession) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Session expirée</h2>
          <p className="text-gray-600 mb-4">Votre session de démo a expiré.</p>
          <Link href="/demo">
            <Button>Retourner à la démo</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Calculate remaining time
  const remainingTime = Math.max(0, demoSession.expiresAt - Date.now());
  const hoursRemaining = Math.floor(remainingTime / (1000 * 60 * 60));
  const minutesRemaining = Math.floor((remainingTime % (1000 * 60 * 60)) / (1000 * 60));

  const sampleQuestions = [
    "Quelles sont les obligations RGPD pour le traitement des données clients ?",
    "Quelle est la procédure de recrutement d'un nouveau collaborateur ?",
    "Quels sont les délais de paiement dans nos contrats types ?",
    "Comment calculer le crédit d'impôt recherche ?",
    "Quelles sont les spécifications techniques de notre produit principal ?"
  ];

  return (
    <div className="h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
      {/* Demo Header */}
      <header className="border-b bg-white/80 backdrop-blur flex-shrink-0">
        <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
          <Link href="/demo/upload" className="flex items-center space-x-2">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Retour à l'upload</span>
          </Link>
          
          <div className="flex-1 flex items-center justify-center">
            <h1 className="text-xl font-semibold text-gray-900">
              Assistant IA - Démo {demoSession.company}
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" asChild>
              <Link href="/demo/upload">
                <FileText className="w-4 h-4 mr-2" />
                Documents
              </Link>
            </Button>
            <Badge variant="default" className="bg-blue-100 text-blue-800 hover:bg-blue-200">
              <Clock className="w-3 h-3 mr-1" />
              {hoursRemaining}h {minutesRemaining}min
            </Badge>
            <Badge variant="outline">
              <Shield className="w-3 h-3 mr-1" />
              Données sécurisées
            </Badge>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Sample Questions (show only at start) */}
        {messages.length === 1 && (
          <div className="border-b bg-white p-4 flex-shrink-0">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Questions suggérées :</h3>
            <div className="flex flex-wrap gap-2">
              {sampleQuestions.slice(0, 3).map((question, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => handleSampleQuestion(question)}
                  className="text-xs h-8"
                  disabled={isLoading}
                >
                  {question.length > 50 ? question.substring(0, 50) + '...' : question}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <ScrollArea ref={scrollAreaRef} className="flex-1">
          <div className="w-full min-h-full">
            {/* Messages list */}
            <div className="py-4">
              <AnimatePresence mode="popLayout">
                {messages.map((message, index) => (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    isLatest={index === messages.length - 1}
                    onOpenDocument={(filename, highlightText, context) => {
                      // In demo mode, we could show a preview or explain that full doc viewing is available in the full version
                      console.log('Demo document view requested:', filename);
                    }}
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
          placeholder="Posez une question sur les documents de démo..."
        />
      </div>

      {/* Demo Limitations Footer */}
      <div className="border-t bg-yellow-50 p-3 flex-shrink-0">
        <div className="flex items-center justify-center text-sm text-yellow-800">
          <Info className="w-4 h-4 mr-2" />
          Démo limitée - Pour la version complète avec upload illimité et fonctionnalités avancées, 
          <Link href="/#contact" className="ml-1 underline font-medium">contactez-nous</Link>
        </div>
      </div>
    </div>
  );
}