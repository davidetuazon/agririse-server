const UserService = require('../../../src/features/user/user.service');
const UserModel = require('../../../src/features/user/user.model');
const bcrypt = require('bcryptjs');

const mockUser = {
    _id: '123',
    email: 'flacko@test.com',
    password: 'user1234',
    role: 'admin',
    localityId: '456',
};

describe('User Service - signIn', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should throw 422 when missing request body', async () => {
        jest.spyOn(UserModel, 'findOne').mockResolvedValue(null);
        jest.spyOn(bcrypt, 'compare').mockResolvedValue(null);
        jest.spyOn(UserModel, 'findByIdAndUpdate').mockResolvedValue(null);

        await expect(
            UserService.signIn(null)
        ).rejects.toMatchObject({ status: 422, message: 'Missing request body' });

        expect(UserModel.findOne).not.toHaveBeenCalled();
        expect(bcrypt.compare).not.toHaveBeenCalled();
        expect(UserModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should throw 404 when user not found', async () => {
        jest.spyOn(UserModel, 'findOne').mockResolvedValue(null);
        jest.spyOn(bcrypt, 'compare').mockResolvedValue(null);
        jest.spyOn(UserModel, 'findByIdAndUpdate').mockResolvedValue(null);

        const testUser = {
            email: 'dev@test.com',
            password: 'admin123'
        };

        await expect(
            UserService.signIn(testUser)
        ).rejects.toMatchObject({ status: 404, message: 'User not found' });

        expect(UserModel.findOne).toHaveBeenCalledWith({ deleted: false, email: testUser.email });
        expect(bcrypt.compare).not.toHaveBeenCalled();
        expect(UserModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should throw 401 when incorrect password', async () => {
        jest.spyOn(UserModel, 'findOne').mockResolvedValue(mockUser);
        jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);
        jest.spyOn(UserModel, 'findByIdAndUpdate').mockResolvedValue(null);

        const testUser = {
            email: 'dev@test.com',
            password: 'admin123'
        };

        await expect(
            UserService.signIn(testUser)
        ).rejects.toMatchObject({ status: 401, message: 'Incorrect password' });

        expect(UserModel.findOne).toHaveBeenCalledWith({ deleted: false, email: testUser.email });
        expect(bcrypt.compare).toHaveBeenCalledWith(testUser.password, mockUser.password);
        expect(UserModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should return basic user info when successful', async () => {
        jest.spyOn(UserModel, 'findOne').mockResolvedValue(mockUser);
        jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
        jest.spyOn(UserModel, 'findByIdAndUpdate').mockResolvedValue(null);

        const result = await UserService.signIn(mockUser);

        expect(result).toEqual({
            localityId: mockUser.localityId,
            email: mockUser.email,
            _id: mockUser._id,
        });
        expect(UserModel.findOne).toHaveBeenCalledWith({ deleted: false, email: mockUser.email });
        expect(bcrypt.compare).toHaveBeenCalledWith('user1234', mockUser.password);
        expect(UserModel.findByIdAndUpdate).toHaveBeenCalledWith(mockUser._id, { lastLogin: expect.any(Date) });
    });
});