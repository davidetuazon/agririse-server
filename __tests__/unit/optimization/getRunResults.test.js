const OptimizationService = require('../../../src/features/optimization/optimization.service');
const OptimizationRunModel = require('../../../src/features/optimization/optimizationRun.model');
const ParetoSolutionModel = require('../../../src/features/optimization/paretoSolution.model');

const mockUser = {
    _id: '123',
    email: 'flacko@test.com',
    password: 'user1234',
    role: 'admin',
    localityId: '456',
};

const mockOptimizationDoc = {
    _id: '456',
    status: 'pending',
    triggeredBy: {
        _id: '123'
    },
};

describe('Optimization Service - getRunResults', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should throw 400 when missing query parameters', async () => {
        await expect(
            OptimizationService.getRunResults(mockUser.localityId, null)
        ).rejects.toMatchObject({ status: 400, message: 'Missing query parameters' });
    });

    it('should throw 404 when optimization run data not found', async () => {
        jest.spyOn(OptimizationRunModel, 'findById').mockImplementation(() => {
            const mockSelect = jest.fn().mockResolvedValue(null);
            return { select: mockSelect }
        });

        await expect(
            OptimizationService.getRunResults(mockUser.localityId, '456')
        ).rejects.toMatchObject({ status: 404, message: 'Optimization run data not found' });
    });

    it('throw 403 when run localityId does not match run localityId', async () => {
        const mockDocs = {
            ...mockOptimizationDoc,
            localityId: { equals: jest.fn().mockReturnValue(false) },
        }
        jest.spyOn(OptimizationRunModel, 'findById').mockImplementation(() => {
            const mockSelect = jest.fn().mockResolvedValue(mockDocs);
            return { select: mockSelect }
        });

        await expect(
            OptimizationService.getRunResults(mockUser.localityId, '456')
        ).rejects.toMatchObject({ status: 403, message: 'Forbidden' });
    });

    it('should throw 404 when no pareto front solutions found', async () => {
        const mockDocs = {
            ...mockOptimizationDoc,
            localityId: { equals: jest.fn().mockReturnValue(true) },
            status: 'completed'
        }

        jest.spyOn(OptimizationRunModel, 'findById').mockImplementation(() => {
            const mockSelect = jest.fn().mockResolvedValue(mockDocs);
            return { select: mockSelect }
        });

        jest.spyOn(ParetoSolutionModel, 'find').mockImplementation(() => {
            const mockLean = jest.fn().mockResolvedValue([]);
            const mockSelect = jest.fn().mockReturnValue({ lean: mockLean });

            return { select: mockSelect };
        });

        await expect(
            OptimizationService.getRunResults(mockUser.localityId, '456')
        ).rejects.toMatchObject({ status: 404, message: 'No pareto front solutions found for this run' });
    });
})