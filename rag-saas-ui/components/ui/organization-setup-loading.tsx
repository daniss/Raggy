"use client"

import { Loader2, MessageSquare, Check } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { useState, useEffect } from "react"

interface SetupStep {
  id: string
  label: string
  completed: boolean
}

export function OrganizationSetupLoading() {
  const [steps, setSteps] = useState<SetupStep[]>([
    { id: "auth", label: "Authentification réussie", completed: false },
    { id: "org", label: "Création de votre organisation", completed: false },
    { id: "settings", label: "Configuration des paramètres", completed: false },
    { id: "ready", label: "Finalisation", completed: false }
  ])

  useEffect(() => {
    // Simulate setup progress
    const intervals = [
      setTimeout(() => {
        setSteps(prev => prev.map(step => 
          step.id === "auth" ? { ...step, completed: true } : step
        ))
      }, 500),
      
      setTimeout(() => {
        setSteps(prev => prev.map(step => 
          step.id === "org" ? { ...step, completed: true } : step
        ))
      }, 2000),
      
      setTimeout(() => {
        setSteps(prev => prev.map(step => 
          step.id === "settings" ? { ...step, completed: true } : step
        ))
      }, 3500),
      
      setTimeout(() => {
        setSteps(prev => prev.map(step => 
          step.id === "ready" ? { ...step, completed: true } : step
        ))
      }, 5000)
    ]

    return () => intervals.forEach(clearTimeout)
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8">
          <div className="flex flex-col items-center space-y-6">
            {/* Logo */}
            <div className="w-16 h-16 rounded-lg bg-blue-600 flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-white" />
            </div>

            {/* Title */}
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-2">
                Configuration en cours
              </h1>
              <p className="text-muted-foreground">
                Nous préparons votre espace de travail...
              </p>
            </div>

            {/* Progress Steps */}
            <div className="w-full space-y-3">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center space-x-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    step.completed 
                      ? 'bg-green-100 text-green-600' 
                      : index === steps.findIndex(s => !s.completed)
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-gray-100 text-gray-400'
                  }`}>
                    {step.completed ? (
                      <Check className="w-3 h-3" />
                    ) : index === steps.findIndex(s => !s.completed) ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <span className="w-1 h-1 bg-current rounded-full" />
                    )}
                  </div>
                  <span className={`text-sm ${
                    step.completed 
                      ? 'text-green-600 font-medium' 
                      : index === steps.findIndex(s => !s.completed)
                        ? 'text-blue-600 font-medium'
                        : 'text-gray-400'
                  }`}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Footer */}
            <p className="text-xs text-muted-foreground text-center">
              Cette étape ne prend que quelques secondes
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
