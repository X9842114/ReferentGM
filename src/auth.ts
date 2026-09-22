import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Discord from "next-auth/providers/discord";
import type { JWT } from "next-auth/jwt";
import { cache } from "react";

/** Mêmes variables qu’Admin-GameMaster (+ fallback AUTH_DISCORD_*) */
const DISCORD_APPLICATION_ID = "1534740491814305974";

function validDiscordApplicationId(value?: string) {
  const id = value?.trim() ?? "";
  return /^\d{17,20}$/.test(id) ? id : null;
}

/**
 * L'identifiant OAuth Discord est public. Le fallback évite de transmettre
 * le placeholder `[SENSITIVE]` si une variable Vercel a été mal configurée.
 */
const discordClientId =
  validDiscordApplicationId(process.env.DISCORD_CLIENT_ID) ||
  validDiscordApplicationId(process.env.AUTH_DISCORD_ID) ||
  DISCORD_APPLICATION_ID;
const discordClientSecret =
  process.env.DISCORD_CLIENT_SECRET?.trim() ||
  process.env.AUTH_DISCORD_SECRET?.trim() ||
  "";

const discordReady = Boolean(discordClientId && discordClientSecret);

const providers = [];

if (discordReady) {
  providers.push(
    Discord({
      clientId: discordClientId,
      clientSecret: discordClientSecret,
      authorization: {
        params: { scope: "identify guilds guilds.members.read" },
      },
      profile(profile) {
        const image = profile.avatar
          ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${
              profile.avatar.startsWith("a_") ? "gif" : "png"
            }?size=128`
          : `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(profile.id) >> 22n) % 6n)}.png`;
        return {
          id: profile.id,
          name: profile.global_name || profile.username,
          email: profile.email,
          image,
        };
      },
    })
  );
}

// Fallback invité si Discord n’est pas configuré
providers.push(
  Credentials({
    id: "guest",
    name: "Guest",
    credentials: {},
    async authorize() {
      return {
        id: "guest-user",
        name: "Invité RefGM",
        email: "guest@refgm.local",
        image: null,
      };
    },
  })
);

const nextAuth = NextAuth({
  trustHost: true,
  providers,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.sub = user.id;
        if (user.name) token.name = user.name;
        if (user.image) token.picture = user.image;
      }
      if (account) {
        const linked = account.provider === "discord";
        token.discordLinked = linked;
        token.discordId = linked ? account.providerAccountId : null;
        if (linked && account.providerAccountId) {
          token.sub = account.providerAccountId;
        }
        if (linked && typeof account.access_token === "string") {
          try {
            const { resolveDiscordStaffGrade } = await import(
              "@/lib/discord-grade-roles"
            );
            token.discordGrade = await resolveDiscordStaffGrade(
              account.access_token,
              account.providerAccountId
            );
          } catch {
            token.discordGrade = null;
          }
          try {
            const { fetchDiscordOauthUser } = await import(
              "@/lib/discord-rest"
            );
            const me = await fetchDiscordOauthUser(account.access_token);
            if (me) {
              token.name = me.username;
              token.picture = me.avatarUrl;
              token.discordBannerUrl = me.bannerUrl;
              token.discordDecorationUrl = me.decorationUrl;
              token.discordAccent = me.accent;
            }
          } catch {
            /* profil Discord optionnel */
          }
        }
      }
      return token as JWT;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.discordLinked = Boolean(token.discordLinked);
        session.user.discordId =
          typeof token.discordId === "string" ? token.discordId : null;
        session.user.discordGrade =
          typeof token.discordGrade === "string" ? token.discordGrade : null;
        session.user.discordBannerUrl =
          typeof token.discordBannerUrl === "string" ? token.discordBannerUrl : null;
        session.user.discordDecorationUrl =
          typeof token.discordDecorationUrl === "string"
            ? token.discordDecorationUrl
            : null;
        session.user.discordAccent =
          typeof token.discordAccent === "string" ? token.discordAccent : null;
        if (typeof token.name === "string") session.user.name = token.name;
        if (typeof token.picture === "string") session.user.image = token.picture;
      }
      return session;
    },
  },
});

export const { handlers, signIn, signOut } = nextAuth;

/** Déduplique auth() layout + page dans la même requête RSC. */
export const auth = cache(nextAuth.auth);

export const isDiscordConfigured = discordReady;
