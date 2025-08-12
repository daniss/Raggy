'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  Mic, 
  MicOff,
  Sparkles,
  Lightbulb,
  FileText,
  Calculator,
  Scale,
  Code,
  Settings,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  suggestions?: string[];
}

interface SmartSuggestion {
  icon: React.ElementType;
  label: string;
  query: string;
  category: string;
  color: string;
}

const smartSuggestions: SmartSuggestion[] = [
  {
    icon: Scale,
    label: "Obligations RGPD",
    query: "Quelles sont nos obligations principales sous le RGPD pour le traitement des données personnelles ?",
    category: "Juridique",
    color: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30"
  },
  {
    icon: FileText,
    label: "Procédures RH",
    query: "Quelle est la procédure complète pour recruter un nouveau collaborateur ?",
    category: "Ressources Humaines",
    color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30"
  },
  {
    icon: Calculator,
    label: "Crédit d'impôt recherche",
    query: "Comment calculer le montant du crédit d'impôt recherche pour notre entreprise ?",
    category: "Fiscal",
    color: "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30"
  },
  {
    icon: Settings,
    label: "Spécifications techniques",
    query: "Quelles sont les spécifications techniques détaillées de notre produit principal ?",
    category: "Technique",
    color: "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30"
  },
  {
    icon: Code,
    label: "Délais contractuels",
    query: "Quels sont les délais de paiement standard dans nos contrats clients ?",
    category: "Commercial",
    color: "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30"
  }
];

export default function EnhancedChatInput({ 
  onSendMessage, 
  disabled = false, 
  placeholder = "Posez votre question...",
  suggestions = []
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any | null>(null);

  // Check for voice support
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      setVoiceSupported(!!SpeechRecognition);
      
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'fr-FR';
        
        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setMessage(prev => prev + transcript);
          setIsListening(false);
        };
        
        recognition.onerror = () => {
          setIsListening(false);
        };
        
        recognition.onend = () => {
          setIsListening(false);
        };
        
        recognitionRef.current = recognition;
      }
    }
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [message]);

  // Show suggestions when focused and empty
  useEffect(() => {
    const timer = setTimeout(() => {
      if (message.trim() === '' && document.activeElement === textareaRef.current) {
        setShowSuggestions(true);
      } else {
        setShowSuggestions(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [message]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
      setShowSuggestions(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const handleVoiceToggle = () => {
    if (!voiceSupported || !recognitionRef.current) return;
    
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleSuggestionClick = (suggestion: SmartSuggestion) => {
    setMessage(suggestion.query);
    setShowSuggestions(false);
    textareaRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    setIsTyping(true);
    
    // Stop typing indicator after a delay
    setTimeout(() => setIsTyping(false), 1000);
  };

  return (
    <div className="relative">
      {/* Smart Suggestions Panel */}
      <AnimatePresence>
        {showSuggestions && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-full left-0 right-0 mb-2"
          >
            <Card className="p-4 shadow-lg floating-glass border-purple-200/30 dark:border-purple-700/30">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                  <Lightbulb className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100 text-sm">Suggestions intelligentes</h4>
                <Badge variant="secondary" className="text-xs">
                  <Zap className="w-3 h-3 mr-1" />
                  IA optimisée
                </Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {smartSuggestions.map((suggestion, index) => (
                  <motion.button
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border transition-all text-left hover:shadow-md",
                      "border-gray-200 dark:border-gray-600 hover:border-purple-300 dark:hover:border-purple-500",
                      "bg-white dark:bg-gray-800/40 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                    )}
                  >
                    <div className={cn("p-1.5 rounded-lg flex-shrink-0", suggestion.color)}>
                      <suggestion.icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900 dark:text-gray-100 mb-1">
                        {suggestion.label}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">
                        {suggestion.query}
                      </div>
                      <Badge variant="outline" className="mt-1 text-xs">
                        {suggestion.category}
                      </Badge>
                    </div>
                  </motion.button>
                ))}
              </div>
              
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Ou tapez votre propre question dans le champ ci-dessous
                </p>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="relative">
        <div className="flex gap-2 p-4 border-t panel-glass">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              onFocus={() => message.trim() === '' && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder={placeholder}
              disabled={disabled}
              className={cn(
                "min-h-[60px] max-h-[200px] resize-none transition-all duration-200",
                "glass-subtle border-white/30 dark:border-gray-600/30 focus:border-purple-400 focus:ring-purple-200",
                "bg-white/20 dark:bg-gray-800/20 backdrop-blur-md",
                isListening && "border-red-400 bg-red-50/50 dark:bg-red-900/20",
                isTyping && "shadow-lg scale-[1.02]"
              )}
              style={{ paddingRight: voiceSupported ? '50px' : '16px' }}
            />
            
            {/* Voice Input Button */}
            {voiceSupported && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleVoiceToggle}
                disabled={disabled}
                className={cn(
                  "absolute right-2 top-2 p-2 h-8 w-8 transition-all",
                  isListening 
                    ? "bg-red-100 text-red-600 hover:bg-red-200 animate-pulse" 
                    : "text-gray-500 hover:text-purple-600 hover:bg-purple-50"
                )}
              >
                {isListening ? (
                  <MicOff className="w-4 h-4" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </Button>
            )}
            
            {/* Typing Indicator */}
            <AnimatePresence>
              {isTyping && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="absolute -top-8 left-2"
                >
                  <div className="bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 px-2 py-1 rounded text-xs flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Saisie en cours...
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button 
              type="submit" 
              disabled={disabled || !message.trim()}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg"
            >
              <Send className="w-4 h-4" />
            </Button>
          </motion.div>
        </div>
        
        {/* Voice Listening Indicator */}
        <AnimatePresence>
          {isListening && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute -top-16 left-1/2 transform -translate-x-1/2"
            >
              <div className="bg-red-100 dark:bg-red-900/50 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  <Mic className="w-4 h-4" />
                </motion.div>
                <span className="text-sm font-medium">Écoute en cours...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </div>
  );
}

// Add type declarations for Speech Recognition API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}