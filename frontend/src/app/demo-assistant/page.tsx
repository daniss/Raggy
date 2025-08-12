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
  ArrowLeft,
  MessageCircle,
  Palette
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import ChatMessage from './components/ChatMessage';
import EnhancedChatInput from './components/EnhancedChatInput';
import SourcesPanel from './components/SourcesPanel';
import ConversationExporter from './components/ConversationExporter';
import ThemeToggle from '@/components/ThemeToggle';
import { handleApiError, type ChatResponse, type Source } from '@/utils/api';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorAlert } from '@/components/ErrorAlert';
import { cn } from '@/lib/utils';
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
  const [requestCount, setRequestCount] = useState(0);
  const MAX_REQUESTS = 5;
  
  // Sources panel state
  const [showSourcesPanel, setShowSourcesPanel] = useState(false);
  const [sourcesPanelCollapsed, setSourcesPanelCollapsed] = useState(false);
  const [currentMessageSources, setCurrentMessageSources] = useState<Source[]>([]);
  const [allSources, setAllSources] = useState<Source[]>([]);
  const [activeCitation, setActiveCitation] = useState<number | null>(null);
  const [autoOpenSources, setAutoOpenSources] = useState(true); // Auto-open sources panel
  const [sourcesButtonPulse, setSourcesButtonPulse] = useState(false); // Pulse animation for new sources
  
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
      
      // Load request count from localStorage
      const storedCount = localStorage.getItem('demoRequestCount');
      if (storedCount) {
        setRequestCount(parseInt(storedCount, 10));
      }
      
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
    
    // Check if request limit is reached
    if (requestCount >= MAX_REQUESTS) {
      setError(`Vous avez atteint la limite de ${MAX_REQUESTS} questions pour la démo. Pour continuer, contactez-nous pour la version complète.`);
      return;
    }

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
    
    // Clear sources from previous message when starting a new question
    setCurrentMessageSources([]);
    setAllSources([]);

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
                    // Update current message sources - replace all sources with just the latest ones
                    setCurrentMessageSources(finalSources);
                    // Replace allSources with only the sources from the current response
                    setAllSources(finalSources);
                    
                    // Auto-open sources panel when sources are received (like GitHub Copilot)
                    if (finalSources && finalSources.length > 0) {
                      if (autoOpenSources) {
                        setShowSourcesPanel(true);
                        setSourcesPanelCollapsed(false);
                      } else {
                        // If auto-open is disabled, pulse the sources button to draw attention
                        setSourcesButtonPulse(true);
                        setTimeout(() => setSourcesButtonPulse(false), 2000);
                      }
                    }
                    break;
                    
                  case 'complete':
                    const responseTime = Date.now() - startTime;
                    console.log(`Demo RAG Response time: ${responseTime}ms`);
                    
                    setConversationId(currentConversationId);
                    
                    // Increment request count and save to localStorage
                    const newCount = requestCount + 1;
                    setRequestCount(newCount);
                    localStorage.setItem('demoRequestCount', newCount.toString());
                    
                    // Add warning message if this was the last question
                    let finalContent = accumulatedContent;
                    if (newCount === MAX_REQUESTS) {
                      finalContent += `\n\n---\n\n⚠️ **Vous avez atteint la limite de ${MAX_REQUESTS} questions pour cette démo.**\n\nPour continuer à explorer notre solution RAG et débloquer toutes les fonctionnalités, [contactez notre équipe commerciale](/#contact).`;
                    } else if (newCount === MAX_REQUESTS - 1) {
                      finalContent += `\n\n---\n\n💡 **Attention : Il vous reste 1 dernière question pour cette démo.**`;
                    }
                    
                    const finalMessage: Message = {
                      id: loadingMessage.id,
                      type: 'assistant',
                      content: finalContent,
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
    <div className="h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex flex-col transition-colors duration-500">
      {/* Demo Header */}
      <header className="border-b panel-glass flex-shrink-0">
        <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
          <Link href="/demo/upload" className="flex items-center space-x-2">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Retour à l'upload</span>
          </Link>
          
          <div className="flex-1 flex items-center justify-center">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Assistant IA - Démo {demoSession.company}
            </h1>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button variant="outline" size="sm" asChild className="glass-hover">
              <Link href="/demo/upload">
                <FileText className="w-4 h-4 mr-2" />
                Documents
              </Link>
            </Button>
            <motion.div
              animate={sourcesButtonPulse ? { scale: [1, 1.1, 1], opacity: [1, 0.8, 1] } : {}}
              transition={{ duration: 0.6, repeat: sourcesButtonPulse ? 3 : 0 }}
            >
              <Button 
                variant={showSourcesPanel ? "default" : "outline"} 
                size="sm"
                onClick={() => {
                  setShowSourcesPanel(!showSourcesPanel);
                  setSourcesButtonPulse(false); // Stop pulse when clicked
                }}
                className={cn(
                  "glass-hover transition-all duration-300",
                  showSourcesPanel 
                    ? "bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg" 
                    : "bg-white/10 backdrop-blur border-white/20",
                  sourcesButtonPulse && "ring-2 ring-purple-400 ring-opacity-50"
                )}
              >
                <FileText className="w-4 h-4 mr-2" />
                Sources {allSources.length > 0 && `(${allSources.length})`}
                {allSources.length > 0 && !showSourcesPanel && (
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="ml-1"
                  >
                    <Sparkles className="w-3 h-3 text-purple-400" />
                  </motion.div>
                )}
              </Button>
            </motion.div>
            {messages.length > 1 && (
              <ConversationExporter 
                messages={messages}
                demoSession={demoSession}
                allSources={allSources}
              />
            )}
            <ThemeToggle variant="minimal" size="sm" showLabel={false} />
            <Badge 
              variant="outline"
              className={cn(
                "glass-subtle transition-all duration-300",
                requestCount >= MAX_REQUESTS 
                  ? "border-red-300 text-red-700 dark:border-red-700 dark:text-red-300" 
                  : requestCount >= MAX_REQUESTS - 1 
                  ? "border-orange-300 text-orange-700 dark:border-orange-700 dark:text-orange-300"
                  : "border-green-300 text-green-700 dark:border-green-700 dark:text-green-300"
              )}
            >
              <MessageCircle className="w-3 h-3 mr-1" />
              {MAX_REQUESTS - requestCount} questions restantes
            </Badge>
            <Badge variant="outline" className="glass-subtle border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300">
              <Clock className="w-3 h-3 mr-1" />
              {hoursRemaining}h {minutesRemaining}min
            </Badge>
            <Badge variant="outline" className="glass-subtle border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300">
              <Shield className="w-3 h-3 mr-1" />
              Données sécurisées
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content Area - Responsive Split Panel Layout */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Left Panel - Chat Area */}
        <div className="flex-1 flex flex-col min-h-0">
        {/* Sample Questions (show only at start) */}
        {messages.length === 1 && (
          <div className="border-b panel-glass p-4 flex-shrink-0">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Questions suggérées :</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {sampleQuestions.slice(0, 3).map((question, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSampleQuestion(question)}
                    className="text-xs h-8 glass-hover transition-all duration-300 bg-white/20 dark:bg-gray-800/20 border-white/30 dark:border-gray-600/30 hover:bg-white/30 dark:hover:bg-gray-700/30 text-gray-800 dark:text-gray-200"
                    disabled={isLoading || requestCount >= MAX_REQUESTS}
                  >
                    {question.length > 50 ? question.substring(0, 50) + '...' : question}
                  </Button>
                </motion.div>
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
        <EnhancedChatInput
          onSendMessage={handleSendMessage}
          disabled={isLoading || requestCount >= MAX_REQUESTS}
          placeholder={
            requestCount >= MAX_REQUESTS 
              ? "Limite de questions atteinte - Contactez-nous pour la version complète" 
              : `Posez une question sur les documents de démo... (${MAX_REQUESTS - requestCount} restantes)`
          }
        />
      </div>

      {/* Sources Panel */}
      <AnimatePresence>
        {showSourcesPanel && (
          <SourcesPanel
            sources={allSources}
            isVisible={showSourcesPanel}
            onClose={() => setShowSourcesPanel(false)}
            onToggle={() => setSourcesPanelCollapsed(!sourcesPanelCollapsed)}
            isCollapsed={sourcesPanelCollapsed}
            currentMessageSources={currentMessageSources}
            onSourceSelect={(source, index) => {
              setActiveCitation(index);
            }}
          />
        )}
      </AnimatePresence>
      </div>

      {/* Demo Limitations Footer */}
      <motion.div 
        className={cn(
          "border-t panel-glass p-3 flex-shrink-0 transition-all duration-500",
          requestCount >= MAX_REQUESTS 
            ? 'bg-red-50/20 dark:bg-red-900/20 border-red-200/30 dark:border-red-700/30' 
            : 'bg-yellow-50/20 dark:bg-yellow-900/20 border-yellow-200/30 dark:border-yellow-700/30'
        )}
        animate={{
          background: requestCount >= MAX_REQUESTS ? 
            'rgba(254, 226, 226, 0.3)' : 'rgba(254, 249, 195, 0.3)'
        }}
      >
        <div className={cn(
          "flex items-center justify-center text-sm transition-colors duration-300",
          requestCount >= MAX_REQUESTS 
            ? 'text-red-800 dark:text-red-200' 
            : 'text-yellow-800 dark:text-yellow-200'
        )}>
          {requestCount >= MAX_REQUESTS ? (
            <>
              <AlertCircle className="w-4 h-4 mr-2 animate-pulse" />
              Limite de {MAX_REQUESTS} questions atteinte - Pour continuer avec la version complète,
              <Link href="/#contact" className="ml-1 underline font-semibold hover:text-red-600 dark:hover:text-red-300 transition-colors">
                contactez-nous
              </Link>
            </>
          ) : (
            <>
              <Info className="w-4 h-4 mr-2" />
              Démo limitée à {MAX_REQUESTS} questions - Pour la version complète avec questions illimitées, 
              <Link href="/#contact" className="ml-1 underline font-medium hover:text-yellow-600 dark:hover:text-yellow-300 transition-colors">
                contactez-nous
              </Link>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}