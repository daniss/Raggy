'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  TrendingUp,
  Users,
  FileText,
  MessageCircle,
  Clock,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Database,
  Zap,
  Calendar,
  Search,
  Filter,
  Activity,
  HardDrive,
  Cpu
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
// import { DatePickerWithRange } from '@/components/ui/date-picker';
import { useOrganization } from '@/contexts/OrganizationContext';
import { FeatureGate, UsageLimitWarning, EmptyState, LoadingSkeleton } from '@/components/FeatureGate';
import { cn } from '@/lib/utils';

// Types
interface UsageQuota {
  resource: string;
  current: number;
  limit: number;
  percentage: number;
  exceeded: boolean;
}

interface UsageSummary {
  organization_id: string;
  period: string;
  documents: UsageQuota;
  tokens: UsageQuota;
  storage: UsageQuota;
  users: UsageQuota;
  updated_at: string;
}

interface UsageMetrics {
  total_queries_month: number;
  unique_users_month: number;
  avg_response_time_month: number;
  successful_queries_month: number;
  failed_queries_month: number;
  documents_processed_month: number;
}

interface TokenUsageDaily {
  date: string;
  tokens_input: number;
  tokens_output: number;
  total_tokens: number;
  cost_estimate_cents: number;
}

interface PopularQuery {
  query_text: string;
  execution_count: number;
  avg_response_time: number;
  avg_satisfaction?: number;
  last_executed: string;
}

const COLORS = {
  primary: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#8b5cf6',
  pink: '#ec4899',
  indigo: '#6366f1',
  teal: '#14b8a6'
};

const CHART_COLORS = [COLORS.primary, COLORS.success, COLORS.warning, COLORS.purple];

export default function UsagePage() {
  const { organization, hasPermission } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [metrics, setMetrics] = useState<UsageMetrics | null>(null);
  const [tokenUsage, setTokenUsage] = useState<TokenUsageDaily[]>([]);
  const [popularQueries, setPopularQueries] = useState<PopularQuery[]>([]);
  const [exportLoading, setExportLoading] = useState(false);

  // Load usage data
  const loadUsageData = async () => {
    try {
      setLoading(true);

      // Load usage summary
      const summaryResponse = await fetch('/api/v1/usage/summary');
      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        setSummary(summaryData);
      }

      // Load usage metrics
      const metricsResponse = await fetch('/api/v1/usage/metrics');
      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json();
        setMetrics(metricsData);
      }

      // Load daily token usage
      const days = selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : 90;
      const tokenResponse = await fetch(`/api/v1/usage/tokens/daily?days=${days}`);
      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json();
        setTokenUsage(tokenData);
      }

      // Load popular queries
      const queriesResponse = await fetch('/api/v1/usage/queries/popular?limit=10');
      if (queriesResponse.ok) {
        const queriesData = await queriesResponse.json();
        setPopularQueries(queriesData);
      }

    } catch (error) {
      console.error('Error loading usage data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsageData();
  }, [selectedPeriod]);

  // Handle export
  const handleExport = async () => {
    try {
      setExportLoading(true);
      
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const response = await fetch(`/api/v1/usage/export/csv?start_date=${startDate}&end_date=${endDate}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `usage-export-${startDate}-${endDate}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        alert('Erreur lors de l\'export des données');
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Erreur lors de l\'export des données');
    } finally {
      setExportLoading(false);
    }
  };

  // Format numbers
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // Format bytes
  const formatBytes = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  // Get quota color
  const getQuotaColor = (percentage: number) => {
    if (percentage >= 95) return 'text-red-600 bg-red-50 border-red-200';
    if (percentage >= 80) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  return (
    <FeatureGate feature="usage" permission="usage:view" fallback={
      <EmptyState
        icon={BarChart3}
        title="Analyses non disponibles"
        description="Vous n'avez pas les permissions nécessaires pour consulter les analyses d'utilisation."
      />
    }>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Utilisation & Analyses</h1>
            <p className="text-gray-600">
              Surveillez l'utilisation de votre organisation et les métriques de performance
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 jours</SelectItem>
                <SelectItem value="30d">30 jours</SelectItem>
                <SelectItem value="90d">90 jours</SelectItem>
              </SelectContent>
            </Select>
            
            <Button variant="outline" onClick={loadUsageData} disabled={loading}>
              <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
              Actualiser
            </Button>
            
            <Button variant="outline" onClick={handleExport} disabled={exportLoading}>
              <Download className={cn("w-4 h-4 mr-2", exportLoading && "animate-spin")} />
              Exporter CSV
            </Button>
          </div>
        </div>

        {/* Usage Warnings */}
        {summary && (
          <div className="space-y-3">
            {summary.documents.percentage >= 80 && (
              <UsageLimitWarning
                currentUsage={summary.documents.current}
                limit={summary.documents.limit}
                type="documents"
              />
            )}
            {summary.tokens.percentage >= 80 && (
              <UsageLimitWarning
                currentUsage={summary.tokens.current}
                limit={summary.tokens.limit}
                type="tokens"
              />
            )}
            {summary.storage.percentage >= 80 && (
              <UsageLimitWarning
                currentUsage={summary.storage.current}
                limit={summary.storage.limit}
                type="storage"
              />
            )}
            {summary.users.percentage >= 80 && (
              <UsageLimitWarning
                currentUsage={summary.users.current}
                limit={summary.users.limit}
                type="users"
              />
            )}
          </div>
        )}

        {/* Quota Overview */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <LoadingSkeleton lines={3} />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <span className="font-medium text-gray-900">Documents</span>
                  </div>
                  <Badge variant="outline" className={getQuotaColor(summary.documents.percentage)}>
                    {Math.round(summary.documents.percentage)}%
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Utilisés</span>
                    <span className="font-medium">{summary.documents.current} / {summary.documents.limit}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={cn(
                        "h-2 rounded-full transition-all",
                        summary.documents.percentage >= 95 ? "bg-red-500" :
                        summary.documents.percentage >= 80 ? "bg-yellow-500" : "bg-green-500"
                      )}
                      style={{ width: `${Math.min(summary.documents.percentage, 100)}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-600" />
                    <span className="font-medium text-gray-900">Tokens</span>
                  </div>
                  <Badge variant="outline" className={getQuotaColor(summary.tokens.percentage)}>
                    {Math.round(summary.tokens.percentage)}%
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Ce mois</span>
                    <span className="font-medium">{formatNumber(summary.tokens.current)} / {formatNumber(summary.tokens.limit)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={cn(
                        "h-2 rounded-full transition-all",
                        summary.tokens.percentage >= 95 ? "bg-red-500" :
                        summary.tokens.percentage >= 80 ? "bg-yellow-500" : "bg-green-500"
                      )}
                      style={{ width: `${Math.min(summary.tokens.percentage, 100)}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-5 h-5 text-purple-600" />
                    <span className="font-medium text-gray-900">Stockage</span>
                  </div>
                  <Badge variant="outline" className={getQuotaColor(summary.storage.percentage)}>
                    {Math.round(summary.storage.percentage)}%
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Utilisé</span>
                    <span className="font-medium">{summary.storage.current} MB / {summary.storage.limit} MB</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={cn(
                        "h-2 rounded-full transition-all",
                        summary.storage.percentage >= 95 ? "bg-red-500" :
                        summary.storage.percentage >= 80 ? "bg-yellow-500" : "bg-green-500"
                      )}
                      style={{ width: `${Math.min(summary.storage.percentage, 100)}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-gray-900">Utilisateurs</span>
                  </div>
                  <Badge variant="outline" className={getQuotaColor(summary.users.percentage)}>
                    {Math.round(summary.users.percentage)}%
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Actifs</span>
                    <span className="font-medium">{summary.users.current} / {summary.users.limit}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={cn(
                        "h-2 rounded-full transition-all",
                        summary.users.percentage >= 95 ? "bg-red-500" :
                        summary.users.percentage >= 80 ? "bg-yellow-500" : "bg-green-500"
                      )}
                      style={{ width: `${Math.min(summary.users.percentage, 100)}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Usage Metrics */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <LoadingSkeleton lines={2} />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : metrics && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Questions ce mois</p>
                    <p className="text-2xl font-bold text-gray-900">{formatNumber(metrics.total_queries_month)}</p>
                  </div>
                  <MessageCircle className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Utilisateurs uniques</p>
                    <p className="text-2xl font-bold text-gray-900">{metrics.unique_users_month}</p>
                  </div>
                  <Users className="w-8 h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Temps de réponse moyen</p>
                    <p className="text-2xl font-bold text-gray-900">{metrics.avg_response_time_month.toFixed(1)}s</p>
                  </div>
                  <Clock className="w-8 h-8 text-yellow-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Questions réussies</p>
                    <p className="text-2xl font-bold text-green-600">{formatNumber(metrics.successful_queries_month)}</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Questions échouées</p>
                    <p className="text-2xl font-bold text-red-600">{formatNumber(metrics.failed_queries_month)}</p>
                  </div>
                  <XCircle className="w-8 h-8 text-red-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Documents traités</p>
                    <p className="text-2xl font-bold text-gray-900">{metrics.documents_processed_month}</p>
                  </div>
                  <Database className="w-8 h-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Token Usage Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Utilisation des tokens</CardTitle>
            <CardDescription>
              Consommation quotidienne de tokens et coûts estimés
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <LoadingSkeleton lines={8} />
            ) : tokenUsage.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={tokenUsage}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => new Date(value).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis tickFormatter={formatNumber} />
                  <Tooltip 
                    labelFormatter={(value) => new Date(value).toLocaleDateString('fr-FR')}
                    formatter={(value: number, name: string) => [
                      formatNumber(value),
                      name === 'tokens_input' ? 'Tokens d\'entrée' :
                      name === 'tokens_output' ? 'Tokens de sortie' : 'Total'
                    ]}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="tokens_input" 
                    stackId="1"
                    stroke={COLORS.primary} 
                    fill={COLORS.primary}
                    fillOpacity={0.6}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="tokens_output" 
                    stackId="1"
                    stroke={COLORS.success} 
                    fill={COLORS.success}
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                icon={BarChart3}
                title="Aucune donnée de tokens"
                description="Les données d'utilisation des tokens apparaîtront ici une fois que vous commencerez à utiliser l'assistant."
              />
            )}
          </CardContent>
        </Card>

        {/* Popular Queries */}
        <Card>
          <CardHeader>
            <CardTitle>Questions populaires</CardTitle>
            <CardDescription>
              Les questions les plus fréquemment posées à votre assistant
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <LoadingSkeleton key={i} lines={2} />
                ))}
              </div>
            ) : popularQueries.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Question</TableHead>
                    <TableHead>Fréquence</TableHead>
                    <TableHead>Temps de réponse</TableHead>
                    <TableHead>Satisfaction</TableHead>
                    <TableHead>Dernière utilisation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {popularQueries.map((query, index) => (
                    <TableRow key={index}>
                      <TableCell className="max-w-xs">
                        <div className="truncate" title={query.query_text}>
                          {query.query_text}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{query.execution_count}</Badge>
                      </TableCell>
                      <TableCell>{query.avg_response_time.toFixed(1)}s</TableCell>
                      <TableCell>
                        {query.avg_satisfaction ? (
                          <Badge variant="outline" className="text-green-700 border-green-200 bg-green-50">
                            {(query.avg_satisfaction * 100).toFixed(0)}%
                          </Badge>
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {new Date(query.last_executed).toLocaleDateString('fr-FR')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                icon={MessageCircle}
                title="Aucune question populaire"
                description="Les questions fréquemment posées apparaîtront ici une fois que votre assistant sera utilisé."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </FeatureGate>
  );
}