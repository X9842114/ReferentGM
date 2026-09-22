import type { CSSProperties, ReactNode } from "react";
import { Layers3, ShieldCheck } from "lucide-react";
import Image from "next/image";

type HomeHeadingProps = {
  name: string;
  grade: string;
  action: ReactNode;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  decorationUrl?: string | null;
  accentColor?: string | null;
};

export function HomeHeading({ name, grade, action, avatarUrl, bannerUrl, decorationUrl, accentColor }: HomeHeadingProps) {
  const initial = name.trim().slice(0, 1).toUpperCase() || "R";
  const accent = /^#[0-9a-f]{6}$/i.test(accentColor || "") ? accentColor! : "#a78bfa";

  return <>
    <div className="refgm-topline"><span><Layers3 size={16} aria-hidden /> Espace de travail <span className="refgm-divider">/</span> <strong>Accueil</strong></span><span className="refgm-grade">{grade}</span></div>
    <header className="refgm-discord-card" style={{ "--discord-accent": accent } as CSSProperties}>
      <div className="refgm-discord-banner">
        {bannerUrl ? <Image src={bannerUrl} alt="Bannière Discord" fill priority sizes="(max-width: 1024px) 100vw, 1200px" className="object-cover" /> : null}
        <div className="refgm-discord-banner-fallback" />
        <div className="refgm-discord-banner-shade" />
      </div>
      <div className="refgm-discord-content">
        <div className="refgm-discord-avatar-wrap">
          <div className="refgm-discord-avatar">
            {avatarUrl ? <Image src={avatarUrl} alt={`Avatar Discord de ${name}`} fill priority sizes="112px" className="object-cover" /> : <span>{initial}</span>}
          </div>
          {decorationUrl ? <Image src={decorationUrl} alt="Décoration d’avatar Discord" fill priority unoptimized sizes="142px" className="refgm-discord-decoration" /> : null}
          <span className="refgm-discord-online" title="Compte Discord connecté" />
        </div>
        <div className="refgm-discord-identity">
          <p className="refgm-eyebrow">PROFIL DISCORD</p>
          <h1>{name}</h1>
          <div className="refgm-discord-role"><ShieldCheck size={14} />{grade}</div>
          <p>Bienvenue dans ton espace Référent GM. Retrouve tes missions, demandes et prochaines actions.</p>
        </div>
        <div className="refgm-discord-action">{action}</div>
      </div>
    </header>
  </>;
}
