const OptimizationService = require('../../../src/features/optimization/optimization.service');
const IoTService = require('../../../src/features/iot/iot.service');
const OptimizationRunModel = require('../../../src/features/optimization/optimizationRun.model');

const mockUser = {
    _id: '123',
    email: 'flacko@test.com',
    password: 'user1234',
    role: 'admin',
    localityId: '456',
};

const mockInput = {
    locality: '456',
    scenario: 'dry season',
    cropVariant: 'main',
    totalSeasonalWaterSupplyM3: 40_000_000,
    canalInputs: [
        {
            _id: '01',
            mainLateralId: 'A',
            tbsByDamHa: 200,
            netWaterDemandM3: 1500,
            seepageM3: 0.13,
            lossFactorPercentage: 0.03,
            coverage: [
                {
                    barangay: 'Tibay',
                    fractionalAreaHa: 200,
                }
            ],
        },
        {
            _id: '02',
            mainLateralId: 'B',
            tbsByDamHa: 300,
            netWaterDemandM3: 3000,
            seepageM3: 0.22,
            lossFactorPercentage: 0.12,
            coverage: [
                {
                    barangay: 'Tikas',
                    fractionalAreaHa: 200,
                },
                {
                    barangay: 'Lakas',
                    fractionalAreaHa: 100,
                }
            ],
        }
    ]
};

const mockReadings = {
    readings: {
        rainfall: { 
            sensorType: 'rainfall', 
            value: 10, 
            unit: 'mm',
            recordedAt: new Date('2024-02-14T10:00:00'),
            localityId: { _id: '456', city: 'TestCity', province: 'TestProvince', region: 'TestRegion' },
            source: 'iot'
        },
    }
};

global.fetch = jest.fn().mockResolvedValue({});

describe('Optimization Service - initiateRun', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should throw 400 when missing request body', async () => {
        await expect(
            OptimizationService.initiateRun(mockUser, null)
        ).rejects.toMatchObject({ status: 400, message: 'Missing request body' });
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should throw 400 when failing to initiate optimization run', async () => {
        jest.spyOn(IoTService, 'getLatestReadings').mockResolvedValue(mockReadings);
        jest.spyOn(OptimizationRunModel, 'create').mockResolvedValue(null);

        await expect(
            OptimizationService.initiateRun(mockUser, mockInput)
        ).rejects.toMatchObject({ status: 400, message: 'Failed to initiate optimization run' });
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should return optimization document when successful', async () => {
        const userSnapshot = {
            _id: mockUser._id,
            name: mockUser.fullName,
            email: mockUser.email,
            role: mockUser.role,
        }
        const mockOptimizationDoc = {
            _id: 123,
            localityId: mockUser.localityId,
            triggeredBy: userSnapshot,
            inputSnapshot: {
                readings: {
                    rainfall: {
                        value: 10, 
                        unit: 'mm',
                        recordedAt: new Date('2024-02-14T10:00:00'),
                        sensorType: 'rainfall', 
                    }
                },
                ...mockInput
            },
            status: 'pending'
        };

        jest.spyOn(IoTService, 'getLatestReadings').mockResolvedValue(mockReadings);
        jest.spyOn(OptimizationRunModel, 'create').mockResolvedValue(mockOptimizationDoc);

        const result = await OptimizationService.initiateRun(mockUser, mockInput);

        expect(OptimizationRunModel.create).toHaveBeenCalledWith({
            localityId: mockUser.localityId,
            triggeredBy: userSnapshot,
            inputSnapshot: {
                readings: {
                    rainfall: {
                        
                        value: 10, 
                        unit: 'mm',
                        recordedAt: new Date('2024-02-14T10:00:00'),
                        sensorType: 'rainfall', 
                    }
                },
                ...mockInput
            },
            status: 'pending'
        });
        expect(result).toBe(mockOptimizationDoc);
        expect(global.fetch).toHaveBeenCalled();
    });
});