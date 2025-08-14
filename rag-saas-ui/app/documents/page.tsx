"use client"

import { useState, useEffect, useRef } from "react"
import { LayoutShell } from "@/components/layout/layout-shell"
import { MainContent } from "@/components/layout/MainContent"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { SummaryBar } from "@/components/ui/SummaryBar"
import { UpgradeBanner } from "@/components/ui/upgrade-banner"
import { useLimits, shouldShowUpgradeBanner } from "@/lib/hooks/use-limits"
import { DocumentsAPI, type Document } from "@/lib/api/documents"
import { useApp } from "@/contexts/app-context"
import { Upload, Search, Filter, MoreVertical, FileText, ImageIcon, File, Download, Trash2, Eye, Loader2 } from "lucide-react"

function DocumentsContent() {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const limits = useLimits()
  const { organization } = useApp()

  // Load documents
  useEffect(() => {
    const loadDocuments = async () => {
      if (!organization?.id) return
      
      try {
        setLoading(true)
        const docs = await DocumentsAPI.getDocuments(organization.id, statusFilter, searchQuery)
        setDocuments(docs)
      } catch (error) {
        console.error('Failed to load documents:', error)
      } finally {
        setLoading(false)
      }
    }

    loadDocuments()
  }, [organization?.id, statusFilter, searchQuery])

  // File upload handler
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !organization?.id) return

    try {
      setUploading(true)
      
      // Initialize upload
      const uploadInit = await DocumentsAPI.initializeUpload(
        organization.id,
        file.name,
        file.type,
        file.size
      )

      // Upload file to Supabase Storage
      await DocumentsAPI.uploadFile(uploadInit.uploadUrl, file)

      // Finalize upload
      await DocumentsAPI.finalizeUpload(organization.id, uploadInit.documentId)

      // Refresh documents list
      const docs = await DocumentsAPI.getDocuments(organization.id, statusFilter, searchQuery)
      setDocuments(docs)
      
    } catch (error) {
      console.error('Upload failed:', error)
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Delete document
  const handleDeleteDocument = async (documentId: string) => {
    if (!organization?.id) return
    
    try {
      await DocumentsAPI.deleteDocument(documentId, organization.id)
      
      // Refresh documents list
      const docs = await DocumentsAPI.getDocuments(organization.id, statusFilter, searchQuery)
      setDocuments(docs)
    } catch (error) {
      console.error('Delete failed:', error)
    }
  }

  // Download document
  const handleDownloadDocument = async (filePath: string, fileName: string) => {
    if (!filePath) return
    
    try {
      const downloadUrl = await DocumentsAPI.downloadDocument(filePath)
      
      // Trigger download
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Download failed:', error)
    }
  }

  const getFileIcon = (type: string) => {
    switch (type) {
      case "PDF":
        return <FileText className="w-5 h-5 text-red-500" />
      case "DOCX":
        return <FileText className="w-5 h-5 text-blue-500" />
      case "PPTX":
        return <ImageIcon className="w-5 h-5 text-orange-500" />
      default:
        return <File className="w-5 h-5 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      Prêt: "default",
      "En cours": "secondary",
      Erreur: "destructive",
    } as const

    return <Badge variant={variants[status as keyof typeof variants] || "outline"}>{status}</Badge>
  }

  // Client-side filtering is handled by API, but we need the counts
  const filteredDocuments = documents

  const statusCounts = {
    all: documents.length,
    ready: documents.filter(d => d.status === "Prêt").length,
    processing: documents.filter(d => d.status === "En cours").length,
    error: documents.filter(d => d.status === "Erreur").length,
  }

  const statusOptions = [
    { value: "all", label: "Tous", count: statusCounts.all },
    { value: "ready", label: "Prêts", count: statusCounts.ready },
    { value: "processing", label: "En cours", count: statusCounts.processing },
    { value: "error", label: "Erreurs", count: statusCounts.error },
  ]

  const showUpgrade = shouldShowUpgradeBanner(limits)

  const summaryItems = [
    { label: "Documents prêts", value: statusCounts.ready },
    ...(statusCounts.processing > 0 ? [{ label: "En cours", value: statusCounts.processing, tone: "warning" as const }] : []),
    { label: "Stockage", value: `${(limits.storageBytes / (1024 * 1024 * 1024)).toFixed(1)} GB` }
  ]

  return (
    <LayoutShell>
      <MainContent>
        <PageHeader 
          title="Documents"
          subtitle="Gérez et organisez vos documents pour l'IA"
        >
          <div>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileUpload}
              accept=".pdf,.doc,.docx,.txt,.md"
              className="hidden"
            />
            <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Téléchargement...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Télécharger un document
                </>
              )}
            </Button>
          </div>
        </PageHeader>

        {/* Upgrade Banner */}
        {showUpgrade && (
          <UpgradeBanner
            type="docs"
            current={limits.docsUsed}
            limit={limits.docsLimit}
            className="mb-4"
          />
        )}

        {/* Summary Bar */}
        <SummaryBar 
          items={summaryItems}
          lastUpdated="il y a 2 minutes"
          className="mb-4"
        />

        {/* Search and Filters Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-4 mt-2">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted" />
            <Input
              placeholder="Rechercher dans vos documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <SegmentedControl
            options={statusOptions}
            value={statusFilter}
            onValueChange={setStatusFilter}
          />
        </div>

        {/* Documents List */}
        <Card>
          <CardHeader>
            <CardTitle>Vos documents</CardTitle>
            <CardDescription>
              {filteredDocuments.length} document{filteredDocuments.length !== 1 ? 's' : ''} 
              {statusFilter !== 'all' ? ` • Filtrés par: ${statusOptions.find(o => o.value === statusFilter)?.label}` : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                {filteredDocuments.length === 0 ? (
                  <div className="text-center py-8 text-muted">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Aucun document trouvé</p>
                    {searchQuery && (
                      <p className="text-sm">Essayez de modifier votre recherche</p>
                    )}
                  </div>
                ) : (
                  filteredDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {getFileIcon(doc.type)}
                          <div>
                            <h4 className="font-medium text-gray-900">{doc.name}</h4>
                            <p className="text-[11px] text-muted">
                              {doc.size} • Téléchargé le {new Date(doc.uploadedAt).toLocaleDateString('fr-FR')} par {doc.uploadedBy}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex gap-1">
                            {doc.tags.map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                          {getStatusBadge(doc.status)}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem disabled={!doc.filePath}>
                                <Eye className="w-4 h-4 mr-2" />
                                Aperçu
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                disabled={!doc.filePath}
                                onClick={() => handleDownloadDocument(doc.filePath!, doc.name)}
                              >
                                <Download className="w-4 h-4 mr-2" />
                                Télécharger
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-red-600"
                                onClick={() => handleDeleteDocument(doc.id)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </MainContent>
    </LayoutShell>
  )
}

export default function DocumentsPage() {
  return <DocumentsContent />
}
