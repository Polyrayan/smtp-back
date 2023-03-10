const router = require("express").Router();
const Prelevement = require("../models").sequelize.model("Prelevement");

router.post("/", async (req, res, next) => {
    const { lieuChargementId, lieuD√©chargementId, materiau, camionneur, quantite } = req.body;
    if (!(lieuChargementId, lieuD√©chargementId, materiau, camionneur, quantite)) {
        res.sendStatus(400);
    }
    try {
        const prelevement = await Prelevement.create({
            lieuChargementId,
            lieuD√©chargementId,
            MateriauId: materiau,
            CamionneurId: camionneur,
            quantite
        });
        res.status(201).json(prelevement);
    } catch (error) {
        next(error);
    }
});

router.get("/", async (req, res, next) => {
    try {
        const prelevements = await Prelevement.findAll({
            include: { all: true }
        });
        res.status(200).json(prelevements);
    } catch (error) {
        next(error);
    }
});

module.exports = router;