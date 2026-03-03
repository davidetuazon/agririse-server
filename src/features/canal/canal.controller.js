const CanalService = require('./canal.service');

exports.getOverview = async (req, res, next) => {
    try {
        const overview = await CanalService.getCanalOverview(req.user.localityId);

        res.status(200).json(overview);
    } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        return res.status(500).json({ error: e.message });
    }
}