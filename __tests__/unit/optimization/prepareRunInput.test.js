const OptimizationService = require('../../../src/features/optimization/optimization.service');
const CanalModel = require('../../../src/features/canal/canal.model');

const mockUser = {
    _id: '123',
    email: 'flacko@test.com',
    password: 'user1234',
    role: 'admin',
    localityId: '456',
};

const mockInput = {
    totalSeasonalWaterSupplyM3: 40_000_000,
    scenario: 'dry season',
};

const mockCanals = [
    {
        localityId: '456',
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
        cropVariant: ['main', 'second']
    },
    {
        localityId: '456',
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
        cropVariant: ['main', 'second']
    }
];

describe('Optimization Service - prepareRunInput', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should throw 400 when missing administrator level input', async () => {
        await expect(
            OptimizationService.prepareRunInput(mockUser.localityId, null)
        ).rejects.toMatchObject({ status: 400, message: 'Missing administrator level input' });
    });

    it('should throw 404 when canal list not found, case: empty array', async () => {
        jest.spyOn(CanalModel, 'find').mockResolvedValue([]);

        await expect(
            OptimizationService.prepareRunInput(mockUser.localityId, mockInput)
        ).rejects.toMatchObject({ status: 404, message: 'Canal list not found' });
    });

    it('should throw 404 when canal list not found, case: not an array', async () => {
        jest.spyOn(CanalModel, 'find').mockResolvedValue(null);

        await expect(
            OptimizationService.prepareRunInput(mockUser.localityId, mockInput)
        ).rejects.toMatchObject({ status: 404, message: 'Canal list not found' });
    });

    it('should throw 422 when invalid canal', async () => {
        const mockInvalidCanal = [
            {
                localityId: '456',
                _id: '03',
                tbsByDamHa: 400,
                netWaterDemandM3: 4000,
                cropVariant: ['main', 'second']
            },
            {
                localityId: '456',
                _id: '04',
                mainLateralId: 'C',
                tbsByDamHa: 400,
                netWaterDemandM3: '20KCM',
                cropVariant: ['main', 'second']
            }
        ];

        jest.spyOn(CanalModel, 'find').mockResolvedValue(mockInvalidCanal);

        await expect(
            OptimizationService.prepareRunInput(mockUser.localityId, mockInput)
        ).rejects.toMatchObject({ status: 422, message: `Invalid canal: ${JSON.stringify(mockInvalidCanal[0])}` })
    });

    it('should throw 400 when water supply is below the minimum theshold', async () => {
        jest.spyOn(CanalModel, 'find').mockResolvedValue(mockCanals);
        const mockShortInput = { totalSeasonalWaterSupplyM3: 3000, scenario: 'dry season' };

        const totalNetWaterDemandM3 = mockCanals.reduce((sum, c) => sum + c.netWaterDemandM3, 0);
        const threshold = totalNetWaterDemandM3 * 0.7;
        const deficit = threshold - mockShortInput.totalSeasonalWaterSupplyM3;

        await expect(
            OptimizationService.prepareRunInput(mockUser.localityId, mockShortInput)
        ).rejects.toMatchObject({
            status: 400,
            message: `Water supply (${mockShortInput.totalSeasonalWaterSupplyM3.toLocaleString()} m³) is below the minimum threshold of 70% of total net water demand (${threshold.toLocaleString()} m³). Shortfall: ${deficit.toLocaleString()} m³. Unable to provide meaningful optimization.`
        });
    });

    it('should return prepared input when successful', async () => {
        jest.spyOn(CanalModel, 'find').mockResolvedValue(mockCanals);

        const result = await OptimizationService.prepareRunInput(mockUser.localityId, mockInput);

        expect(result.locality).toBe(mockUser.localityId);
        expect(result.scenario).toBe(mockInput.scenario);
        expect(result.cropVariant).toBe(mockInput.scenario === 'dry season' ? 'main' : 'second');
        expect(result.totalSeasonalWaterSupplyM3).toBe(mockInput.totalSeasonalWaterSupplyM3);
        expect(result.canalInput).toEqual([
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
        ]);
    });
});