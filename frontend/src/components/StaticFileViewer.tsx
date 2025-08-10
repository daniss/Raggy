'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  FileText, 
  Download, 
  ExternalLink, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw,
  Search,
  ChevronLeft,
  ChevronRight,
  File
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface FileViewerProps {
  filename: string;
  isOpen: boolean;
  onClose: () => void;
  sourceDocument?: {
    name: string;
    type: string;
    size: string;
    description?: string;
  };
  highlightText?: string;
  citationContext?: {
    page?: number;
    section?: string;
    confidence?: number;
  };
}

interface DemoDocument {
  name: string;
  type: string;
  size: string;
  description: string;
  content: {
    type: 'text' | 'pdf' | 'excel' | 'word';
    pages?: string[];
    sections?: { title: string; content: string; page?: number }[];
    preview: string;
  };
}

// Mock demo documents content (in real implementation, this would come from API)
const getDemoDocumentContent = (filename: string): DemoDocument | null => {
  const documents: Record<string, DemoDocument> = {
    'Guide_Conformite_RGPD.pdf': {
      name: 'Guide_Conformite_RGPD.pdf',
      type: 'Juridique',
      size: '2.3 MB',
      description: 'Guide complet de conformité RGPD pour entreprises',
      content: {
        type: 'pdf',
        pages: [
          `GUIDE DE CONFORMITÉ RGPD
          
Table des matières:
1. Introduction au RGPD
2. Principes fondamentaux
3. Droits des personnes concernées
4. Obligations du responsable de traitement
5. Procédures de mise en conformité

Page 1 sur 47`,
          `CHAPITRE 1 - INTRODUCTION AU RGPD

Le Règlement Général sur la Protection des Données (RGPD) est entré en vigueur le 25 mai 2018. Il s'applique à toutes les organisations qui traitent des données personnelles de résidents européens.

Objectifs du RGPD:
• Renforcer les droits des individus
• Harmoniser la protection des données en Europe
• Responsabiliser les organisations
• Moderniser le cadre juridique

Champ d'application:
Le RGPD s'applique si votre organisation:
- Traite des données de résidents UE
- Est établie dans l'UE
- Offre des biens/services dans l'UE

Page 2 sur 47`,
          `CHAPITRE 2 - PRINCIPES FONDAMENTAUX

Les 6 principes du RGPD:

1. LICÉITÉ, LOYAUTÉ ET TRANSPARENCE
Les données doivent être traitées de manière licite, loyale et transparente.

2. LIMITATION DES FINALITÉS
Les données doivent être collectées pour des finalités déterminées, explicites et légitimes.

3. MINIMISATION DES DONNÉES
Les données doivent être adéquates, pertinentes et limitées à ce qui est nécessaire.

4. EXACTITUDE
Les données doivent être exactes et tenues à jour.

5. LIMITATION DE LA CONSERVATION
Les données ne doivent être conservées que le temps nécessaire.

6. INTÉGRITÉ ET CONFIDENTIALITÉ
Les données doivent être sécurisées.

Page 3 sur 47`
        ],
        sections: [
          { title: 'Introduction au RGPD', content: 'Le RGPD renforce la protection des données...', page: 1 },
          { title: 'Principes fondamentaux', content: 'Six principes régissent le traitement...', page: 2 },
          { title: 'Droits des personnes', content: 'Huit droits fondamentaux sont garantis...', page: 15 }
        ],
        preview: 'Guide complet de 47 pages sur la conformité RGPD avec exemples pratiques et check-lists.'
      }
    },
    'Manuel_Procedures_RH_2024.pdf': {
      name: 'Manuel_Procedures_RH_2024.pdf',
      type: 'RH',
      size: '1.8 MB',
      description: 'Manuel des procédures ressources humaines 2024',
      content: {
        type: 'pdf',
        pages: [
          `MANUEL DES PROCÉDURES RH - 2024

Sommaire:
1. Processus de recrutement
2. Intégration des nouveaux collaborateurs
3. Gestion des congés et absences
4. Évaluation des performances
5. Formation et développement
6. Procédures disciplinaires

Version 2024.1 - Mise à jour janvier 2024
Page 1 sur 32`,
          `PROCESSUS DE RECRUTEMENT

1. DÉFINITION DU BESOIN
• Analyse du poste
• Validation budgétaire
• Rédaction de la fiche de poste

2. SOURCING ET DIFFUSION
• Publication interne (48h minimum)
• Sites d'emploi externes
• Réseaux professionnels
• Candidatures spontanées

3. SÉLECTION DES CANDIDATURES
• Tri automatique sur critères obligatoires
• Évaluation par le manager
• Présélection de 3-5 profils maximum

4. ENTRETIENS
• 1er entretien RH (30 min)
• 2ème entretien manager (45 min)
• 3ème entretien équipe si besoin

Page 8 sur 32`,
          `GESTION DES CONGÉS

PROCÉDURE DE DEMANDE:
1. Demande via l'outil SIRH minimum 15 jours avant
2. Validation automatique du N+1 si moins de 5 jours
3. Validation N+2 requise pour plus de 5 jours consécutifs
4. Notification email au demandeur sous 48h

PÉRIODES DE BLOCAGE:
• Fermeture entreprise: 24 déc - 2 janv
• Pics d'activité: avril-mai, septembre-octobre
• Maximum 50% de l'équipe absente simultanément

CONGÉS EXCEPTIONNELS:
• Mariage: 4 jours
• Naissance/adoption: selon convention
• Décès proche: 1-3 jours selon lien familial

Page 15 sur 32`
        ],
        sections: [
          { title: 'Processus de recrutement', content: 'Procédure complète en 4 étapes...', page: 8 },
          { title: 'Gestion des congés', content: 'Demandes via SIRH avec validation...', page: 15 },
          { title: 'Évaluation performances', content: 'Entretiens annuels et mi-parcours...', page: 22 }
        ],
        preview: 'Manuel RH de 32 pages couvrant tous les processus de gestion du personnel.'
      }
    },
    'Contrat_Type_Client.docx': {
      name: 'Contrat_Type_Client.docx',
      type: 'Commercial',
      size: '156 KB',
      description: 'Modèle de contrat client standard',
      content: {
        type: 'word',
        pages: [
          `CONTRAT DE PRESTATION DE SERVICES

Entre:
La société [NOM ENTREPRISE], SARL au capital de [CAPITAL]€
Siège social: [ADRESSE]
SIRET: [SIRET]
Représentée par [NOM REPRÉSENTANT], en qualité de [FONCTION]

Et:
La société [NOM CLIENT], [FORME JURIDIQUE]
Siège social: [ADRESSE CLIENT]
SIRET: [SIRET CLIENT]
Représentée par [NOM REPRÉSENTANT CLIENT]

Il a été convenu ce qui suit:

ARTICLE 1 - OBJET DU CONTRAT
La présente convention a pour objet [DESCRIPTION PRESTATIONS].

ARTICLE 2 - OBLIGATIONS DU PRESTATAIRE
Le prestataire s'engage à:
• Fournir les prestations conformément au cahier des charges
• Respecter les délais convenus
• Maintenir la confidentialité des informations`,
          `ARTICLE 3 - OBLIGATIONS DU CLIENT
Le client s'engage à:
• Fournir les informations nécessaires à la réalisation des prestations
• Payer les factures aux échéances convenues
• Désigner un interlocuteur unique pour le suivi du projet

ARTICLE 4 - CONDITIONS FINANCIÈRES
Montant total: [MONTANT] € HT
TVA applicable: 20%
Modalités de paiement:
• 30% à la commande
• 40% à mi-parcours
• 30% à la livraison

Délai de paiement: 30 jours fin de mois à réception de facture

ARTICLE 5 - DÉLAIS ET PÉNALITÉS
Délai de réalisation: [DÉLAI]
En cas de retard imputable au prestataire:
• Pénalité de 1% du montant HT par semaine de retard
• Maximum 10% du montant total`
        ],
        sections: [
          { title: 'Objet du contrat', content: 'Définition des prestations...', page: 1 },
          { title: 'Conditions financières', content: 'Modalités de paiement 30-40-30...', page: 2 },
          { title: 'Délais et pénalités', content: 'Pénalités de retard 1% par semaine...', page: 2 }
        ],
        preview: 'Contrat type avec clauses standards pour prestations de services.'
      }
    }
  };
  
  return documents[filename] || null;
};

export default function StaticFileViewer({ 
  filename, 
  isOpen, 
  onClose, 
  sourceDocument,
  highlightText,
  citationContext 
}: FileViewerProps) {
  const [document, setDocument] = useState<DemoDocument | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [zoom, setZoom] = useState(100);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen && filename) {
      setIsLoading(true);
      // Simulate loading delay
      setTimeout(() => {
        const doc = getDemoDocumentContent(filename);
        setDocument(doc);
        setIsLoading(false);
        
        // If citation context has page info, navigate to that page
        if (citationContext?.page && doc?.content.pages) {
          setCurrentPage(Math.max(0, Math.min(citationContext.page - 1, doc.content.pages.length - 1)));
        }
      }, 500);
    }
  }, [isOpen, filename, citationContext]);

  useEffect(() => {
    if (highlightText) {
      setSearchQuery(highlightText);
    }
  }, [highlightText]);

  const handleDownload = () => {
    // In real implementation, this would download the actual file
    alert('Fonctionnalité de téléchargement disponible dans la version complète');
  };

  const handleZoomIn = () => setZoom(prev => Math.min(200, prev + 25));
  const handleZoomOut = () => setZoom(prev => Math.max(50, prev - 25));
  const handleResetZoom = () => setZoom(100);

  const highlightSearchText = (text: string) => {
    if (!searchQuery.trim()) return text;
    
    const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.split(regex).map((part, index) => 
      regex.test(part) ? 
        <mark key={index} className="bg-yellow-200 px-1 rounded">{part}</mark> : 
        part
    );
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center space-x-3">
              <FileText className="w-6 h-6 text-blue-600" />
              <div>
                <h2 className="text-lg font-semibold truncate">{filename}</h2>
                {sourceDocument && (
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Badge variant="outline">{sourceDocument.type}</Badge>
                    <span>{sourceDocument.size}</span>
                    {citationContext?.confidence && (
                      <Badge variant="secondary">
                        {citationContext.confidence}% confiance
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                Télécharger
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between p-4 border-b bg-gray-50">
            <div className="flex items-center space-x-4">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Rechercher dans le document..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              
              {/* Zoom controls */}
              <div className="flex items-center space-x-1">
                <Button variant="outline" size="sm" onClick={handleZoomOut}>
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-sm font-medium min-w-[3rem] text-center">
                  {zoom}%
                </span>
                <Button variant="outline" size="sm" onClick={handleZoomIn}>
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleResetZoom}>
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Page navigation */}
            {document?.content.pages && (
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                  disabled={currentPage === 0}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm">
                  Page {currentPage + 1} sur {document.content.pages.length}
                </span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCurrentPage(prev => Math.min(document.content.pages!.length - 1, prev + 1))}
                  disabled={currentPage === document.content.pages.length - 1}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 flex min-h-0">
            {/* Sidebar with sections */}
            {document?.content.sections && (
              <div className="w-64 border-r bg-gray-50">
                <div className="p-4">
                  <h3 className="font-semibold text-sm mb-3">Table des matières</h3>
                  <ScrollArea className="h-64">
                    <div className="space-y-2">
                      {document.content.sections.map((section, index) => (
                        <button
                          key={index}
                          onClick={() => section.page && setCurrentPage(section.page - 1)}
                          className="w-full text-left p-2 text-sm hover:bg-blue-50 rounded transition-colors"
                        >
                          <div className="font-medium">{section.title}</div>
                          {section.page && (
                            <div className="text-xs text-gray-500">Page {section.page}</div>
                          )}
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            )}

            {/* Document viewer */}
            <div className="flex-1 p-6 overflow-auto">
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <File className="w-12 h-12 text-gray-400 mx-auto mb-4 animate-pulse" />
                    <p className="text-gray-600">Chargement du document...</p>
                  </div>
                </div>
              ) : document ? (
                <Card className="max-w-4xl mx-auto">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <FileText className="w-5 h-5" />
                      <span>{document.name}</span>
                    </CardTitle>
                    <p className="text-gray-600">{document.description}</p>
                  </CardHeader>
                  <CardContent>
                    <div 
                      className="prose max-w-none"
                      style={{ zoom: `${zoom}%` }}
                    >
                      {document.content.pages ? (
                        <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
                          {highlightSearchText(document.content.pages[currentPage])}
                        </div>
                      ) : (
                        <div className="text-gray-600">
                          {document.content.preview}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <File className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Document introuvable</p>
                    <p className="text-sm text-gray-500">
                      Ce document n'est pas disponible dans la démo
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t bg-gray-50 text-center">
            <p className="text-xs text-gray-500">
              📄 Version démo • Documents simulés à des fins de démonstration • 
              <Button variant="link" className="p-0 h-auto text-xs" onClick={() => window.location.href = 'mailto:contact@raggy.fr'}>
                Demander accès aux vrais documents
              </Button>
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}