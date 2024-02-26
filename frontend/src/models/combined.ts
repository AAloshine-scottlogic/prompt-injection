import { ChatMessageDTO } from './chat';
import { DefenceDTO } from './defence';
import { EmailInfo } from './email';
import { LevelSystemRole } from './level';

type StartReponse = {
	emails: EmailInfo[];
	chatHistory: ChatMessageDTO[];
	defences: DefenceDTO[];
	availableModels: string[];
	systemRoles: LevelSystemRole[];
};

export type { StartReponse };