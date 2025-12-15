const signIn = {
    email: {
        presence: { allowEmpty: false, message: 'is required' },
    },
    password: {
        presence: { allowEmpty: false, message: 'is required' },
    },
}

module.exports = {
    signIn,
}