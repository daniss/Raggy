'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Brain, 
  FileText, 
  Sparkles,
  Zap,
  Target,
  CheckCircle,
  ArrowRight
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface ThinkingStep {
  id: string;
  icon: React.ElementType;
  label: string;
  description: string;
  duration: number; // in milliseconds
  color: string;
}

interface ThinkingIndicatorProps {
  isVisible: boolean;
  className?: string;
  onStepComplete?: (step: ThinkingStep) => void;
  customSteps?: ThinkingStep[];
}

const defaultSteps: ThinkingStep[] = [
  {
    id: 'analyzing',
    icon: Brain,
    label: 'Analyse de la question',
    description: 'Compréhension du contexte et des intentions...',
    duration: 1500,
    color: 'text-purple-600'
  },
  {
    id: 'searching',
    icon: Search,
    label: 'Recherche dans les documents',
    description: 'Exploration des sources pertinentes...',
    duration: 2000,
    color: 'text-blue-600'
  },
  {
    id: 'processing',
    icon: Target,
    label: 'Traitement des informations',
    description: 'Extraction et analyse des données trouvées...',
    duration: 1800,
    color: 'text-green-600'
  },
  {
    id: 'generating',
    icon: Sparkles,
    label: 'Génération de la réponse',
    description: 'Synthèse et rédaction de la réponse...',
    duration: 2200,
    color: 'text-orange-600'
  }
];

export default function ThinkingIndicator({ 
  isVisible, 
  className,
  onStepComplete,
  customSteps = defaultSteps 
}: ThinkingIndicatorProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepProgress, setStepProgress] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isVisible) {
      // Reset state when hidden
      setCurrentStepIndex(0);
      setStepProgress(0);
      setCompletedSteps(new Set());
      return;
    }

    const currentStep = customSteps[currentStepIndex];
    if (!currentStep) return;

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / currentStep.duration) * 100, 100);
      setStepProgress(progress);

      if (progress >= 100) {
        clearInterval(interval);
        setCompletedSteps(prev => new Set([...Array.from(prev), currentStep.id]));
        onStepComplete?.(currentStep);
        
        // Move to next step after a brief delay
        setTimeout(() => {
          if (currentStepIndex < customSteps.length - 1) {
            setCurrentStepIndex(prev => prev + 1);
            setStepProgress(0);
          }
        }, 300);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [isVisible, currentStepIndex, customSteps, onStepComplete]);

  if (!isVisible) return null;

  const currentStep = customSteps[currentStepIndex];
  const Icon = currentStep?.icon || Sparkles;
  const totalProgress = ((currentStepIndex + stepProgress / 100) / customSteps.length) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        "p-4 floating-glass rounded-lg border-purple-200/30 dark:border-purple-700/30",
        className
      )}
    >
      {/* Main thinking animation */}
      <div className="flex items-center gap-4 mb-4">
        <motion.div
          animate={{ 
            rotate: 360,
            scale: [1, 1.1, 1]
          }}
          transition={{ 
            rotate: { duration: 2, repeat: Infinity, ease: "linear" },
            scale: { duration: 1, repeat: Infinity, ease: "easeInOut" }
          }}
          className={cn(
            "p-2 rounded-full glass-subtle shadow-lg",
            currentStep?.color
          )}
        >
          <Icon className="w-5 h-5" />
        </motion.div>
        
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-medium text-gray-900 dark:text-gray-100">
              {currentStep?.label}
            </h4>
            <Badge variant="secondary" className="text-xs">
              Étape {currentStepIndex + 1}/{customSteps.length}
            </Badge>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {currentStep?.description}
          </p>
        </div>
      </div>

      {/* Progress bars */}
      <div className="space-y-2 mb-4">
        {/* Current step progress */}
        <div>
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>Progression actuelle</span>
            <span>{Math.round(stepProgress)}%</span>
          </div>
          <Progress 
            value={stepProgress} 
            className="h-1.5"
          />
        </div>

        {/* Overall progress */}
        <div>
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>Progression globale</span>
            <span>{Math.round(totalProgress)}%</span>
          </div>
          <Progress 
            value={totalProgress} 
            className="h-1.5"
          />
        </div>
      </div>

      {/* Steps overview */}
      <div className="flex items-center justify-between">
        {customSteps.map((step, index) => {
          const isCompleted = completedSteps.has(step.id);
          const isCurrent = index === currentStepIndex;
          const isPending = index > currentStepIndex;
          
          return (
            <React.Fragment key={step.id}>
              <motion.div
                className={cn(
                  "flex items-center gap-2 px-2 py-1 rounded-full text-xs transition-all",
                  isCompleted && "bg-green-100 text-green-700",
                  isCurrent && "bg-purple-100 text-purple-700 scale-105",
                  isPending && "text-gray-400"
                )}
                animate={isCurrent ? { scale: [1, 1.05, 1] } : {}}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {isCompleted ? (
                  <CheckCircle className="w-3 h-3" />
                ) : (
                  <step.icon className="w-3 h-3" />
                )}
                <span className="hidden sm:inline font-medium">
                  {step.label}
                </span>
              </motion.div>
              
              {index < customSteps.length - 1 && (
                <ArrowRight className="w-3 h-3 text-gray-300 flex-shrink-0" />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Performance indicators */}
      <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <Zap className="w-3 h-3" />
          <span>IA optimisée</span>
        </div>
        <div className="flex items-center gap-1">
          <FileText className="w-3 h-3" />
          <span>Sources vérifiées</span>
        </div>
        <div className="flex items-center gap-1">
          <Target className="w-3 h-3" />
          <span>Réponse contextualisée</span>
        </div>
      </div>
    </motion.div>
  );
}

// Specific thinking indicators for different scenarios
export function DocumentSearchIndicator({ isVisible, className }: { isVisible: boolean; className?: string }) {
  const searchSteps: ThinkingStep[] = [
    {
      id: 'indexing',
      icon: Search,
      label: 'Indexation des documents',
      description: 'Analyse des 5 documents de votre corpus...',
      duration: 1200,
      color: 'text-blue-600'
    },
    {
      id: 'matching',
      icon: Target,
      label: 'Recherche de correspondances',
      description: 'Identification des passages pertinents...',
      duration: 1800,
      color: 'text-green-600'
    },
    {
      id: 'ranking',
      icon: Sparkles,
      label: 'Classement par pertinence',
      description: 'Évaluation de la qualité des sources...',
      duration: 1000,
      color: 'text-purple-600'
    }
  ];

  return (
    <ThinkingIndicator 
      isVisible={isVisible} 
      className={className}
      customSteps={searchSteps}
    />
  );
}

export function AnalysisIndicator({ isVisible, className }: { isVisible: boolean; className?: string }) {
  const analysisSteps: ThinkingStep[] = [
    {
      id: 'parsing',
      icon: Brain,
      label: 'Analyse linguistique',
      description: 'Compréhension de la question en français...',
      duration: 800,
      color: 'text-blue-600'
    },
    {
      id: 'context',
      icon: FileText,
      label: 'Contextualisation',
      description: 'Prise en compte du domaine métier...',
      duration: 1200,
      color: 'text-green-600'
    },
    {
      id: 'synthesis',
      icon: Sparkles,
      label: 'Synthèse intelligente',
      description: 'Génération de la réponse optimisée...',
      duration: 1500,
      color: 'text-purple-600'
    }
  ];

  return (
    <ThinkingIndicator 
      isVisible={isVisible} 
      className={className}
      customSteps={analysisSteps}
    />
  );
}