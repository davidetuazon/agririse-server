const getDates = () => {
    const month = new Date().getMonth() + 1;
    const formattedMonth = String(month).padStart(2, '0');
    const year = new Date().getFullYear();
    const lastDay = new Date(year, month, 0).getDate();


    return { year, month: formattedMonth, lastDay };
}

module.exports = {
    getDates,
}