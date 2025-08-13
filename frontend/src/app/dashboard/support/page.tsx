'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle,
  AlertCircle,
  XCircle,
  Activity,
  Server,
  Database,
  Zap,
  RotateCw
} from 'lucide-react';

interface ServiceHealth {
  backend_status: 'healthy' | 'degraded' | 'down';
  vector_status: 'healthy' | 'degraded' | 'down';  
  llm_status: 'healthy' | 'degraded' | 'down';
  uptime: string;
}

export default function SupportPage() {
  const [health, setHealth] = useState<ServiceHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const checkHealth = async () => {
    setLoading(true);
    try {
      const response = await fetch('/health');
      const data = await response.json();
      
      // Map health data to our interface
      setHealth({
        backend_status: data.status === 'healthy' ? 'healthy' : 'degraded',
        vector_status: data.services?.vector_store?.includes('connected') ? 'healthy' : 'degraded',
        llm_status: data.services?.groq_api?.includes('configured') ? 'healthy' : 'degraded',
        uptime: 'N/A'
      });
      setLastCheck(new Date());
    } catch (error) {
      console.error('Failed to check health:', error);
      setHealth({
        backend_status: 'down',
        vector_status: 'down',
        llm_status: 'down',
        uptime: 'N/A'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const handleQuickAction = async (action: string) => {
    setActionLoading(action);
    try {
      // Simulate action for demo purposes
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      switch (action) {
        case 'cache':
          alert('Cache vidé avec succès !');
          break;
        case 'reindex':
          alert('Réindexation des documents lancée !');
          break;
        case 'export':
          alert('Export des données initié ! Vous recevrez un email avec le lien de téléchargement.');
          break;
      }
    } catch (error) {
      alert('Erreur lors de l\'exécution de l\'action');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'degraded': return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case 'down': return <XCircle className="w-5 h-5 text-red-600" />;
      default: return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy': return <Badge className="bg-green-100 text-green-700 border-green-300">Opérationnel</Badge>;
      case 'degraded': return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300">Dégradé</Badge>;
      case 'down': return <Badge className="bg-red-100 text-red-700 border-red-300">Hors ligne</Badge>;
      default: return <Badge variant="secondary">Inconnu</Badge>;
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support & Statut</h1>
          <p className="text-gray-600">État des services et aide technique</p>
        </div>
        <Button onClick={checkHealth} variant="outline" size="sm" disabled={loading}>
          <RotateCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Service Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              État des services
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <Server className="w-4 h-4 text-gray-600" />
                  <span className="font-medium">Backend API</span>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(health?.backend_status || 'unknown')}
                  {getStatusBadge(health?.backend_status || 'unknown')}
                </div>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <Database className="w-4 h-4 text-gray-600" />
                  <span className="font-medium">Base vectorielle</span>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(health?.vector_status || 'unknown')}
                  {getStatusBadge(health?.vector_status || 'unknown')}
                </div>
              </div>

              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Zap className="w-4 h-4 text-gray-600" />
                  <span className="font-medium">Modèle IA</span>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(health?.llm_status || 'unknown')}
                  {getStatusBadge(health?.llm_status || 'unknown')}
                </div>
              </div>
            </div>

            {lastCheck && (
              <div className="mt-4 pt-4 border-t border-gray-200 text-sm text-gray-600">
                Dernière vérification : {lastCheck.toLocaleString('fr-FR')}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contact Support */}
        <Card>
          <CardHeader>
            <CardTitle>Besoin d'aide ?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Documentation</h3>
              <p className="text-sm text-gray-600 mb-3">
                Consultez notre guide d'utilisation pour résoudre les problèmes courants.
              </p>
              <Button variant="outline" size="sm">
                Voir la documentation
              </Button>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-2">Support technique</h3>
              <p className="text-sm text-gray-600 mb-3">
                Contactez notre équipe pour obtenir une assistance personnalisée.
              </p>
              <div className="space-y-2">
                <div className="text-sm">
                  <strong>Email :</strong> support@raggy.fr
                </div>
                <div className="text-sm">
                  <strong>Réponse :</strong> Sous 24h en jours ouvrés
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-2">Informations système</h3>
              <div className="text-sm text-gray-600 space-y-1">
                <div>Version : Raggy v2.0</div>
                <div>Région : Europe (France)</div>
                <div>Conformité : RGPD</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions rapides</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button 
              variant="outline" 
              className="justify-start h-auto p-4"
              onClick={() => handleQuickAction('cache')}
              disabled={actionLoading === 'cache'}
            >
              <div className="text-left">
                <div className="font-medium">
                  {actionLoading === 'cache' ? 'Vidage en cours...' : 'Vider le cache'}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  Actualiser les données en cache
                </div>
              </div>
            </Button>

            <Button 
              variant="outline" 
              className="justify-start h-auto p-4"
              onClick={() => handleQuickAction('reindex')}
              disabled={actionLoading === 'reindex'}
            >
              <div className="text-left">
                <div className="font-medium">
                  {actionLoading === 'reindex' ? 'Réindexation en cours...' : 'Réindexer documents'}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  Reconstruire l'index de recherche
                </div>
              </div>
            </Button>

            <Button 
              variant="outline" 
              className="justify-start h-auto p-4"
              onClick={() => handleQuickAction('export')}
              disabled={actionLoading === 'export'}
            >
              <div className="text-left">
                <div className="font-medium">
                  {actionLoading === 'export' ? 'Export en cours...' : 'Exporter données'}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  Télécharger vos données
                </div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}