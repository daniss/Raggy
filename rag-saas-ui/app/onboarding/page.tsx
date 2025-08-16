"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { MessageSquare, Loader2, AlertCircle, Building } from "lucide-react"

export default function OnboardingPage() {
  const [orgName, setOrgName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError("Utilisateur non authentifié")
        return
      }

      // Call the setup API to create organization
      const response = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          name: user.user_metadata?.name || user.user_metadata?.full_name || 'User',
          orgName: orgName.trim()
        })
      })

      // Ensure we only parse JSON when content-type is JSON
      const contentType = response.headers.get('content-type') || ''
      let result: any = null
      if (contentType.includes('application/json')) {
        result = await response.json()
      } else {
        const text = await response.text()
        throw new Error(`Réponse inattendue du serveur: ${text.slice(0, 120)}...`)
      }

      if (!response.ok) {
        setError(result?.error || "Erreur lors de la création de l'organisation")
        return
      }

      if (result.success) {
        // Organization created successfully, redirect to dashboard
        router.push('/dashboard')
        router.refresh()
      } else {
        setError("Erreur lors de la création de l'organisation")
      }
    } catch (error) {
      console.error('Organization creation error:', error)
      setError(error instanceof Error ? error.message : "Une erreur inattendue s'est produite")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <Card className="w-full">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 rounded-lg bg-blue-600 flex items-center justify-center">
                <Building className="w-6 h-6 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-center">
              Créer votre organisation
            </CardTitle>
            <CardDescription className="text-center">
              Pour commencer, vous devez créer une organisation qui regroupera vos documents et paramètres
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateOrganization} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="orgName">Nom de l'organisation</Label>
                <Input
                  id="orgName"
                  type="text"
                  placeholder="Mon Entreprise"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  required
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  Vous pourrez modifier ce nom plus tard dans les paramètres
                </p>
              </div>
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading || !orgName.trim()}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Création en cours...
                  </>
                ) : (
                  "Créer l'organisation"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
