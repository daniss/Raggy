"use client"

import { Suspense, useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { MessageSquare, Loader2, AlertCircle } from "lucide-react"

function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/dashboard'
  const code = searchParams.get('code')
  
  const supabase = createSupabaseBrowserClient()

  // Handle OAuth callback if code is present
  useEffect(() => {
    if (code) {
      console.log('Code detected, processing OAuth callback:', code)
      handleOAuthCallback(code)
    }
  }, [code])

  const handleOAuthCallback = async (authCode: string) => {
    console.log('Starting OAuth callback processing...')
    setIsLoading(true)
    setError(null)

    try {
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(authCode)
      
      if (exchangeError) {
        console.error('OAuth exchange error:', exchangeError)
        setError("Erreur lors de la connexion OAuth")
        setIsLoading(false)
        return
      }

      if (data.user) {
        console.log('OAuth successful, user authenticated:', data.user.id)
        console.log('About to redirect to:', redirectTo)
        
        // Force immediate redirect
        window.location.replace(redirectTo)
      }
    } catch (error) {
      console.error('OAuth callback error:', error)
      setError("Une erreur inattendue s'est produite lors de la connexion")
      setIsLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      })

      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          setError("Email ou mot de passe incorrect")
        } else if (signInError.message.includes('Email not confirmed')) {
          setError("Veuillez confirmer votre email avant de vous connecter")
        } else {
          setError(signInError.message)
        }
        return
      }

      if (data.user) {
        // Redirect to dashboard - middleware will handle organization check
        router.push(redirectTo)
        router.refresh()
      }
    } catch (error) {
      console.error('Login error:', error)
      setError("Une erreur inattendue s'est produite")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-center mb-4">
          <div className="w-12 h-12 rounded-lg bg-blue-600 flex items-center justify-center">
            <MessageSquare className="w-6 h-6 text-white" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold text-center">
          Connexion
        </CardTitle>
        <CardDescription className="text-center">
          Accédez à votre assistant IA privé
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Show processing message if handling OAuth callback */}
        {code && isLoading && (
          <div className="text-center py-8">
            <Loader2 className="mx-auto h-8 w-8 animate-spin mb-4" />
            <p className="text-muted-foreground">Connexion en cours...</p>
          </div>
        )}
        
        {/* Show login form only if no OAuth code is being processed */}
        {!code && (
          <>
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading || !email.trim() || !password}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connexion...
                  </>
                ) : (
                  "Se connecter"
                )}
              </Button>
            </form>
            
            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">
                Pas encore de compte ?{" "}
              </span>
              <Link 
                href="/auth/register" 
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                Créer un compte
              </Link>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>}>
      <LoginForm />
    </Suspense>
  )
}