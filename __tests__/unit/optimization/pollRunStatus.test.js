const OptimizationService = require('../../../src/features/optimization/optimization.service');
const OptimizationRunModel = require('../../../src/features/optimization/optimizationRun.model');

const mockUser = {
    _id: '123',
    email: 'flacko@test.com',
    password: 'user1234',
    role: 'admin',
    localityId: '456',
};

describe('Optimization Service - pollRunStatus', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should throw 400 when missing query parameter', async () => {
        await expect(
            OptimizationService.pollRunStatus(null)
        ).rejects.toMatchObject({ status: 400, message: 'Missing query parameters' });
    });

    it('should throw 404 when optimization run not found in database', async () => {
        jest.spyOn(OptimizationRunModel, 'findOne').mockImplementation(() => {
            const mockLean = jest.fn().mockResolvedValue(null);
            return { lean: mockLean };
        });

        await expect(
            OptimizationService.pollRunStatus(mockUser._id, '123')
        ).rejects.toMatchObject({ status: 404, message: 'No Optimization Run document found' });
    });

    it('should return optimization run status', async () => {
        const mockOptimizationDoc = {
            _id: '456',
            status: 'pending',
            triggeredBy: {
                _id: '123'
            },
        };
        
        jest.spyOn(OptimizationRunModel, 'findOne').mockImplementation(() => {
            const mockLean = jest.fn().mockResolvedValue(mockOptimizationDoc);
            return { lean: mockLean };
        });

        const result = await OptimizationService.pollRunStatus(mockUser._id, '456');

        expect(result.status).toBe(mockOptimizationDoc.status);
    });
});