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
import { useToast } from "@/hooks/use-toast"
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
  const { toast } = useToast()

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

  // Supported file types
  const SUPPORTED_FILE_TYPES = {
    'application/pdf': '.pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx', 
    'text/plain': '.txt',
    'text/markdown': '.md',
    'text/html': '.html',
    'text/csv': '.csv',
    'application/json': '.json',
    'text/javascript': '.js',
    'text/python': '.py'
  }

  const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

  // Enhanced file validation
  const validateFile = (file: File): { valid: boolean; error?: string } => {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return { 
        valid: false, 
        error: `Le fichier est trop volumineux. Taille maximale: 50MB (actuel: ${(file.size / 1024 / 1024).toFixed(1)}MB)` 
      }
    }

    // Check file type
    if (!SUPPORTED_FILE_TYPES[file.type as keyof typeof SUPPORTED_FILE_TYPES] && 
        !Object.values(SUPPORTED_FILE_TYPES).some(ext => file.name.toLowerCase().endsWith(ext))) {
      return { 
        valid: false, 
        error: `Type de fichier non supporté. Types acceptés: ${Object.values(SUPPORTED_FILE_TYPES).join(', ')}` 
      }
    }

    return { valid: true }
  }

  // File upload handler with enhanced validation and progress
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !organization?.id) return

    // Validate file
    const validation = validateFile(file)
    if (!validation.valid) {
      alert(validation.error)
      return
    }

    try {
      setUploading(true)
      
      // Initialize upload
      const uploadInit = await DocumentsAPI.initializeUpload(
        organization.id,
        file.name,
        file.type,
        file.size
      )

      // Upload file to Supabase Storage with progress tracking
      await DocumentsAPI.uploadFile(uploadInit.uploadUrl, file)

      // Finalize upload
      await DocumentsAPI.finalizeUpload(organization.id, uploadInit.documentId)

      // Refresh documents list
      const docs = await DocumentsAPI.getDocuments(organization.id, statusFilter, searchQuery)
      setDocuments(docs)
      
      // Notify user about successful upload and indexation process
      toast({
        title: "Document téléchargé avec succès",
        description: `${file.name} a été téléchargé et est en cours d'indexation pour être disponible dans l'assistant IA.`,
      })
      
    } catch (error) {
      console.error('Upload failed:', error)
      toast({
        title: "Erreur lors du téléchargement",
        description: "Une erreur s'est produite lors du téléchargement du document.",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    
    if (files.length > 0) {
      const file = files[0]
      
      // Validate file
      const validation = validateFile(file)
      if (!validation.valid) {
        alert(validation.error)
        return
      }

      // Create a fake event to reuse the upload handler
      const fakeEvent = {
        target: { files: [file] }
      } as unknown as React.ChangeEvent<HTMLInputElement>
      
      handleFileUpload(fakeEvent)
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
        />

        {/* Document Upload Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors mb-6 ${uploading ? 'border-blue-300 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
            }`}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileUpload}
            accept=".pdf,.docx,.txt,.md,.html,.csv,.json,.js,.py"
            className="hidden"
          />
          
          {uploading ? (
            <div className="flex flex-col items-center space-y-2">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <p className="text-sm text-gray-600">Téléchargement en cours...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-4">
              <Upload className="w-12 h-12 text-gray-400" />
              <div>
                <p className="text-lg font-medium text-gray-900">
                  Glissez-déposez vos documents ici
                </p>
                <p className="text-sm text-gray-500">
                  ou{' '}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-blue-600 hover:text-blue-500 underline"
                  >
                    cliquez pour sélectionner
                  </button>
                </p>
              </div>
              <div className="text-xs text-gray-400 space-y-1">
                <p>Types supportés: PDF, DOCX, TXT, MD, HTML, CSV, JSON, JS, PY</p>
                <p>Taille maximum: 50MB</p>
              </div>
            </div>
          )}
        </div>

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
