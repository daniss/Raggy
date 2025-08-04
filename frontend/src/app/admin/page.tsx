'use client';

import React, { useState, useEffect } from 'react';
import { 
  MessageCircle, 
  FileText, 
  Clock, 
  TrendingUp,
  Users,
  Activity
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function AdminDashboard() {
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    // Set current time only on client-side to avoid hydration mismatch
    setCurrentTime(new Date().toLocaleString('fr-FR'));
  }, []);

  // Mock data - in production, this would come from your API
  const stats = {
    totalQueries: 1234,
    totalDocuments: 45,
    avgResponseTime: 1.2,
    successRate: 98.5,
    activeUsers: 156,
    systemHealth: 'healthy'
  };

  const recentActivity = [
    {
      id: 1,
      type: 'query',
      message: 'Question sur les tarifs posée',
      time: 'Il y a 2 minutes',
      user: 'user@example.com'
    },
    {
      id: 2,
      type: 'upload',
      message: 'Nouveau document ajouté: guide-produits.pdf',
      time: 'Il y a 15 minutes',
      user: 'admin@example.com'
    },
    {
      id: 3,
      type: 'query',
      message: 'Question technique résolue',
      time: 'Il y a 32 minutes',
      user: 'support@example.com'
    },
    {
      id: 4,
      type: 'system',
      message: 'Sauvegarde automatique effectuée',
      time: 'Il y a 1 heure',
      user: 'system'
    }
  ];

  const StatCard = ({ 
    title, 
    value, 
    subtitle, 
    icon: Icon, 
    trend 
  }: {
    title: string;
    value: string | number;
    subtitle: string;
    icon: any;
    trend?: 'up' | 'down' | 'stable';
  }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground flex items-center">
          {trend && (
            <TrendingUp className={`mr-1 h-3 w-3 ${
              trend === 'up' ? 'text-green-500' : 
              trend === 'down' ? 'text-red-500' : 
              'text-gray-500'
            }`} />
          )}
          {subtitle}
        </p>
      </CardContent>
    </Card>
  );

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'query':
        return <MessageCircle className="h-4 w-4" />;
      case 'upload':
        return <FileText className="h-4 w-4" />;
      case 'system':
        return <Activity className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'query':
        return 'text-blue-500';
      case 'upload':
        return 'text-green-500';
      case 'system':
        return 'text-gray-500';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">
          Vue d'ensemble de votre assistant IA
        </p>
      </div>

      {/* System Status */}
      <div className="flex items-center space-x-4">
        <Badge 
          variant={stats.systemHealth === 'healthy' ? 'default' : 'destructive'}
          className="flex items-center space-x-1"
        >
          <div className={`w-2 h-2 rounded-full ${
            stats.systemHealth === 'healthy' ? 'bg-green-400' : 'bg-red-400'
          } animate-pulse`} />
          <span>
            Système {stats.systemHealth === 'healthy' ? 'opérationnel' : 'en maintenance'}
          </span>
        </Badge>
        <span className="text-sm text-gray-500">
          Dernière mise à jour: {currentTime || '--:--'}
        </span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title="Requêtes Totales"
          value={stats.totalQueries.toLocaleString()}
          subtitle="+12% ce mois-ci"
          icon={MessageCircle}
          trend="up"
        />
        <StatCard
          title="Documents Indexés"
          value={stats.totalDocuments}
          subtitle="Base de connaissances"
          icon={FileText}
        />
        <StatCard
          title="Temps de Réponse Moyen"
          value={`${stats.avgResponseTime}s`}
          subtitle="Performance optimale"
          icon={Clock}
          trend="stable"
        />
        <StatCard
          title="Taux de Succès"
          value={`${stats.successRate}%`}
          subtitle="Réponses satisfaisantes"
          icon={TrendingUp}
          trend="up"
        />
        <StatCard
          title="Utilisateurs Actifs"
          value={stats.activeUsers}
          subtitle="Cette semaine"
          icon={Users}
          trend="up"
        />
        <StatCard
          title="Santé du Système"
          value="Excellent"
          subtitle="Tous les services fonctionnent"
          icon={Activity}
        />
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Activité Récente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3">
                  <div className={`mt-1 ${getActivityColor(activity.type)}`}>
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {activity.message}
                    </p>
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <span>{activity.time}</span>
                      {activity.user !== 'system' && (
                        <>
                          <span>•</span>
                          <span>{activity.user}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Statistiques Rapides</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Questions aujourd'hui</span>
                <Badge variant="secondary">23</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Nouveaux documents</span>
                <Badge variant="secondary">3</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Utilisateurs connectés</span>
                <Badge variant="secondary">8</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Erreurs système</span>
                <Badge variant="outline">0</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Temps d'activité</span>
                <Badge variant="default">99.9%</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions Rapides</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button className="p-4 text-center hover:bg-gray-50 rounded-lg transition-colors">
              <FileText className="h-8 w-8 mx-auto mb-2 text-gray-600" />
              <span className="text-sm font-medium">Ajouter Document</span>
            </button>
            <button className="p-4 text-center hover:bg-gray-50 rounded-lg transition-colors">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 text-gray-600" />
              <span className="text-sm font-medium">Tester Chat</span>
            </button>
            <button className="p-4 text-center hover:bg-gray-50 rounded-lg transition-colors">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 text-gray-600" />
              <span className="text-sm font-medium">Voir Analytics</span>
            </button>
            <button className="p-4 text-center hover:bg-gray-50 rounded-lg transition-colors">
              <Activity className="h-8 w-8 mx-auto mb-2 text-gray-600" />
              <span className="text-sm font-medium">Paramètres</span>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}