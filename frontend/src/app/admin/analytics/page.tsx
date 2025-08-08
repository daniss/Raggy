'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Users,  
  MessageCircle,
  Clock,
  Target,
  Download,
  Calendar,
  Filter,
  Eye,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState('7d');
  const [currentTime, setCurrentTime] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<any>(null);

  useEffect(() => {
    setCurrentTime(new Date().toLocaleString('fr-FR'));
    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleString('fr-FR'));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch analytics data from API
  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const days = timeRange === '24h' ? 1 : timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
        setAnalyticsData(null);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch analytics:', err);
        setError('Failed to load analytics data');
        setAnalyticsData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [timeRange]);

  // Use real data if available, otherwise fallback to mock data
  const kpiData = analyticsData ? {
    totalQueries: analyticsData.total_queries || 0,
    totalUsers: analyticsData.unique_users || 0,
    avgResponseTime: analyticsData.avg_response_time || 0,
    successRate: analyticsData.success_rate || 0,
    totalDocuments: 0,
    totalChunks: 0
  } : {
    totalQueries: 0,
    totalUsers: 0,
    avgResponseTime: 0,
    successRate: 0,
    totalDocuments: 0,
    totalChunks: 0
  };

  const queryTrendsData = [
    { date: '01/08', queries: 45, responses: 43, avg_time: 1.2 },
    { date: '02/08', queries: 67, responses: 65, avg_time: 1.1 },
    { date: '03/08', queries: 89, responses: 86, avg_time: 1.3 },
    { date: '04/08', queries: 123, responses: 119, avg_time: 1.5 },
    { date: '05/08', queries: 156, responses: 152, avg_time: 1.2 },
    { date: '06/08', queries: 134, responses: 131, avg_time: 1.4 },
    { date: '07/08', queries: 198, responses: 193, avg_time: 1.1 },
  ];

  const responseTimeData = [
    { range: '<1s', count: 1456, percentage: 59.3 },
    { range: '1-2s', count: 745, percentage: 30.3 },
    { range: '2-3s', count: 198, percentage: 8.1 },
    { range: '3-5s', count: 45, percentage: 1.8 },
    { range: '>5s', count: 12, percentage: 0.5 },
  ];

  const topicsData = [
    { topic: 'API & Intégration', count: 456, percentage: 23.1, color: '#0BC5EA' },
    { topic: 'Tarifs & Abonnements', count: 389, percentage: 19.7, color: '#4A5568' },
    { topic: 'Support Technique', count: 324, percentage: 16.4, color: '#48BB78' },
    { topic: 'Fonctionnalités', count: 267, percentage: 13.5, color: '#ED8936' },
    { topic: 'Sécurité', count: 198, percentage: 10.0, color: '#9F7AEA' },
    { topic: 'Documentation', count: 156, percentage: 7.9, color: '#38B2AC' },
    { topic: 'Autres', count: 186, percentage: 9.4, color: '#A0AEC0' },
  ];

  const satisfactionData = [
    { day: 'Lundi', satisfied: 85, neutral: 12, unsatisfied: 3 },
    { day: 'Mardi', satisfied: 89, neutral: 8, unsatisfied: 3 },
    { day: 'Mercredi', satisfied: 92, neutral: 6, unsatisfied: 2 },
    { day: 'Jeudi', satisfied: 87, neutral: 10, unsatisfied: 3 },
    { day: 'Vendredi', satisfied: 94, neutral: 5, unsatisfied: 1 },
    { day: 'Samedi', satisfied: 78, neutral: 18, unsatisfied: 4 },
    { day: 'Dimanche', satisfied: 82, neutral: 15, unsatisfied: 3 },
  ];

  const documentPerformanceData = [
    { name: 'guide-api.pdf', queries: 234, success_rate: 94.2, avg_relevance: 0.87 },
    { name: 'faq-generale.md', queries: 189, success_rate: 91.5, avg_relevance: 0.82 },
    { name: 'tarifs-2024.pdf', queries: 156, success_rate: 88.9, avg_relevance: 0.79 },
    { name: 'installation.docx', queries: 134, success_rate: 85.1, avg_relevance: 0.74 },
    { name: 'troubleshooting.txt', queries: 98, success_rate: 82.7, avg_relevance: 0.71 },
  ];

  const StatCard = ({ 
    title, 
    value, 
    subtitle, 
    icon: Icon, 
    trend,
    trendValue 
  }: {
    title: string;
    value: string | number;
    subtitle: string;
    icon: any;
    trend?: 'up' | 'down' | 'stable';
    trendValue?: string;
  }) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-center space-x-2">
              <p className="text-2xl font-bold">{value}</p>
              {trend && trendValue && (
                <Badge variant={trend === 'up' ? 'default' : trend === 'down' ? 'destructive' : 'secondary'}>
                  <TrendingUp className={`w-3 h-3 mr-1 ${trend === 'down' ? 'rotate-180' : ''}`} />
                  {trendValue}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );

  const exportData = (format: 'csv' | 'json' | 'pdf') => {
    // Mock export functionality
    const data = {
      kpi: kpiData,
      trends: queryTrendsData,
      topics: topicsData,
      satisfaction: satisfactionData,
      documents: documentPerformanceData,
      exported_at: new Date().toISOString()
    };

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { 
        type: 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
    } else {
      alert(`Export ${format.toUpperCase()} en cours de développement...`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600">
            Analyse des performances de votre assistant IA • Dernière MAJ: {currentTime}
          </p>
        </div>
        <div className="flex space-x-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">24 heures</SelectItem>
              <SelectItem value="7d">7 jours</SelectItem>
              <SelectItem value="30d">30 jours</SelectItem>
              <SelectItem value="90d">90 jours</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => exportData('json')}>
            <Download className="w-4 h-4 mr-2" />
            Exporter
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title="Requêtes Totales"
          value={kpiData.totalQueries.toLocaleString()}
          subtitle="Questions posées"
          icon={MessageCircle}
          trend="up"
          trendValue="+12%"
        />
        <StatCard
          title="Utilisateurs Actifs"
          value={kpiData.totalUsers}
          subtitle="Cette semaine"
          icon={Users}
          trend="up"
          trendValue="+8%"
        />
        <StatCard
          title="Temps de Réponse"
          value={`${kpiData.avgResponseTime}s`}
          subtitle="Moyenne"
          icon={Clock}
          trend="down"
          trendValue="-5%"
        />
        <StatCard
          title="Taux de Succès"
          value={`${kpiData.successRate}%`}
          subtitle="Réponses satisfaisantes"
          icon={Target}
          trend="up"
          trendValue="+2%"
        />
        <StatCard
          title="Documents Indexés"
          value={kpiData.totalDocuments}
          subtitle="Base de connaissances"
          icon={BarChart3}
          trend="stable"
          trendValue="0%"
        />
        <StatCard
          title="Chunks Disponibles"
          value={kpiData.totalChunks.toLocaleString()}
          subtitle="Segments de texte"
          icon={Eye}
          trend="up"
          trendValue="+15%"
        />
      </div>

      {/* Main Analytics Tabs */}
      <Tabs defaultValue="trends" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="trends">Tendances</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="topics">Sujets</TabsTrigger>
          <TabsTrigger value="satisfaction">Satisfaction</TabsTrigger>
        </TabsList>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Évolution des Requêtes</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={queryTrendsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="queries" 
                      stackId="1"
                      stroke="#0BC5EA" 
                      fill="#0BC5EA" 
                      fillOpacity={0.6}
                      name="Requêtes"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="responses" 
                      stackId="2"
                      stroke="#48BB78" 
                      fill="#48BB78" 
                      fillOpacity={0.6}
                      name="Réponses"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Temps de Réponse Moyen</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={queryTrendsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`${value}s`, 'Temps moyen']} />
                    <Line 
                      type="monotone" 
                      dataKey="avg_time" 
                      stroke="#ED8936" 
                      strokeWidth={3}
                      dot={{ fill: '#ED8936', strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Distribution des Temps de Réponse</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={responseTimeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="range" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#0BC5EA" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance des Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {documentPerformanceData.map((doc, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{doc.name}</div>
                        <div className="text-xs text-gray-500">
                          {doc.queries} requêtes • Pertinence: {Math.round(doc.avg_relevance * 100)}%
                        </div>
                      </div>
                      <Badge variant={doc.success_rate > 90 ? 'default' : 'secondary'}>
                        {doc.success_rate}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Topics Tab */}
        <TabsContent value="topics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Répartition des Sujets</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={topicsData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }) => `${name}: ${percentage}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {topicsData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sujets les Plus Populaires</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topicsData.map((topic, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">{topic.topic}</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-500">{topic.count}</span>
                          <Badge style={{ backgroundColor: topic.color, color: 'white' }}>
                            {topic.percentage}%
                          </Badge>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="h-2 rounded-full" 
                          style={{ 
                            width: `${topic.percentage}%`,
                            backgroundColor: topic.color 
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Satisfaction Tab */}
        <TabsContent value="satisfaction" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Satisfaction par Jour</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={satisfactionData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="satisfied" stackId="a" fill="#48BB78" name="Satisfait" />
                    <Bar dataKey="neutral" stackId="a" fill="#ED8936" name="Neutre" />
                    <Bar dataKey="unsatisfied" stackId="a" fill="#F56565" name="Insatisfait" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Métriques de Satisfaction</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-green-600">
                      {analyticsData?.satisfaction?.satisfaction_score || '4.2'}/5
                    </div>
                    <div className="text-sm text-gray-500">Score moyen</div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <ThumbsUp className="w-4 h-4 text-green-500" />
                        <span className="text-sm">Réponses utiles</span>
                      </div>
                      <span className="font-medium">
                        {Math.round(((analyticsData?.satisfaction?.positive_feedback || 95) / (analyticsData?.satisfaction?.total_feedback || 125)) * 100)}%
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <ThumbsDown className="w-4 h-4 text-red-500" />
                        <span className="text-sm">Réponses inadéquates</span>
                      </div>
                      <span className="font-medium">
                        {Math.round(((analyticsData?.satisfaction?.negative_feedback || 5) / (analyticsData?.satisfaction?.total_feedback || 125)) * 100)}%
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <MessageCircle className="w-4 h-4 text-blue-500" />
                        <span className="text-sm">Taux de feedback</span>
                      </div>
                      <span className="font-medium">
                        {Math.round((analyticsData?.satisfaction?.response_rate || 0.68) * 100)}%
                      </span>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t">
                    <h4 className="font-medium mb-2">Commentaires récents:</h4>
                    <div className="space-y-2 text-sm">
                      <div className="p-2 bg-green-50 rounded border-l-2 border-green-400">
                        "Réponse très précise et rapide !"
                      </div>
                      <div className="p-2 bg-blue-50 rounded border-l-2 border-blue-400">
                        "L'assistant a bien compris ma question"
                      </div>
                      <div className="p-2 bg-yellow-50 rounded border-l-2 border-yellow-400">
                        "Pourrait être plus détaillé"
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}