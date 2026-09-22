import { NextResponse } from "next/server";
import { canProposeMissions } from "@/lib/permissions";
import {
  jsonAuthError,
  requireApprovedAccount,
} from "@/lib/server-authorization";

export const runtime = "nodejs";

type Idea = {
  title: string;
  summary: string;
  duration: string;
  tags: string[];
};

function localIdeas(prompt: string): Idea[] {
  const p = prompt.trim().toLowerCase() || "braquage";
  const seeds: Idea[] = [
    {
      title: `Opération « ${prompt.trim().slice(0, 28) || "Sans nom"} »`,
      summary: `Scénario RP centré sur : ${prompt.trim() || "un objectif libre"}. Les joueurs préparent, exécutent, puis gèrent les conséquences (flics / rivaux).`,
      duration: "45–90 min",
      tags: ["RP", "préparation", "tension"],
    },
    {
      title: "Course contre la montre",
      summary: `Limiter le temps IG pour ${p}. Ajoute un twist à mi-mission (trahison, panne, témoin).`,
      duration: "30–60 min",
      tags: ["timer", "twist"],
    },
    {
      title: "Négociation sous pression",
      summary: `L’objectif « ${prompt.trim() || "…"} » passe par une négociation publique, puis un choix moral qui change la fin.`,
      duration: "40–70 min",
      tags: ["dialogue", "choix"],
    },
    {
      title: "Double agenda",
      summary: `Deux groupes poursuivent le même objectif (${prompt.trim() || "mission"}) sans le savoir. Collision finale.`,
      duration: "60–120 min",
      tags: ["multi-groupes", "collision"],
    },
    {
      title: "Aftermath",
      summary: `Mission courte : gérer les retombées après ${p} (médias, PF, dettes, blessés).`,
      duration: "25–45 min",
      tags: ["conséquences", "soft"],
    },
  ];
  return seeds;
}

async function fromGroq(prompt: string): Promise<Idea[] | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
          temperature: 0.8,
          messages: [
            {
              role: "system",
              content:
                "Tu es un game designer RP GTA/FiveM. Réponds UNIQUEMENT en JSON : {\"ideas\":[{\"title\",\"summary\",\"duration\",\"tags\":string[]}]} avec 4 à 5 idées en français.",
            },
            {
              role: "user",
              content: `Objectif / brief GM : ${prompt}`,
            },
          ],
        }),
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = data.choices?.[0]?.message?.content ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as { ideas?: Idea[] };
    if (!Array.isArray(parsed.ideas) || !parsed.ideas.length) return null;
    return parsed.ideas.slice(0, 5);
  } catch {
    return null;
  }
}

const hits = new Map<string, number[]>();

function rateLimited(userId: string) {
  const now = Date.now();
  const windowMs = 60_000;
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= 8) {
    hits.set(userId, recent);
    return true;
  }
  recent.push(now);
  hits.set(userId, recent);
  return false;
}

export async function POST(req: Request) {
  try {
    const actor = await requireApprovedAccount();
    if (!canProposeMissions(actor.grade)) {
      return NextResponse.json({ error: "Permission insuffisante." }, { status: 403 });
    }
    if (rateLimited(actor.userId)) {
      return NextResponse.json({ error: "Trop de demandes, réessaie dans une minute." }, { status: 429 });
    }

    let prompt = "";
    try {
      const body = (await req.json()) as { prompt?: string };
      prompt = String(body.prompt ?? "").trim().slice(0, 400);
    } catch {
      prompt = "";
    }
    if (!prompt) {
      return NextResponse.json(
        { error: "Décris un objectif ou un thème." },
        { status: 400 }
      );
    }

    const remote = await fromGroq(prompt);
    const ideas = remote ?? localIdeas(prompt);
    return NextResponse.json({
      ideas,
      source: remote ? "groq" : "local",
    });
  } catch (error) {
    if (error instanceof Response) {
      const denied = await jsonAuthError(error);
      const body = await denied.json();
      return NextResponse.json(body, { status: denied.status });
    }
    return NextResponse.json({ error: "Impossible de générer des idées." }, { status: 500 });
  }
}
