'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, LogIn } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorAlert } from '@/components/ErrorAlert';
import { signInWithEmail, getSession } from '@/utils/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Check if we're in demo mode
  const isDemoMode = process.env.NEXT_PUBLIC_SUPABASE_URL === 'your_real_supabase_url_here' ||
                     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === 'your_real_anon_key_here';

  // Check if user is already logged in
  useEffect(() => {
    if (isDemoMode) {
      // In demo mode, don't check session - let user see login form
      return;
    }

    const checkSession = async () => {
      try {
        const session = await getSession();
        if (session) {
          router.push('/admin');
        }
      } catch (error) {
        console.error('Session check failed:', error);
      }
    };
    checkSession();
  }, [router, isDemoMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Demo mode: simulate login with demo credentials
      if (isDemoMode) {
        // Simulate loading time
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check demo credentials
        if (email === 'demo@example.com' && password === 'demo123') {
          router.push('/');
        } else {
          setError('Utilisez demo@example.com / demo123 pour la démonstration');
        }
        return;
      }

      // Real authentication for production
      const { user, error: signInError } = await signInWithEmail(email, password);
      
      if (signInError) {
        setError(signInError);
        return;
      }

      if (user) {
        // Redirect to admin dashboard
        router.push('/admin');
      }
    } catch (err) {
      setError('Une erreur inattendue s\'est produite');
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = email.trim() && password.trim();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Connexion Admin</h1>
          <p className="mt-2 text-gray-600">
            Accédez au tableau de bord administrateur
          </p>
        </div>

        {/* Login Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-center">
              {isDemoMode ? 'Mode Démonstration' : 'Se connecter'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isDemoMode && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800 font-medium">Mode Démonstration</p>
                <p className="text-xs text-blue-600 mt-1">
                  Utilisez: demo@example.com / demo123
                </p>
              </div>
            )}

            {/* Error Alert */}
            {error && (
              <div className="mb-4">
                <ErrorAlert 
                  title="Erreur de connexion"
                  message={error}
                  onDismiss={() => setError(null)}
                />
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email">Adresse email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@example.com"
                    className="pl-10"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10 pr-10"
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                disabled={!isFormValid || isLoading}
              >
                {isLoading ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span className="ml-2">Connexion en cours...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 mr-2" />
                    Se connecter
                  </>
                )}
              </Button>
            </form>

                {/* Forgot Password Link */}
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => router.push('/auth/forgot-password')}
                    className="text-sm text-blue-600 hover:text-blue-500"
                    disabled={isLoading}
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
          </CardContent>
        </Card>

        {/* Demo Credentials */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <h3 className="font-medium text-blue-900 mb-2">Accès démo</h3>
            <p className="text-sm text-blue-800 mb-3">
              Utilisez ces identifiants pour tester l'application :
            </p>
            <div className="space-y-1 text-sm font-mono">
              <div className="text-blue-900">
                <span className="font-semibold">Email:</span> demo@example.com
              </div>
              <div className="text-blue-900">
                <span className="font-semibold">Mot de passe:</span> demo123
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full"
              onClick={() => {
                setEmail('demo@example.com');
                setPassword('demo123');
              }}
              disabled={isLoading}
            >
              Utiliser les identifiants démo
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}