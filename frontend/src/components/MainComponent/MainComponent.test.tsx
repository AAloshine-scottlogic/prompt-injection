import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { LEVEL_NAMES } from '@src/models/level';

import MainComponent from './MainComponent';

describe('MainComponent component tests', () => {
	// mock the health check service call
	const { mockHealthCheck } = vi.hoisted(() => {
		return { mockHealthCheck: vi.fn() };
	});
	vi.mock('@src/service/healthService', () => ({
		healthCheck: mockHealthCheck.mockResolvedValue({}),
	}));

	vi.mock('@src/service/emailService', () => ({
		getSentEmails: vi.fn().mockResolvedValue([]),
	}));
	vi.mock('@src/service/chatService', () => ({
		getChatHistory: vi.fn().mockResolvedValue([]),
	}));

	afterEach(() => {
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

		expect(
			await screen.findByText(
				'Failed to reach the server. Please try again later.'
			)
		).not.toBeInTheDocument();
	});
});
