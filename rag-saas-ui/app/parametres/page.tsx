"use client"

import { useState } from "react"
import { LayoutShell } from "@/components/layout/layout-shell"
import { useApp } from "@/contexts/app-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { User, Bell, Shield, CreditCard, Users, Key, Save, AlertTriangle } from "lucide-react"

export default function ParametresPage() {
  const { user, profile, organization, userRole } = useApp()
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    weekly: true,
  })

  return (
    <LayoutShell>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-heading font-bold text-gray-900">Paramètres</h1>
          <p className="text-gray-600">Gérez vos préférences et la configuration de votre compte</p>
        </div>

            <Tabs defaultValue="profile" className="space-y-6">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="profile" className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Profil
                </TabsTrigger>
                <TabsTrigger value="notifications" className="flex items-center gap-2">
                  <Bell className="w-4 h-4" />
                  Notifications
                </TabsTrigger>
                <TabsTrigger value="security" className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Sécurité
                </TabsTrigger>
                <TabsTrigger value="billing" className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Facturation
                </TabsTrigger>
                <TabsTrigger value="team" className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Équipe
                </TabsTrigger>
                <TabsTrigger value="api" className="flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  API
                </TabsTrigger>
              </TabsList>

              {/* Profile Tab */}
              <TabsContent value="profile" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Informations personnelles</CardTitle>
                    <CardDescription>Mettez à jour vos informations de profil et vos préférences</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Nom complet</Label>
                      <Input id="fullName" defaultValue={profile?.name || ""} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" defaultValue={user?.email || ""} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company">Entreprise</Label>
                      <Input id="company" defaultValue={organization?.name || ""} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Rôle</Label>
                      <Input id="role" defaultValue={userRole || ""} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bio">Bio</Label>
                      <Textarea id="bio" placeholder="Parlez-nous de vous..." />
                    </div>
                    <Button>
                      <Save className="w-4 h-4 mr-2" />
                      Sauvegarder les modifications
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Préférences</CardTitle>
                    <CardDescription>Configurez vos préférences d'utilisation</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Langue</Label>
                        <p className="text-sm text-gray-500">Choisissez votre langue préférée</p>
                      </div>
                      <Select defaultValue="fr">
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fr">Français</SelectItem>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="es">Español</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Fuseau horaire</Label>
                        <p className="text-sm text-gray-500">Votre fuseau horaire local</p>
                      </div>
                      <Select defaultValue="europe/paris">
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="europe/paris">Europe/Paris</SelectItem>
                          <SelectItem value="europe/london">Europe/London</SelectItem>
                          <SelectItem value="america/new_york">America/New_York</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Notifications Tab */}
              <TabsContent value="notifications" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Préférences de notification</CardTitle>
                    <CardDescription>Choisissez comment vous souhaitez être notifié</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Notifications par email</Label>
                        <p className="text-sm text-gray-500">Recevez des notifications par email</p>
                      </div>
                      <Switch
                        checked={notifications.email}
                        onCheckedChange={(checked) => setNotifications((prev) => ({ ...prev, email: checked }))}
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Notifications push</Label>
                        <p className="text-sm text-gray-500">Recevez des notifications dans le navigateur</p>
                      </div>
                      <Switch
                        checked={notifications.push}
                        onCheckedChange={(checked) => setNotifications((prev) => ({ ...prev, push: checked }))}
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Rapport hebdomadaire</Label>
                        <p className="text-sm text-gray-500">Recevez un résumé de votre activité chaque semaine</p>
                      </div>
                      <Switch
                        checked={notifications.weekly}
                        onCheckedChange={(checked) => setNotifications((prev) => ({ ...prev, weekly: checked }))}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Security Tab */}
              <TabsContent value="security" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Sécurité du compte</CardTitle>
                    <CardDescription>Gérez la sécurité de votre compte</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">Mot de passe actuel</Label>
                      <Input id="currentPassword" type="password" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">Nouveau mot de passe</Label>
                      <Input id="newPassword" type="password" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirmer le nouveau mot de passe</Label>
                      <Input id="confirmPassword" type="password" />
                    </div>
                    <Button>Changer le mot de passe</Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Authentification à deux facteurs</CardTitle>
                    <CardDescription>Ajoutez une couche de sécurité supplémentaire à votre compte</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">2FA désactivée</p>
                        <p className="text-sm text-gray-500">Activez l'authentification à deux facteurs</p>
                      </div>
                      <Button variant="outline">Activer 2FA</Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Billing Tab */}
              <TabsContent value="billing" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Plan actuel</CardTitle>
                    <CardDescription>Gérez votre abonnement et votre facturation</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold">Plan {organization?.tier === 'pro' ? 'Pro' : organization?.tier === 'enterprise' ? 'Enterprise' : 'Starter'}</h3>
                          <Badge>Actuel</Badge>
                        </div>
                        <p className="text-sm text-gray-500">29€/mois • Renouvelé le 15 février 2024</p>
                      </div>
                      <Button variant="outline">Changer de plan</Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Utilisation</CardTitle>
                    <CardDescription>Votre utilisation ce mois-ci</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Messages IA</span>
                        <span>247 / 1000</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: "24.7%" }}></div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Stockage documents</span>
                        <span>8.6 GB / 50 GB</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full" style={{ width: "17.2%" }}></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Team Tab */}
              <TabsContent value="team" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Membres de l'équipe</CardTitle>
                    <CardDescription>Gérez les membres de votre organisation</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-blue-600">
                              {profile?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{profile?.name || 'Utilisateur'}</p>
                            <p className="text-sm text-gray-500">{user?.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{userRole === 'owner' ? 'Propriétaire' : userRole}</Badge>
                        </div>
                      </div>
                      <Button className="w-full bg-transparent" variant="outline">
                        <Users className="w-4 h-4 mr-2" />
                        Inviter un membre
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* API Tab */}
              <TabsContent value="api" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Clés API</CardTitle>
                    <CardDescription>Gérez vos clés d'accès API</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">Clé de production</p>
                          <p className="text-sm text-gray-500 font-mono">sk-proj-*********************</p>
                        </div>
                        <Button variant="outline" size="sm">
                          Révoquer
                        </Button>
                      </div>
                      <Button variant="outline">
                        <Key className="w-4 h-4 mr-2" />
                        Générer une nouvelle clé
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-red-200">
                  <CardHeader>
                    <CardTitle className="text-red-600 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5" />
                      Zone de danger
                    </CardTitle>
                    <CardDescription>Actions irréversibles sur votre compte</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="destructive">Supprimer le compte</Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
    </LayoutShell>
  )
}
