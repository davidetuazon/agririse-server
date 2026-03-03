const OptimizationService = require('../../../src/features/optimization/optimization.service');
const OptimizationRunModel = require('../../../src/features/optimization/optimizationRun.model');
const ParetoSolutionModel = require('../../../src/features/optimization/paretoSolution.model');

const mockPayload = {
    runId: 123,
    status: 'completed',
    paretoSolutions: [
        {
            _id: '01',
            runId: 'run_01',
            allocationVector: [
                {
                "mainLateralId": "N",
                "coverage": [
                    {
                        "barangay": "Rizal",
                        "fractionalAreaHa": 200.15399999999997
                    }
                ],
                "areaHa": 200.154,
                "allocatedWaterM3": 399920.71,
                "effectiveWaterM3": 367856.66,
                "netWaterDemandM3": 2501925,
            },
            {
                "mainLateralId": "O",
                "coverage": [
                    {
                        "barangay": "Rizal",
                        "fractionalAreaHa": 133.436
                    },
                    {
                        "barangay": "Santa_Cruz",
                        "fractionalAreaHa": 33.57
                    }
                ],
                "areaHa": 167.006,
                "allocatedWaterM3": 2102318.94,
                "effectiveWaterM3": 2067151.03,
                "netWaterDemandM3": 2087575,
            }
            ]
        },
    ],
    objectiveValues: {
        deficit: {
            value: 0.04,
            unit: 'ratio',
            direction: 'minimze',
        },
        fairness: {
            value: 0.89,
            unit: 'ratio',
            direction: 'maximize',
        },
    }
};

describe('Optimization Service - receiveAndProcessRunCallback', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should throw 404 when missing payload from optimization service', async () => {
        await expect(
            OptimizationService.receiveAndProcessRunCallback(null)
        ).rejects.toMatchObject({ status: 400, message: 'Missing payload from optimization service' });
    });

    it('should throw 400 when invalid or missing pareto solutions in payload, case: not an array', async () => {
        const mockPayload = {
            status: 'completed',
            paretoSolutions: {
                max: 1
            }
        };

        await expect(
            OptimizationService.receiveAndProcessRunCallback(mockPayload)
        ).rejects.toMatchObject({ status: 400, message: 'Invalid or missing pareto solutions in payload' });
    });

    it('should throw 400 when invalid or missing pareto solutions in payload, case: empty array', async () => {
        const mockPayload = {
            status: 'completed',
            paretoSolutions: []
        };

        await expect(
            OptimizationService.receiveAndProcessRunCallback(mockPayload)
        ).rejects.toMatchObject({ status: 400, message: 'Invalid or missing pareto solutions in payload' });
    });

    it('should throw 404 when optimization run not found in database', async () => {
        jest.spyOn(OptimizationRunModel, 'findByIdAndUpdate').mockResolvedValue(null);

        await expect(
            OptimizationService.receiveAndProcessRunCallback(mockPayload)
        ).rejects.toMatchObject({ status: 404, message: 'Optimization run not found' });
    });

    it('should return optimization doc when GA optimization failed', async () => {
        const mockFailedPayload = {
            ...mockPayload,
             status: 'failed',
        };

        const mockOptimizationDoc = {
            _id: 123,
            localityId: '456',
            triggeredBy: {},
            inputSnapshot: {},
            status: 'failed',
        }

        jest.spyOn(OptimizationRunModel, 'findByIdAndUpdate').mockResolvedValue(mockOptimizationDoc);

        const result = await OptimizationService.receiveAndProcessRunCallback(mockFailedPayload);

        expect(result.optimizationDoc.status).toBe('failed');
        expect(result.optimizationDoc).toBe(mockOptimizationDoc);
        expect(result.message).toEqual('GA optimization failed');
    });

    it('should return when successfully inserting pareto solution into database', async () => {
        const mockOptimizationDoc = {
            _id: 123,
            localityId: '456',
            triggeredBy: {},
            inputSnapshot: {},
            status: 'completed',
        }

        const docs = mockPayload.paretoSolutions.map(sol => ({
            runId: mockPayload.runId,
            allocationVector: sol.allocationVector,
            objectiveValues: sol.objectiveValues,
        }));

        jest.spyOn(OptimizationRunModel, 'findByIdAndUpdate').mockResolvedValue(mockOptimizationDoc);
        jest.spyOn(ParetoSolutionModel, 'insertMany').mockResolvedValue(docs);
        jest.spyOn(console, 'error').mockImplementation(() => {});

        await OptimizationService.receiveAndProcessRunCallback(mockPayload);

        expect(OptimizationRunModel.findByIdAndUpdate).toHaveBeenCalledWith(mockPayload.runId, { status: mockPayload.status }, { new: true });
        expect(ParetoSolutionModel.insertMany).toHaveBeenCalledWith(docs);
    });
});