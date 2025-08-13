'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  Download,
  RefreshCw,
  Plus,
  MoreHorizontal,
  Gavel,
  Search,
  Filter,
  Eye,
  Users,
  Database,
  TrendingUp,
  XCircle,
  Calendar,
  BarChart3,
  Target,
  Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOrganization } from '@/contexts/OrganizationContext';
import { FeatureGate, EmptyState, LoadingSkeleton } from '@/components/FeatureGate';
import { cn } from '@/lib/utils';

// Types
interface SecurityIncident {
  id: string;
  organization_id: string;
  title: string;
  description?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  affected_users: number;
  affected_documents: number;
  data_types_affected: string[];
  detected_at: string;
  resolved_at?: string;
  assigned_to?: string;
  reported_by?: string;
}

interface ComplianceAudit {
  id: string;
  organization_id: string;
  audit_type: string;
  framework: string;
  title: string;
  description?: string;
  scope?: string;
  status: 'planned' | 'in_progress' | 'completed' | 'failed';
  planned_date?: string;
  started_at?: string;
  completed_at?: string;
  score?: number;
  auditor_name?: string;
  created_at: string;
}

interface SecurityDashboard {
  organization_id: string;
  period: { days: number; start_date: string; end_date: string };
  security_posture: {
    risk_level: 'low' | 'medium' | 'high';
    incidents_summary: {
      total_incidents: number;
      critical_incidents: number;
      open_incidents: number;
      avg_resolution_hours: number;
    };
    compliance_score: number;
    pii_incidents: number;
  };
  recent_audits: ComplianceAudit[];
  recommendations: Array<{
    priority: 'low' | 'medium' | 'high' | 'critical';
    category: string;
    title: string;
    description: string;
  }>;
  generated_at: string;
}

const SEVERITY_COLORS = {
  low: 'bg-blue-100 text-blue-800 border-blue-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  critical: 'bg-red-100 text-red-800 border-red-200',
};

const STATUS_COLORS = {
  open: 'bg-red-100 text-red-800 border-red-200',
  investigating: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  resolved: 'bg-green-100 text-green-800 border-green-200',
  closed: 'bg-gray-100 text-gray-800 border-gray-200',
  planned: 'bg-blue-100 text-blue-800 border-blue-200',
  in_progress: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  failed: 'bg-red-100 text-red-800 border-red-200',
};

const RISK_COLORS = {
  low: 'text-green-600 bg-green-50 border-green-200',
  medium: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  high: 'text-red-600 bg-red-50 border-red-200',
};

export default function CompliancePage() {
  const { organization, hasPermission } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboard, setDashboard] = useState<SecurityDashboard | null>(null);
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [audits, setAudits] = useState<ComplianceAudit[]>([]);
  const [incidentDialogOpen, setIncidentDialogOpen] = useState(false);
  const [auditDialogOpen, setAuditDialogOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('30');

  // Load compliance data
  const loadComplianceData = async () => {
    try {
      setLoading(true);

      // Load security dashboard
      const dashboardResponse = await fetch(`/api/v1/security/reports/security-dashboard?days=${selectedPeriod}`);
      if (dashboardResponse.ok) {
        const dashboardData = await dashboardResponse.json();
        setDashboard(dashboardData);
      }

      // Load security incidents
      const incidentsResponse = await fetch('/api/v1/security/incidents?page=1&page_size=20');
      if (incidentsResponse.ok) {
        const incidentsData = await incidentsResponse.json();
        setIncidents(incidentsData.items || []);
      }

      // Load compliance audits
      const auditsResponse = await fetch('/api/v1/security/audits?page=1&page_size=20');
      if (auditsResponse.ok) {
        const auditsData = await auditsResponse.json();
        setAudits(auditsData.items || []);
      }

    } catch (error) {
      console.error('Error loading compliance data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComplianceData();
  }, [selectedPeriod]);

  // Handle export GDPR register
  const handleExportGDPR = async () => {
    try {
      const response = await fetch('/api/v1/security/reports/gdpr-register');
      if (response.ok) {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `gdpr-register-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Erreur lors de l\'export');
    }
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

  // Get severity icon
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'high':
        return <AlertTriangle className="w-4 h-4 text-orange-600" />;
      case 'medium':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-blue-600" />;
    }
  };

  return (
    <FeatureGate feature="compliance" permission="compliance:view" fallback={
      <EmptyState
        icon={Shield}
        title="Conformité non disponible"
        description="Vous n'avez pas les permissions nécessaires pour consulter les données de conformité."
      />
    }>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Conformité & Audit</h1>
            <p className="text-gray-600">
              Surveillez votre posture de sécurité et gérez la conformité RGPD
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 jours</SelectItem>
                <SelectItem value="30">30 jours</SelectItem>
                <SelectItem value="90">90 jours</SelectItem>
              </SelectContent>
            </Select>
            
            <Button variant="outline" onClick={loadComplianceData} disabled={loading}>
              <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
              Actualiser
            </Button>
            
            <Button variant="outline" onClick={handleExportGDPR}>
              <Download className="w-4 h-4 mr-2" />
              Export RGPD
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard">Tableau de bord</TabsTrigger>
            <TabsTrigger value="incidents">Incidents</TabsTrigger>
            <TabsTrigger value="audits">Audits</TabsTrigger>
            <TabsTrigger value="gdpr">RGPD</TabsTrigger>
          </TabsList>

          {/* Security Dashboard */}
          <TabsContent value="dashboard" className="space-y-6">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <LoadingSkeleton lines={3} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : dashboard && (
              <>
                {/* Security Posture Overview */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Niveau de risque</p>
                          <Badge className={cn("mt-2", RISK_COLORS[dashboard.security_posture.risk_level])}>
                            {dashboard.security_posture.risk_level.charAt(0).toUpperCase() + dashboard.security_posture.risk_level.slice(1)}
                          </Badge>
                        </div>
                        <Shield className={cn(
                          "w-8 h-8",
                          dashboard.security_posture.risk_level === 'high' ? "text-red-600" :
                          dashboard.security_posture.risk_level === 'medium' ? "text-yellow-600" : "text-green-600"
                        )} />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Score de conformité</p>
                          <p className="text-2xl font-bold text-gray-900">{dashboard.security_posture.compliance_score}%</p>
                        </div>
                        <Target className="w-8 h-8 text-blue-600" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Incidents ouverts</p>
                          <p className="text-2xl font-bold text-red-600">{dashboard.security_posture.incidents_summary.open_incidents}</p>
                        </div>
                        <AlertTriangle className="w-8 h-8 text-red-600" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Incidents critiques</p>
                          <p className="text-2xl font-bold text-red-600">{dashboard.security_posture.incidents_summary.critical_incidents}</p>
                        </div>
                        <XCircle className="w-8 h-8 text-red-600" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Additional Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Total incidents</p>
                          <p className="text-2xl font-bold text-gray-900">{dashboard.security_posture.incidents_summary.total_incidents}</p>
                        </div>
                        <Activity className="w-8 h-8 text-blue-600" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Incidents DCP</p>
                          <p className="text-2xl font-bold text-purple-600">{dashboard.security_posture.pii_incidents}</p>
                        </div>
                        <Database className="w-8 h-8 text-purple-600" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Temps de résolution moyen</p>
                          <p className="text-2xl font-bold text-gray-900">{dashboard.security_posture.incidents_summary.avg_resolution_hours}h</p>
                        </div>
                        <Clock className="w-8 h-8 text-green-600" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Recommendations */}
                <Card>
                  <CardHeader>
                    <CardTitle>Recommandations de sécurité</CardTitle>
                    <CardDescription>
                      Actions recommandées pour améliorer votre posture de sécurité
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {dashboard.recommendations.length > 0 ? (
                      <div className="space-y-4">
                        {dashboard.recommendations.map((rec, index) => (
                          <div key={index} className={cn(
                            "p-4 rounded-lg border",
                            rec.priority === 'critical' ? 'border-red-200 bg-red-50' :
                            rec.priority === 'high' ? 'border-orange-200 bg-orange-50' :
                            rec.priority === 'medium' ? 'border-yellow-200 bg-yellow-50' :
                            'border-blue-200 bg-blue-50'
                          )}>
                            <div className="flex items-start gap-3">
                              <div className={cn(
                                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                                rec.priority === 'critical' ? 'bg-red-600 text-white' :
                                rec.priority === 'high' ? 'bg-orange-600 text-white' :
                                rec.priority === 'medium' ? 'bg-yellow-600 text-white' :
                                'bg-blue-600 text-white'
                              )}>
                                {rec.priority === 'critical' ? '!' :
                                 rec.priority === 'high' ? 'H' :
                                 rec.priority === 'medium' ? 'M' : 'L'}
                              </div>
                              <div className="flex-1">
                                <h4 className="font-semibold text-gray-900">{rec.title}</h4>
                                <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
                                <Badge variant="outline" className="mt-2 text-xs">
                                  {rec.category.replace('_', ' ')}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        icon={CheckCircle}
                        title="Aucune recommandation"
                        description="Votre posture de sécurité est bonne. Continuez le monitoring régulier."
                      />
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Security Incidents */}
          <TabsContent value="incidents" className="space-y-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <Input placeholder="Rechercher des incidents..." className="w-64" />
                <Select>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Sévérité" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes</SelectItem>
                    <SelectItem value="critical">Critique</SelectItem>
                    <SelectItem value="high">Élevée</SelectItem>
                    <SelectItem value="medium">Moyenne</SelectItem>
                    <SelectItem value="low">Faible</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => setIncidentDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Nouveau incident
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Incidents de sécurité</CardTitle>
                <CardDescription>
                  Suivi et gestion des incidents de sécurité
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <LoadingSkeleton key={i} lines={2} />
                    ))}
                  </div>
                ) : incidents.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Incident</TableHead>
                        <TableHead>Sévérité</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Impact</TableHead>
                        <TableHead>Détecté le</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {incidents.map((incident) => (
                        <TableRow key={incident.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium text-gray-900">{incident.title}</div>
                              <div className="text-sm text-gray-500">{incident.category}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={SEVERITY_COLORS[incident.severity]}>
                              <div className="flex items-center gap-1">
                                {getSeverityIcon(incident.severity)}
                                {incident.severity.charAt(0).toUpperCase() + incident.severity.slice(1)}
                              </div>
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={STATUS_COLORS[incident.status]}>
                              {incident.status === 'open' ? 'Ouvert' :
                               incident.status === 'investigating' ? 'Investigation' :
                               incident.status === 'resolved' ? 'Résolu' : 'Fermé'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{incident.affected_users} utilisateurs</div>
                              <div className="text-gray-500">{incident.affected_documents} documents</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {formatDate(incident.detected_at)}
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
                                  <Eye className="mr-2 h-4 w-4" />
                                  Voir les détails
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  Modifier le statut
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem>
                                  Assigner à
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
                    icon={Shield}
                    title="Aucun incident"
                    description="Aucun incident de sécurité n'a été signalé."
                    action={{
                      label: "Signaler un incident",
                      onClick: () => setIncidentDialogOpen(true)
                    }}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Compliance Audits */}
          <TabsContent value="audits" className="space-y-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <Input placeholder="Rechercher des audits..." className="w-64" />
                <Select>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Framework" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="gdpr">RGPD</SelectItem>
                    <SelectItem value="iso27001">ISO 27001</SelectItem>
                    <SelectItem value="nist">NIST</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => setAuditDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Nouvel audit
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Audits de conformité</CardTitle>
                <CardDescription>
                  Planification et suivi des audits de conformité
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <LoadingSkeleton key={i} lines={2} />
                    ))}
                  </div>
                ) : audits.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Audit</TableHead>
                        <TableHead>Framework</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Dates</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {audits.map((audit) => (
                        <TableRow key={audit.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium text-gray-900">{audit.title}</div>
                              <div className="text-sm text-gray-500">{audit.audit_type}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {audit.framework.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={STATUS_COLORS[audit.status]}>
                              {audit.status === 'planned' ? 'Planifié' :
                               audit.status === 'in_progress' ? 'En cours' :
                               audit.status === 'completed' ? 'Terminé' : 'Échoué'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {audit.score ? (
                              <div className="flex items-center gap-2">
                                <div className={cn(
                                  "w-12 h-2 rounded-full",
                                  audit.score >= 80 ? "bg-green-200" :
                                  audit.score >= 60 ? "bg-yellow-200" : "bg-red-200"
                                )}>
                                  <div 
                                    className={cn(
                                      "h-2 rounded-full",
                                      audit.score >= 80 ? "bg-green-600" :
                                      audit.score >= 60 ? "bg-yellow-600" : "bg-red-600"
                                    )}
                                    style={{ width: `${audit.score}%` }}
                                  />
                                </div>
                                <span className="text-sm font-medium">{audit.score}%</span>
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {audit.planned_date && (
                              <div>Prévu: {formatDate(audit.planned_date)}</div>
                            )}
                            {audit.completed_at && (
                              <div>Terminé: {formatDate(audit.completed_at)}</div>
                            )}
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
                                  <Eye className="mr-2 h-4 w-4" />
                                  Voir les détails
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  Modifier
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem>
                                  <Download className="mr-2 h-4 w-4" />
                                  Télécharger le rapport
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
                    icon={Gavel}
                    title="Aucun audit"
                    description="Aucun audit de conformité n'a été planifié."
                    action={{
                      label: "Planifier un audit",
                      onClick: () => setAuditDialogOpen(true)
                    }}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* GDPR Compliance */}
          <TabsContent value="gdpr" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Conformité RGPD</CardTitle>
                <CardDescription>
                  Registre des activités de traitement et outils de conformité RGPD
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600">Activités de traitement</p>
                            <p className="text-2xl font-bold text-gray-900">-</p>
                          </div>
                          <FileText className="w-8 h-8 text-blue-600" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600">Traitements à haut risque</p>
                            <p className="text-2xl font-bold text-red-600">-</p>
                          </div>
                          <AlertTriangle className="w-8 h-8 text-red-600" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600">Tiers impliqués</p>
                            <p className="text-2xl font-bold text-gray-900">-</p>
                          </div>
                          <Users className="w-8 h-8 text-purple-600" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-3">
                      <Database className="w-8 h-8 text-blue-600" />
                      <div>
                        <h3 className="font-semibold text-blue-900">Registre des activités de traitement</h3>
                        <p className="text-sm text-blue-700">
                          Générez et exportez votre registre RGPD conforme
                        </p>
                      </div>
                    </div>
                    <Button onClick={handleExportGDPR} variant="outline" className="border-blue-300 text-blue-700">
                      <Download className="w-4 h-4 mr-2" />
                      Exporter
                    </Button>
                  </div>

                  <EmptyState
                    icon={FileText}
                    title="Module RGPD en développement"
                    description="Les fonctionnalités détaillées de gestion RGPD seront disponibles prochainement."
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create Incident Dialog */}
        <Dialog open={incidentDialogOpen} onOpenChange={setIncidentDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Signaler un incident de sécurité</DialogTitle>
              <DialogDescription>
                Créez un rapport d'incident de sécurité
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="incident-title">Titre de l'incident</Label>
                <Input id="incident-title" placeholder="Décrivez brièvement l'incident" />
              </div>
              
              <div>
                <Label htmlFor="incident-severity">Sévérité</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner la sévérité" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Faible</SelectItem>
                    <SelectItem value="medium">Moyenne</SelectItem>
                    <SelectItem value="high">Élevée</SelectItem>
                    <SelectItem value="critical">Critique</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="incident-description">Description</Label>
                <Textarea 
                  id="incident-description" 
                  placeholder="Détails de l'incident..."
                  rows={4}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIncidentDialogOpen(false)}>
                Annuler
              </Button>
              <Button>
                Signaler l'incident
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Audit Dialog */}
        <Dialog open={auditDialogOpen} onOpenChange={setAuditDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Planifier un audit</DialogTitle>
              <DialogDescription>
                Créez un nouvel audit de conformité
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="audit-title">Titre de l'audit</Label>
                <Input id="audit-title" placeholder="Audit de conformité RGPD..." />
              </div>
              
              <div>
                <Label htmlFor="audit-framework">Framework</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner le framework" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gdpr">RGPD</SelectItem>
                    <SelectItem value="iso27001">ISO 27001</SelectItem>
                    <SelectItem value="nist">NIST</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="audit-description">Description</Label>
                <Textarea 
                  id="audit-description" 
                  placeholder="Objectifs et périmètre de l'audit..."
                  rows={3}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setAuditDialogOpen(false)}>
                Annuler
              </Button>
              <Button>
                Créer l'audit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </FeatureGate>
  );
}