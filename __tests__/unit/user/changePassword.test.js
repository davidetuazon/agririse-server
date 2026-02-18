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

describe('User Service - changePassword', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should throw 422 when missing request body', async () => {
        jest.spyOn(UserModel, 'findById').mockResolvedValue(null);
        jest.spyOn(bcrypt, 'compare').mockResolvedValue(null);
        jest.spyOn(bcrypt, 'hash').mockResolvedValue(null);
        jest.spyOn(UserModel, 'findByIdAndUpdate').mockResolvedValue(null);

        await expect(
            UserService.signIn(null)
        ).rejects.toMatchObject({ status: 422, message: 'Missing request body' });

        expect(UserModel.findById).not.toHaveBeenCalled();
        expect(bcrypt.compare).not.toHaveBeenCalled();
        expect(bcrypt.hash).not.toHaveBeenCalled();
        expect(UserModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should throw 404 when user not found', async () => {
        jest.spyOn(UserModel, 'findById').mockResolvedValue(null);
        jest.spyOn(bcrypt, 'compare').mockResolvedValue(null);
        jest.spyOn(bcrypt, 'hash').mockResolvedValue(null);
        jest.spyOn(UserModel, 'findByIdAndUpdate').mockResolvedValue(null);

        const testUser = {
            _id: '423',
            email: 'dev@test.com',
            password: 'admin123',
        }
        const updates = {
            oldPassword: 'admin123',
            newPassword: 'user1234'
        }

        await expect(
            UserService.changePassword(testUser._id, updates)
        ).rejects.toMatchObject({ status: 404, message: 'User not found' });

        expect(UserModel.findById).toHaveBeenCalledWith(testUser._id);
        expect(bcrypt.compare).not.toHaveBeenCalled();
        expect(bcrypt.hash).not.toHaveBeenCalled();
        expect(UserModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should throw 401 when old password is incorrect', async () => {
        jest.spyOn(UserModel, 'findById').mockResolvedValue(mockUser);
        jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);
        jest.spyOn(bcrypt, 'hash').mockResolvedValue(null);
        jest.spyOn(UserModel, 'findByIdAndUpdate').mockResolvedValue(null);

        const testUser = {
           _id: '123',
            email: 'flacko@test.com',
            password: 'admin123',
        }
        const updates = {
            oldPassword: 'user1234',
            newPassword: 'admin123'
        }

        await expect(
            UserService.changePassword(testUser._id, updates)
        ).rejects.toMatchObject({ status: 401, message: 'Old password is incorrect' });

        expect(UserModel.findById).toHaveBeenCalledWith(testUser._id);
        expect(bcrypt.compare).toHaveBeenCalledWith(updates.oldPassword, mockUser.password);
        expect(bcrypt.hash).not.toHaveBeenCalled();
        expect(UserModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should throw 404 when update is unsuccessful', async () => {
        const hashedNewPassword = 'zoltrak01';

        jest.spyOn(UserModel, 'findById').mockResolvedValue(mockUser);
        jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
        jest.spyOn(bcrypt, 'hash').mockResolvedValue(hashedNewPassword);
        jest.spyOn(UserModel, 'findByIdAndUpdate').mockResolvedValue(null);

        const updates = {
            oldPassword: 'user1234',
            newPassword: 'zoltrak01'
        }
        
        await expect(
            UserService.changePassword(mockUser._id, updates)
        ).rejects.toMatchObject({ status: 404, message: 'User not found. Update is unsuccessful' });
    });

    it('should successfully change password and return basic user info', async () => {
        const hashedNewPassword = 'zoltrak01';
        const updatedMockUser = {
            ...mockUser,
            password: hashedNewPassword,
        };

        jest.spyOn(UserModel, 'findById').mockResolvedValue(mockUser);
        jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
        jest.spyOn(bcrypt, 'hash').mockResolvedValue(hashedNewPassword);
        jest.spyOn(UserModel, 'findByIdAndUpdate').mockResolvedValue(updatedMockUser);

        const updates = {
            oldPassword: 'user1234',
            newPassword: 'zoltrak01'
        }

        const result = await UserService.changePassword(mockUser._id, updates);

        expect(result).toEqual({
            localityId: mockUser.localityId,
            email: mockUser.email,
            role: mockUser.role,
            _id: mockUser._id,
        });
        expect(UserModel.findById).toHaveBeenCalledWith(mockUser._id);
        expect(bcrypt.compare).toHaveBeenCalledWith(updates.oldPassword, mockUser.password);
        expect(bcrypt.hash).toHaveBeenCalledWith(updates.newPassword, 16);
        expect(UserModel.findByIdAndUpdate).toHaveBeenCalledWith(mockUser._id, { password: hashedNewPassword }, { new: true });
    });
});