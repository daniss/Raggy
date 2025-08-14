"use client"

import { useState, useEffect } from "react"
import { LayoutShell } from "@/components/layout/layout-shell"
import { MainContent } from "@/components/layout/MainContent"
import { PageHeader } from "@/components/layout/PageHeader"
import { OrgProvider } from "@/contexts/org-context"
import { PermissionProvider } from "@/contexts/permissions-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { 
  Users, 
  UserPlus, 
  Settings, 
  Trash2, 
  Send, 
  X, 
  Shield, 
  Eye, 
  Edit,
  ChevronDown,
  Clock,
  Mail,
  CheckCircle,
  XCircle,
} from "lucide-react"
import {
  TeamAPI,
  type TeamMember as Member,
  type TeamInvitation as Invitation,
  type SeatUsage,
  roleDefinitions,
} from "@/lib/api/team"
import { useApp } from "@/contexts/app-context"
import type { UserRole } from "@/lib/supabase/database.types"
import { formatRelativeTime } from "@/lib/utils/time"

function TeamContent() {
  const { organization } = useApp()
  const [members, setMembers] = useState<Member[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [seatUsage, setSeatUsage] = useState<SeatUsage | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Modal states
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [editRolesModalOpen, setEditRolesModalOpen] = useState(false)
  const [removeModalOpen, setRemoveModalOpen] = useState(false)
  const [rolesLegendOpen, setRolesLegendOpen] = useState(false)
  
  // Form states
  const [inviteEmails, setInviteEmails] = useState("")
  const [inviteRoles, setInviteRoles] = useState<UserRole[]>(['viewer'])
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [editingRoles, setEditingRoles] = useState<UserRole[]>([])

  // Load data
  useEffect(() => {
    if (!organization?.id) return

    const loadData = async () => {
      try {
        const [membersData, invitationsData, seatData] = await Promise.all([
          TeamAPI.listMembers(organization.id),
          TeamAPI.listInvitations(organization.id), 
          TeamAPI.getSeatUsage(organization.id)
        ])
        setMembers(membersData)
        setInvitations(invitationsData)
        setSeatUsage(seatData)
      } catch (error) {
        console.error('Error loading team data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [organization?.id])

  // Handle invite members
  const handleInvite = async () => {
    if (!organization?.id) return
    
    const emails = inviteEmails.split('\n').filter(email => email.trim())
    if (emails.length === 0) return
    
    try {
      await TeamAPI.inviteMembers(organization.id, emails, inviteRoles)
      setInviteEmails("")
      setInviteRoles(['viewer'])
      setInviteModalOpen(false)
      // Refresh invitations
      const newInvitations = await TeamAPI.listInvitations(organization.id)
      setInvitations(newInvitations)
    } catch (error) {
      console.error('Error inviting members:', error)
    }
  }

  // Handle edit roles
  const handleEditRoles = async () => {
    if (!selectedMember || !organization?.id) return
    
    try {
      await TeamAPI.updateMemberRoles(selectedMember.id, organization.id, editingRoles)
      setEditRolesModalOpen(false)
      setSelectedMember(null)
      // Refresh members
      const newMembers = await TeamAPI.listMembers(organization.id)
      setMembers(newMembers)
    } catch (error) {
      console.error('Error updating roles:', error)
    }
  }

  // Handle remove member
  const handleRemoveMember = async () => {
    if (!selectedMember || !organization?.id) return
    
    try {
      await TeamAPI.removeMember(selectedMember.id, organization.id)
      setRemoveModalOpen(false)
      setSelectedMember(null)
      // Refresh members
      const newMembers = await TeamAPI.listMembers(organization.id)
      setMembers(newMembers)
    } catch (error) {
      console.error('Error removing member:', error)
    }
  }

  const openEditRoles = (member: Member) => {
    setSelectedMember(member)
    setEditingRoles([...member.roles])
    setEditRolesModalOpen(true)
  }

  const openRemoveMember = (member: Member) => {
    setSelectedMember(member)
    setRemoveModalOpen(true)
  }

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'owner': return <Shield className="w-3 h-3" />
      case 'admin': return <Shield className="w-3 h-3" />
      case 'security_admin': return <Shield className="w-3 h-3" />
      case 'billing_admin': return <Shield className="w-3 h-3" />
      case 'editor': return <Edit className="w-3 h-3" />
      case 'viewer': return <Eye className="w-3 h-3" />
    }
  }

  const getRoleLabel = (role: UserRole) => {
    if (role === 'owner') return 'Propriétaire'
    return roleDefinitions.find(def => def.code === role)?.label || role
  }

  if (loading) {
    return (
      <LayoutShell>
        <MainContent>
          <PageHeader title="Équipe" subtitle="Gestion des membres et invitations" />
          <div className="text-center py-8 text-muted">Chargement...</div>
        </MainContent>
      </LayoutShell>
    )
  }

  return (
    <LayoutShell>
      <MainContent>
        <PageHeader 
          title="Équipe"
          subtitle={`${members.length} membre${members.length > 1 ? 's' : ''} • ${invitations.length} invitation${invitations.length > 1 ? 's' : ''} en attente`}
        >
          <Button onClick={() => setInviteModalOpen(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Inviter des membres
          </Button>
        </PageHeader>

        <div className="space-y-6">
          {/* Seat Usage Banner */}
          {seatUsage && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted" />
                    <span className="text-sm font-medium">Sièges utilisés</span>
                  </div>
                  <span className="text-sm text-muted">
                    {seatUsage.used} / {seatUsage.limit}
                  </span>
                </div>
                <Progress value={seatUsage.percentage} className="h-2 mb-3" />
                {seatUsage.percentage >= 80 && (
                  <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-md p-3">
                    <span className="text-sm text-orange-800">
                      Vous approchez de la limite de votre plan
                    </span>
                    <Button variant="outline" size="sm">
                      Passer à Pro
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Role Legend */}
          <Collapsible open={rolesLegendOpen} onOpenChange={setRolesLegendOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="text-sm text-muted p-0 h-auto">
                <ChevronDown className="w-4 h-4 mr-1" />
                Légende des rôles
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Card className="mt-2">
                <CardContent className="p-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    {roleDefinitions.map((role) => (
                      <div key={role.code} className="space-y-2">
                        <div className="flex items-center gap-2">
                          {getRoleIcon(role.code)}
                          <span className="font-medium text-sm">{role.label}</span>
                        </div>
                        <p className="text-xs text-muted">{role.description}</p>
                        <ul className="text-xs text-muted space-y-1">
                          {role.permissions.map((permission, idx) => (
                            <li key={idx}>• {permission}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>

          {/* Members Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Membres</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rôles</TableHead>
                    <TableHead>Dernière activité</TableHead>
                    <TableHead>MFA</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{member.name}</TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {member.roles.map((role) => (
                            <Badge key={role} variant="secondary" className="text-xs">
                              {getRoleIcon(role)}
                              {getRoleLabel(role)}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted">
                          {formatRelativeTime(member.lastActivity)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {member.mfaEnabled ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-gray-400" />
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditRoles(member)}
                          >
                            <Settings className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openRemoveMember(member)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Invitations Table */}
          {invitations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Invitations en attente</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Rôles</TableHead>
                      <TableHead>Invité par</TableHead>
                      <TableHead>Expire</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.map((invitation) => (
                      <TableRow key={invitation.id}>
                        <TableCell>{invitation.email}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {invitation.roles.map((role) => (
                              <Badge key={role} variant="outline" className="text-xs">
                                {getRoleIcon(role)}
                                {getRoleLabel(role)}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted">
                            {invitation.invitedBy}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-muted" />
                            <span className="text-sm text-muted">
                              {formatRelativeTime(invitation.expiresAt)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => TeamAPI.resendInvitation(invitation.id)}
                            >
                              <Send className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                if (!organization?.id) return
                                try {
                                  await TeamAPI.cancelInvitation(invitation.id, organization.id)
                                  const newInvitations = await TeamAPI.listInvitations(organization.id)
                                  setInvitations(newInvitations)
                                } catch (error) {
                                  console.error('Error canceling invitation:', error)
                                }
                              }}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Invite Members Modal */}
        <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Inviter des membres</DialogTitle>
              <DialogDescription>
                Entrez une adresse email par ligne. Les invitations expireront dans 7 jours.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Adresses email</label>
                <textarea
                  className="w-full mt-1 p-2 border rounded-md text-sm resize-none"
                  rows={4}
                  placeholder="alice@example.com&#10;bob@example.com"
                  value={inviteEmails}
                  onChange={(e) => setInviteEmails(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Rôles</label>
                <Select
                  value={inviteRoles[0]}
                  onValueChange={(value: UserRole) => setInviteRoles([value])}
                >
                  <SelectTrigger className="w-full mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleDefinitions.map((role) => (
                      <SelectItem key={role.code} value={role.code}>
                        <div className="flex items-center gap-2">
                          {getRoleIcon(role.code)}
                          {role.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteModalOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleInvite} disabled={!inviteEmails.trim()}>
                <Mail className="w-4 h-4 mr-2" />
                Envoyer les invitations
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Roles Modal */}
        <Dialog open={editRolesModalOpen} onOpenChange={setEditRolesModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Modifier les rôles</DialogTitle>
              <DialogDescription>
                Modifier les rôles de {selectedMember?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Rôles</label>
                <div className="mt-2 space-y-2">
                  {roleDefinitions.map((role) => (
                    <label key={role.code} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={editingRoles.includes(role.code)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditingRoles([...editingRoles, role.code])
                          } else {
                            setEditingRoles(editingRoles.filter(r => r !== role.code))
                          }
                        }}
                        className="rounded"
                      />
                      <div className="flex items-center gap-2">
                        {getRoleIcon(role.code)}
                        <span className="text-sm">{role.label}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditRolesModalOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleEditRoles} disabled={editingRoles.length === 0}>
                Sauvegarder
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Remove Member Modal */}
        <Dialog open={removeModalOpen} onOpenChange={setRemoveModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Retirer le membre</DialogTitle>
              <DialogDescription>
                Êtes-vous sûr de vouloir retirer {selectedMember?.name} de l'équipe ? 
                Cette action ne peut pas être annulée.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRemoveModalOpen(false)}>
                Annuler
              </Button>
              <Button variant="destructive" onClick={handleRemoveMember}>
                Retirer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </MainContent>
    </LayoutShell>
  )
}

export default function TeamPage() {
  return <TeamContent />
}