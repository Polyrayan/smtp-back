const cors = require("cors");
const fs = require("fs");
const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");
const adapter = new FileSync("db.json");
const db = low(adapter);
require("dotenv").config();
const jwt = require("express-jwt");
const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const routes = require("./routes");
const _ = require("lodash");
const sequelize = require("./models").sequelize;
const winston = require("winston");
const CronJob = require("cron").CronJob;
const job = new CronJob(
	'* 59 23 * * *',
	function() {
    try {
      fs.unlinkSync("info.log");
    } catch (error) {
      console.log(error);
    }

	},
	null,
	true,
	'Europe/Paris'
);

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.logstash(),
  transports: [new winston.transports.File({ filename: 'info.log' })]
});

const port = process.env.PORT || 3000;

app.use(cors())
app.use(express.static("public"));
app.use(express.json());
app.use(
  jwt({ secret: process.env.JWT_SECRET }).unless({
    path: [
      /.*\/authenticate/,
      "/",
      { url: "/entreprises", methods: ["GET"] },
      { url: "/camionneurs", methods: ["GET"] },
      { url: "/grutiers", methods: ["GET"] },
			{ url: /^\/versions\/type\/.*/, methods: ["GET"] },
      "/io",
      "/socketdoc/index.html",
      "/favicon.ico",
    ],
  })
);
app.use("/admins", routes.admins);
app.use("/camionneurs", routes.camionneurs);
app.use("/chantiers", routes.chantiers);
app.use("/etapes", routes.etapes);
app.use("/grutiers", routes.grutiers);
app.use("/lieux", routes.lieux);
app.use("/entreprises", routes.entreprises);
app.use("/chartes", routes.chartes);
app.use("/versions", routes.versions);
app.use("/pauses", routes.pauses);
app.use("/prelevements", routes.prelevements);
app.use("/materiaux", routes.materiaux);
app.use("/sorties",routes.sorties)


app.get("/", (req, res) => {
  res.send(
    "Bienvenue sur l'API SMTP, lien vers la doc : <a href=https://stoplight.io/p/docs/gh/qkjlu/smtp-pi-server> API SMTP </a> \n" +
      "Lien vers la doc socket : <a href=/socketdoc/index.html> Socket SMTP </a>"
  );
});

app.get("/io", (req, res) => {
  res.sendFile(__dirname + "/io.html");
});

http.listen(port, function () {
  console.log("Application listening on port " + port);
});

// SOCKETS
// Initialise le fichier json si il n'existe pas
db.defaults({ users: [], routes: [] }).write();

io.on("connection", (socket) => {
  // Initialise les informations li??es ?? la socket
  let socketInfo = { id: "", chantier: "", connected: false };

  // Le client se connecte ?? un chantier (room)
  socket.on("chantier/connect", async (data) => {
    logger.info(`Date [${Date.now()}] Action [connected to chantier] User [${data.userId}] Chantier [${data.chantierId}]`);

    // Enregistre les informations li??es ?? la socket
    socketInfo.connected = true;
    socketInfo.id = data.userId;
    socketInfo.chantier = data.chantierId;

    // R??cup??re les donn??es pr??c??demment persist??es, les initialisent sinon
    let storedUser = db.get("users").find({ id: data.userId }).value();

    if (storedUser == undefined) {
      // L'utilisateur n'a pas ??t?? persist?? pr??c??demment

      // Initialise l'utilisateur ?? persister
      storedUser = {
        id: data.userId,
        chantierId: data.chantierId,
        coordinates: data.coordinates || {},
        etat: "d??charg??",
        previousEtat: "",
      };

      // Persiste l'utilisateur dans le fichier json
      db.get("users").push(storedUser).write();
    }

    // Ajoute l'utilisateur dans la room du chantier
    socket.join(`chantier:${data.chantierId}`, () => {

      // Notifie tous les utilisateurs de la room qu'un nouvel utilisateur s'est connect??
      socket.to(`chantier:${data.chantierId}`).emit("chantier/user/connected", {
        userId: storedUser.id,
        chantierId: storedUser.chantierId,
        coordinates: storedUser.coordinates,
        etat: storedUser.etat,
        previousEtat: storedUser.previousEtat,
      });

      // Notifie l'utilisateur que la connexion ?? la room a r??ussi
      io.to(socket.id).emit("chantier/connect/success", {
        coordinates: storedUser.coordinates,
        etat: storedUser.etat,
        previousEtat: storedUser.previousEtat,
      });

    });

    // Le client se d??connecte d'un chantier
    socket.on("chantier/disconnect", () => {
      logger.info(`Date [${Date.now()}] Action [disconnected from chantier] User [${socketInfo.id}] Chantier [${socketInfo.chantier}]`);
      // Notifie les utilisateurs de la room qu'un utilisateur s'est d??connect??
      socket
        .to(`chantier:${socketInfo.chantier}`)
        .emit("chantier/user/disconnected", { userId: socketInfo.id });

      socketInfo.connected = false;
      socketInfo.chantier = undefined;
    });

    // Le client envoie ses coordonn??es GPS au chantier
    socket.on("chantier/sendCoordinates", (data) => {
      if (!socketInfo.connected) {
        // Notifie l'utilisateur d'une erreur
        io.to(socket.id).emit("erreur", {
          msg:
            "Erreur : il faut ??tre connect?? ?? un chantier pour envoyer les coordonn??es GPS",
        });
      } else {
        // Persiste les donn??es re??ues
        db.get("users")
          .find({ id: socketInfo.id })
          .assign({
            coordinates: data.coordinates,
            etat: data.etat,
            previousEtat: data.previousEtat,
            ETA: data.ETA || undefined
          })
          .write();

        logger.info(`Date [${Date.now()}] Action [send coordinate] User [${socketInfo.id}] Coordinate [${data.coordinates}] Etat [${data.etat}] ETA [${data.ETA}]`);

        // Notifie les utilisateurs de la room qu'un utilisateur a envoy?? de nouvelles coordonn??es
        socket
          .to(`chantier:${socketInfo.chantier}`)
          .emit("chantier/user/sentCoordinates", {
            userId: socketInfo.id,
            chantierId: socketInfo.chantier,
            coordinates: data.coordinates,
            etat: data.etat,
            previousEtat: data.previousEtat,
            ETA: data.ETA || undefined
          });
      }
    });

    // Le client envoie souhaite detourner un camion
    socket.on("chantier/detournement", (data) => {
      socket.to(`chantier:${data.previousChantierId}`)
          .emit("chantier/detournement", {
              userId: data.userId,
              chantierId: data.chantierId,
              originLong: data.originLong,
              originLat: data.originLat,
              destinationLong: data.destinationLong,
              destinationLat: data.destinationLat,
          });
    });
  });
});
