'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Download, 
  Share, 
  FileText, 
  Mail,
  Copy,
  Check,
  X,
  Calendar,
  Building,
  User,
  Clock,
  Shield,
  Sparkles,
  BarChart3,
  FileX,
  Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { type Source } from '@/utils/api';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: Source[];
  responseTime?: number;
}

interface DemoSession {
  token: string;
  email: string;
  company: string;
  expiresAt: number;
}

interface ConversationExporterProps {
  messages: Message[];
  demoSession: DemoSession | null;
  allSources: Source[];
  className?: string;
}

export default function ConversationExporter({ 
  messages, 
  demoSession, 
  allSources,
  className 
}: ConversationExporterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'markdown' | 'html' | 'pdf'>('markdown');
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [includeSources, setIncludeSources] = useState(true);
  const [shareEmail, setShareEmail] = useState('');
  const [shareNote, setShareNote] = useState('');
  const [copied, setCopied] = useState(false);
  const [exportedContent, setExportedContent] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);

  const generateMarkdownReport = () => {
    let markdown = '';
    
    if (includeMetadata && demoSession) {
      markdown += `# Rapport de Démonstration RAG - ${demoSession.company}\n\n`;
      markdown += `**Entreprise:** ${demoSession.company}  \n`;
      markdown += `**Email:** ${demoSession.email}  \n`;
      markdown += `**Date:** ${new Date().toLocaleDateString('fr-FR')}  \n`;
      markdown += `**Durée de la session:** ${Math.round((Date.now() - (demoSession.expiresAt - 24 * 60 * 60 * 1000)) / (1000 * 60))} minutes  \n\n`;
      
      markdown += `## Statistiques de la Démonstration\n\n`;
      markdown += `- **Questions posées:** ${messages.filter(m => m.type === 'user').length}\n`;
      markdown += `- **Réponses générées:** ${messages.filter(m => m.type === 'assistant').length}\n`;
      markdown += `- **Sources consultées:** ${allSources.length}\n`;
      markdown += `- **Documents analysés:** ${new Set(allSources.map(s => s.metadata?.filename)).size}\n\n`;
      
      const avgResponseTime = messages
        .filter(m => m.type === 'assistant' && m.responseTime)
        .reduce((acc, m) => acc + (m.responseTime || 0), 0) / 
        messages.filter(m => m.type === 'assistant' && m.responseTime).length;
      
      if (avgResponseTime) {
        markdown += `- **Temps de réponse moyen:** ${avgResponseTime.toFixed(2)}s\n\n`;
      }
      
      markdown += `---\n\n`;
    }
    
    markdown += `## Conversation\n\n`;
    
    messages.forEach((message, index) => {
      if (message.type === 'user') {
        markdown += `### 🙋 Question ${Math.ceil((index + 1) / 2)}\n\n`;
        markdown += `**${message.timestamp.toLocaleTimeString('fr-FR')}** - ${message.content}\n\n`;
      } else {
        markdown += `### 🤖 Réponse de l'Assistant IA\n\n`;
        markdown += `**${message.timestamp.toLocaleTimeString('fr-FR')}**`;
        if (message.responseTime) {
          markdown += ` *(${message.responseTime.toFixed(2)}s)*`;
        }
        markdown += `\n\n`;
        markdown += `${message.content}\n\n`;
        
        if (includeSources && message.sources && message.sources.length > 0) {
          markdown += `#### 📚 Sources référencées:\n\n`;
          message.sources.forEach((source, idx) => {
            markdown += `**[${idx + 1}]** ${source.metadata?.filename || 'Document inconnu'}`;
            if (source.metadata?.page) {
              markdown += ` (page ${source.metadata.page})`;
            }
            if (source.score) {
              markdown += ` - Pertinence: ${Math.round(source.score * 100)}%`;
            }
            markdown += `\n\n> ${source.content}\n\n`;
          });
        }
        
        markdown += `---\n\n`;
      }
    });
    
    if (includeSources && allSources.length > 0) {
      markdown += `## 📖 Bibliographie Complète\n\n`;
      const uniqueFiles = new Set<string>();
      allSources.forEach((source, index) => {
        const filename = source.metadata?.filename || 'Document inconnu';
        if (!uniqueFiles.has(filename)) {
          uniqueFiles.add(filename);
          markdown += `- **${filename}**`;
          if (source.metadata?.page) {
            markdown += ` (consultée page ${source.metadata.page})`;
          }
          markdown += `\n`;
        }
      });
    }
    
    markdown += `\n## 🔒 Conformité et Sécurité\n\n`;
    markdown += `- Données traitées selon le RGPD\n`;
    markdown += `- Session temporaire de 24h (auto-suppression)\n`;
    markdown += `- Aucune donnée personnelle stockée\n`;
    markdown += `- Chiffrement des échanges\n\n`;
    
    markdown += `---\n\n`;
    markdown += `*Rapport généré automatiquement par **Raggy AI** - Solution RAG pour entreprises françaises*  \n`;
    markdown += `*Pour une version complète avec fonctionnalités avancées, contactez-nous : contact@raggy.fr*\n`;
    
    return markdown;
  };

  const generateHTMLReport = () => {
    const markdown = generateMarkdownReport();
    // Simple markdown to HTML conversion for demo
    return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rapport Démo RAG - ${demoSession?.company || 'Entreprise'}</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
        h1, h2, h3 { color: #2d3748; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
        .metadata { background: #f7fafc; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .conversation { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin: 10px 0; }
        .user-message { background: #ebf8ff; border-left: 4px solid #3182ce; }
        .assistant-message { background: #f0fff4; border-left: 4px solid #38a169; }
        .sources { background: #faf5ff; border: 1px solid #d6bcfa; border-radius: 6px; padding: 10px; margin: 10px 0; }
        .citation { font-size: 0.9em; color: #4a5568; font-style: italic; }
        .footer { text-align: center; color: #718096; font-size: 0.9em; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
    </style>
</head>
<body>
${markdown
  .replace(/^# (.*$)/gim, '<h1>$1</h1>')
  .replace(/^## (.*$)/gim, '<h2>$1</h2>')
  .replace(/^### (.*$)/gim, '<h3>$1</h3>')
  .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  .replace(/\*(.*?)\*/g, '<em>$1</em>')
  .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
  .replace(/\n/g, '<br>')
  .replace(/---/g, '<hr>')
}
</body>
</html>
`;
  };

  const handleExport = () => {
    let content = '';
    let filename = '';
    
    switch (exportFormat) {
      case 'markdown':
        content = generateMarkdownReport();
        filename = `rapport-demo-${demoSession?.company?.replace(/\s+/g, '-').toLowerCase() || 'entreprise'}-${new Date().toISOString().split('T')[0]}.md`;
        break;
      case 'html':
        content = generateHTMLReport();
        filename = `rapport-demo-${demoSession?.company?.replace(/\s+/g, '-').toLowerCase() || 'entreprise'}-${new Date().toISOString().split('T')[0]}.html`;
        break;
      case 'pdf':
        // For PDF, we'd use a library like jsPDF or puppeteer
        // For now, export as HTML with print-friendly CSS
        content = generateHTMLReport();
        filename = `rapport-demo-${demoSession?.company?.replace(/\s+/g, '-').toLowerCase() || 'entreprise'}-${new Date().toISOString().split('T')[0]}.html`;
        break;
    }
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyContent = async () => {
    const content = generateMarkdownReport();
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareByEmail = () => {
    const subject = `Rapport de démonstration RAG - ${demoSession?.company || 'Entreprise'}`;
    const body = `Bonjour,

Veuillez trouver ci-joint le rapport de notre démonstration de la solution RAG Raggy.

${shareNote}

Statistiques de la démonstration :
- Questions posées : ${messages.filter(m => m.type === 'user').length}
- Documents analysés : ${new Set(allSources.map(s => s.metadata?.filename)).size}
- Sources consultées : ${allSources.length}

Pour accéder à la version complète avec toutes les fonctionnalités avancées, n'hésitez pas à nous contacter.

Cordialement,
L'équipe Raggy

---
Contact : contact@raggy.fr
Site web : https://raggy.fr
`;
    
    const mailtoLink = `mailto:${shareEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink);
  };

  const handlePreview = () => {
    setExportedContent(generateMarkdownReport());
    setShowPreview(true);
  };

  const conversationStats = {
    questions: messages.filter(m => m.type === 'user').length,
    responses: messages.filter(m => m.type === 'assistant').length,
    sources: allSources.length,
    documents: new Set(allSources.map(s => s.metadata?.filename)).size,
    avgResponseTime: messages
      .filter(m => m.type === 'assistant' && m.responseTime)
      .reduce((acc, m) => acc + (m.responseTime || 0), 0) / 
      messages.filter(m => m.type === 'assistant' && m.responseTime).length || 0
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className={className}>
            <Download className="w-4 h-4 mr-2" />
            Exporter la conversation
          </Button>
        </DialogTrigger>
        
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-600" />
              Exportation de la Conversation
            </DialogTitle>
            <div className="text-sm text-gray-600">
              Générez un rapport professionnel de votre session de démonstration
            </div>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Export Options */}
            <div className="lg:col-span-2 space-y-6">
              {/* Session Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Résumé de la Session
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{conversationStats.questions}</div>
                      <div className="text-sm text-blue-800">Questions</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{conversationStats.responses}</div>
                      <div className="text-sm text-green-800">Réponses</div>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">{conversationStats.sources}</div>
                      <div className="text-sm text-purple-800">Sources</div>
                    </div>
                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">{conversationStats.documents}</div>
                      <div className="text-sm text-orange-800">Documents</div>
                    </div>
                  </div>
                  
                  {conversationStats.avgResponseTime > 0 && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg text-center">
                      <div className="text-lg font-semibold text-gray-700">
                        Temps de réponse moyen : {conversationStats.avgResponseTime.toFixed(2)}s
                      </div>
                      <div className="text-sm text-gray-500">Performance IA optimisée</div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Export Format */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Format d'Export</CardTitle>
                  <CardDescription>
                    Choisissez le format de votre rapport
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { format: 'markdown', label: 'Markdown', desc: 'Format texte structuré' },
                      { format: 'html', label: 'HTML', desc: 'Page web interactive' },
                      { format: 'pdf', label: 'PDF', desc: 'Document portable (bientôt)' }
                    ].map(({ format, label, desc }) => (
                      <button
                        key={format}
                        onClick={() => setExportFormat(format as any)}
                        className={`p-3 border rounded-lg text-left transition-all ${
                          exportFormat === format 
                            ? 'border-purple-400 bg-purple-50 text-purple-700' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="font-medium">{label}</div>
                        <div className="text-xs text-gray-500 mt-1">{desc}</div>
                      </button>
                    ))}
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Options d'inclusion</Label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          checked={includeMetadata}
                          onChange={(e) => setIncludeMetadata(e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm">Inclure les métadonnées de session</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          checked={includeSources}
                          onChange={(e) => setIncludeSources(e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm">Inclure les sources et citations</span>
                      </label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Actions Panel */}
            <div className="space-y-4">
              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Actions Rapides</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button onClick={handlePreview} variant="outline" className="w-full justify-start">
                    <Eye className="w-4 h-4 mr-2" />
                    Aperçu du rapport
                  </Button>
                  
                  <Button onClick={handleCopyContent} variant="outline" className="w-full justify-start">
                    {copied ? <Check className="w-4 h-4 mr-2 text-green-600" /> : <Copy className="w-4 h-4 mr-2" />}
                    {copied ? 'Copié !' : 'Copier le contenu'}
                  </Button>
                  
                  <Button onClick={handleExport} className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
                    <Download className="w-4 h-4 mr-2" />
                    Télécharger le rapport
                  </Button>
                </CardContent>
              </Card>

              {/* Share Options */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Share className="w-5 h-5" />
                    Partager par Email
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label htmlFor="shareEmail" className="text-sm">Email du destinataire</Label>
                    <Input
                      id="shareEmail"
                      type="email"
                      value={shareEmail}
                      onChange={(e) => setShareEmail(e.target.value)}
                      placeholder="collegue@entreprise.fr"
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="shareNote" className="text-sm">Note personnelle (optionnelle)</Label>
                    <Textarea
                      id="shareNote"
                      value={shareNote}
                      onChange={(e) => setShareNote(e.target.value)}
                      placeholder="Cette démonstration montre les capacités de notre solution RAG..."
                      className="mt-1"
                      rows={3}
                    />
                  </div>
                  
                  <Button 
                    onClick={handleShareByEmail} 
                    disabled={!shareEmail}
                    variant="outline" 
                    className="w-full"
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Partager par email
                  </Button>
                </CardContent>
              </Card>

              {/* Demo Notice */}
              <Card className="border-orange-200 bg-orange-50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium text-orange-800 text-sm mb-1">
                        Version de démonstration
                      </div>
                      <div className="text-orange-700 text-xs leading-relaxed">
                        Cette fonctionnalité d'export est limitée en version démo. 
                        La version complète propose des rapports PDF avancés, 
                        des templates personnalisés et l'intégration avec vos outils.
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Aperçu du Rapport</DialogTitle>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowPreview(false)}
              className="absolute right-4 top-4"
            >
              <X className="w-4 h-4" />
            </Button>
          </DialogHeader>
          
          <div className="max-h-[70vh] overflow-y-auto">
            <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm whitespace-pre-wrap">
              {exportedContent}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}