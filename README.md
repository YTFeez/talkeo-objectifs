# Talkeo

Application web **Talkeo** : tes parents ajoutent des objectifs à ta to-do list. Interface sombre style Cursor.

## Fonctionnalités

- **Parents** : ajoutent, modifient et suppriment leurs objectifs en attente
- **Arron (admin)** : voit tout, coche comme terminé, supprime
- Changement de code d'accès dans **Paramètres**
- Données persistées en SQLite sur le VPS (volume Docker)

## Codes d'accès par défaut

| Rôle   | Code par défaut | Usage                          |
|--------|-----------------|--------------------------------|
| Parent | `parents2026`   | Ajouter et modifier ses objectifs |
| Admin  | `admin2026`     | Gérer et cocher les objectifs  |

Modifiables dans l'app via **Paramètres** ou dans `.env` avant le premier lancement.

## Développement local

```bash
cd talkeo
npm run install:all
npm run dev
```

- Frontend : http://localhost:5174
- Backend : http://localhost:3002

## Déploiement sur VPS Hostinger

### 1. Prérequis

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
sudo apt install -y nginx certbot python3-certbot-nginx git
```

### 2. Cloner et configurer

```bash
git clone https://github.com/YTFeez/talkeo-objectifs.git ~/talkeo
cd ~/talkeo
cp .env.example .env
nano .env   # codes secrets
```

### 3. Lancer (données persistées)

```bash
docker compose up -d --build
```

Toutes les données (objectifs + mots de passe) sont stockées dans le volume Docker **`talkeo-data`** monté sur `/data`. Elles survivent aux redémarrages et mises à jour.

```bash
# Vérifier le volume
docker volume inspect talkeo-data

# Sauvegarder la base
docker compose exec talkeo cat /data/todos.db > backup-$(date +%F).db
```

### 4. Mises à jour

```bash
cd ~/talkeo
./deploy.sh
```

### 5. Nginx + HTTPS

```bash
sudo cp nginx.example.conf /etc/nginx/sites-available/talkeo
sudo nano /etc/nginx/sites-available/talkeo   # ton domaine
sudo ln -s /etc/nginx/sites-available/talkeo /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d talkeo.tondomaine.com
```

## Structure

```
talkeo/
├── client/          # React + Vite
├── server/          # Express + SQLite
├── docker-compose.yml
├── deploy.sh
└── nginx.example.conf
```

## Commandes utiles

```bash
docker compose logs -f talkeo
docker compose restart talkeo
```
