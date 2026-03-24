# DIPK - Système de Gestion des Poubelles Urbaines

DIPK est une solution complète de gestion intelligente des déchets urbains, comprenant un backend robuste, un tableau de bord web pour l'administration et le suivi, ainsi qu'une application mobile pour les agents sur le terrain.

## Structure du Projet

Le projet est divisé en plusieurs composants principaux :

- **`backend/`** : L'API principale gérant la logique métier, la base de données et les communications avec les interfaces front-end.
- **`web_dashboard/`** : L'interface d'administration en ligne permettant de visualiser la carte des poubelles, les statistiques et de gérer les utilisateurs et assignations.
- **`mobile_app/`** : L'application mobile destinée aux agents de collecte et de transit pour la mise à jour de l'état des poubelles en temps réel.

## Dépendances et Installation

### Prérequis
- Python 3.8+
- Node.js & npm (pour le dashboard web et l'application mobile)

### Backend
1. Créer un environnement virtuel : `python3 -m venv venv`
2. Activer l'environnement : `source venv/bin/activate`
3. Installer les dépendances : `pip install -r requirements.txt`

### Web Dashboard
1. Naviguer dans le dossier : `cd web_dashboard`
2. Installer les dépendances : `npm install`
3. Lancer le serveur de développement : `npm run dev`

### Mobile App
Consulter le fichier [mobile_setup_guide.md](./mobile_setup_guide.md) pour les instructions détaillées de configuration et d'exécution de l'application mobile.

## Documentation
Vous trouverez davantage de détails dans les fichiers fournis :
- `RAPPORT_FINAL.md` : Rapport détaillé du projet.
- `mobile_setup_guide.md` : Guide de configuration de l'application mobile.
- Les documents de conception et d'analyse dans le dossier racine.
