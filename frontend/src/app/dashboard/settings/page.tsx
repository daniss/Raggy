'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Settings,
  Key,
  Building2,
  Palette,
  Bell,
  Shield,
  Globe,
  Save,
  Plus,
  Copy,
  Eye,
  EyeOff,
  Trash2,
  MoreHorizontal,
  RefreshCw,
  Calendar,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  Upload,
  FileText,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOrganization } from '@/contexts/OrganizationContext';
import { FeatureGate, EmptyState, LoadingSkeleton } from '@/components/FeatureGate';
import { cn } from '@/lib/utils';

// Types
interface ApiKey {
  id: string;
  name: string;
  key: string;
  permissions: string[];
  created_at: string;
  last_used?: string;
  expires_at?: string;
  status: 'active' | 'revoked' | 'expired';
}

interface OrganizationSettings {
  id: string;
  name: string;
  description?: string;
  website?: string;
  industry?: string;
  size?: string;
  branding: {
    primaryColor?: string;
    secondaryColor?: string;
    logoUrl?: string;
    customDomain?: string;
  };
  preferences: {
    language: string;
    timezone: string;
    dateFormat: string;
    notifications: {
      email: boolean;
      security: boolean;
      marketing: boolean;
      usage: boolean;
    };
  };
  security: {
    twoFactorRequired: boolean;
    sessionTimeout: number;
    ipWhitelist: string[];
    dataRetention: number;
  };
}

const API_PERMISSIONS = [
  { value: 'documents:read', label: 'Lire les documents', description: 'Consulter les documents uploadés' },
  { value: 'documents:write', label: 'Gérer les documents', description: 'Uploader et modifier les documents' },
  { value: 'chat:query', label: 'Poser des questions', description: 'Interroger l\'assistant via API' },
  { value: 'analytics:read', label: 'Consulter les analyses', description: 'Accéder aux métriques d\'utilisation' },
  { value: 'users:read', label: 'Consulter les utilisateurs', description: 'Lire les informations des membres' },
  { value: 'users:write', label: 'Gérer les utilisateurs', description: 'Inviter et gérer les membres' },
];

export default function SettingsPage() {
  const { organization, updateOrganization, hasPermission } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [settings, setSettings] = useState<OrganizationSettings | null>(null);
  const [activeTab, setActiveTab] = useState('general');
  const [createApiKeyOpen, setCreateApiKeyOpen] = useState(false);
  const [showApiKey, setShowApiKey] = useState<string | null>(null);
  const [newApiKey, setNewApiKey] = useState({
    name: '',
    permissions: [] as string[],
    expiresInDays: 365
  });

  // Load settings and API keys
  const loadData = async () => {
    try {
      setLoading(true);

      // Load organization settings
      if (organization) {
        setSettings({
          id: organization.id,
          name: organization.name,
          description: organization.description,
          branding: organization.branding || {},
          preferences: {
            language: 'fr',
            timezone: 'Europe/Paris',
            dateFormat: 'DD/MM/YYYY',
            notifications: {
              email: true,
              security: true,
              marketing: false,
              usage: true
            }
          },
          security: {
            twoFactorRequired: false,
            sessionTimeout: 24,
            ipWhitelist: [],
            dataRetention: 365
          }
        } as OrganizationSettings);
      }

      // Load API keys
      const apiKeysResponse = await fetch('/api/v1/organizations/api-keys');
      if (apiKeysResponse.ok) {
        const apiKeysData = await apiKeysResponse.json();
        setApiKeys(apiKeysData.items || []);
      }

    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [organization]);

  // Save organization settings
  const handleSaveSettings = async () => {
    if (!settings) return;

    try {
      setSaving(true);
      
      const updates = {
        name: settings.name,
        description: settings.description,
        branding: settings.branding
      };

      await updateOrganization(updates);
      
      // Also save preferences to backend if API exists
      // await fetch('/api/v1/organizations/preferences', {
      //   method: 'PUT',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(settings.preferences)
      // });

    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // Create API key
  const handleCreateApiKey = async () => {
    try {
      const response = await fetch('/api/v1/organizations/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newApiKey.name,
          permissions: newApiKey.permissions,
          expires_in_days: newApiKey.expiresInDays
        })
      });

      if (response.ok) {
        const result = await response.json();
        setApiKeys([...apiKeys, result.data]);
        setCreateApiKeyOpen(false);
        setNewApiKey({ name: '', permissions: [], expiresInDays: 365 });
        loadData(); // Refresh
      } else {
        const error = await response.json();
        alert(error.detail || 'Erreur lors de la création');
      }
    } catch (error) {
      console.error('Error creating API key:', error);
      alert('Erreur lors de la création');
    }
  };

  // Revoke API key
  const handleRevokeApiKey = async (keyId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir révoquer cette clé API ?')) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/organizations/api-keys/${keyId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setApiKeys(apiKeys.filter(key => key.id !== keyId));
      } else {
        alert('Erreur lors de la révocation');
      }
    } catch (error) {
      console.error('Error revoking API key:', error);
      alert('Erreur lors de la révocation');
    }
  };

  // Copy API key to clipboard
  const copyApiKey = (key: string) => {
    navigator.clipboard.writeText(key);
    // Show toast notification here
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get key status color
  const getKeyStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'expired':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'revoked':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <FeatureGate feature="settings" permission="org:settings" fallback={
      <EmptyState
        icon={Settings}
        title="Paramètres non disponibles"
        description="Vous n'avez pas les permissions nécessaires pour gérer les paramètres de l'organisation."
      />
    }>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
            <p className="text-gray-600">
              Gérez les paramètres de votre organisation et vos clés API
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={loadData} disabled={loading}>
              <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
              Actualiser
            </Button>
            
            <Button onClick={handleSaveSettings} disabled={saving || loading}>
              <Save className={cn("w-4 h-4 mr-2", saving && "animate-spin")} />
              Enregistrer
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="general">Général</TabsTrigger>
            <TabsTrigger value="branding">Image de marque</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="security">Sécurité</TabsTrigger>
            <TabsTrigger value="api-keys">Clés API</TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general" className="space-y-6">
            {loading ? (
              <Card>
                <CardContent className="p-6">
                  <LoadingSkeleton lines={8} />
                </CardContent>
              </Card>
            ) : settings && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    Informations générales
                  </CardTitle>
                  <CardDescription>
                    Informations de base de votre organisation
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="org-name">Nom de l'organisation</Label>
                      <Input
                        id="org-name"
                        value={settings.name}
                        onChange={(e) => setSettings({...settings, name: e.target.value})}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="org-website">Site web</Label>
                      <Input
                        id="org-website"
                        type="url"
                        value={settings.website || ''}
                        onChange={(e) => setSettings({...settings, website: e.target.value})}
                        placeholder="https://exemple.com"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="org-description">Description</Label>
                    <Textarea
                      id="org-description"
                      value={settings.description || ''}
                      onChange={(e) => setSettings({...settings, description: e.target.value})}
                      placeholder="Décrivez votre organisation..."
                      rows={4}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="org-industry">Secteur d'activité</Label>
                      <Select 
                        value={settings.industry || ''} 
                        onValueChange={(value) => setSettings({...settings, industry: value})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un secteur" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="technology">Technologie</SelectItem>
                          <SelectItem value="finance">Finance</SelectItem>
                          <SelectItem value="healthcare">Santé</SelectItem>
                          <SelectItem value="education">Éducation</SelectItem>
                          <SelectItem value="retail">Commerce</SelectItem>
                          <SelectItem value="manufacturing">Industrie</SelectItem>
                          <SelectItem value="consulting">Conseil</SelectItem>
                          <SelectItem value="other">Autre</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="org-size">Taille de l'organisation</Label>
                      <Select 
                        value={settings.size || ''} 
                        onValueChange={(value) => setSettings({...settings, size: value})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner la taille" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1-10">1-10 employés</SelectItem>
                          <SelectItem value="11-50">11-50 employés</SelectItem>
                          <SelectItem value="51-200">51-200 employés</SelectItem>
                          <SelectItem value="201-1000">201-1000 employés</SelectItem>
                          <SelectItem value="1000+">1000+ employés</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <Label htmlFor="org-language">Langue</Label>
                      <Select 
                        value={settings.preferences.language} 
                        onValueChange={(value) => setSettings({
                          ...settings, 
                          preferences: {...settings.preferences, language: value}
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fr">Français</SelectItem>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="es">Español</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="org-timezone">Fuseau horaire</Label>
                      <Select 
                        value={settings.preferences.timezone} 
                        onValueChange={(value) => setSettings({
                          ...settings, 
                          preferences: {...settings.preferences, timezone: value}
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Europe/Paris">Paris (GMT+1)</SelectItem>
                          <SelectItem value="Europe/London">Londres (GMT+0)</SelectItem>
                          <SelectItem value="America/New_York">New York (GMT-5)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="org-dateformat">Format de date</Label>
                      <Select 
                        value={settings.preferences.dateFormat} 
                        onValueChange={(value) => setSettings({
                          ...settings, 
                          preferences: {...settings.preferences, dateFormat: value}
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                          <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                          <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Branding Settings */}
          <TabsContent value="branding" className="space-y-6">
            {loading ? (
              <Card>
                <CardContent className="p-6">
                  <LoadingSkeleton lines={6} />
                </CardContent>
              </Card>
            ) : settings && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="w-5 h-5" />
                    Image de marque
                  </CardTitle>
                  <CardDescription>
                    Personnalisez l'apparence de votre interface
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="primary-color">Couleur principale</Label>
                      <div className="flex items-center gap-3">
                        <Input
                          id="primary-color"
                          type="color"
                          value={settings.branding.primaryColor || '#3b82f6'}
                          onChange={(e) => setSettings({
                            ...settings, 
                            branding: {...settings.branding, primaryColor: e.target.value}
                          })}
                          className="w-16 h-10"
                        />
                        <Input
                          value={settings.branding.primaryColor || '#3b82f6'}
                          onChange={(e) => setSettings({
                            ...settings, 
                            branding: {...settings.branding, primaryColor: e.target.value}
                          })}
                          placeholder="#3b82f6"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="secondary-color">Couleur secondaire</Label>
                      <div className="flex items-center gap-3">
                        <Input
                          id="secondary-color"
                          type="color"
                          value={settings.branding.secondaryColor || '#1e40af'}
                          onChange={(e) => setSettings({
                            ...settings, 
                            branding: {...settings.branding, secondaryColor: e.target.value}
                          })}
                          className="w-16 h-10"
                        />
                        <Input
                          value={settings.branding.secondaryColor || '#1e40af'}
                          onChange={(e) => setSettings({
                            ...settings, 
                            branding: {...settings.branding, secondaryColor: e.target.value}
                          })}
                          placeholder="#1e40af"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="logo-url">URL du logo</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        id="logo-url"
                        type="url"
                        value={settings.branding.logoUrl || ''}
                        onChange={(e) => setSettings({
                          ...settings, 
                          branding: {...settings.branding, logoUrl: e.target.value}
                        })}
                        placeholder="https://exemple.com/logo.png"
                      />
                      <Button variant="outline" size="sm">
                        <Upload className="w-4 h-4 mr-2" />
                        Upload
                      </Button>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="custom-domain">Domaine personnalisé</Label>
                    <Input
                      id="custom-domain"
                      value={settings.branding.customDomain || ''}
                      onChange={(e) => setSettings({
                        ...settings, 
                        branding: {...settings.branding, customDomain: e.target.value}
                      })}
                      placeholder="votre-domaine.com"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Configurez un domaine personnalisé pour votre assistant (fonctionnalité Enterprise)
                    </p>
                  </div>
                  
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h4 className="font-medium text-blue-900 mb-2">Aperçu des couleurs</h4>
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-16 h-16 rounded-lg border border-gray-300"
                        style={{ backgroundColor: settings.branding.primaryColor || '#3b82f6' }}
                      />
                      <div 
                        className="w-16 h-16 rounded-lg border border-gray-300"
                        style={{ backgroundColor: settings.branding.secondaryColor || '#1e40af' }}
                      />
                      <div className="text-sm text-blue-700">
                        <p>Primaire: {settings.branding.primaryColor || '#3b82f6'}</p>
                        <p>Secondaire: {settings.branding.secondaryColor || '#1e40af'}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Notifications Settings */}
          <TabsContent value="notifications" className="space-y-6">
            {loading ? (
              <Card>
                <CardContent className="p-6">
                  <LoadingSkeleton lines={6} />
                </CardContent>
              </Card>
            ) : settings && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    Préférences de notification
                  </CardTitle>
                  <CardDescription>
                    Configurez vos notifications par email
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="notif-email">Notifications par email</Label>
                        <p className="text-sm text-gray-500">Recevoir les notifications importantes par email</p>
                      </div>
                      <Switch
                        id="notif-email"
                        checked={settings.preferences.notifications.email}
                        onCheckedChange={(checked) => setSettings({
                          ...settings,
                          preferences: {
                            ...settings.preferences,
                            notifications: {...settings.preferences.notifications, email: checked}
                          }
                        })}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="notif-security">Alertes de sécurité</Label>
                        <p className="text-sm text-gray-500">Incidents de sécurité et violations</p>
                      </div>
                      <Switch
                        id="notif-security"
                        checked={settings.preferences.notifications.security}
                        onCheckedChange={(checked) => setSettings({
                          ...settings,
                          preferences: {
                            ...settings.preferences,
                            notifications: {...settings.preferences.notifications, security: checked}
                          }
                        })}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="notif-usage">Rapports d'utilisation</Label>
                        <p className="text-sm text-gray-500">Rapports mensuels d'utilisation</p>
                      </div>
                      <Switch
                        id="notif-usage"
                        checked={settings.preferences.notifications.usage}
                        onCheckedChange={(checked) => setSettings({
                          ...settings,
                          preferences: {
                            ...settings.preferences,
                            notifications: {...settings.preferences.notifications, usage: checked}
                          }
                        })}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="notif-marketing">Communications marketing</Label>
                        <p className="text-sm text-gray-500">Nouvelles fonctionnalités et mises à jour</p>
                      </div>
                      <Switch
                        id="notif-marketing"
                        checked={settings.preferences.notifications.marketing}
                        onCheckedChange={(checked) => setSettings({
                          ...settings,
                          preferences: {
                            ...settings.preferences,
                            notifications: {...settings.preferences.notifications, marketing: checked}
                          }
                        })}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Security Settings */}
          <TabsContent value="security" className="space-y-6">
            {loading ? (
              <Card>
                <CardContent className="p-6">
                  <LoadingSkeleton lines={6} />
                </CardContent>
              </Card>
            ) : settings && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Paramètres de sécurité
                  </CardTitle>
                  <CardDescription>
                    Configurez la sécurité de votre organisation
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="2fa-required">Authentification à deux facteurs obligatoire</Label>
                        <p className="text-sm text-gray-500">Exiger 2FA pour tous les membres</p>
                      </div>
                      <Switch
                        id="2fa-required"
                        checked={settings.security.twoFactorRequired}
                        onCheckedChange={(checked) => setSettings({
                          ...settings,
                          security: {...settings.security, twoFactorRequired: checked}
                        })}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="session-timeout">Timeout de session (heures)</Label>
                      <Select 
                        value={settings.security.sessionTimeout.toString()} 
                        onValueChange={(value) => setSettings({
                          ...settings,
                          security: {...settings.security, sessionTimeout: parseInt(value)}
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 heure</SelectItem>
                          <SelectItem value="8">8 heures</SelectItem>
                          <SelectItem value="24">24 heures</SelectItem>
                          <SelectItem value="168">7 jours</SelectItem>
                          <SelectItem value="720">30 jours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="data-retention">Rétention des données (jours)</Label>
                      <Select 
                        value={settings.security.dataRetention.toString()} 
                        onValueChange={(value) => setSettings({
                          ...settings,
                          security: {...settings.security, dataRetention: parseInt(value)}
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="90">90 jours</SelectItem>
                          <SelectItem value="180">6 mois</SelectItem>
                          <SelectItem value="365">1 an</SelectItem>
                          <SelectItem value="1095">3 ans</SelectItem>
                          <SelectItem value="1825">5 ans</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-gray-500 mt-1">
                        Durée de conservation des logs et données d'utilisation
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* API Keys */}
          <TabsContent value="api-keys" className="space-y-6">
            <FeatureGate feature="api_keys" permission="apikeys:manage" fallback={
              <Card>
                <CardContent className="p-6">
                  <EmptyState
                    icon={Key}
                    title="Clés API non disponibles"
                    description="Les clés API sont disponibles avec le plan Pro ou Enterprise."
                  />
                </CardContent>
              </Card>
            }>
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">Clés API</h3>
                  <p className="text-gray-600">Gérez vos clés d'accès API pour l'intégration</p>
                </div>
                <Button onClick={() => setCreateApiKeyOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Créer une clé
                </Button>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="w-5 h-5" />
                    Clés API actives
                  </CardTitle>
                  <CardDescription>
                    Clés d'accès pour intégrer l'API Raggy dans vos applications
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-4">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <LoadingSkeleton key={i} lines={2} />
                      ))}
                    </div>
                  ) : apiKeys.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nom</TableHead>
                          <TableHead>Clé</TableHead>
                          <TableHead>Permissions</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead>Dernière utilisation</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {apiKeys.map((apiKey) => (
                          <TableRow key={apiKey.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{apiKey.name}</div>
                                <div className="text-sm text-gray-500">
                                  Créée le {formatDate(apiKey.created_at)}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                                  {showApiKey === apiKey.id 
                                    ? apiKey.key 
                                    : `${apiKey.key.substring(0, 8)}...${apiKey.key.substring(-4)}`
                                  }
                                </code>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setShowApiKey(
                                    showApiKey === apiKey.id ? null : apiKey.id
                                  )}
                                >
                                  {showApiKey === apiKey.id ? 
                                    <EyeOff className="w-4 h-4" /> : 
                                    <Eye className="w-4 h-4" />
                                  }
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyApiKey(apiKey.key)}
                                >
                                  <Copy className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {apiKey.permissions.slice(0, 2).map((perm) => (
                                  <Badge key={perm} variant="secondary" className="text-xs">
                                    {perm.split(':')[0]}
                                  </Badge>
                                ))}
                                {apiKey.permissions.length > 2 && (
                                  <Badge variant="secondary" className="text-xs">
                                    +{apiKey.permissions.length - 2}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={getKeyStatusColor(apiKey.status)}>
                                {apiKey.status === 'active' ? 'Active' :
                                 apiKey.status === 'expired' ? 'Expirée' : 'Révoquée'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-gray-500">
                              {apiKey.last_used ? formatDate(apiKey.last_used) : 'Jamais'}
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" className="h-8 w-8 p-0">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                  <DropdownMenuItem onClick={() => copyApiKey(apiKey.key)}>
                                    <Copy className="mr-2 h-4 w-4" />
                                    Copier la clé
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => handleRevokeApiKey(apiKey.id)}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Révoquer
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <EmptyState
                      icon={Key}
                      title="Aucune clé API"
                      description="Créez votre première clé API pour commencer l'intégration."
                      action={{
                        label: "Créer une clé API",
                        onClick: () => setCreateApiKeyOpen(true)
                      }}
                    />
                  )}
                </CardContent>
              </Card>

              {/* API Documentation */}
              <Card>
                <CardHeader>
                  <CardTitle>Documentation API</CardTitle>
                  <CardDescription>
                    Ressources pour intégrer l'API Raggy
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-3">
                        <FileText className="w-8 h-8 text-blue-600" />
                        <div>
                          <h4 className="font-semibold text-blue-900">Documentation complète</h4>
                          <p className="text-sm text-blue-700">
                            Guide complet d'utilisation de l'API REST
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" className="border-blue-300 text-blue-700">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Voir la doc
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <h4 className="font-medium text-gray-900 mb-2">Endpoint de base</h4>
                        <code className="text-sm bg-white px-2 py-1 rounded border">
                          https://api.raggy.ai/v1
                        </code>
                      </div>
                      
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <h4 className="font-medium text-gray-900 mb-2">Format d'authentification</h4>
                        <code className="text-sm bg-white px-2 py-1 rounded border">
                          Authorization: Bearer YOUR_API_KEY
                        </code>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </FeatureGate>
          </TabsContent>
        </Tabs>

        {/* Create API Key Dialog */}
        <Dialog open={createApiKeyOpen} onOpenChange={setCreateApiKeyOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Créer une nouvelle clé API</DialogTitle>
              <DialogDescription>
                Configurez les permissions et l'expiration de votre clé
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="key-name">Nom de la clé</Label>
                <Input
                  id="key-name"
                  value={newApiKey.name}
                  onChange={(e) => setNewApiKey({...newApiKey, name: e.target.value})}
                  placeholder="Application mobile, Site web, etc."
                />
              </div>
              
              <div>
                <Label>Permissions</Label>
                <div className="space-y-2 mt-2">
                  {API_PERMISSIONS.map(permission => (
                    <div key={permission.value} className="flex items-start space-x-2">
                      <input
                        type="checkbox"
                        id={permission.value}
                        checked={newApiKey.permissions.includes(permission.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewApiKey({
                              ...newApiKey,
                              permissions: [...newApiKey.permissions, permission.value]
                            });
                          } else {
                            setNewApiKey({
                              ...newApiKey,
                              permissions: newApiKey.permissions.filter(p => p !== permission.value)
                            });
                          }
                        }}
                        className="mt-1"
                      />
                      <Label htmlFor={permission.value} className="text-sm">
                        <div>
                          <div className="font-medium">{permission.label}</div>
                          <div className="text-xs text-gray-500">{permission.description}</div>
                        </div>
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <Label htmlFor="key-expiry">Expiration</Label>
                <Select 
                  value={newApiKey.expiresInDays.toString()} 
                  onValueChange={(value) => setNewApiKey({...newApiKey, expiresInDays: parseInt(value)})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 jours</SelectItem>
                    <SelectItem value="90">90 jours</SelectItem>
                    <SelectItem value="365">1 an</SelectItem>
                    <SelectItem value="0">Pas d'expiration</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateApiKeyOpen(false)}>
                Annuler
              </Button>
              <Button 
                onClick={handleCreateApiKey} 
                disabled={!newApiKey.name || newApiKey.permissions.length === 0}
              >
                Créer la clé
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </FeatureGate>
  );
}