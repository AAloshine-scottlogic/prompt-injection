import { DEFAULT_DEFENCES } from '@src/Defences';
import {
	DEFENCE_ID,
	DefenceConfigItem,
	DefenceResetResponse,
	DefenceDTO,
} from '@src/models/defence';

import { sendRequest } from './backendService';

const PATH = 'defence/';

function getDefencesFromDTOs(defenceDTOs: DefenceDTO[]) {
	return DEFAULT_DEFENCES.map((defence) => {
		const defenceDTO = defenceDTOs.find(
			(defenceDTO) => defence.id === defenceDTO.id
		);
		return defenceDTO
			? {
					...defence,
					isActive: defenceDTO.isActive,
					config: defence.config.map((config) => {
						const matchingConfigItemDTO = defenceDTO.config.find(
							(configItemDTO) => config.id === configItemDTO.id
						);
						return matchingConfigItemDTO
							? { ...config, value: matchingConfigItemDTO.value }
							: config;
					}),
			  }
			: defence;
	});
}

async function toggleDefence(
	defenceId: DEFENCE_ID,
	isActive: boolean,
	level: number
): Promise<boolean> {
	const requestPath = isActive ? 'deactivate' : 'activate';
	const response = await sendRequest(`${PATH}${requestPath}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ defenceId, level }),
	});
	return response.status === 200;
}

async function configureDefence(
	defenceId: string,
	config: DefenceConfigItem[],
	level: number
): Promise<boolean> {
	const response = await sendRequest(`${PATH}configure`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ defenceId, config, level }),
	});
	return response.status === 200;
}

async function resetDefenceConfig(
	defenceId: string,
	configId: string
): Promise<DefenceResetResponse> {
	const response = await sendRequest(`${PATH}resetConfig`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ defenceId, configId }),
	});
	return (await response.json()) as DefenceResetResponse;
}

function validatePositiveNumberConfig(config: string) {
	// config is a number greater than zero
	return !isNaN(Number(config)) && Number(config) > 0;
}

function validateNonEmptyStringConfig(config: string) {
	// config is non empty string and is not a number
	return config !== '' && !Number(config);
}

function validateFilterConfig(config: string) {
	// config is not a list of empty commas
	const commaPattern = /^,*,*$/;
	return config === '' || !commaPattern.test(config);
}

function validateDefence(
	defenceId: DEFENCE_ID,
	configId: string,
	config: string
) {
	switch (defenceId) {
		case DEFENCE_ID.CHARACTER_LIMIT:
			return validatePositiveNumberConfig(config);
		case DEFENCE_ID.INPUT_FILTERING:
		case DEFENCE_ID.OUTPUT_FILTERING:
			return validateFilterConfig(config);
		case DEFENCE_ID.RANDOM_SEQUENCE_ENCLOSURE:
			return configId === 'SEQUENCE_LENGTH'
				? validatePositiveNumberConfig(config)
				: validateNonEmptyStringConfig(config);
		default:
			return validateNonEmptyStringConfig(config);
	}
}

export {
	toggleDefence,
	configureDefence,
	resetDefenceConfig,
	validateDefence,
	getDefencesFromDTOs,
};
