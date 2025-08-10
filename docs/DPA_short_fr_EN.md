# DPA - Contrat de Traitement des Données / Data Processing Agreement

**Version**: 2.0  
**Date**: 15 janvier 2025  
**Langues**: Français / English

---

## 🇫🇷 FRANÇAIS

### Contrat de Traitement des Données Personnelles (DPA)
**Conforme au Règlement Général sur la Protection des Données (RGPD)**

#### 1. Parties contractantes

**Responsable de traitement** : Le Client  
**Sous-traitant** : Raggy Solutions (ci-après "Raggy")

#### 2. Objet du traitement

**Finalité** : Mise à disposition d'un assistant IA alimenté par les documents du Client  
**Catégories de données** : Documents professionnels, métadonnées, logs d'utilisation  
**Personnes concernées** : Employés du Client, clients du Client (selon documents traités)

#### 3. Localisation et sécurité des données

**🏠 Hébergement souverain** :
- Données stockées exclusivement sur l'infrastructure du Client
- Aucun transfert vers des serveurs tiers
- Traitement local par l'assistant IA déployé

**🔒 Mesures de sécurité techniques** :
- Chiffrement AES-256 pour le stockage
- Communications sécurisées TLS 1.3
- Accès par authentification multi-facteurs
- Logs d'audit complets et horodatés

**🛡️ Mesures organisationnelles** :
- Formation du personnel aux enjeux RGPD
- Accès aux données sur principe du besoin d'en connaître
- Procédures de gestion des incidents de sécurité
- Révision annuelle des mesures de sécurité

#### 4. Droits des personnes concernées

**Exercice des droits** :
- Accès, rectification, effacement : Via interface d'administration
- Portabilité : Export des données au format JSON/CSV
- Opposition : Suppression des documents concernés
- Limitation : Isolation temporaire des données

**Délais de traitement** : 30 jours maximum conformément au RGPD

#### 5. Sous-traitance ultérieure

**Principe** : Aucun sous-traitant externe  
**Exception** : Hébergement Cloud (avec accord préalable du Client)  
**Garanties** : Mêmes niveaux de protection que le présent DPA

#### 6. Assistance au responsable de traitement

**Raggy s'engage à** :
- Fournir les informations nécessaires aux analyses d'impact (AIPD)
- Collaborer aux audits et inspections
- Notifier tout incident de sécurité sous 24h
- Assister dans la réponse aux demandes d'exercice de droits

#### 7. Suppression et restitution des données

**Fin de contrat** :
- Suppression complète des données sous 30 jours
- Génération d'un certificat de destruction cryptographique
- Restitution possible au format demandé par le Client

**Preuve de suppression** :
```json
{
  "operation": "purge_complete",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "verification_hash": "sha256:abc123def456...",
  "documents_purged": 1000,
  "vectors_purged": 50000,
  "proof_signature": "ed25519:xyz789..."
}
```

#### 8. Responsabilités et engagements

**Client (Responsable de traitement)** :
- Collecte licite des données
- Information des personnes concernées
- Base légale appropriée pour le traitement
- Gestion des demandes d'exercice de droits

**Raggy (Sous-traitant)** :
- Traitement conforme aux instructions du Client
- Maintien des mesures de sécurité
- Confidentialité du personnel
- Assistance technique et juridique

#### 9. Durée et résiliation

**Durée** : Pendant toute la durée du contrat de services  
**Résiliation** : Possible à tout moment avec préavis de 30 jours  
**Effets** : Suppression immédiate des données avec preuve cryptographique

#### 10. Contact DPO

**Délégué à la Protection des Données Raggy** :  
📧 Email : dpo@raggy.fr  
📞 Téléphone : +33 1 XX XX XX XX  
📬 Adresse : [Adresse du siège social]

---

## 🇬🇧 ENGLISH

### Data Processing Agreement (DPA)
**GDPR Compliant**

#### 1. Contracting Parties

**Data Controller**: The Client  
**Data Processor**: Raggy Solutions (hereinafter "Raggy")

#### 2. Processing Purpose

**Purpose**: Provision of an AI assistant powered by Client's documents  
**Data Categories**: Professional documents, metadata, usage logs  
**Data Subjects**: Client's employees, Client's customers (depending on processed documents)

#### 3. Data Location and Security

**🏠 Sovereign Hosting**:
- Data stored exclusively on Client's infrastructure
- No transfer to third-party servers
- Local processing by deployed AI assistant

**🔒 Technical Security Measures**:
- AES-256 encryption for storage
- TLS 1.3 secure communications
- Multi-factor authentication access
- Complete and timestamped audit logs

**🛡️ Organizational Measures**:
- Staff training on GDPR compliance
- Data access on need-to-know basis
- Security incident management procedures
- Annual security measures review

#### 4. Data Subject Rights

**Rights Exercise**:
- Access, rectification, erasure: Via administration interface
- Portability: Data export in JSON/CSV format
- Objection: Deletion of relevant documents
- Restriction: Temporary data isolation

**Processing Timeframe**: Maximum 30 days in accordance with GDPR

#### 5. Sub-processing

**Principle**: No external sub-processors  
**Exception**: Cloud hosting (with prior Client agreement)  
**Guarantees**: Same protection levels as this DPA

#### 6. Assistance to Data Controller

**Raggy commits to**:
- Provide information necessary for impact assessments (DPIA)
- Collaborate in audits and inspections
- Report any security incident within 24h
- Assist in responding to rights exercise requests

#### 7. Data Deletion and Return

**Contract Termination**:
- Complete data deletion within 30 days
- Generation of cryptographic destruction certificate
- Possible data return in Client-requested format

**Deletion Proof**:
```json
{
  "operation": "purge_complete",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "verification_hash": "sha256:abc123def456...",
  "documents_purged": 1000,
  "vectors_purged": 50000,
  "proof_signature": "ed25519:xyz789..."
}
```

#### 8. Responsibilities and Commitments

**Client (Data Controller)**:
- Lawful data collection
- Data subject information
- Appropriate legal basis for processing
- Handling rights exercise requests

**Raggy (Data Processor)**:
- Processing in accordance with Client instructions
- Maintaining security measures
- Staff confidentiality
- Technical and legal assistance

#### 9. Duration and Termination

**Duration**: Throughout the entire service contract period  
**Termination**: Possible at any time with 30 days' notice  
**Effects**: Immediate data deletion with cryptographic proof

#### 10. DPO Contact

**Raggy Data Protection Officer**:  
📧 Email: dpo@raggy.fr  
📞 Phone: +33 1 XX XX XX XX  
📬 Address: [Headquarters address]

---

## 📋 Annexes

### A. Categories of Personal Data Processed

| Category | Examples | Retention Period |
|----------|----------|------------------|
| **Employee Data** | Names, email addresses, job titles in documents | Duration of contract + 3 years |
| **Customer Data** | Client names, contact details in business documents | As per Client's retention policy |
| **Technical Data** | IP addresses, usage logs, system metrics | 12 months maximum |
| **Content Data** | Document content, metadata, vector embeddings | Duration of contract |

### B. Technical and Organizational Measures

| Measure | Implementation | Verification |
|---------|----------------|--------------|
| **Encryption** | AES-256 at rest, TLS 1.3 in transit | Annual penetration testing |
| **Access Control** | RBAC with MFA | Quarterly access review |
| **Backup** | Encrypted daily backups | Monthly restoration tests |
| **Monitoring** | 24/7 security monitoring | Real-time alerts |

### C. Incident Response Procedure

1. **Detection** (0-1h): Automated monitoring alerts
2. **Assessment** (1-4h): Impact and scope evaluation  
3. **Notification** (4-24h): Client notification if required
4. **Containment** (24-48h): Immediate measures implementation
5. **Recovery** (48-72h): Full service restoration
6. **Review** (1 week): Post-incident analysis and improvements

---

**🔏 Document électroniquement signé**  
**Raggy Solutions - Date: 15/01/2025**

**⚖️ Droit applicable**: Droit français  
**🏛️ Juridiction compétente**: Tribunaux de Paris

---

**Pour toute question relative à ce DPA** :  
📧 dpo@raggy.fr | 📞 +33 1 XX XX XX XX