import { sendRequest } from "./backendService";

const PATH = "openai/";

interface OpenAIDefenceInfo {
  blocked: boolean;
  triggeredDefences: string[];
}

interface OpenAIMessage {
  isUser: boolean;
  defenceInfo?: OpenAIDefenceInfo;
  message: string;
  isOriginalMessage: boolean;
}

interface OpenAIResponse {
  reply: string;
  defenceInfo: OpenAIDefenceInfo;
  transformedMessage: string;
}

const clearOpenAiChat = async (): Promise<boolean> => {
  const response = await sendRequest(PATH + "clear", "POST");
  return response.status === 200;
};

const openAiSendMessage = async (message: string): Promise<OpenAIResponse> => {
  const response = await sendRequest(
    PATH + "chat",
    "POST",
    { "Content-Type": "application/json" },
    JSON.stringify({ message })
  );
  const data = await response.json();
  console.log(data);
  return data;
};

export { clearOpenAiChat, openAiSendMessage };
export type { OpenAIMessage, OpenAIResponse };
