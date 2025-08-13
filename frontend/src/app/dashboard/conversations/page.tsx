'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  MessageCircle,
  Search,
  Filter,
  Clock,
  MoreVertical,
  TrendingUp,
  Users,
  Zap,
  RefreshCw
} from 'lucide-react';
import { dashboardApi, type Conversation } from '@/utils/dashboard-api';




export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await dashboardApi.getConversationsFromSupabase();
      setConversations(data);
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setError('Impossible de charger les conversations');
    } finally {
      setLoading(false);
    }
  };

  const filteredConversations = conversations.filter(conv =>
    conv.conversation_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalMessages = conversations.reduce((sum, conv) => sum + conv.messages, 0);
  const avgLatency = conversations.length > 0 
    ? conversations.reduce((sum, conv) => sum + conv.avg_latency, 0) / conversations.length 
    : 0;
  const activeConversations = conversations.filter(conv => 
    new Date(conv.updated_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des conversations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Conversations</h1>
          <p className="text-gray-600">Historique et statistiques des conversations</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={loadConversations} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button onClick={() => window.open('/demo-assistant', '_blank')}>
            <MessageCircle className="w-4 h-4 mr-2" />
            Nouvelle conversation
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold">{conversations.length}</p>
              </div>
              <MessageCircle className="w-8 h-8 text-blue-600 bg-blue-100 rounded-lg p-1.5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Messages</p>
                <p className="text-2xl font-bold">{totalMessages}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600 bg-green-100 rounded-lg p-1.5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Latence moy.</p>
                <p className="text-2xl font-bold">{avgLatency.toFixed(1)}s</p>
              </div>
              <Zap className="w-8 h-8 text-yellow-600 bg-yellow-100 rounded-lg p-1.5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Actives (7j)</p>
                <p className="text-2xl font-bold">{activeConversations}</p>
              </div>
              <Users className="w-8 h-8 text-purple-600 bg-purple-100 rounded-lg p-1.5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher une conversation..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              Filtres
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Conversations List */}
      <Card>
        <CardHeader>
          <CardTitle>Conversations ({filteredConversations.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {filteredConversations.length === 0 ? (
            <div className="text-center py-12">
              <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">
                {searchTerm ? 'Aucune conversation trouvée pour cette recherche' : 'Aucune conversation disponible'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredConversations.map((conv) => (
                <div key={conv.conversation_id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <MessageCircle className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">
                        Conversation #{conv.conversation_id.slice(-8)}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>{conv.messages} messages</span>
                        <span>{conv.avg_latency.toFixed(1)}s latence</span>
                        <span>{new Date(conv.updated_at).toLocaleDateString('fr-FR')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-gray-400" />
                    {conv.csat ? (
                      <Badge className="bg-green-100 text-green-700 border-green-300">
                        CSAT: {conv.csat}/5
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Sans évaluation</Badge>
                    )}
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}