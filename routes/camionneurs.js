const router = require("express").Router();
const sequelize = require("../models").sequelize;
const Camionneur = sequelize.model("Camionneur");
const Entreprise = sequelize.model("Entreprise");
var _ = require("lodash");
var jwt = require("jsonwebtoken");
var helper = require('../routes/helper')

router.get("/", async (req, res, next) => {
  try {
    res.json(
      await Camionneur.findAll({
        include: {
          model: Entreprise,
        },
      })
    );
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const {id} = req.params;
    const camionneurToFind = await Camionneur.findByPk(id, {
      include: {
        model: Entreprise,
      },
    });
    if (_.isEmpty(camionneurToFind)) {
      res.sendStatus(204);
    } else {
      res.json(camionneurToFind);
    }
  } catch (error) {
    next(error);
  }
})

router.get("/:id/entreprises", async (req, res, next) => {
  helper.getAssociatedById(Camionneur, Entreprise, req, res, next);
});

router.post("/", async (req, res, next) => {
  try {
    const { nom, prenom, entreprise } = req.body;
    if (!(nom && prenom && entreprise)) {
      res.sendStatus(400);
    }
    const newCamionneur = await Camionneur.create({ nom, prenom });
    await newCamionneur.addEntreprise(entreprise);
    res.status(201).json(newCamionneur);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/entreprise", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { entreprise } = req.body;
    if (!entreprise) {
      res.sendStatus(400);
    }
    const camionneurToAddEntreprise = await Camionneur.findByPk(id, {
      include: {
        model: Entreprise,
      },
    });
    const entreprisesCamionneurId = camionneurToAddEntreprise
      .get("Entreprises")
      .map((ets) => ets.id);
    if (_.indexOf(entreprisesCamionneurId, entreprise) != -1 ) {
      res.sendStatus(409)
    } else {
      res
      .status(201)
      .json(await camionneurToAddEntreprise.addEntreprise(entreprise));
    }
  } catch (error) {
    next(error);
  }
});

router.post("/authenticate", async (req, res, next) => {
  try {
    const { nom, prenom, entreprise } = req.body;
    if (!(nom && prenom && entreprise)) {
      res.sendStatus(400);
    }
    const camionneurToConnect = await Camionneur.findOne({
      where: { nom, prenom },
      include: [
        {
          model: Entreprise,
          where: { id: entreprise },
          attributes: ["id", "nom"],
          logging: true,
        },
      ],
    });
    _.isEmpty(camionneurToConnect)
      ? res.sendStatus(403)
      : res.json({
          token: jwt.sign(
            { id: camionneurToConnect.id, role: "camionneur" },
            process.env.JWT_SECRET
          ),
        });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
