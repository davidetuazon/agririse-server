const signIn = {
    email: {
        presence: { allowEmpty: false, message: 'is required' },
    },
    password: {
        presence: { allowEmpty: false, message: 'is required' },
    },
}

const passwordChange = {
    oldPassword: {
        presence: { allowEmpty: false, message: 'is required' },
        length: { minimum: 8, message: 'Password must be at least 8 characters' },
    },
    newPassword: {
        presence: { allowEmpty: false, message: 'is required' },
        length: { minimum: 8, message: 'Password must be at least 8 characters' },
    }
}

module.exports = {
    signIn,
    passwordChange
}