import { Hono } from "hono";
import { cors } from "hono/cors";
import OpenAI from "openai";
import { Resource } from "sst";
import type { Bill, Politician } from "../src/types.ts";

type RefinePolicyInput = {
  text?: string;
};

type ScoreLobbyInput = {
  message?: string;
  politician?: Politician;
  bill?: Bill;
};

type PoliticianReplyInput = {
  message?: string;
  politician?: Politician;
  bill?: Bill;
};

export const app = new Hono();

app.use(
  "/api/*",
  cors({
    origin: "*",
    allowMethods: ["POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

app.options("/api/*", (c) => c.body(null, 204));

function openAiApiKey() {
  const linkedResource = Resource as typeof Resource & {
    OpenAIApiKey?: {
      value?: string;
    };
  };

  try {
    return linkedResource.OpenAIApiKey?.value ?? process.env.OPENAI_API_KEY;
  } catch {
    return process.env.OPENAI_API_KEY;
  }
}

const apiKey = openAiApiKey();
const openai = apiKey ? new OpenAI({ apiKey }) : null;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function fallbackBill(text: string): Bill {
  const lower = text.toLowerCase();
  const leftTerms = [
    "ubi",
    "universal basic income",
    "welfare",
    "housing",
    "climate",
    "wealth tax",
    "healthcare",
  ];
  const rightTerms = [
    "tax cut",
    "border",
    "deregulation",
    "police",
    "defense",
    "school choice",
  ];
  const leftHits = leftTerms.filter((term) => lower.includes(term)).length;
  const rightHits = rightTerms.filter((term) => lower.includes(term)).length;
  const lean = clamp((rightHits - leftHits) * 0.22, -0.85, 0.85);

  return {
    title: `${text.trim().split(/\s+/).slice(0, 5).join(" ") || "Public Interest"} Act`,
    summary: `Creates a legislative proposal around: ${text.trim() || "a general public policy idea"}.`,
    lean,
    tags: [
      "economy",
      "public policy",
      lean < -0.15 ? "equity" : lean > 0.15 ? "markets" : "bipartisan",
    ],
    affectedGroups: ["constituents", "taxpayers", "local communities"],
  };
}

function fallbackScore(
  message: string,
  politician: Politician | undefined,
  bill: Bill | undefined,
) {
  const lower = message.toLowerCase();
  const issues = [
    "jobs",
    "taxes",
    "healthcare",
    "security",
    "families",
    "small business",
    "local economy",
  ].filter((term) => lower.includes(term));
  const hostileTerms = [
    "idiot",
    "corrupt",
    "stupid",
    "traitor",
    "bribe",
    "blackmail",
    "threat",
    "destroy your career",
  ];
  const hostileHits = hostileTerms.filter((term) =>
    lower.includes(term),
  ).length;
  const dismissiveTerms = [
    "everyone knows",
    "obviously",
    "you people",
    "just vote yes",
    "do what i say",
  ];
  const dismissiveHits = dismissiveTerms.filter((term) =>
    lower.includes(term),
  ).length;
  const ideologyAlignment =
    politician && bill
      ? 1 - Math.min(2, Math.abs(politician.ideology - bill.lean)) / 2
      : 0.5;
  const partyConflict =
    politician && bill
      ? (politician.party === "D" && bill.lean > 0.25) ||
        (politician.party === "R" && bill.lean < -0.25)
      : false;
  const bipartisanTerms = [
    "bipartisan",
    "across the aisle",
    "both parties",
    "compromise",
  ];
  const partyBaseTerms =
    politician?.party === "D"
      ? ["working families", "equity", "healthcare", "labor", "climate"]
      : politician?.party === "R"
        ? ["taxpayers", "small business", "border", "freedom", "regulation"]
        : ["independent", "accountability", "pragmatic", "waste", "compromise"];
  const partyHits = partyBaseTerms.filter((term) => lower.includes(term)).length;
  const bipartisanHits = bipartisanTerms.filter((term) => lower.includes(term)).length;
  const specificity = Math.min(
    0.3,
    issues.length * 0.07 + partyHits * 0.09 + bipartisanHits * 0.05 + message.length / 900,
  );
  const penalty =
    hostileHits * 0.45 +
    dismissiveHits * 0.22 +
    (partyConflict && partyHits === 0 ? 0.22 : 0) +
    (ideologyAlignment < 0.35 && issues.length === 0 ? 0.18 : 0);
  const persuasion = clamp(
    0.18 + ideologyAlignment * 0.34 + specificity - penalty,
    -0.9,
    0.92,
  );

  return {
    persuasion: Number(persuasion.toFixed(2)),
    reason:
      persuasion < 0
        ? "The message damages trust by sounding hostile, dismissive, or disconnected from this member's incentives."
        : issues.length
          ? `The argument connects to ${issues.slice(0, 2).join(" and ")}, but this member is also weighing party pressure and ideological cover.`
          : "The argument is understandable but needs a clearer partisan or constituency-specific reason for this member to break or hold the party line.",
    key_issues:
      persuasion < 0
        ? ["trust loss", "poor fit"]
        : issues.length
          ? issues
          : ["party incentives", "general persuasion"],
  };
}

app.post("/api/refine-policy", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as RefinePolicyInput;
  const text = body.text?.trim() ?? "";

  if (!openai) {
    return c.json(fallbackBill(text));
  }

  try {
    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "Convert natural-language policy ideas into structured legislative bills. Return valid JSON only with title, summary, tags, lean, and affectedGroups. The lean is -1 hard left to +1 hard right. Do not include markdown.",
        },
        { role: "user", content: text },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "bill",
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["title", "summary", "tags", "lean", "affectedGroups"],
            properties: {
              title: { type: "string" },
              summary: { type: "string" },
              tags: { type: "array", items: { type: "string" } },
              lean: { type: "number", minimum: -1, maximum: 1 },
              affectedGroups: { type: "array", items: { type: "string" } },
            },
          },
          strict: true,
        },
      },
    });

    return c.json(JSON.parse(response.output_text) as Bill);
  } catch (error) {
    console.warn("Policy refinement failed; using fallback.", error);
    return c.json(fallbackBill(text));
  }
});

app.post("/api/score-lobby", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as ScoreLobbyInput;
  const message = body.message?.trim() ?? "";

  if (!openai) {
    return c.json(fallbackScore(message, body.politician, body.bill));
  }

  try {
    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "Score persuasive strength of a lobbying message for this politician and bill. You must not decide or predict a vote. Return JSON only with persuasion from -1 to 1, reason, and key_issues. Politicians should behave more partisan than neutral: Democrats are protective of Democratic priorities and wary of conservative framing; Republicans are protective of Republican priorities and wary of progressive framing; Independents want pragmatic distance from both parties. Reward arguments that give the member partisan cover, appeal to their base, or frame compromise as a party win. Penalize messages that ask them to betray their party without cover, use the opposing party's talking points, are hostile, vague, or politically costly.",
        },
        { role: "user", content: JSON.stringify(body) },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "lobby_score",
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["persuasion", "reason", "key_issues"],
            properties: {
              persuasion: { type: "number", minimum: -1, maximum: 1 },
              reason: { type: "string" },
              key_issues: { type: "array", items: { type: "string" } },
            },
          },
          strict: true,
        },
      },
    });

    return c.json(
      JSON.parse(response.output_text) as ReturnType<typeof fallbackScore>,
    );
  } catch (error) {
    console.warn("Lobby scoring failed; using fallback.", error);
    return c.json(fallbackScore(message, body.politician, body.bill));
  }
});

app.post("/api/politician-reply", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as PoliticianReplyInput;

  if (!openai) {
    const politician = body.politician;
    const trait = politician?.traits[0] ? ` As a ${politician.traits[0]},` : "";
    const partyLine =
      politician?.party === "D"
        ? " I also need to know why Democrats should own this fight."
        : politician?.party === "R"
          ? " I also need to know why Republicans should not see this as a giveaway to the other side."
          : " I also need to know why this is not just party politics dressed up as policy.";
    return c.text(
      `${trait} I hear the argument, but I need to see how this helps people back home before I move my position.${partyLine}`,
    );
  }

  try {
    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "Reply in character as the politician in 1-3 sentences. Be noticeably partisan, not generically civic-minded. Use bio, traits, party, state, and the bill summary. Democrats should sound protective of Democratic priorities, coalition groups, and attacks from the right. Republicans should sound protective of Republican priorities, taxpayers/business/security/freedom themes, and attacks from the left. Independents should sound skeptical of both party establishments. Make them ask for partisan cover, base-friendly framing, or district/state benefits before they move. Do not mention hidden scoring or vote logic.",
        },
        { role: "user", content: JSON.stringify(body) },
      ],
    });

    return c.text(response.output_text);
  } catch (error) {
    console.warn("Politician reply failed; using fallback.", error);
    const politician = body.politician;
    const partyLine =
      politician?.party === "D"
        ? " Show me how this helps our coalition and does not hand Republicans an attack line."
        : politician?.party === "R"
          ? " Show me how this fits conservative priorities and does not hand Democrats a spending win."
          : " Show me why this rises above both parties' talking points.";
    return c.text(
      `${politician?.name ?? "The member"} pauses before answering. I need an argument that connects this bill to my voters, not just a national talking point.${partyLine}`,
    );
  }
});
