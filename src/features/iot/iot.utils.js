const periodToMilliseconds = (period) => {
    switch (period) {
        case '1day':    return 1 * 24 * 60 * 60 * 1000;    // last 24 hours
        case '7days':   return 7 * 24 * 60 * 60 * 1000;    // last week
        case '2weeks':  return 14 * 24 * 60 * 60 * 1000;   // last two weeks
        case '1month':  return 30 * 24 * 60 * 60 * 1000;   // last month
        case '3months': return 90 * 24 * 60 * 60 * 1000;   // last quarter
        case '6months': return 180 * 24 * 60 * 60 * 1000;  // optional half-year
        case '1year':   return 365 * 24 * 60 * 60 * 1000;  // optional full year
        default:        return 7 * 24 * 60 * 60 * 1000;    // fallback to 7 days
    }
};

module.exports = {
    periodToMilliseconds,
}