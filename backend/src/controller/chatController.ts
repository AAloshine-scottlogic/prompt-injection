import { Response } from 'express';

import {
	transformMessage,
	detectTriggeredInputDefences,
	detectTriggeredOutputDefences,
} from '@src/defence';
import { OpenAiAddInfoToChatHistoryRequest } from '@src/models/api/OpenAiAddInfoToChatHistoryRequest';
import { OpenAiChatRequest } from '@src/models/api/OpenAiChatRequest';
import { OpenAiClearRequest } from '@src/models/api/OpenAiClearRequest';
import {
	DefenceReport,
	ChatHttpResponse,
	ChatModel,
	LevelHandlerResponse,
	MessageTransformation,
	defaultChatModel,
} from '@src/models/chat';
import {
	ChatMessage,
	ChatInfoMessage,
	chatInfoMessageTypes,
} from '@src/models/chatMessage';
import { Defence } from '@src/models/defence';
import { EmailInfo } from '@src/models/email';
import { LEVEL_NAMES } from '@src/models/level';
import { chatGptSendMessage } from '@src/openai';
import {
	pushMessageToHistory,
	setSystemRoleInChatHistory,
} from '@src/utils/chat';

import { handleChatError } from './handleError';

function combineDefenceReports(reports: DefenceReport[]): DefenceReport {
	return {
		blockedReason: reports
			.filter((report) => report.blockedReason !== null)
			.map((report) => report.blockedReason)
			.join('\n'),
		isBlocked: reports.some((report) => report.isBlocked),
		alertedDefences: reports.flatMap((report) => report.alertedDefences),
		triggeredDefences: reports.flatMap((report) => report.triggeredDefences),
	};
}

function createNewUserMessages(
	message: string,
	messageTransformation?: MessageTransformation,
	createAs: 'completion' | 'info' = 'completion'
): ChatMessage[] {
	if (messageTransformation) {
		return [
			{
				chatMessageType: 'USER',
				infoMessage: message,
			},
			{
				chatMessageType: 'GENERIC_INFO',
				infoMessage: messageTransformation.transformedMessageInfo,
			},
			{
				completion:
					createAs === 'completion'
						? {
								role: 'user',
								content: messageTransformation.transformedMessageCombined,
						  }
						: undefined,
				chatMessageType: 'USER_TRANSFORMED',
				transformedMessage: messageTransformation.transformedMessage,
			},
		];
	} else {
		return [
			createAs === 'completion'
				? {
						completion: {
							role: 'user',
							content: message,
						},
						chatMessageType: 'USER',
				  }
				: {
						chatMessageType: 'USER',
						infoMessage: message,
				  },
		];
	}
}

async function handleChatWithoutDefenceDetection(
	message: string,
	chatResponse: ChatHttpResponse,
	currentLevel: LEVEL_NAMES,
	chatModel: ChatModel,
	chatHistory: ChatMessage[],
	defences: Defence[]
): Promise<LevelHandlerResponse> {
	console.log(`User message: '${message}'`);

	const updatedChatHistory = createNewUserMessages(message).reduce(
		pushMessageToHistory,
		chatHistory
	);

	const openAiReply = await chatGptSendMessage(
		updatedChatHistory,
		defences,
		chatModel,
		currentLevel
	);

	const updatedChatResponse: ChatHttpResponse = {
		...chatResponse,
		reply: openAiReply.chatResponse.completion?.content?.toString() ?? '',
		wonLevel: openAiReply.chatResponse.wonLevel,
		openAIErrorMessage: openAiReply.chatResponse.openAIErrorMessage,
		sentEmails: openAiReply.sentEmails,
	};
	return {
		chatResponse: updatedChatResponse,
		chatHistory: openAiReply.chatHistory,
	};
}

async function handleChatWithDefenceDetection(
	message: string,
	chatResponse: ChatHttpResponse,
	currentLevel: LEVEL_NAMES,
	chatModel: ChatModel,
	chatHistory: ChatMessage[],
	defences: Defence[]
): Promise<LevelHandlerResponse> {
	const messageTransformation = transformMessage(message, defences);
	const chatHistoryWithNewUserMessages = createNewUserMessages(
		message,
		messageTransformation
	).reduce(pushMessageToHistory, chatHistory);

	const triggeredInputDefencesPromise = detectTriggeredInputDefences(
		message,
		defences
	);

	console.log(
		`User message: '${
			messageTransformation?.transformedMessageCombined ?? message
		}'`
	);

	const openAiReplyPromise = chatGptSendMessage(
		chatHistoryWithNewUserMessages,
		defences,
		chatModel,
		currentLevel
	);

	// run input defence detection and chatGPT concurrently
	const [inputDefenceReport, openAiReply] = await Promise.all([
		triggeredInputDefencesPromise,
		openAiReplyPromise,
	]);

	const botReply = openAiReply.chatResponse.completion?.content?.toString();
	const outputDefenceReport = botReply
		? detectTriggeredOutputDefences(botReply, defences)
		: null;

	const defenceReports = outputDefenceReport
		? [inputDefenceReport, outputDefenceReport]
		: [inputDefenceReport];
	const combinedDefenceReport = combineDefenceReports(defenceReports);

	// if blocked, restore original chat history and add user message to chat history without completion
	const updatedChatHistory = combinedDefenceReport.isBlocked
		? createNewUserMessages(message, messageTransformation, 'info').reduce(
				pushMessageToHistory,
				chatHistory
		  )
		: openAiReply.chatHistory;

	const updatedChatResponse: ChatHttpResponse = {
		...chatResponse,
		defenceReport: combinedDefenceReport,
		openAIErrorMessage: openAiReply.chatResponse.openAIErrorMessage,
		reply: !combinedDefenceReport.isBlocked && botReply ? botReply : '',
		transformedMessage: messageTransformation?.transformedMessage,
		wonLevel:
			openAiReply.chatResponse.wonLevel && !combinedDefenceReport.isBlocked,
		sentEmails: combinedDefenceReport.isBlocked ? [] : openAiReply.sentEmails,
		transformedMessageInfo: messageTransformation?.transformedMessageInfo,
	};
	return {
		chatResponse: updatedChatResponse,
		chatHistory: updatedChatHistory,
	};
}

async function handleChatToGPT(req: OpenAiChatRequest, res: Response) {
	const initChatResponse: ChatHttpResponse = {
		reply: '',
		defenceReport: {
			blockedReason: null,
			isBlocked: false,
			alertedDefences: [],
			triggeredDefences: [],
		},
		wonLevel: false,
		isError: false,
		openAIErrorMessage: null,
		sentEmails: [],
	};
	const { message, currentLevel } = req.body;

	if (!message || currentLevel === undefined) {
		handleChatError(
			res,
			initChatResponse,
			'Missing or empty message or level',
			400
		);
		return;
	}

	const MESSAGE_CHARACTER_LIMIT = 16384;
	if (message.length > MESSAGE_CHARACTER_LIMIT) {
		handleChatError(
			res,
			initChatResponse,
			'Message exceeds character limit',
			400
		);
		return;
	}

	// use default model for levels, allow user to select in sandbox
	const chatModel =
		currentLevel === LEVEL_NAMES.SANDBOX
			? req.session.chatModel
			: defaultChatModel;

	const currentChatHistory = setSystemRoleInChatHistory(
		currentLevel,
		req.session.levelState[currentLevel].defences,
		req.session.levelState[currentLevel].chatHistory
	);

	const defences = [...req.session.levelState[currentLevel].defences];

	let levelResult: LevelHandlerResponse;
	try {
		if (currentLevel < LEVEL_NAMES.LEVEL_3) {
			levelResult = await handleChatWithoutDefenceDetection(
				message,
				initChatResponse,
				currentLevel,
				chatModel,
				currentChatHistory,
				defences
			);
		} else {
			levelResult = await handleChatWithDefenceDetection(
				message,
				initChatResponse,
				currentLevel,
				chatModel,
				currentChatHistory,
				defences
			);
		}
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : 'Failed to get chatGPT reply';
		req.session.levelState[currentLevel].chatHistory = addErrorToChatHistory(
			currentChatHistory,
			errorMessage
		);
		handleChatError(res, initChatResponse, errorMessage, 500);
		return;
	}

	let updatedChatHistory = levelResult.chatHistory;

	const totalSentEmails: EmailInfo[] = [
		...req.session.levelState[currentLevel].sentEmails,
		...levelResult.chatResponse.sentEmails,
	];

	const updatedChatResponse: ChatHttpResponse = {
		...initChatResponse,
		...levelResult.chatResponse,
	};

	if (updatedChatResponse.defenceReport.isBlocked) {
		updatedChatHistory = pushMessageToHistory(updatedChatHistory, {
			chatMessageType: 'BOT_BLOCKED',
			infoMessage:
				updatedChatResponse.defenceReport.blockedReason ??
				'block reason unknown',
		});
	} else if (updatedChatResponse.openAIErrorMessage) {
		const errorMsg = simplifyOpenAIErrorMessage(
			updatedChatResponse.openAIErrorMessage
		);
		req.session.levelState[currentLevel].chatHistory = addErrorToChatHistory(
			updatedChatHistory,
			errorMsg
		);
		handleChatError(res, updatedChatResponse, errorMsg, 500);
		return;
	} else if (!updatedChatResponse.reply) {
		const errorMsg = 'Failed to get chatGPT reply';
		req.session.levelState[currentLevel].chatHistory = addErrorToChatHistory(
			updatedChatHistory,
			errorMsg
		);
		handleChatError(res, updatedChatResponse, errorMsg, 500);
		return;
	} else {
		updatedChatHistory = pushMessageToHistory(updatedChatHistory, {
			completion: {
				role: 'assistant',
				content: updatedChatResponse.reply,
			},
			chatMessageType: 'BOT',
		});
	}

	req.session.levelState[currentLevel].chatHistory = updatedChatHistory;
	req.session.levelState[currentLevel].sentEmails = totalSentEmails;

	console.log('chatResponse: ', updatedChatResponse);
	console.log('chatHistory: ', updatedChatHistory);

	res.send(updatedChatResponse);
}

function simplifyOpenAIErrorMessage(openAIErrorMessage: string) {
	if (openAIErrorMessage.startsWith('429')) {
		const tryAgainMessage = openAIErrorMessage
			.split('. ')
			.find((sentence) => sentence.includes('Please try again in'));
		return `I'm receiving too many requests. ${tryAgainMessage}. You can upgrade your open AI key to increase the rate limit.`;
	} else {
		return 'Failed to get ChatGPT reply.';
	}
}

function addErrorToChatHistory(
	chatHistory: ChatMessage[],
	errorMessage: string
): ChatMessage[] {
	console.error(errorMessage);
	return pushMessageToHistory(chatHistory, {
		chatMessageType: 'ERROR_MSG',
		infoMessage: errorMessage,
	});
}

function handleAddInfoToChatHistory(
	req: OpenAiAddInfoToChatHistoryRequest,
	res: Response
) {
	const { infoMessage, chatMessageType, level } = req.body;
	if (
		infoMessage &&
		chatMessageType &&
		chatInfoMessageTypes.includes(chatMessageType) &&
		level !== undefined &&
		level >= LEVEL_NAMES.LEVEL_1
	) {
		req.session.levelState[level].chatHistory = pushMessageToHistory(
			req.session.levelState[level].chatHistory,
			{
				chatMessageType,
				infoMessage,
			} as ChatInfoMessage
		);
		res.send();
	} else {
		res.status(400);
		res.send();
	}
}

function handleClearChatHistory(req: OpenAiClearRequest, res: Response) {
	const level = req.body.level;
	if (level !== undefined && level >= LEVEL_NAMES.LEVEL_1) {
		req.session.levelState[level].chatHistory = [];
		console.debug('ChatGPT messages cleared');
		res.send();
	} else {
		res.status(400);
		res.send();
	}
}

export { handleChatToGPT, handleAddInfoToChatHistory, handleClearChatHistory };
