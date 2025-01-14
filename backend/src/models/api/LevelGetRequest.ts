import { Request } from 'express';

import { ChatMessage } from '@src/models/chatMessage';
import { Defence } from '@src/models/defence';
import { EmailInfo } from '@src/models/email';
import { LEVEL_NAMES } from '@src/models/level';

export type LevelGetRequest = Request<
	never,
	{
		emails: EmailInfo[];
		chatHistory: ChatMessage[];
		defences: Defence[];
	},
	never,
	{
		level?: LEVEL_NAMES;
	}
>;
