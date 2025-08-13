'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, 
  Circle, 
  Upload, 
  MessageCircle, 
  Eye,
  X,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  completed: boolean;
  actionUrl?: string;
  actionLabel?: string;
}

interface OnboardingChecklistProps {
  hasDocuments: boolean;
  hasConversations: boolean;
  isAssistantReady: boolean;
  onDismiss?: () => void;
}

export default function OnboardingChecklist({ 
  hasDocuments, 
  hasConversations, 
  isAssistantReady,
  onDismiss 
}: OnboardingChecklistProps) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if user has dismissed the checklist before
    const isDismissed = localStorage.getItem('onboarding-dismissed') === 'true';
    setDismissed(isDismissed);
  }, []);

  const steps: OnboardingStep[] = [
    {
      id: 'upload',
      title: 'Importer un document',
      description: 'Ajoutez votre premier PDF, DOCX, TXT ou CSV',
      icon: Upload,
      completed: hasDocuments,
      actionUrl: '/dashboard/documents',
      actionLabel: 'Importer'
    },
    {
      id: 'question',
      title: 'Poser une question',
      description: 'Testez l\'assistant avec vos documents',
      icon: MessageCircle,
      completed: hasConversations,
      actionUrl: '/dashboard/demo-assistant',
      actionLabel: 'Utiliser l\'assistant'
    },
    {
      id: 'citation',
      title: 'Voir une citation',
      description: 'Vérifiez que les réponses sont sourcées',
      icon: Eye,
      completed: hasConversations && isAssistantReady,
      actionUrl: '/dashboard/demo-assistant',
      actionLabel: 'Tester'
    }
  ];

  const completedSteps = steps.filter(step => step.completed).length;
  const totalSteps = steps.length;
  const progressPercentage = (completedSteps / totalSteps) * 100;
  const isComplete = completedSteps === totalSteps;

  const handleDismiss = () => {
    localStorage.setItem('onboarding-dismissed', 'true');
    setDismissed(true);
    if (onDismiss) {
      onDismiss();
    }
  };

  // Auto-dismiss when complete
  useEffect(() => {
    if (isComplete && !dismissed) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, 3000); // Auto-dismiss after 3 seconds when complete
      return () => clearTimeout(timer);
    }
  }, [isComplete, dismissed]);

  if (dismissed) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
      >
        <Card className={`border-2 ${isComplete ? 'border-green-200 bg-green-50' : 'border-blue-200 bg-blue-50'}`}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {isComplete ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <Circle className="w-5 h-5 text-blue-600" />
                  )}
                  <h3 className={`font-semibold ${isComplete ? 'text-green-900' : 'text-blue-900'}`}>
                    {isComplete ? 'Félicitations ! Configuration terminée' : 'Premiers pas avec votre assistant RAG'}
                  </h3>
                </div>
                <p className={`text-sm ${isComplete ? 'text-green-700' : 'text-blue-700'}`}>
                  {isComplete 
                    ? 'Votre assistant est prêt à utiliser. Vous pouvez maintenant exploiter pleinement vos documents.'
                    : `Complétez ces étapes pour activer votre assistant (${completedSteps}/${totalSteps})`
                  }
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Progression</span>
                <span>{Math.round(progressPercentage)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <motion.div
                  className={`h-2 rounded-full ${isComplete ? 'bg-green-500' : 'bg-blue-500'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercentage}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
            </div>

            {/* Steps */}
            <div className="space-y-3">
              {steps.map((step, index) => {
                const StepIcon = step.icon;
                const isActive = !step.completed && (index === 0 || steps[index - 1].completed);
                
                return (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      step.completed 
                        ? 'bg-green-50 border-green-200' 
                        : isActive 
                          ? 'bg-blue-50 border-blue-200'
                          : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      step.completed 
                        ? 'bg-green-100 text-green-600' 
                        : isActive
                          ? 'bg-blue-100 text-blue-600'
                          : 'bg-gray-100 text-gray-400'
                    }`}>
                      {step.completed ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <StepIcon className="w-4 h-4" />
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <h4 className={`font-medium text-sm ${
                        step.completed ? 'text-green-900' : isActive ? 'text-blue-900' : 'text-gray-600'
                      }`}>
                        {step.title}
                      </h4>
                      <p className={`text-xs ${
                        step.completed ? 'text-green-700' : isActive ? 'text-blue-700' : 'text-gray-500'
                      }`}>
                        {step.description}
                      </p>
                    </div>

                    {!step.completed && isActive && step.actionUrl && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.location.href = step.actionUrl!}
                        className="border-blue-300 text-blue-700 hover:bg-blue-100"
                      >
                        {step.actionLabel}
                        <ChevronRight className="w-3 h-3 ml-1" />
                      </Button>
                    )}

                    {step.completed && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="text-green-600"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {isComplete && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 pt-4 border-t border-green-200"
              >
                <div className="flex gap-3">
                  <Button
                    onClick={() => window.location.href = '/dashboard/demo-assistant'}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Utiliser l'assistant
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => window.location.href = '/dashboard/documents'}
                    className="border-green-300 text-green-700 hover:bg-green-100"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Ajouter plus de documents
                  </Button>
                </div>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}