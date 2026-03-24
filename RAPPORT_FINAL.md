# DIPK – Rapport Final du Projet
## Système Intelligent de Gestion et de Collecte des Déchets Urbains à Hanoï

> **Version :** 2.0  
> **Date :** Mars 2026  
> **Statut :** Développement Actif

---

## 1. Vue d'Ensemble

DIPK est un système intégré de gestion des déchets urbains conçu pour la ville de Hanoï, Vietnam. Il exploite le **Computer Vision** (IA) et la **géolocalisation GPS** pour orchestrer un cycle complet de détection, collecte, inspection et validation des déchets. Le système connecte les citoyens, les agents de terrain, les superviseurs, les inspecteurs et les administrateurs centraux via trois applications distinctes.

---

## 2. Architecture Globale

```
┌─────────────────────────────────────────────────────────────────┐
│                          DIPK SYSTEM                            │
├──────────────────┬──────────────────────┬───────────────────────┤
│   CITOYEN        │   TERRAIN (Mobile)   │   CENTRAL (Web)       │
│   HomeScreen     │   AgentDashboard     │   Admin Dashboard     │
│   (Signalement)  │   SupervisorDashboard│   (Next.js)           │
│   React Native   │   InspectorDashboard │                       │
└────────┬─────────┴─────────┬────────────┴──────────┬────────────┘
         │                   │                       │
         └───────────────────▼───────────────────────┘
                     ┌───────────────────┐
                     │  BACKEND API      │
                     │  FastAPI / Python │
                     │  Port 8000        │
                     └────────┬──────────┘
                              │
                     ┌────────▼──────────┐
                     │   PostgreSQL      │
                     │   + PostGIS       │
                     └───────────────────┘
```

---

## 3. Stack Technique

### 3.1 Backend (API & IA)

| Composant | Technologie | Version |
|---|---|---|
| Framework API | FastAPI | 0.128.0 |
| Serveur ASGI | Uvicorn | 0.40.0 |
| Authentification | JWT (python-jose + passlib[bcrypt]) | — |
| IA Détection Déchets | YOLOv8 (Ultralytics) | 8.4.5 |
| Deep Learning | PyTorch + CUDA (GPU) | 2.9.1 |
| Vision par Ordinateur | OpenCV | 4.12.0 |
| ORM / Driver DB | Psycopg2-binary | 2.9.11 |
| Validation Données | Pydantic | 2.12.5 |
| Env. Variables | python-dotenv | 1.2.1 |
| Langage | Python | 3.12 |

### 3.2 Application Mobile (Terrain)

| Composant | Technologie | Version |
|---|---|---|
| Framework | React Native | 0.83.1 |
| Langage | TypeScript | 5.x |
| Navigation | React Navigation (Native Stack) | 7.x |
| Cartes | react-native-maps / WebView + Leaflet | 1.27.1 |
| GPS | react-native-geolocation-service | 5.3.1 |
| Caméra / Media | react-native-image-picker | 8.2.1 |
| Requêtes HTTP | Axios | 1.13.2 |
| Stockage Local | AsyncStorage | 2.x |
| Contenu Web | react-native-webview | 13.16.0 |
| Plateforme cible | Android (Kotlin/Java natif) | — |

### 3.3 Dashboard Web (Administration)

| Composant | Technologie | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.1.6 |
| Runtime | React | 19.2.3 |
| Langage | TypeScript | 5.x |
| Cartes | Leaflet + react-leaflet | 1.9.4 / 5.x |
| Icônes | Lucide React | 0.564.0 |
| CSS | TailwindCSS | 4.x |
| Requêtes HTTP | Axios | 1.13.5 |

### 3.4 Base de Données

| Composant | Technologie |
|---|---|
| SGBD | PostgreSQL |
| Extension Géospatiale | PostGIS (GEOMETRY, GIST) |
| Système de Coordonnées | WGS84 / EPSG:4326 |
| Données cartes | OpenStreetMap (.osc) |

---

## 4. Structure du Projet

```
DIPK/
├── backend/                    # API FastAPI
│   ├── main.py                 # Tous les endpoints API (1200+ lignes)
│   └── auth.py                 # JWT helpers (verify, hash, create_token)
│
├── mobile_app/                 # Application React Native (Android)
│   └── src/
│       ├── context/
│       │   └── AuthContext.tsx # Gestion token JWT global
│       ├── navigation/
│       │   └── AppNavigator.tsx# Routage selon le rôle utilisateur
│       └── screens/
│           ├── LoginScreen.tsx       # Authentification
│           ├── HomeScreen.tsx        # Signalement citoyen (avec IA)
│           ├── AgentDashboard.tsx    # Tableau de bord Agent
│           ├── SupervisorDashboard.tsx# Tableau de bord Superviseur
│           └── InspectorDashboard.tsx # Tableau de bord Inspecteur
│
├── web_dashboard/              # Dashboard Admin (Next.js)
│   └── src/app/
│       ├── dashboard/
│       │   ├── page.tsx        # Page d'accueil admin (statistiques)
│       │   ├── reports/        # Gestion des signalements
│       │   ├── users/          # Gestion CRUD des utilisateurs
│       │   ├── transit/        # Centres de transit
│       │   ├── landfill/       # Centres d'enfouissement
│       │   └── map/            # Carte interactive
│       └── _components/
│           ├── MapComponent.tsx# Carte Leaflet interactive
│           └── Sidebar.tsx     # Navigation latérale
│
├── database_setup.py           # Initialisation schéma DB + import OSC
├── import_bins.py              # Import des poubelles OpenStreetMap
├── import_transit_data.py      # Import des centres de transit Hanoï
├── changes.osc                 # Données OSM (noeuds poubelles)
├── best.pt                     # Modèle YOLO - détection poubelles
├── little_best.pt              # Modèle YOLO - détection bouteilles plastiques
└── requirements.txt            # Dépendances Python
```

---

## 5. Modèle de Base de Données

### 5.1 Tables Principales

```sql
-- Utilisateurs et rôles
users (
  id, username, password_hash, role [ADMIN|INSPECTEUR|SUPERVISEUR|AGENT],
  phone, full_name, assigned_zone (GEOMETRY), created_at
)

-- Signalements de déchets
signalements (
  id, geom (GEOMETRY Point), image_path, status, status_message,
  latitude, longitude, created_at,
  assigned_to → users(id),
  transit_center_id → centres_transit(id),
  validated_by → users(id), validated_at, validation_photo_path
)

-- Centres de Transit
centres_transit (
  id, osm_id, name, capacity_max, current_load,
  status [OPERATIONAL|FULL|EVACUATING],
  geom (GEOMETRY Point),
  supervisor_id → users(id)
)

-- Centres d'Enfouissement (Décharges)
centres_enfouissement (
  id, osm_id, name, geom (GEOMETRY Point),
  supervisor_id → users(id),
  status, current_load, capacity_max
)

-- Poubelles Officielles (OpenStreetMap)
poubelles_officielles (
  id, osm_id, tags (JSONB), geom (GEOMETRY Point)
)
```

### 5.2 Cycle de Statuts d'un Signalement (FSM)

```
PENDING → ASSIGNED → IN_TRANSIT → DEPOSITED → WAITING_INSPECTION
                                                      ↓
                                            INSPECTION_ASSIGNED
                                                      ↓
ILLEGAL_DUMP ──────────────────────────────────── CLEANED / RESOLVED
LEGAL_MAINTENANCE (conservé vert sur la carte)
```

---

## 6. Rôles et Permissions

| Rôle | Accès Mobile | Accès Web Dashboard |
|---|---|---|
| **Citoyen** (non-connecté) | HomeScreen (signalement) | ✗ |
| **AGENT** | AgentDashboard (tâches, carte, transit) | ✗ |
| **INSPECTEUR** | InspectorDashboard (tâches GPS) | ✗ |
| **SUPERVISEUR** | SupervisorDashboard (dépôts entrants, validation) | Partiel (reports) |
| **ADMIN** | AgentDashboard | Accès complet |

---

## 7. API Endpoints (Backend FastAPI)

### Publics / Authentification
| Méthode | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Health check |
| `POST` | `/token` | Login → retourne JWT |
| `POST` | `/register` | Enregistrement (usage interne) |
| `POST` | `/predict_trash` | Analyse image IA (YOLOv8) |
| `POST` | `/submit_report` | Soumettre un signalement citoyen |
| `GET`  | `/nearest_transit_center` | Centre de transit le plus proche |

### Agent
| Méthode | Endpoint | Description |
|---|---|---|
| `GET` | `/agent/my_tasks` | Tâches ASSIGNED de l'agent |
| `PUT` | `/agent/tasks/{id}/resolve` | Marquer une tâche → `IN_TRANSIT` |
| `POST` | `/agent/confirm_deposit` | Confirmer le dépôt → `DEPOSITED` |

### Superviseur
| Méthode | Endpoint | Description |
|---|---|---|
| `GET` | `/supervisor/my_center` | Informations du centre assigné |
| `GET` | `/supervisor/incoming_deposits` | Liste des agents avec dépôts en attente |
| `POST` | `/supervisor/validate_deposit` | Valider un dépôt → `WAITING_INSPECTION` |

### Inspecteur
| Méthode | Endpoint | Description |
|---|---|---|
| `GET` | `/inspector/my_tasks` | Tâches `INSPECTION_ASSIGNED` |
| `POST` | `/inspector/validate_task` | Valider nettoyage (GPS ≤ 10m) → `CLEANED` |

### Administration (ADMIN uniquement)
| Méthode | Endpoint | Description |
|---|---|---|
| `GET` | `/admin/stats` | Statistiques générales |
| `GET` | `/admin/users` | Liste de tous les utilisateurs |
| `POST` | `/admin/create_user` | Créer un utilisateur |
| `PUT` | `/admin/users/{id}` | Modifier un utilisateur / changer son rôle |
| `DELETE` | `/admin/users/{id}` | Supprimer un utilisateur |
| `GET` | `/admin/reports` | Tous les signalements |
| `PUT` | `/admin/reports/{id}/assign` | Assigner/Désassigner un rapport |
| `PUT` | `/admin/transit/{id}/assign` | Assigner un superviseur à un centre transit |
| `PUT` | `/admin/landfill/{id}/assign` | Assigner un superviseur à une décharge |
| `GET` | `/admin/map_data` | Données carte (rapports, centres, poubelles) |

---

## 8. Flux de Travail Complet

```
1. CITOYEN
   └─ Prend photo → IA YOLOv8 détecte déchets
   └─ Géolocalise → Soumet signalement (status: ILLEGAL_DUMP ou LEGAL_MAINTENANCE)

2. ADMIN WEB
   └─ Voit le signalement sur la carte (rouge / gris)
   └─ Assigne un AGENT → status: ASSIGNED (jaune sur carte)

3. AGENT MOBILE
   └─ Voit sa liste de tâches
   └─ Navigue vers la poubelle (Itinéraire)
   └─ Clique "Prendre (En transit)" → status: IN_TRANSIT
   └─ Cherche Centre de Transit le plus proche
   └─ Clique "Confirmer l'arrivée et le dépôt" → status: DEPOSITED

4. SUPERVISEUR MOBILE
   └─ Voit les agents avec dépôts arrivants
   └─ Clique "Valider le dépôt" → status: WAITING_INSPECTION

5. ADMIN WEB
   └─ Assigne un INSPECTEUR → status: INSPECTION_ASSIGNED

6. INSPECTEUR MOBILE
   └─ Voit ses tâches sur une carte interactive
   └─ Se rend sur place (GPS tracé en direct)
   └─ Clique "Confirmer (GPS)" [tolérance ≤ 10m]
   └─ Si ILLEGAL_DUMP → status: CLEANED (disparaît de la carte)
   └─ Si LEGAL_MAINTENANCE → status: CLEANED (passe en vert = prêt pour prochain cycle)
```

---

## 9. Couleurs sur la Carte d'Administration

| Couleur | Entité | Statut |
|---|---|---|
| 🔴 Rouge | Signalement Illégal | `ILLEGAL_DUMP`, Transit FULL |
| ⚫ Noir | Centre d'Enfouissement | Décharge |
| 🟡 Jaune | Signalement en cours | `IN_TRANSIT`, `DEPOSITED`, `WAITING_INSPECTION`, `INSPECTION_ASSIGNED` |
| 🟢 Vert | Poubelle Légale Nettoyée | `CLEANED` (LEGAL) |
| ⚫ Grisé | Signalement Légal | `LEGAL_MAINTENANCE` |
| 🟫 Or | Centre de Transit | Opérationnel |
| 🟣 Violet | Centre de Transit | Urgence `EMERGENCY` |

---

## 10. Modèles IA

| Modèle | Fichier | Objet Détecté | Seuil Confiance |
|---|---|---|---|
| Trash Detector | `best.pt` | Poubelles / Dépôts sauvages | 0.50 |
| Bottle Detector | `little_best.pt` | Bouteilles plastiques | 0.50 |

Les modèles sont basés sur **YOLOv8** (Ultralytics) et tournent en **GPU CUDA** si disponible.  
L'API `/predict_trash` retourne :
```json
{
  "is_trash": true,
  "confidence": 0.87,
  "is_plastic": false,
  "plastic_confidence": 0.12
}
```

---

## 11. Sécurité

- **Authentification** : JWT Bearer Token (expiry 24h)
- **Hachage** : bcrypt (passlib)
- **Autorisation** : Role-based access control (RBAC) sur tous les endpoints sensibles
- **CORS** : Activé pour toutes origines en développement (à restreindre en production)
- **Vérification GPS** : Les inspecteurs doivent être physiquement à ≤ 10m de la cible pour valider

---

## 12. Configuration & Variables d'Environnement

### `.env` (Racine du projet)
```dotenv
DB_NAME=dipk_db
DB_USER=postgres
DB_PASSWORD=password
DB_HOST=localhost
DB_PORT=5432
```

### `web_dashboard/.env.local`
```dotenv
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

---

## 13. Démarrage du Projet

### Backend API
```bash
cd /home/hamba/DIPK
source venv/bin/activate
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

### Application Mobile
```bash
cd /home/hamba/DIPK/mobile_app
npx react-native start
npx react-native run-android
```

### Dashboard Web
```bash
cd /home/hamba/DIPK/web_dashboard
npm run dev
# → http://localhost:3000
```

### Initialisation Base de Données (première fois)
```bash
cd /home/hamba/DIPK
python database_setup.py
python import_bins.py
python import_transit_data.py
```

---

## 14. Points Techniques Notables

1. **PostGIS** : Toutes les coordonnées géographiques sont stockées nativement avec `GEOMETRY(Point, 4326)`. Les distances (GPS 10m) sont calculées avec `ST_Distance`.

2. **Carte Mobile (Agent & Inspecteur)** : Implémentée via `react-native-webview` injectant une carte **Leaflet** vanilla en HTML. Cela évite les problèmes de compatibilité de `react-native-maps` avec des cartes OpenStreetMap personnalisées.

3. **Carte Web (Admin)** : Implémentée avec `react-leaflet`. Les couleurs des marqueurs sont dynamiquement choisies selon le statut retourné par le backend, en utilisant la librairie `leaflet-color-markers` via CDN.

4. **Dual YOLO Models** : Deux modèles entraînés opèrent en parallèle sur chaque image soumise pour détecter à la fois les déchets généraux et les matières plastiques spécifiquement.

5. **GPS Strict (Inspecteur)** : La validation GPS côté backend utilise la formule de calcul de distance sphérique (haversine approximée) pour s'assurer que l'inspecteur est physiquement sur site.

---

*Rapport généré automatiquement – Projet DIPK v2.0*
