'use client';

import React, { useState } from 'react';
import { 
  Cable, 
  Database, 
  FileText, 
  Cloud, 
  GitBranch, 
  Mail, 
  MessageSquare, 
  Calendar,
  Plus,
  Settings,
  Play,
  Pause,
  MoreHorizontal,
  CheckCircle,
  AlertTriangle,
  Clock,
  ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useOrganization } from '@/contexts/OrganizationContext';
import { FeatureGate, EmptyState } from '@/components/FeatureGate';
import { cn } from '@/lib/utils';

// Mock data for connectors
const AVAILABLE_CONNECTORS = [
  {
    id: 'sharepoint',
    name: 'Microsoft SharePoint',
    description: 'Synchronisez vos documents SharePoint',
    icon: Database,
    category: 'Stockage',
    status: 'available',
    enterprise: false
  },
  {
    id: 'gdrive',
    name: 'Google Drive',
    description: 'Importez vos documents Google Drive',
    icon: Cloud,
    category: 'Stockage',
    status: 'available',
    enterprise: false
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    description: 'Connectez votre Dropbox Business',
    icon: Cloud,
    category: 'Stockage',
    status: 'coming_soon',
    enterprise: false
  },
  {
    id: 'confluence',
    name: 'Atlassian Confluence',
    description: 'Synchronisez votre base de connaissances',
    icon: FileText,
    category: 'Documentation',
    status: 'available',
    enterprise: true
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Importez vos pages et bases de données',
    icon: FileText,
    category: 'Documentation',
    status: 'available',
    enterprise: true
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Intégrez avec vos canaux Slack',
    icon: MessageSquare,
    category: 'Communication',
    status: 'coming_soon',
    enterprise: true
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    description: 'Connectez avec Microsoft Teams',
    icon: MessageSquare,
    category: 'Communication',
    status: 'coming_soon',
    enterprise: true
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    description: 'Synchronisez vos données CRM',
    icon: Database,
    category: 'CRM',
    status: 'coming_soon',
    enterprise: true
  }
];

const MOCK_ACTIVE_CONNECTORS = [
  {
    id: 'conn-1',
    name: 'SharePoint Principal',
    type: 'sharepoint',
    status: 'active',
    lastSync: '2024-01-15T10:30:00Z',
    documentsCount: 245,
    config: {
      url: 'https://company.sharepoint.com',
      folders: ['Documents', 'Procedures']
    }
  },
  {
    id: 'conn-2',
    name: 'Google Drive Marketing',
    type: 'gdrive',
    status: 'error',
    lastSync: '2024-01-14T15:45:00Z',
    documentsCount: 89,
    config: {
      folderId: '1abc123def456',
      includeDrafts: false
    }
  }
];

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-800 border-green-200',
  error: 'bg-red-100 text-red-800 border-red-200',
  syncing: 'bg-blue-100 text-blue-800 border-blue-200',
  paused: 'bg-yellow-100 text-yellow-800 border-yellow-200',
};

const CATEGORY_COLORS = {
  'Stockage': 'bg-blue-100 text-blue-800',
  'Documentation': 'bg-green-100 text-green-800',
  'Communication': 'bg-purple-100 text-purple-800',
  'CRM': 'bg-orange-100 text-orange-800',
};

export default function ConnectorsPage() {
  const { organization } = useOrganization();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedConnector, setSelectedConnector] = useState<any>(null);

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

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'syncing':
        return <Clock className="w-4 h-4 text-blue-600 animate-spin" />;
      default:
        return <Pause className="w-4 h-4 text-yellow-600" />;
    }
  };

  return (
    <FeatureGate feature="connectors" permission="connectors:manage" fallback={
      <EmptyState
        icon={Cable}
        title="Connecteurs non disponibles"
        description="Les connecteurs sont disponibles avec le plan Enterprise."
      />
    }>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Connecteurs</h1>
            <p className="text-gray-600">
              Connectez vos sources de données externes pour enrichir votre assistant
            </p>
          </div>
          
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Ajouter un connecteur
          </Button>
        </div>

        {/* Active Connectors */}
        <Card>
          <CardHeader>
            <CardTitle>Connecteurs actifs</CardTitle>
            <CardDescription>
              Gérez vos sources de données connectées
            </CardDescription>
          </CardHeader>
          <CardContent>
            {MOCK_ACTIVE_CONNECTORS.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Connecteur</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Documents</TableHead>
                    <TableHead>Dernière sync</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MOCK_ACTIVE_CONNECTORS.map((connector) => {
                    const connectorType = AVAILABLE_CONNECTORS.find(c => c.id === connector.type);
                    const Icon = connectorType?.icon || Database;
                    
                    return (
                      <TableRow key={connector.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                              <Icon className="w-4 h-4 text-gray-600" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{connector.name}</div>
                              <div className="text-sm text-gray-500">{connectorType?.name}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={CATEGORY_COLORS[connectorType?.category as keyof typeof CATEGORY_COLORS] || CATEGORY_COLORS['Stockage']}>
                            {connectorType?.category}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={STATUS_COLORS[connector.status as keyof typeof STATUS_COLORS] || STATUS_COLORS['active']}>
                            <div className="flex items-center gap-1">
                              {getStatusIcon(connector.status)}
                              {connector.status === 'active' ? 'Actif' :
                               connector.status === 'error' ? 'Erreur' :
                               connector.status === 'syncing' ? 'Synchronisation' : 'Suspendu'}
                            </div>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{connector.documentsCount}</span>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {formatDate(connector.lastSync)}
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
                              <DropdownMenuItem>
                                <Play className="mr-2 h-4 w-4" />
                                Synchroniser maintenant
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Settings className="mr-2 h-4 w-4" />
                                Configurer
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem>
                                <Pause className="mr-2 h-4 w-4" />
                                Suspendre
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                icon={Cable}
                title="Aucun connecteur actif"
                description="Ajoutez votre premier connecteur pour commencer à synchroniser vos données."
                action={{
                  label: "Ajouter un connecteur",
                  onClick: () => setCreateDialogOpen(true)
                }}
              />
            )}
          </CardContent>
        </Card>

        {/* Available Connectors */}
        <Card>
          <CardHeader>
            <CardTitle>Connecteurs disponibles</CardTitle>
            <CardDescription>
              Choisissez parmi nos intégrations disponibles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {AVAILABLE_CONNECTORS.map((connector) => {
                const Icon = connector.icon;
                const isEnterprise = connector.enterprise && organization?.tier !== 'enterprise';
                const isComingSoon = connector.status === 'coming_soon';
                
                return (
                  <Card 
                    key={connector.id} 
                    className={cn(
                      "cursor-pointer transition-all hover:shadow-md",
                      (isEnterprise || isComingSoon) && "opacity-60"
                    )}
                    onClick={() => {
                      if (!isEnterprise && !isComingSoon) {
                        setSelectedConnector(connector);
                        setCreateDialogOpen(true);
                      }
                    }}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                          <Icon className="w-6 h-6 text-gray-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-gray-900">{connector.name}</h3>
                            {connector.enterprise && (
                              <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                                Enterprise
                              </Badge>
                            )}
                            {isComingSoon && (
                              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                Bientôt
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-3">{connector.description}</p>
                          <Badge variant="outline" className={cn("text-xs", CATEGORY_COLORS[connector.category as keyof typeof CATEGORY_COLORS] || CATEGORY_COLORS['Stockage'])}>
                            {connector.category}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Coming Soon Notice */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <GitBranch className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">Développement en cours</h3>
                <p className="text-gray-600">
                  Nous travaillons activement sur de nouveaux connecteurs. 
                  Contactez-nous si vous avez des besoins spécifiques d'intégration.
                </p>
              </div>
              <Button variant="outline">
                <ExternalLink className="w-4 h-4 mr-2" />
                Demander une intégration
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Create Connector Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {selectedConnector ? `Configurer ${selectedConnector.name}` : 'Choisir un connecteur'}
              </DialogTitle>
              <DialogDescription>
                {selectedConnector ? 
                  'Configurez les paramètres de connexion' :
                  'Sélectionnez le type de connecteur à ajouter'
                }
              </DialogDescription>
            </DialogHeader>
            
            {selectedConnector ? (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="connector-name">Nom du connecteur</Label>
                  <Input
                    id="connector-name"
                    placeholder={`${selectedConnector.name} - Production`}
                  />
                </div>
                
                {selectedConnector.id === 'sharepoint' && (
                  <>
                    <div>
                      <Label htmlFor="sharepoint-url">URL SharePoint</Label>
                      <Input
                        id="sharepoint-url"
                        placeholder="https://company.sharepoint.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="sharepoint-folders">Dossiers à synchroniser</Label>
                      <Textarea
                        id="sharepoint-folders"
                        placeholder="Documents, Procedures, Policies"
                        rows={3}
                      />
                    </div>
                  </>
                )}
                
                {selectedConnector.id === 'gdrive' && (
                  <>
                    <div>
                      <Label htmlFor="gdrive-folder">ID du dossier Google Drive</Label>
                      <Input
                        id="gdrive-folder"
                        placeholder="1abc123def456ghi789"
                      />
                    </div>
                    <div className="text-sm text-gray-500">
                      <p>Pour obtenir l'ID du dossier :</p>
                      <ol className="list-decimal list-inside mt-1 space-y-1">
                        <li>Ouvrez le dossier dans Google Drive</li>
                        <li>Copiez l'ID depuis l'URL</li>
                      </ol>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <EmptyState
                icon={Cable}
                title="Fonctionnalité en développement"
                description="L'interface de configuration des connecteurs sera disponible prochainement."
              />
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setCreateDialogOpen(false);
                setSelectedConnector(null);
              }}>
                Annuler
              </Button>
              {selectedConnector && (
                <Button onClick={() => {
                  // Handle connector creation
                  setCreateDialogOpen(false);
                  setSelectedConnector(null);
                }}>
                  Créer le connecteur
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </FeatureGate>
  );
}