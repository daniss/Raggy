'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  UserPlus,
  Crown,
  Shield,
  Eye,
  CreditCard,
  AlertTriangle,
  MoreHorizontal,
  Search,
  Filter,
  Mail,
  Clock,
  Check,
  X,
  Edit,
  Trash2,
  Key,
  Settings,
  RefreshCw,
  FileText,
  ChevronDown,
  Calendar,
  UserCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useOrganization } from '@/contexts/OrganizationContext';
import { FeatureGate, UsageLimitWarning, EmptyState, LoadingSkeleton } from '@/components/FeatureGate';
import { cn } from '@/lib/utils';

// Types
interface TeamMember {
  id: string;
  user_id: string;
  email: string;
  name?: string;
  roles: string[];
  role_display: string;
  status: 'active' | 'invited' | 'suspended';
  invited_at: string;
  joined_at?: string;
  last_active?: string;
  invited_by?: string;
  is_admin: boolean;
}

interface TeamSummary {
  total_members: number;
  active_members: number;
  pending_invitations: number;
  seat_limit: number;
  seat_usage_percentage: number;
  roles_breakdown: Record<string, number>;
}

interface InviteMemberForm {
  email: string;
  roles: string[];
  send_email: boolean;
  custom_message: string;
}

const ROLE_OPTIONS = [
  { value: 'user', label: 'Utilisateur', description: 'Peut consulter et utiliser l\'assistant', icon: Users },
  { value: 'knowledge_manager', label: 'Gestionnaire de contenu', description: 'Peut gérer les documents et l\'entraînement', icon: FileText },
  { value: 'admin', label: 'Administrateur', description: 'Peut gérer l\'équipe et les paramètres', icon: Shield },
  { value: 'security_admin', label: 'Admin sécurité', description: 'Peut gérer les audits et la conformité', icon: AlertTriangle },
  { value: 'billing_admin', label: 'Admin facturation', description: 'Peut gérer la facturation et les abonnements', icon: CreditCard },
  { value: 'observer', label: 'Observateur', description: 'Peut uniquement consulter les données', icon: Eye },
];

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-800 border-green-200',
  invited: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  suspended: 'bg-red-100 text-red-800 border-red-200',
};

const STATUS_LABELS = {
  active: 'Actif',
  invited: 'Invité',
  suspended: 'Suspendu',
};

export default function TeamPage() {
  const { organization, hasPermission, getUsageStatus } = useOrganization();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [summary, setSummary] = useState<TeamSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [inviteForm, setInviteForm] = useState<InviteMemberForm>({
    email: '',
    roles: ['user'],
    send_email: true,
    custom_message: ''
  });

  const usageStatus = getUsageStatus();

  // Load team data
  const loadTeamData = async () => {
    try {
      setLoading(true);
      
      // Load summary
      const summaryResponse = await fetch('/api/v1/team/summary');
      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        setSummary(summaryData);
      }

      // Load members
      const membersResponse = await fetch('/api/v1/team/members');
      if (membersResponse.ok) {
        const membersData = await membersResponse.json();
        setMembers(membersData);
      }
    } catch (error) {
      console.error('Error loading team data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeamData();
  }, []);

  // Handle member invitation
  const handleInviteMember = async () => {
    try {
      const response = await fetch('/api/v1/team/members/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(inviteForm),
      });

      if (response.ok) {
        setInviteDialogOpen(false);
        setInviteForm({
          email: '',
          roles: ['user'],
          send_email: true,
          custom_message: ''
        });
        await loadTeamData();
      } else {
        const error = await response.json();
        alert(error.detail || 'Erreur lors de l\'invitation');
      }
    } catch (error) {
      console.error('Error inviting member:', error);
      alert('Erreur lors de l\'invitation');
    }
  };

  // Handle member update
  const handleUpdateMember = async (memberId: string, updates: any) => {
    try {
      const response = await fetch(`/api/v1/team/members/${memberId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        await loadTeamData();
      } else {
        const error = await response.json();
        alert(error.detail || 'Erreur lors de la mise à jour');
      }
    } catch (error) {
      console.error('Error updating member:', error);
      alert('Erreur lors de la mise à jour');
    }
  };

  // Handle member removal
  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce membre ?')) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/team/members/${memberId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadTeamData();
      } else {
        const error = await response.json();
        alert(error.detail || 'Erreur lors de la suppression');
      }
    } catch (error) {
      console.error('Error removing member:', error);
      alert('Erreur lors de la suppression');
    }
  };

  // Filter members
  const filteredMembers = members.filter(member => {
    const matchesSearch = !searchTerm || 
      member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (member.name && member.name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = !statusFilter || member.status === statusFilter;
    const matchesRole = !roleFilter || member.roles.includes(roleFilter);
    
    return matchesSearch && matchesStatus && matchesRole;
  });

  // Get role icon
  const getRoleIcon = (roles: string[]) => {
    if (roles.includes('owner')) return <Crown className="w-4 h-4 text-yellow-600" />;
    if (roles.includes('admin')) return <Shield className="w-4 h-4 text-blue-600" />;
    if (roles.includes('knowledge_manager')) return <FileText className="w-4 h-4 text-green-600" />;
    if (roles.includes('billing_admin')) return <CreditCard className="w-4 h-4 text-purple-600" />;
    if (roles.includes('security_admin')) return <AlertTriangle className="w-4 h-4 text-red-600" />;
    if (roles.includes('observer')) return <Eye className="w-4 h-4 text-gray-600" />;
    return <Users className="w-4 h-4 text-gray-400" />;
  };

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 24) {
      return `Il y a ${diffInHours}h`;
    } else if (diffInHours < 24 * 7) {
      return `Il y a ${Math.floor(diffInHours / 24)}j`;
    } else {
      return date.toLocaleDateString('fr-FR');
    }
  };

  return (
    <FeatureGate feature="team" permission="team:manage" fallback={
      <EmptyState
        icon={Users}
        title="Équipe non disponible"
        description="Vous n'avez pas les permissions nécessaires pour gérer l'équipe."
      />
    }>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Équipe & Rôles</h1>
            <p className="text-gray-600">
              Gérez les membres de votre organisation et leurs permissions
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={loadTeamData} disabled={loading}>
              <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
              Actualiser
            </Button>
            
            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Inviter un membre
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Inviter un nouveau membre</DialogTitle>
                  <DialogDescription>
                    Ajoutez un nouveau membre à votre organisation
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="email">Adresse email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm({...inviteForm, email: e.target.value})}
                      placeholder="nom@exemple.com"
                    />
                  </div>
                  
                  <div>
                    <Label>Rôles</Label>
                    <div className="space-y-2 mt-2">
                      {ROLE_OPTIONS.map(role => (
                        <div key={role.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={role.value}
                            checked={inviteForm.roles.includes(role.value)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setInviteForm({
                                  ...inviteForm,
                                  roles: [...inviteForm.roles, role.value]
                                });
                              } else {
                                setInviteForm({
                                  ...inviteForm,
                                  roles: inviteForm.roles.filter(r => r !== role.value)
                                });
                              }
                            }}
                          />
                          <Label htmlFor={role.value} className="text-sm">
                            {role.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="send_email"
                      checked={inviteForm.send_email}
                      onCheckedChange={(checked) => 
                        setInviteForm({...inviteForm, send_email: !!checked})
                      }
                    />
                    <Label htmlFor="send_email" className="text-sm">
                      Envoyer un email d'invitation
                    </Label>
                  </div>
                  
                  <div>
                    <Label htmlFor="message">Message personnalisé (optionnel)</Label>
                    <Textarea
                      id="message"
                      value={inviteForm.custom_message}
                      onChange={(e) => setInviteForm({...inviteForm, custom_message: e.target.value})}
                      placeholder="Message de bienvenue..."
                      rows={3}
                    />
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button onClick={handleInviteMember} disabled={!inviteForm.email}>
                    Envoyer l'invitation
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Usage Warning */}
        {usageStatus.users.percentage >= 80 && (
          <UsageLimitWarning
            currentUsage={usageStatus.users.current}
            limit={usageStatus.users.max}
            type="users"
          />
        )}

        {/* Team Summary */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <LoadingSkeleton lines={2} />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Membres totaux</p>
                    <p className="text-2xl font-bold text-gray-900">{summary.total_members}</p>
                  </div>
                  <Users className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Membres actifs</p>
                    <p className="text-2xl font-bold text-green-600">{summary.active_members}</p>
                  </div>
                  <UserCheck className="w-8 h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Invitations en attente</p>
                    <p className="text-2xl font-bold text-yellow-600">{summary.pending_invitations}</p>
                  </div>
                  <Clock className="w-8 h-8 text-yellow-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Utilisation des sièges</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {summary.active_members}/{summary.seat_limit}
                    </p>
                    <p className="text-xs text-gray-500">
                      {Math.round(summary.seat_usage_percentage)}% utilisé
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-full border-4 border-gray-200 flex items-center justify-center relative">
                    <div 
                      className="absolute inset-0 rounded-full border-4 border-blue-600"
                      style={{
                        clipPath: `polygon(0 0, ${summary.seat_usage_percentage}% 0, ${summary.seat_usage_percentage}% 100%, 0 100%)`
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Rechercher par nom ou email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tous les statuts</SelectItem>
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="invited">Invité</SelectItem>
                  <SelectItem value="suspended">Suspendu</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Rôle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tous les rôles</SelectItem>
                  {ROLE_OPTIONS.map(role => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Members Table */}
        <Card>
          <CardHeader>
            <CardTitle>Membres de l'équipe</CardTitle>
            <CardDescription>
              Gérez les rôles et permissions de vos membres
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <LoadingSkeleton key={i} lines={1} />
                ))}
              </div>
            ) : filteredMembers.length === 0 ? (
              <EmptyState
                icon={Users}
                title={searchTerm || statusFilter || roleFilter ? "Aucun résultat" : "Aucun membre"}
                description={
                  searchTerm || statusFilter || roleFilter 
                    ? "Aucun membre ne correspond aux critères de recherche."
                    : "Commencez par inviter des membres à votre organisation."
                }
                action={!searchTerm && !statusFilter && !roleFilter ? {
                  label: "Inviter un membre",
                  onClick: () => setInviteDialogOpen(true)
                } : undefined}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Membre</TableHead>
                    <TableHead>Rôles</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Dernière activité</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-medium text-sm">
                              {(member.name || member.email).charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">
                              {member.name || member.email.split('@')[0]}
                            </div>
                            <div className="text-sm text-gray-500">{member.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getRoleIcon(member.roles)}
                          <span className="text-sm font-medium">{member.role_display}</span>
                          {member.roles.length > 1 && (
                            <Badge variant="secondary" className="text-xs">
                              +{member.roles.length - 1}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <Badge variant="outline" className={STATUS_COLORS[member.status]}>
                          {STATUS_LABELS[member.status]}
                        </Badge>
                      </TableCell>
                      
                      <TableCell className="text-sm text-gray-500">
                        {member.status === 'invited' 
                          ? `Invité ${formatRelativeTime(member.invited_at)}`
                          : member.last_active 
                            ? formatRelativeTime(member.last_active)
                            : 'Jamais connecté'
                        }
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
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedMember(member);
                                setEditDialogOpen(true);
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Modifier les rôles
                            </DropdownMenuItem>
                            {member.status === 'active' && (
                              <DropdownMenuItem
                                onClick={() => handleUpdateMember(member.id, { status: 'suspended' })}
                              >
                                <X className="mr-2 h-4 w-4" />
                                Suspendre
                              </DropdownMenuItem>
                            )}
                            {member.status === 'suspended' && (
                              <DropdownMenuItem
                                onClick={() => handleUpdateMember(member.id, { status: 'active' })}
                              >
                                <Check className="mr-2 h-4 w-4" />
                                Réactiver
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleRemoveMember(member.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Edit Member Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Modifier les rôles</DialogTitle>
              <DialogDescription>
                Gérez les rôles et permissions de {selectedMember?.name || selectedMember?.email}
              </DialogDescription>
            </DialogHeader>
            
            {selectedMember && (
              <div className="space-y-4">
                <div>
                  <Label>Rôles</Label>
                  <div className="space-y-2 mt-2">
                    {ROLE_OPTIONS.map(role => (
                      <div key={role.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-${role.value}`}
                          checked={selectedMember.roles.includes(role.value)}
                          onCheckedChange={(checked) => {
                            const updatedRoles = checked
                              ? [...selectedMember.roles, role.value]
                              : selectedMember.roles.filter(r => r !== role.value);
                            
                            setSelectedMember({
                              ...selectedMember,
                              roles: updatedRoles
                            });
                          }}
                        />
                        <Label htmlFor={`edit-${role.value}`} className="text-sm">
                          <div>
                            <div className="font-medium">{role.label}</div>
                            <div className="text-xs text-gray-500">{role.description}</div>
                          </div>
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Annuler
              </Button>
              <Button 
                onClick={() => {
                  if (selectedMember) {
                    handleUpdateMember(selectedMember.id, { roles: selectedMember.roles });
                    setEditDialogOpen(false);
                  }
                }}
              >
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </FeatureGate>
  );
}