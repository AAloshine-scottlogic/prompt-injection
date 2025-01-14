import { expect, test, jest, describe } from '@jest/globals';
import { Request, Response } from 'express';

import { handleResetProgress } from '@src/controller/resetController';
import { defaultDefences } from '@src/defaultDefences';
import { ChatMessage } from '@src/models/chatMessage';
import { DEFENCE_ID, Defence, DefenceConfigItem } from '@src/models/defence';
import { EmailInfo } from '@src/models/email';
import {
	LEVEL_NAMES,
	LevelState,
	getInitialLevelStates,
} from '@src/models/level';

function responseMock() {
	return {
		send: jest.fn(),
		status: jest.fn(),
	} as unknown as Response;
}

function createLevelObject(
	param: keyof LevelState,
	setTo: unknown
): Record<string, LevelState> {
	const obj: Record<string, LevelState> = {};
	Object.values(LEVEL_NAMES)
		.filter((value) => Number.isNaN(Number(value)))
		.forEach((value, index) => {
			obj[index.toString()] = {
				level: value as LEVEL_NAMES,
				chatHistory: param === 'chatHistory' ? setTo : [],
				defences: param === 'defences' ? setTo : defaultDefences,
				sentEmails: param === 'sentEmails' ? setTo : [],
			} as LevelState;
		});
	return obj;
}

describe('handleResetProgress unit tests', () => {
	test('GIVEN a chat history THEN should reset all chatHistory for all levels', () => {
		const mockChatHistory: ChatMessage[] = [
			{
				completion: {
					content: 'testing',
					role: 'assistant',
				},
				chatMessageType: 'BOT',
			},
		];
		const reqWithChatHistory = {
			session: {
				levelState: createLevelObject('chatHistory', mockChatHistory),
			},
		} as unknown as Request;

		const res = responseMock();
		handleResetProgress(reqWithChatHistory, res);
		expect(res.send).toHaveBeenCalledWith(getInitialLevelStates());
	});

	test('GIVEN sent emails THEN should reset emails for all levels', () => {
		const mockSentEmails: EmailInfo[] = [
			{ address: 'bob@example.com', subject: 'test', body: 'this is a test' },
		];
		const reqWithSentEmails = {
			session: {
				levelState: createLevelObject('sentEmails', mockSentEmails),
			},
		} as unknown as Request;

		const res = responseMock();
		handleResetProgress(reqWithSentEmails, res);
		expect(res.send).toHaveBeenCalledWith(getInitialLevelStates());
	});

	test('GIVEN defences THEN should reset defences for levels', () => {
		function configureAndActivateDefence(
			id: DEFENCE_ID,
			defences: Defence[],
			config: DefenceConfigItem[]
		): Defence[] {
			// return the updated list of defences
			return defences.map((defence) =>
				defence.id === id ? { ...defence, config, isActive: true } : defence
			);
		}
		const mockDefences = configureAndActivateDefence(
			DEFENCE_ID.CHARACTER_LIMIT,
			defaultDefences,
			[
				{
					id: 'MAX_MESSAGE_LENGTH',
					value: '10',
				},
			]
		);
		const reqWithDefences = {
			session: {
				levelState: createLevelObject('defences', mockDefences),
			},
		} as unknown as Request;

		const res = responseMock();
		handleResetProgress(reqWithDefences, res);
		expect(res.send).toHaveBeenCalledWith(getInitialLevelStates());
	});
});
