const router = require("express").Router();
const Etape = require("../models").sequelize.model('Etape');

router.get("/", async (req, res, next) => {
    try {
        res.json(await Etape.findAll());
    } catch (error) {
        next(error)
    }
  
});

router.post("/", async (req, res, next) => {
  const { dateDebut, type, CamionneurId, ChantierId, etapePrec } = req.body;
  if (!(dateDebut && type && CamionneurId && ChantierId)) {
    res.sendStatus(400);
  }
  try {
    res.status(201).json(
      await Etape.create({
        dateDebut,
        type,
        CamionneurId,
        ChantierId,
        etapePrec
      })
    );
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  const { dateFin } = req.body;
  const { id } = req.params;
  try {
    await Etape.update({ dateFin }, { where: { id } });
    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
});
module.exports = router;
