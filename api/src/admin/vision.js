import Anthropic from "@anthropic-ai/sdk";

// Lecture d'une photo de carte par Claude (API Anthropic, clé ANTHROPIC_API_KEY dans .env).
// Le modèle est obligé d'appeler l'outil record_card : la réponse est toujours un JSON structuré.
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

const RECORD_CARD_TOOL = {
  name: "record_card",
  description: "Enregistre les informations lues sur la photo d'une carte à collectionner.",
  input_schema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description:
          "Nom du personnage ou de la carte en alphabet latin, tel que connu des fans anglophones (ex. « Satoru Gojo »). Prénom puis nom de famille comme dans les versions anglaises de l'anime.",
      },
      name_original: {
        type: "string",
        description: "Le nom tel qu'il est imprimé sur la carte (chinois, japonais…). Vide s'il n'y en a pas.",
      },
      rarity: {
        type: "string",
        description: "Code de rareté imprimé sur la carte, en majuscules (ex. SSR, SE, UR, SR, R).",
      },
      number: {
        type: "string",
        description: "Numéro imprimé avec la rareté, seulement les chiffres (ex. « 12 » pour SSR-012).",
      },
      printed_code: {
        type: "string",
        description: "Le code complet tel qu'imprimé (ex. « SSR-012 » ou « JJK01-SSR-012 »). Vide s'il est illisible.",
      },
      confidence: {
        type: "string",
        enum: ["high", "medium", "low"],
        description: "high : rareté, numéro et nom bien lisibles. low : un des trois est deviné.",
      },
      notes: {
        type: "string",
        description: "Courte remarque en français si quelque chose est incertain (reflet, carte coupée, nom inconnu…).",
      },
    },
    required: ["name", "rarity", "number", "confidence"],
  },
};

let client;

export async function readCard(imageBuffer, context) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY manquante dans .env");
  }
  client ??= new Anthropic();

  const hints = [
    `Jeu : ${context.gameName}`,
    `Set : ${context.setName} (${context.setCode})`,
    context.rarities?.length ? `Raretés connues dans ce set : ${context.rarities.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    tools: [RECORD_CARD_TOOL],
    tool_choice: { type: "tool", name: "record_card" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: "image/webp", data: imageBuffer.toString("base64") },
          },
          {
            type: "text",
            text: `Voici la photo d'une carte à collectionner.\n${hints}\n\nLis le code de rareté et le numéro imprimés sur la carte, et identifie le personnage. N'invente rien : si une information est illisible, mets confidence à low et explique dans notes.`,
          },
        ],
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse) throw new Error("Réponse de Claude sans record_card");
  return toolUse.input;
}
