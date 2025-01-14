import { DEFENCE_ID } from './defence';
import { EmailInfo } from './email';

type CHAT_MESSAGE_TYPE =
	| 'BOT'
	| 'BOT_BLOCKED'
	| 'GENERIC_INFO'
	| 'USER'
	| 'USER_TRANSFORMED'
	| 'LEVEL_INFO'
	| 'DEFENCE_ALERTED'
	| 'DEFENCE_TRIGGERED'
	| 'SYSTEM'
	| 'FUNCTION_CALL'
	| 'ERROR_MSG'
	| 'RESET_LEVEL';

enum MODEL_CONFIG {
	TEMPERATURE = 'temperature',
	TOP_P = 'topP',
	FREQUENCY_PENALTY = 'frequencyPenalty',
	PRESENCE_PENALTY = 'presencePenalty',
}

interface ChatModel {
	id: string;
	configuration: ChatModelConfigurations;
}

interface ChatModelConfigurations {
	temperature: number;
	topP: number;
	frequencyPenalty: number;
	presencePenalty: number;
}

interface CustomChatModelConfiguration {
	id: MODEL_CONFIG;
	name: string;
	info: string;
	value: number;
	min: number;
	max: number;
}

interface DefenceReport {
	blockedReason: string;
	isBlocked: boolean;
	alertedDefences: DEFENCE_ID[];
	triggeredDefences: DEFENCE_ID[];
}

interface ChatMessage {
	message: string;
	transformedMessage?: TransformedChatMessage;
	type: CHAT_MESSAGE_TYPE;
}

interface TransformedChatMessage {
	preMessage: string;
	message: string;
	postMessage: string;
	transformationName: string;
}

interface ChatResponse {
	reply: string;
	defenceReport: DefenceReport;
	transformedMessage?: TransformedChatMessage;
	wonLevel: boolean;
	isError: boolean;
	sentEmails: EmailInfo[];
	transformedMessageInfo?: string;
}

interface ChatCompletionRequestMessage {
	role: string;
	name: string | null;
	content: string;
}

interface ChatMessageDTO {
	completion: ChatCompletionRequestMessage | null;
	chatMessageType: CHAT_MESSAGE_TYPE;
	infoMessage: string | null | undefined;
	transformedMessage?: TransformedChatMessage;
}

export type {
	ChatMessage,
	ChatResponse,
	ChatMessageDTO,
	ChatModel,
	ChatModelConfigurations,
	CustomChatModelConfiguration,
	CHAT_MESSAGE_TYPE,
};
export { MODEL_CONFIG };
