# Déploiement RefGM → https://cveshop.com

## Source
- Repo GitHub : https://github.com/X9842114/cveshop
- Vercel : projet **`refgm-eu`** (lié au repo — un push sur `main` déclenche le deploy)
- Domaines : `cveshop.com` + `www.cveshop.com`

## Variables d’environnement (Vercel Dashboard)

**Ne jamais coller une valeur `[SENSITIVE]`** (placeholder du CLI `vercel env pull`).

Projet `refgm-eu` → Settings → Environment Variables → Production :

| Variable | Valeur |
|----------|--------|
| `AUTH_URL` | `https://cveshop.com` |
| `AUTH_SECRET` | secret aléatoire |
| `AUTH_TRUST_HOST` | `true` |
| `DISCORD_CLIENT_ID` | snowflake numérique Discord |
| `DISCORD_CLIENT_SECRET` | secret Discord |
| `AUTH_DISCORD_ID` | même ID |
| `AUTH_DISCORD_SECRET` | même secret |
| `DISCORD_BOT_TOKEN` | token du bot (logs) |
| `DISCORD_CHANNEL_LOGS` | ID du salon de logs |
| `NEXT_PUBLIC_SUPABASE_URL` | URL Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | clé publishable |

Après modification des env : **Redeploy** une seule fois depuis le dashboard (ou un push GitHub).

## Discord OAuth Redirects

```
https://cveshop.com/api/auth/callback/discord
http://localhost:3010/api/auth/callback/discord
```

## Workflow

1. Développer / commit dans ce repo
2. `git push origin main`
3. Vercel build auto — **pas de `vercel --prod` en boucle**

Les commits doivent être signés avec une adresse e-mail liée au compte GitHub,
sinon Vercel bloque le déploiement. Utiliser l’adresse GitHub noreply vérifiée
`172382011+X9842114@users.noreply.github.com`.
