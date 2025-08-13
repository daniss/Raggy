'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Upload,
  MessageCircle,
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { dashboardApi, type DashboardOverview, type Document, type Conversation } from '@/utils/dashboard-api';
import OnboardingChecklist from '@/components/OnboardingChecklist';
import IndexSummary from '@/components/IndexSummary';
import UpgradeBanner from '@/components/UpgradeBanner';
import { useUserRole, useUsageLimits } from '@/hooks/useUserRole';
import { UsageLimitWarning } from '@/components/FeatureGate';


export default function DashboardOverview() {
  const { user, profile } = useAuth();
  const { role, tier, permissions } = useUserRole();
  const usageLimits = useUsageLimits();
  const [overview, setOverview] = useState<Partial<DashboardOverview> | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Try to load real data from API endpoints
      // If they don't exist, fall back to direct Supabase queries
      const [overviewData, documentsData, conversationsData] = await Promise.allSettled([
        dashboardApi.getOverviewFromSupabase(),
        dashboardApi.getDocumentsFromSupabase(),
        dashboardApi.getConversationsFromSupabase()
      ]);

      if (overviewData.status === 'fulfilled') {
        setOverview(overviewData.value);
      }

      if (documentsData.status === 'fulfilled') {
        setDocuments(documentsData.value);
      }

      if (conversationsData.status === 'fulfilled') {
        setConversations(conversationsData.value);
      }

    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError('Impossible de charger les données du tableau de bord');
    } finally {
      setLoading(false);
    }
  };

  // User state detection
  const isFirstTime = documents.length === 0 && conversations.length === 0;
  const hasDocuments = documents.length > 0;
  const hasConversations = conversations.length > 0;
  const readyDocs = documents.filter(d => d.status === 'ready').length;
  const processingDocs = documents.filter(d => d.status === 'processing').length;
  const isAssistantReady = readyDocs > 0;
  const totalSizeMB = documents.reduce((sum, doc) => sum + doc.size_mb, 0);
  const lastUpdate = documents.length > 0 ? 
    new Date(Math.max(...documents.map(d => new Date(d.updated_at).getTime()))).toISOString() : 
    null;

  // Get recent activity from real data
  const recentActivity = [
    ...documents.slice(0, 3).map(doc => ({
      id: doc.id,
      type: 'upload' as const,
      description: `${doc.filename} uploadé`,
      timestamp: new Date(doc.updated_at),
      status: doc.status
    })),
    ...conversations.slice(0, 2).map(conv => ({
      id: conv.conversation_id,
      type: 'conversation' as const,
      description: `${conv.messages} messages échangés`,
      timestamp: new Date(conv.updated_at)
    }))
  ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 5);

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  const getActivityIcon = (type: 'upload' | 'conversation' | 'system') => {
    switch (type) {
      case 'upload': return '📄';
      case 'conversation': return '💬';
      case 'system': return '⚙️';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement du tableau de bord...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6" style={{ gap: 'var(--spacing-lg)' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">
              Tableau de bord
            </h1>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                tier === 'enterprise' ? 'bg-purple-100 text-purple-800' :
                tier === 'pro' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {tier.charAt(0).toUpperCase() + tier.slice(1)}
              </span>
              {role !== 'user' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                  {role === 'knowledge_manager' ? 'Gestionnaire' : 'Admin'}
                </span>
              )}
            </div>
          </div>
          <p className="text-gray-600">
            Bienvenue {profile?.full_name || user?.email?.split('@')[0]}
          </p>
        </div>
        <Button onClick={loadDashboardData} variant="outline" size="sm">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-2 p-4">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-700">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Upgrade Banner for Near Limits */}
      {usageLimits.showUpgradePrompts && usageLimits.isNearDocumentLimit(documents.length) && (
        <UpgradeBanner
          type="documents"
          current={documents.length}
          limit={usageLimits.maxDocuments}
          onLearnMore={() => window.location.href = '/dashboard/billing'}
        />
      )}

      {/* Smart Onboarding Checklist */}
      <OnboardingChecklist
        hasDocuments={hasDocuments}
        hasConversations={hasConversations}
        isAssistantReady={isAssistantReady}
      />

      {/* Index Summary - Replaces KPI Cards */}
      <IndexSummary
        docsReady={readyDocs}
        totalDocs={documents.length}
        lastUpdate={lastUpdate}
        assistantOk={isAssistantReady}
        processingCount={processingDocs}
        totalSizeMB={totalSizeMB}
      />

      {/* Bottom section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent activity - Real Data */}
        <motion.div initial="hidden" animate="visible" variants={fadeInUp}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" />
                Activité récente
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentActivity.length > 0 ? (
                <div className="space-y-4">
                  {recentActivity.map((activity, index) => (
                    <div key={activity.id || index} className="flex items-start gap-3">
                      <div className="text-lg">{getActivityIcon(activity.type)}</div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">
                          {activity.description}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {activity.timestamp.toLocaleString('fr-FR')}
                        </div>
                      </div>
                      {'status' in activity && activity.status && (
                        <div className={`p-1 rounded ${
                          activity.status === 'ready' ? 'bg-green-100 text-green-700' :
                          activity.status === 'processing' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {activity.status === 'ready' ? <CheckCircle className="w-3 h-3" /> : 
                           <AlertCircle className="w-3 h-3" />}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">
                  Aucune activité récente
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Index Summary - Clean one-liner */}
        <motion.div initial="hidden" animate="visible" variants={fadeInUp}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-gray-900">État de l'index:</span>
                </div>
                <div className="text-sm text-gray-600">
                  <span className="font-semibold">
                    {readyDocs} document{readyDocs > 1 ? 's' : ''}
                  </span>
                  <span className="mx-2">•</span>
                  <span>
                    {documents.reduce((sum, doc) => sum + doc.size_mb, 0).toFixed(1)} MB
                  </span>
                  <span className="mx-2">•</span>
                  <span>
                    {documents.length > 0 ? 
                      `à jour ${new Date(Math.max(...documents.map(d => new Date(d.updated_at).getTime()))).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : 
                      'aucune donnée'
                    }
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}