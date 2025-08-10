'use client';

import React, { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  CreditCard,
  BarChart3,
  Shield,
  Zap,
  Mail,
  Plus,
  Settings as SettingsIcon,
  Crown,
  CheckCircle,
  AlertTriangle,
  Copy,
  Download,
  Upload,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
  UserPlus,
  MoreVertical,
  Edit,
  Save,
  X,
  Loader2
} from 'lucide-react';
import { 
  organizationApi, 
  usageApi, 
  handleApiError,
  type OrganizationInfo,
  type MemberInfo,
  type UsageStats
} from '@/utils/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from '@/components/ui/dialog';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface BillingInfo {
  plan: string;
  status: 'active' | 'past_due' | 'canceled';
  next_billing_date: string;
  amount: number;
  currency: string;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('organization');
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Real data from API
  const [organization, setOrganization] = useState<OrganizationInfo | null>(null);
  const [teamMembers, setTeamMembers] = useState<MemberInfo[]>([]);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [billingInfo] = useState<BillingInfo>({
    plan: 'Plan Gratuit',
    status: 'active',
    next_billing_date: '2025-02-15',
    amount: 0,
    currency: 'EUR'
  });

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  const apiKey = 'sk-proj-ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [orgData, membersData, usageData] = await Promise.all([
        organizationApi.getCurrentOrganization(),
        organizationApi.getMembers(),
        usageApi.getCurrentUsage()
      ]);
      
      setOrganization(orgData);
      setTeamMembers(membersData);
      setUsageStats(usageData);
    } catch (err) {
      console.error('Failed to load settings data:', err);
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOrganization = async () => {
    if (!organization) return;
    
    try {
      setSaving(true);
      await organizationApi.updateOrganization({
        name: organization.name,
        description: organization.description
      });
      
      // Reload organization data to get updated info
      const updatedOrg = await organizationApi.getCurrentOrganization();
      setOrganization(updatedOrg);
      
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save organization:', err);
      setError(handleApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleInviteUser = async () => {
    if (!inviteEmail) return;
    
    try {
      setInviting(true);
      await organizationApi.inviteMember({
        email: inviteEmail,
        role: 'member'
      });
      
      // Reload members to show the updated list
      const updatedMembers = await organizationApi.getMembers();
      setTeamMembers(updatedMembers);
      
      setInviteEmail('');
      setShowInviteDialog(false);
    } catch (err) {
      console.error('Failed to invite user:', err);
      setError(handleApiError(err));
    } finally {
      setInviting(false);
    }
  };


  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce membre de l\'organisation ?')) {
      return;
    }
    
    try {
      await organizationApi.removeMember(memberId);
      
      // Remove from local state
      setTeamMembers(prev => prev.filter(member => member.id !== memberId));
    } catch (err) {
      console.error('Failed to remove member:', err);
      setError(handleApiError(err));
    }
  };

  const copyApiKey = () => {
    navigator.clipboard.writeText(apiKey);
  };

  const getUsagePercentage = (used: number, limit: number) => {
    return Math.round((used / limit) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Chargement des paramètres...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <h3 className="font-medium text-red-800">Erreur de chargement</h3>
          </div>
          <p className="text-red-700 mt-1">{error}</p>
          <button 
            onClick={loadData}
            className="mt-3 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded-md transition-colors"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (!organization || !usageStats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Données non disponibles</h3>
          <p className="text-gray-600 mb-4">Impossible de charger les données de l'organisation.</p>
          <button 
            onClick={loadData}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Paramètres de l'organisation</h1>
          <p className="text-gray-600 mt-1">
            Gérez votre équipe, votre plan et vos intégrations
          </p>
        </div>
        <Badge variant={organization.plan === 'free' ? 'secondary' : 'default'} className="px-3 py-1">
          <Crown className="w-3 h-3 mr-1" />
          {organization.plan === 'free' ? 'Plan Gratuit' : 
           organization.plan === 'pro' ? 'Plan Pro' : 'Plan Enterprise'}
        </Badge>
      </div>

      {/* Settings Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="organization" className="flex items-center space-x-2">
            <Building2 className="w-4 h-4" />
            <span className="hidden sm:inline">Organisation</span>
          </TabsTrigger>
          <TabsTrigger value="team" className="flex items-center space-x-2">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Équipe</span>
          </TabsTrigger>
          <TabsTrigger value="billing" className="flex items-center space-x-2">
            <CreditCard className="w-4 h-4" />
            <span className="hidden sm:inline">Facturation</span>
          </TabsTrigger>
          <TabsTrigger value="usage" className="flex items-center space-x-2">
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Utilisation</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center space-x-2">
            <Shield className="w-4 h-4" />
            <span className="hidden sm:inline">Sécurité</span>
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center space-x-2">
            <Zap className="w-4 h-4" />
            <span className="hidden sm:inline">Intégrations</span>
          </TabsTrigger>
        </TabsList>

        {/* Organization Tab */}
        <TabsContent value="organization" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <Building2 className="w-5 h-5" />
                    <span>Informations de l'organisation</span>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Gérez les détails de votre organisation
                  </p>
                </div>
                <Button
                  variant={isEditing ? 'default' : 'outline'}
                  onClick={isEditing ? handleSaveOrganization : () => setIsEditing(true)}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Sauvegarde...
                    </>
                  ) : isEditing ? (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Sauvegarder
                    </>
                  ) : (
                    <>
                      <Edit className="w-4 h-4 mr-2" />
                      Modifier
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nom de l'organisation</label>
                  <Input
                    value={organization.name}
                    onChange={(e) => setOrganization(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                    disabled={!isEditing}
                    placeholder="Nom de votre entreprise"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">ID de l'organisation</label>
                  <div className="flex space-x-2">
                    <Input
                      value={organization.id}
                      disabled
                      className="font-mono text-sm"
                    />
                    <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(organization.id)}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={organization.description || ''}
                  onChange={(e) => setOrganization(prev => prev ? ({ ...prev, description: e.target.value }) : null)}
                  disabled={!isEditing}
                  placeholder="Décrivez votre organisation..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Créée le</p>
                  <p className="text-sm">{formatDate(organization.created_at)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Dernière modification</p>
                  <p className="text-sm">{formatDateTime(organization.created_at)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Supprimer l'organisation</CardTitle>
              <p className="text-sm text-muted-foreground">
                Cette action est irréversible et supprimera toutes vos données.
              </p>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" className="bg-red-600 hover:bg-red-700">
                <Trash2 className="w-4 h-4 mr-2" />
                Supprimer l'organisation
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <Users className="w-5 h-5" />
                    <span>Membres de l'équipe</span>
                    <Badge variant="secondary">{teamMembers.length}/{usageStats.user_usage?.max_users || usageStats.document_usage.max_documents}</Badge>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Invitez et gérez les membres de votre organisation
                  </p>
                </div>
                <Button onClick={() => setShowInviteDialog(true)}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Inviter un membre
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {teamMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Avatar>
                        <AvatarImage src={undefined} />
                        <AvatarFallback>{(member.name || member.email).split(' ').map(n => n[0]).join('').toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center space-x-2">
                          <p className="font-medium">{member.name || member.email}</p>
                          <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                            {member.role === 'admin' ? 'Admin' : 'Membre'}
                          </Badge>
                          <Badge 
                            variant={member.status === 'active' ? 'default' : 
                                   member.status === 'invited' ? 'secondary' : 'destructive'}
                          >
                            {member.status === 'active' ? 'Actif' : 
                             member.status === 'invited' ? 'Invité' : 'Suspendu'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{member.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {member.joined_at ? `Rejoint le: ${formatDateTime(member.joined_at)}` : 'En attente d\'acceptation'}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {member.status === 'invited' && (
                          <DropdownMenuItem>Renvoyer l'invitation</DropdownMenuItem>
                        )}
                        {member.role !== 'admin' && (
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={() => handleRemoveMember(member.id)}
                          >
                            Supprimer
                          </DropdownMenuItem>
                        )}
                        {member.role === 'admin' && (
                          <DropdownMenuItem disabled className="text-gray-400">
                            Créateur de l'organisation
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CreditCard className="w-5 h-5" />
                <span>Plan actuel</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium">{billingInfo.plan}</h3>
                  <p className="text-sm text-muted-foreground">
                    {billingInfo.amount > 0 ? `${billingInfo.amount}€/${billingInfo.currency === 'EUR' ? 'mois' : 'month'}` : 'Gratuit'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {billingInfo.amount > 0 ? `Prochaine facturation: ${formatDate(billingInfo.next_billing_date)}` : 'Aucune facturation'}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Factures
                  </Button>
                  <Button>
                    <Crown className="w-4 h-4 mr-2" />
                    Passer à Pro
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Plan Gratuit</CardTitle>
                <p className="text-2xl font-bold">0€<span className="text-sm font-normal">/mois</span></p>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm">10 utilisateurs</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm">100 documents</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm">500 MB de stockage</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm">1000 requêtes IA/mois</span>
                </div>
                <Button variant="outline" className="w-full mt-4" disabled>
                  Plan actuel
                </Button>
              </CardContent>
            </Card>

            <Card className="border-primary">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center">
                  Plan Pro 
                  <Badge className="ml-2">Populaire</Badge>
                </CardTitle>
                <p className="text-2xl font-bold">49€<span className="text-sm font-normal">/mois</span></p>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm">50 utilisateurs</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm">1000 documents</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm">5 GB de stockage</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm">10000 requêtes IA/mois</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm">Support prioritaire</span>
                </div>
                <Button className="w-full mt-4">
                  Passer à Pro
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Plan Enterprise</CardTitle>
                <p className="text-2xl font-bold">Sur mesure</p>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm">Utilisateurs illimités</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm">Documents illimités</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm">Stockage illimité</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm">Support dédié</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm">Déploiement on-premise</span>
                </div>
                <Button variant="outline" className="w-full mt-4">
                  Nous contacter
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Usage Tab */}
        <TabsContent value="usage" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Documents</span>
                  <Badge variant="secondary">{usageStats.document_usage.current_documents}/{usageStats.document_usage.max_documents}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={getUsagePercentage(usageStats.document_usage.current_documents, usageStats.document_usage.max_documents)} className="mb-2" />
                <p className="text-sm text-muted-foreground">
                  {usageStats.document_usage.current_documents} documents utilisés sur {usageStats.document_usage.max_documents} autorisés
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Utilisateurs</span>
                  <Badge variant="secondary">{usageStats.user_usage?.current_users || teamMembers.length}/{usageStats.user_usage?.max_users || 10}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={getUsagePercentage(usageStats.user_usage?.current_users || teamMembers.length, usageStats.user_usage?.max_users || 10)} className="mb-2" />
                <p className="text-sm text-muted-foreground">
                  {usageStats.user_usage?.current_users || teamMembers.length} utilisateurs sur {usageStats.user_usage?.max_users || 10} autorisés
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Stockage</span>
                  <Badge variant="secondary">{usageStats.storage_usage?.current_storage_mb || 0} MB/{usageStats.storage_usage?.max_storage_mb || 500} MB</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={getUsagePercentage(usageStats.storage_usage?.current_storage_mb || 0, usageStats.storage_usage?.max_storage_mb || 500)} className="mb-2" />
                <p className="text-sm text-muted-foreground">
                  {usageStats.storage_usage?.current_storage_mb || 0} MB utilisés sur {usageStats.storage_usage?.max_storage_mb || 500} MB autorisés
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Requêtes IA</span>
                  <Badge variant="secondary">{usageStats.api_usage?.current_requests || 0}/{usageStats.api_usage?.max_requests || 1000}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={getUsagePercentage(usageStats.api_usage?.current_requests || 0, usageStats.api_usage?.max_requests || 1000)} className="mb-2" />
                <p className="text-sm text-muted-foreground">
                  {usageStats.api_usage?.current_requests || 0} requêtes ce mois sur {usageStats.api_usage?.max_requests || 1000} autorisées
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="w-5 h-5" />
                <span>Sécurité de l'organisation</span>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Gérez les paramètres de sécurité de votre organisation
              </p>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Sécurité avancée</h3>
                <p className="text-gray-600 mb-4">Les fonctionnalités de sécurité avancées seront bientôt disponibles.</p>
                <div className="text-sm text-gray-500">
                  Prochainement : Clés API, authentification à deux facteurs, audit logs
                </div>
              </div>
            </CardContent>
          </Card>

          {/* API Key section temporarily disabled */}
          {false && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="w-5 h-5" />
                  <span>Clé API de l'organisation</span>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Utilisez cette clé pour intégrer Raggy dans vos applications
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex space-x-2">
                  <Input
                    value={showApiKey ? apiKey : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••'}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button variant="outline" onClick={copyApiKey}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm">
                    Régénérer la clé
                  </Button>
                  <Button variant="outline" size="sm">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Documentation API
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Paramètres de sécurité</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Authentification à deux facteurs obligatoire</label>
                  <p className="text-xs text-muted-foreground">Oblige tous les membres à activer 2FA</p>
                </div>
                <Switch />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Restriction d'accès par IP</label>
                  <p className="text-xs text-muted-foreground">Limite l'accès depuis certaines adresses IP</p>
                </div>
                <Switch />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Audit logs</label>
                  <p className="text-xs text-muted-foreground">Enregistre toutes les actions des utilisateurs</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Zap className="w-5 h-5" />
                <span>Intégrations</span>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Connectez Raggy à vos outils favoris
              </p>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Zap className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">En développement</h3>
                <p className="text-gray-600 mb-4">Les intégrations tierces sont actuellement en cours de développement.</p>
                <div className="text-sm text-gray-500">
                  Prochainement : Slack, Microsoft Teams, Zapier, Webhooks, API REST
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Invite User Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inviter un nouveau membre</DialogTitle>
            <DialogDescription>
              Invitez une personne à rejoindre votre organisation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Adresse e-mail</label>
              <Input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="utilisateur@entreprise.com"
                type="email"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Rôle</label>
              <div className="p-3 bg-gray-50 rounded-md border">
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium">Membre</span>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Accès aux documents et chat de l'organisation
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                💡 Seul le créateur de l'organisation peut être administrateur
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleInviteUser} disabled={!inviteEmail || inviting}>
              {inviting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Invitation...
                </>
              ) : (
                'Envoyer l\'invitation'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}