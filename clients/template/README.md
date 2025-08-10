# Client Template

Ce dossier contient les fichiers de base pour un déploiement client de Raggy.

## Structure

```
clients/[client-name]/
├── config/
│   └── .env              # Configuration client
├── data/
│   └── documents/        # Documents uploadés
├── backups/
│   └── [dates]/          # Sauvegardes automatiques
├── logs/
│   ├── backend.log       # Logs API
│   └── access.log        # Logs d'accès
├── assets/
│   └── logo-client.png   # Logo personnalisé
├── docker-compose.yml    # Configuration Docker
├── deploy.sh            # Script de déploiement
├── backup.sh            # Script de sauvegarde
└── monitor.sh           # Script de monitoring
```

## Utilisation

1. **Créer un nouveau client** :
   ```bash
   ./scripts/setup_client.sh "Nom Client" docker
   ```

2. **Configurer** :
   ```bash
   cd clients/nom-client
   nano config/.env
   ```

3. **Déployer** :
   ```bash
   ./deploy.sh
   ```

4. **Monitorer** :
   ```bash
   ./monitor.sh
   ```

## Configuration

Principales variables à configurer dans `config/.env` :

- `GROQ_API_KEY` : Clé API Groq
- `SUPABASE_URL` : URL Supabase
- `SUPABASE_SERVICE_KEY` : Clé service Supabase
- `CLIENT_NAME` : Nom du client
- `PRIMARY_COLOR` : Couleur principale de l'interface

## Support

- Documentation : https://docs.raggy.fr
- Support technique : support@raggy.fr
- Monitoring : ./monitor.sh