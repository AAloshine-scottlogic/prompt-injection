import { getValidModelsFromOpenAI } from '@src/openai';

// Define a mock implementation for the createChatCompletion method
const mockCreateChatCompletion = jest.fn();
let mockModelList: { id: string }[] = [];
jest.mock('openai', () => ({
	OpenAI: jest.fn().mockImplementation(() => ({
		chat: {
			completions: {
				create: mockCreateChatCompletion,
			},
		},
		models: {
			list: jest.fn().mockImplementation(() => ({
				data: mockModelList,
			})),
		},
	})),
}));

jest.mock('@src/openai', () => {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const originalModule = jest.requireActual('@src/openai');
	// eslint-disable-next-line @typescript-eslint/no-unsafe-return
	return {
		...originalModule,
		initOpenAi: jest.fn(),
		getOpenAI: jest.fn(),
	};
});

jest.mock('@src/langchain', () => {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const originalModule = jest.requireActual('@src/langchain');
	// eslint-disable-next-line @typescript-eslint/no-unsafe-return
	return {
		...originalModule,
		initQAModel: jest.fn(),
		initDocumentVectors: jest.fn(),
	};
});

beforeEach(() => {
	// clear environment variables
	process.env = {};
});
afterEach(() => {
	mockCreateChatCompletion.mockReset();
	jest.clearAllMocks();
});

describe('unit test getValidModelsFromOpenAI', () => {
	test('GIVEN the user has an openAI key WHEN getValidModelsFromOpenAI is called THEN it returns the models in CHAT_MODELS enum', async () => {
		process.env.OPENAI_API_KEY = 'sk-12345';
		mockModelList = [
			{ id: 'gpt-3.5-turbo' },
			{ id: 'gpt-3.5-turbo-0613' },
			{ id: 'gpt-4' },
			{ id: 'gpt-4-0613' },
			{ id: 'da-vinci-1' },
			{ id: 'da-vinci-2' },
		];
		const expectedValidModels = [
			'gpt-3.5-turbo',
			'gpt-3.5-turbo-0613',
			'gpt-4',
			'gpt-4-0613',
		];
		const validModels = await getValidModelsFromOpenAI();
		expect(validModels).toEqual(expectedValidModels);
	});
});

describe('unit test setSystemRoleInChatHistory', () => {
	// level 1 and no existing system role
	// level 1 and existing system role
	// sandbox and no existing system role and system role active
	// sandbox and existing (different) system role and system role active
	// sandbox and exisint system role and system role inactive
	// sandbox and no existing system role and system role inactive
	return;
});
