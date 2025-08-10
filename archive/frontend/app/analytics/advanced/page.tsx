'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';
import {
  TrendingUp,
  Users,
  FileText,
  Clock,
  Activity,
  AlertCircle,
  CheckCircle,
  BarChart3,
  PieChart as PieChartIcon,
  Download,
  RefreshCw,
  Calendar,
  Target,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorAlert } from '@/components/ErrorAlert';
import { advancedAnalyticsApi, handleApiError } from '@/utils/api';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

export default function AdvancedAnalyticsPage() {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [userEngagement, setUserEngagement] = useState<any>(null);
  const [documentEffectiveness, setDocumentEffectiveness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState(30);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadAnalyticsData();
  }, [selectedPeriod]);

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [dashboard, engagement, effectiveness] = await Promise.all([
        advancedAnalyticsApi.getDashboard(selectedPeriod),
        advancedAnalyticsApi.getUserEngagement(selectedPeriod),
        advancedAnalyticsApi.getDocumentEffectiveness(selectedPeriod)
      ]);

      setDashboardData(dashboard);
      setUserEngagement(engagement);
      setDocumentEffectiveness(effectiveness);
    } catch (err) {
      console.error('Failed to load analytics:', err);
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    // Implementation for exporting analytics data
    console.log('Exporting analytics data...');
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Chargement des analyses avancées...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <ErrorAlert
          title="Erreur de chargement"
          message={error}
          onDismiss={() => setError(null)}
          action={{
            label: "Réessayer",
            onClick: loadAnalyticsData
          }}
        />
      </div>
    );
  }

  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversations Totales</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData?.overview.total_conversations.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              +12.5% par rapport à la période précédente
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Requêtes Totales</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData?.overview.total_queries.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Moy. {dashboardData?.usage_patterns.avg_daily_queries.toFixed(1)}/jour
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Score Performance</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData?.overview.performance_score}%</div>
            <div className="flex items-center gap-2">
              <Badge variant={dashboardData?.overview.performance_score >= 90 ? "default" : "secondary"}>
                {dashboardData?.overview.performance_score >= 90 ? "Excellent" : "Bon"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage Patterns Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Utilisation Quotidienne</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={dashboardData?.usage_patterns.daily_breakdown}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="queries"
                stroke="#3B82F6"
                fill="#3B82F6"
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Performance Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Distribution des Temps de Réponse</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Rapide (<2s)', value: dashboardData?.performance.response_time_distribution.fast },
                    { name: 'Moyen (2-5s)', value: dashboardData?.performance.response_time_distribution.medium },
                    { name: 'Lent (>5s)', value: dashboardData?.performance.response_time_distribution.slow }
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {[0, 1, 2].map((index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Complexité des Requêtes</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={[
                { name: 'Simple', value: dashboardData?.query_analysis.simple },
                { name: 'Moyen', value: dashboardData?.query_analysis.medium },
                { name: 'Complexe', value: dashboardData?.query_analysis.complex }
              ]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#10B981" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderEngagementTab = () => (
    <div className="space-y-6">
      {/* Engagement Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Utilisateurs Actifs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userEngagement?.summary.active_users}</div>
            <p className="text-xs text-muted-foreground">
              sur {userEngagement?.summary.total_users} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taux d'Engagement</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userEngagement?.summary.engagement_rate}%</div>
            <Badge variant="default">Excellent</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Requêtes/Utilisateur</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userEngagement?.summary.avg_queries_per_user.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">En moyenne</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sessions/Utilisateur</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userEngagement?.summary.avg_sessions_per_user.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">En moyenne</p>
          </CardContent>
        </Card>
      </div>

      {/* User Segments */}
      <Card>
        <CardHeader>
          <CardTitle>Segmentation des Utilisateurs</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={userEngagement?.activity_distribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="segment" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );

  const renderDocumentTab = () => (
    <div className="space-y-6">
      {/* Document Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documents Actifs</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{documentEffectiveness?.summary.active_documents}</div>
            <p className="text-xs text-muted-foreground">
              sur {documentEffectiveness?.summary.total_documents} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taux d'Utilisation</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{documentEffectiveness?.summary.document_usage_rate}%</div>
            <Badge variant="default">Bon</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documents Inutilisés</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{documentEffectiveness?.summary.unused_documents}</div>
            <p className="text-xs text-muted-foreground">À réviser</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Efficacité Moyenne</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">87.3%</div>
            <Badge variant="default">Excellent</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Top Performing Documents */}
      <Card>
        <CardHeader>
          <CardTitle>Documents les Plus Performants</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {documentEffectiveness?.top_performing_documents.map((doc: any, index: number) => (
              <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium">{doc.filename}</h4>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                    <span>{doc.queries_served} requêtes servies</span>
                    <span>Pertinence: {(doc.avg_relevance * 100).toFixed(1)}%</span>
                    <span>Score: {doc.effectiveness_score.toFixed(1)}</span>
                  </div>
                </div>
                <Badge variant={index < 3 ? "default" : "secondary"}>
                  #{index + 1}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Document Type Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Analyse par Type de Document</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {documentEffectiveness?.document_type_analysis.map((type: any, index: number) => (
              <div key={index} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">
                    {type.content_type === 'application/pdf' ? 'PDF' : 
                     type.content_type === 'text/plain' ? 'Texte' : 
                     type.content_type}
                  </h4>
                  <Badge variant="outline">{type.usage_rate.toFixed(1)}% d'utilisation</Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Total:</span>
                    <span className="ml-2 font-medium">{type.total_documents}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Utilisés:</span>
                    <span className="ml-2 font-medium">{type.used_documents}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Requêtes:</span>
                    <span className="ml-2 font-medium">{type.total_queries_served}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Moy/Doc:</span>
                    <span className="ml-2 font-medium">{type.avg_queries_per_doc.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="container mx-auto py-6 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Analyses Avancées</h1>
          <p className="text-gray-600 mt-1">
            Insights détaillés sur les performances et l'utilisation
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Period Selector */}
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(Number(e.target.value))}
            className="px-3 py-2 border rounded-md text-sm"
          >
            <option value={7}>7 derniers jours</option>
            <option value={30}>30 derniers jours</option>
            <option value={90}>3 derniers mois</option>
          </select>

          <Button variant="outline" onClick={loadAnalyticsData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualiser
          </Button>

          <Button onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Exporter
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 mb-6 border-b">
        {[
          { id: 'overview', label: 'Vue d\'ensemble', icon: BarChart3 },
          { id: 'engagement', label: 'Engagement', icon: Users },
          { id: 'documents', label: 'Documents', icon: FileText }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'engagement' && renderEngagementTab()}
        {activeTab === 'documents' && renderDocumentTab()}
      </motion.div>
    </div>
  );
}