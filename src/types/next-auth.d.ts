import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      discordLinked: boolean;
      discordId?: string | null;
      discordGrade?: string | null;
      discordBannerUrl?: string | null;
      discordDecorationUrl?: string | null;
      discordAccent?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    discordLinked?: boolean;
    discordId?: string | null;
    discordGrade?: string | null;
    discordBannerUrl?: string | null;
    discordDecorationUrl?: string | null;
    discordAccent?: string | null;
  }
}
