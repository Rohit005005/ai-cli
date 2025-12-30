import chalk from "chalk";
import boxen from "boxen";
import { marked } from "marked";
import { intro, outro, cancel, isCancel, text } from "@clack/prompts";
import yoctoSpinner from "yocto-spinner";
import { AiService } from "../services/ai.service";
import {
  addMessageType,
  ChatService,
  messagesType,
} from "../services/chat.service";
import { getStoredToken } from "../../../lib/token";
import { prisma } from "../../../lib/prisma";
import { ModelMessage } from "ai";
import TerminalRenderer from "marked-terminal";

export type startChatType = {
  mode: string;
  conversationId?: string | null;
};

export type initConversationType = {
  userId: string;
  mode: string;
  conversationId: string | null;
};

export type updateConversationTitleType = {
  conversationId: string;
  userInput: string;
  messageCount: number;
};

export type conversationType = {
  id: string;
  userId: string;
  title: string | null;
  mode: string;
  createdAt: Date;
  updatedAt: Date;
};

const terminalRenderer = new TerminalRenderer({
  code: chalk.cyan,
  blockquote: chalk.gray.italic,
  heading: chalk.green.bold,
  firstHeading: chalk.magenta.underline.bold,
  hr: chalk.reset,
  listitem: chalk.reset,
  list: chalk.reset,
  paragraph: chalk.reset,
  strong: chalk.bold,
  em: chalk.italic,
  codespan: chalk.yellow.bgBlack,
  del: chalk.dim.gray.strikethrough,
  link: chalk.blue.underline,
  href: chalk.blue.underline,
});

const aiService = new AiService();
const chatService = new ChatService();

async function getUserFromToken() {
  const token = await getStoredToken();
  if (!token) {
    throw new Error("Not authenticated. Please run 'ai-cli login' first.");
  }
  const spinner = yoctoSpinner({ text: "Authenticating..." }).start();

  const user = await prisma.user.findFirst({
    where: {
      sessions: {
        some: { token: token.access_token },
      },
    },
  });

  if (!user) {
    spinner.error("User not found");
    throw new Error("User not found. Please logi again.");
  }

  spinner.success(`Welcome back, ${user.name}`);

  return user;
}

async function initConversation({
  userId,
  conversationId = null,
  mode = "chat",
}: initConversationType) {
  const spinner = yoctoSpinner({ text: "Loading conversation..." }).start();

  const conversation = await chatService.getOrCreateConversation({
    userId,
    conversationId,
    mode,
  });

  spinner.success("Conversation Loaded !!");

  const conversationInfoBox = boxen(
    `${chalk.bold("Conversation: " + conversation.title)}\n ${chalk.gray("ID: " + conversation.id)}\n ${chalk.gray("Mode: " + conversation.mode)}`,
    {
      padding: 1,
      borderColor: "cyan",
      margin: { top: 1, bottom: 1 },
      borderStyle: "round",
      title: "Chat session",
      titleAlignment: "center",
    },
  );

  console.log(conversationInfoBox);

  if (conversation.messages.length > 0) {
    console.log(chalk.yellow("Previous messages: "));
    displayMessages(conversation.messages);
  }

  return conversation;
}

async function displayMessages(messages: messagesType[]) {
  for (const msg of messages) {
    if (msg.role === "user") {
      const userBox = boxen(chalk.white(msg.content), {
        padding: 1,
        margin: { left: 2, bottom: 1 },
        borderStyle: "round",
        borderColor: "blue",
        title: "You",
        titleAlignment: "left",
      });
      console.log(userBox);
    } else {
      const renderedContent = await marked.parse(msg.content, {
        renderer: terminalRenderer as any,
      });
      const assistantBox = boxen(renderedContent.trim(), {
        padding: 1,
        margin: { left: 2, bottom: 1 },
        borderColor: "green",
        borderStyle: "round",
        title: "Assistant",
        titleAlignment: "left",
      });
      console.log(assistantBox);
    }
  }
}

async function saveMessage({ conversationId, content, role }: addMessageType) {
  return await chatService.addMessage({ conversationId, role, content });
}

async function updateConversationTitle({
  conversationId,
  messageCount,
  userInput,
}: updateConversationTitleType) {
  if (messageCount === 1) {
    const title = userInput.slice(0, 50) + (userInput.length > 50 ? "..." : "");
    await chatService.updateTitle({ conversationId, title });
  }
}

async function getAiResponse(conversationId: string) {
  const spinner = yoctoSpinner({
    text: "Ai is thinking...",
    color: "cyan",
  }).start();

  const messages = await chatService.getMessages({ conversationId });

  const aiMessages = chatService.formatMessagesForAi(messages);

  let fullResponse = "";

  let isFirstChunk = true;

  try {
    const result = await aiService.sendMessage(
      aiMessages as ModelMessage[],
      (chunk) => {
        if (isFirstChunk) {
          spinner.stop();
          console.log("\n");
          console.log(chalk.green.bold("Assistant: "));
          console.log(chalk.gray("-".repeat(60)));
          isFirstChunk = false;
        }
        fullResponse += chunk;
      },
    );

    console.log("\n");
    const renderedMarkdown = marked.parse(fullResponse, {
      renderer: terminalRenderer as any,
    });
    console.log(renderedMarkdown);
    console.log(chalk.gray("-".repeat(60)));
    console.log("\n");

    return result?.content;
  } catch (error) {
    spinner.error("Failed to get AI Response !!");
    throw error;
  }
}

async function chatLoop(conversation: conversationType) {
  const helpBox = boxen(
    `${chalk.gray("Type your message and press enter")}\n ${chalk.gray("Markdown formatting is supported in responses")}\n ${chalk.gray("Type 'exit' to end conversation")}\n ${chalk.gray("Press ctrl+c to quit anytime")}`,
    {
      padding: 1,
      margin: { bottom: 1 },
      borderColor: "gray",
      borderStyle: "round",
      dimBorder: true,
    },
  );

  console.log(helpBox);

  while (true) {
    const userInput = await text({
      message: chalk.blue("Your message"),
      placeholder: "Type your message...",
      validate(value) {
        if (!value || value.trim().length === 0) {
          return "Message can't be empty";
        }
      },
    });

    if (isCancel(userInput)) {
      const exitBox = boxen(chalk.yellow("Chat session ended !!"), {
        padding: 1,
        margin: 1,
        borderStyle: "round",
        backgroundColor: "yellow",
      });

      console.log(exitBox);
      process.exit(0);
    }

    if (userInput.toLowerCase() === "exit") {
      const exitBox = boxen(chalk.yellow("Chat session ended !!"), {
        padding: 1,
        margin: 1,
        borderStyle: "round",
        backgroundColor: "yellow",
      });

      console.log(exitBox);
      break;
    }

    await saveMessage({
      conversationId: conversation.id,
      content: userInput,
      role: "user",
    });

    const messages = await chatService.getMessages({
      conversationId: conversation.id,
    });

    const aiResponse = await getAiResponse(conversation.id);

    if (!aiResponse) {
      console.log(chalk.red("Failed to get AI response !!"));
      break;
    }

    await saveMessage({
      conversationId: conversation.id,
      content: aiResponse,
      role: "assistant",
    });

    await updateConversationTitle({
      conversationId: conversation.id,
      messageCount: messages.length,
      userInput: userInput,
    });
  }
}

export async function startChat({
  mode = "chat",
  conversationId = null,
}: startChatType) {
  try {
    intro(
      boxen(chalk.cyan("Ai Cli Chat"), {
        padding: 1,
        borderStyle: "double",
        borderColor: "cyan",
      }),
    );

    const user = await getUserFromToken();
    const conversation = await initConversation({
      userId: user.id,
      conversationId,
      mode,
    });
    await chatLoop(conversation);

    outro(chalk.green("Thanks for Chatting"));
  } catch (error) {
    const errorBox = boxen(chalk.red(`Error: ${error}`), {
      padding: 1,
      borderStyle: "round",
      borderColor: "red",
    });

    console.log(errorBox);
    process.exit(1);
  }
}
