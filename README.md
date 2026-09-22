# RefGM

QG des référents GameMaster. Le site tourne sur **un VPS** (un serveur Linux), pas sur un PC.

- Le domaine **https://gamemaster.fbfa.fr** pointe vers l’IP du VPS.
- Node.js tourne sur le VPS.
- PostgreSQL est installé **sur ce même VPS**. La base n’est pas chez Supabase et n’est pas ouverte sur Internet.
- Discord, le mot de passe Postgres et l’URL se mettent dans un fichier `.env` sur le VPS. Rien de ça n’est écrit dans le code.

Connexion au VPS, depuis ton PC :

```bash
ssh utilisateur@IP_DU_VPS
```

Tout le reste se fait dans cette session SSH.

## 1. Installer les outils sur le VPS

Il faut Node.js 20 ou plus, npm, git et PostgreSQL.

Exemple Debian / Ubuntu :

```bash
sudo apt update
sudo apt install -y git postgresql postgresql-contrib
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
```

PostgreSQL doit écouter en local (`127.0.0.1`, port **5432**). On ne change pas `listen_addresses` pour l’ouvrir au monde.

Puis le code :

```bash
git clone https://github.com/X9842114/RefGM.git
cd RefGM
npm install
cp .env.example .env
nano .env
```

Chaque ligne du `.env` est `NOM=valeur`, sans espace autour du `=`, sans guillemets. Le fichier reste sur le VPS. On ne le commit pas.

## 2. Remplir `.env`

### Adresse du site

```
PORT=3010
AUTH_URL=https://gamemaster.fbfa.fr
AUTH_TRUST_HOST=true
```

- `PORT` : port sur lequel Node écoute, en local. Le proxy public enverra le domaine vers ce port.
- `AUTH_URL` : l’adresse **publique**, avec `https://`, **sans** slash à la fin. C’est cette valeur que Discord doit connaître.
- `AUTH_TRUST_HOST=true` : obligatoire derrière nginx ou Caddy.

Secret de session, une longue chaîne aléatoire :

```bash
openssl rand -base64 32
```

Colle le résultat :

```
AUTH_SECRET=colle-ici-le-resultat
```

### PostgreSQL (installé sur le VPS)

```
REFGM_USE_LOCAL_PG=true
DATABASE_URL=postgresql://UTILISATEUR:MOT_DE_PASSE@127.0.0.1:5432/refgm
```

`127.0.0.1` veut dire « le VPS lui-même ». Remplace `UTILISATEUR` et `MOT_DE_PASSE` par un compte PostgreSQL de ce VPS.

Créer ce compte (une fois) :

```bash
sudo -u postgres psql -c "CREATE USER refgm WITH PASSWORD 'choisis-un-mot-de-passe';"
```

La ligne devient alors :

```
DATABASE_URL=postgresql://refgm:choisis-un-mot-de-passe@127.0.0.1:5432/refgm
```

La base `refgm` n’a pas à être créée à la main : la commande plus bas s’en charge. Le port 5432 ne doit pas être ouvert dans le pare-feu du VPS.

Ensuite, toujours depuis le dossier du projet :

```bash
npm run db:setup
```

Cette commande crée la base `refgm` si elle n’existe pas, puis crée les tables (`supabase/refgm.sql`).

### Discord (connexion des gens)

1. Va sur https://discord.com/developers/applications
2. Ouvre l’application du QG, ou crée-en une.
3. Onglet **OAuth2**.
4. Copie **Client ID** dans :

```
DISCORD_CLIENT_ID=colle-le-client-id
```

5. Clique **Reset Secret**, copie le secret (il ne s’affiche qu’une fois) dans :

```
DISCORD_CLIENT_SECRET=colle-le-secret
```

6. Dans **OAuth2 → Redirects**, ajoute **exactement** cette ligne, puis Enregistrer :

```
https://gamemaster.fbfa.fr/api/auth/callback/discord
```

Si tu testes aussi sur le PC, ajoute en plus :

```
http://localhost:3010/api/auth/callback/discord
```

Le chemin est toujours `/api/auth/callback/discord`. Le début doit être identique à `AUTH_URL`. Une lettre de différence et Discord refuse la connexion.

Les scopes utilisés par le site : `identify`, `guilds`, `guilds.members.read`. Rien à cocher à la main si le site les demande tout seul.

## 3. Lancer le site sur le VPS

```bash
npm run build
```

Pour qu’il reste allumé après une déconnexion SSH et après un reboot, un service systemd :

```bash
sudo nano /etc/systemd/system/refgm.service
```

```
[Unit]
Description=RefGM
After=network.target postgresql.service

[Service]
Type=simple
WorkingDirectory=/chemin/vers/RefGM
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm run start
Restart=on-failure
User=TON_UTILISATEUR

[Install]
WantedBy=multi-user.target
```

Remplace `/chemin/vers/RefGM` (par exemple `/root/RefGM` ou `/home/ubuntu/RefGM`) et `TON_UTILISATEUR`.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now refgm
sudo systemctl status refgm
```

Le site répond sur le VPS à `http://127.0.0.1:3010`. Ce n’est pas encore l’adresse publique.

Après chaque changement de `.env` ou du code :

```bash
npm run build
sudo systemctl restart refgm
```

## 4. Domaine et HTTPS

Le DNS de `gamemaster.fbfa.fr` doit avoir un enregistrement **A** vers l’IP publique du VPS.

Un reverse proxy sur le VPS reçoit le HTTPS et le renvoie vers Node :

- public : `https://gamemaster.fbfa.fr`
- interne : `http://127.0.0.1:3010`

PostgreSQL ne passe pas par ce proxy. Il reste sur `127.0.0.1:5432`.

Exemple Caddy (`sudo apt install caddy`) :

```
gamemaster.fbfa.fr {
  reverse_proxy 127.0.0.1:3010
}
```

Caddy obtient le certificat HTTPS tout seul. Ouvre les ports **80** et **443** du pare-feu. Laisse **5432** fermé. Le port **3010** peut rester fermé de l’extérieur : seul Caddy, sur le VPS, y accède.

## 5. Premier essai

1. Ouvre https://gamemaster.fbfa.fr
2. Connecte-toi avec Discord.
3. Si ton ID est dans `NEXT_PUBLIC_DEVELOPER_DISCORD_IDS`, tu entres direct comme Développeur.
4. Sinon, le compte est en attente. Un Développeur le valide dans le QG.

## Si ça bloque

| Symptôme | Cause fréquente |
| --- | --- |
| Discord dit « redirect_uri » | L’URL dans le portail Discord n’est pas exactement `{AUTH_URL}/api/auth/callback/discord` |
| Page de login sans bouton Discord | `DISCORD_CLIENT_ID` ou `DISCORD_CLIENT_SECRET` vide, ou le site n’a pas été redémarré |
| Erreur PostgreSQL au démarrage | Mauvais mot de passe dans `DATABASE_URL`, ou Postgres arrêté, ou `npm run db:setup` pas lancé |
| Le site n’est pas sur le domaine | Le proxy ne pointe pas vers le `PORT`, ou `AUTH_URL` ne correspond pas au domaine |

## À ne pas envoyer

Le fichier `.env` contient le secret Discord, le mot de passe Postgres et `AUTH_SECRET`. Il n’est pas sur git. On partage le repo, pas ce fichier.

Le modèle sans secrets est [`.env.example`](./.env.example).
