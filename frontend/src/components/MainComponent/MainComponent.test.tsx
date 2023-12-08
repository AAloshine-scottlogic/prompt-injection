import { render, screen } from '@testing-library/react';
import { afterAll, describe, expect, test, vi } from 'vitest';

import { LEVEL_NAMES } from '@src/models/level';

import MainComponent from './MainComponent';

describe('MainComponent component tests', () => {
	const { mockHealthCheck } = vi.hoisted(() => {
		return { mockHealthCheck: vi.fn() };
	});
	vi.mock('@src/service/healthService', () => ({
		healthCheck: mockHealthCheck.mockResolvedValue({}),
	}));

	vi.mock('@src/service/chatService', async (importOriginal) => {
		const mod = await importOriginal<
			typeof import('@src/service/chatService')
		>();
		return {
			...mod,
			getChatHistory: vi.fn().mockResolvedValue([]),
		};
	});

	vi.mock('@src/service/defenceService', async (importOriginal) => {
		const mod = await importOriginal<
			typeof import('@src/service/defenceService')
		>();
		return {
			...mod,
			getDefences: vi.fn().mockResolvedValue([]),
		};
	});

	vi.mock('@src/service/emailService', async (importOriginal) => {
		const mod = await importOriginal<
			typeof import('@src/service/emailService')
		>();
		return {
			...mod,
			getSentEmails: vi.fn().mockResolvedValue([]),
		};
	});

	afterAll(() => {
		vi.resetAllMocks();
	});

	function renderMainComponent() {
		render(
			<MainComponent
				currentLevel={LEVEL_NAMES.SANDBOX}
				numCompletedLevels={0}
				incrementNumCompletedLevels={vi.fn()}
				openHandbook={vi.fn()}
				openInformationOverlay={vi.fn()}
				openLevelsCompleteOverlay={vi.fn()}
				openWelcomeOverlay={vi.fn()}
				openDocumentViewer={vi.fn()}
				setCurrentLevel={vi.fn()}
			/>
		);
	}

	test("GIVEN the backend isn't running WHEN the page loads THEN the user sees an error message", async () => {
		mockHealthCheck.mockRejectedValueOnce(new Error());

		renderMainComponent();

		expect(
			await screen.findByText(
				'Failed to reach the server. Please try again later.'
			)
		).toBeInTheDocument();
	});

	test('GIVEN the backend is running WHEN the page loads THEN the user does not see an error message', async () => {
		mockHealthCheck.mockResolvedValueOnce({});

		renderMainComponent();

		// expect the findByText to throw
		await expect(
			screen.findByText('Failed to reach the server. Please try again later.')
		).rejects.toThrow();
	});
});
