import { describe, expect, it } from 'vitest';

import {
	CleanModeDisplayLabel,
	CleanModeLabelInfo,
} from '../../../behaviors/roborock.vacuum/core/cleanModeConfig/types.js';
import { getAllModesForDevice } from '../../../behaviors/roborock.vacuum/core/deviceCapabilityRegistry.js';
import { DeviceModel } from '../../../roborockCommunication/models/deviceModel.js';
import { decodeFeatureSet } from '../../../share/featureSetDecoder.js';
import { isSupportedDevice } from '../../../share/helper.js';

// P30 Pro (roborock.vacuum.a306) fixture strings from python-roborock tests/testdata/home_data_device_p30_pro.json
const A306_FEATURE_SET = '4499197267967999';
const A306_NEW_FEATURE_SET = '000002637C3FBF1DCEDD7FFDA8E8B6FD5BBFAF7F7EFEFFFF';
const A306_MODEL = 'roborock.vacuum.a306';

describe('DeviceModel', () => {
	describe('P30_PRO', () => {
		it('should equal roborock.vacuum.a306 when read from the enum', () => {
			// Arrange
			const expected = 'roborock.vacuum.a306';

			// Act
			const value = DeviceModel.P30_PRO;

			// Assert
			expect(value).toBe(expected);
		});

		it('should be recognised as a supported device when model string is roborock.vacuum.a306', () => {
			// Arrange
			const model = DeviceModel.P30_PRO;

			// Act
			const supported = isSupportedDevice(model);

			// Assert
			expect(supported).toBe(true);
		});
	});

	describe('a306 feature-set decoding', () => {
		it('should report water slide, valley electricity and smart clean mode set as supported when decoding the a306 fixture', () => {
			// Arrange
			// (inputs are the fixture strings above)

			// Act
			const features = decodeFeatureSet(A306_FEATURE_SET, A306_NEW_FEATURE_SET);

			// Assert
			expect(features.is_water_slide_mode_supported).toBe(true);
			expect(features.is_supported_valley_electricity).toBe(true);
			expect(features.is_smart_clean_mode_set_supported).toBe(true);
		});

		it('should include Smart Plan and Vac-Follow-by-Mop modes when resolving modes for the a306 fixture', () => {
			// Arrange
			const smartPlanMode = CleanModeLabelInfo[CleanModeDisplayLabel.SmartPlan].mode;
			const vacFollowByMopMode = CleanModeLabelInfo[CleanModeDisplayLabel.VacFollowedByMop].mode;

			// Act
			const modes = getAllModesForDevice(A306_MODEL, A306_FEATURE_SET, A306_NEW_FEATURE_SET);
			const modeNumbers = modes.map((config) => config.mode);

			// Assert
			expect(modeNumbers).toContain(smartPlanMode);
			expect(modeNumbers).toContain(vacFollowByMopMode);
		});
	});
});
