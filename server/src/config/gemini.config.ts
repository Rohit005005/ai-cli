import "dotenv/config";

export const config = {
  googleApiKey: process.env.GEMINI_API_KEY,
  model: process.env.AI_MODEL,
};
