import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { LanguageModel, ModelMessage, streamText } from "ai";
import { config } from "../../../config/gemini.config";

export class AiService {
  private model: LanguageModel;
  constructor() {
    if (!config.googleApiKey) {
      throw new Error("Gemini api key not set in env !!");
    }

    if (!config.model) {
      throw new Error("Gemini model not set in env !!");
    }

    const google = createGoogleGenerativeAI({
      apiKey: config.googleApiKey,
    });

    this.model = google(config.model);
  }

  // /**
  //  * @params {Array} messages
  //  * @params {Function} onChunk
  //  * @params {Object} tools
  //  * @params {Function} onToolCall
  //  * @returns {Promise<Object>}
  //  */

  async sendMessage(
    messages: ModelMessage[],
    onChunk: (chunk: string) => void,
    tools = undefined,
    onToolCall = null,
  ) {
    try {
      const streamConfig = {
        model: this.model,
        messages: messages,
      };
      const result = streamText(streamConfig);

      let fullResponse = "";

      for await (const chunk of result.textStream) {
        fullResponse += chunk;
        if (onChunk) {
          onChunk(chunk);
        }
      }

      const fullResult = result;

      return {
        content: fullResponse,
        finishResponse: fullResult.finishReason,
        usage: fullResult.usage,
      };
    } catch (error) {}
  }

  //geting non streaming response

  async getMessage(messages: ModelMessage[], tools = undefined) {
    let fullResponse = "";
    await this.sendMessage(messages, (chunk) => {
      fullResponse += chunk;
    });

    return fullResponse;
  }
}
