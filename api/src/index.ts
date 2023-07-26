import express from "express";
import "reflect-metadata";
require('dotenv').config();
import { DataSource, In } from "typeorm";
import { User } from "./entities/User";
import { __prod__ } from "./constants";
import { join } from "path";
import passport from "passport";
import { Strategy as GitHubStrategy } from "passport-github2";
import jwt from "jsonwebtoken";	
import session from "express-session";
import cors from "cors";
import { Scan } from "./entities/Scan";
import { isAuth } from "./isAuth";
import { Standard } from "./entities/Standard";
import { analyzeCompliance } from "../modules/scanAnalyzer";

export const conn = new DataSource({
  type: "postgres",
  database: "vscribe",
  username: "postgres",
  password: "postgres",
  entities: [join(__dirname, "./entities", "*.*")],
  logging: !__prod__,
  synchronize: !__prod__,
  })

const main = async () => {

  try{
    await conn.initialize();
    console.log('Database connection established:', conn.isInitialized);
  } catch (error) {
    console.error('Database connection error:', error);
  }

  passport.serializeUser(function(user: any, done) {
    done(null, user.accessToken);
  });

  passport.deserializeUser(function(obj: false | null | undefined | User, done) {
    done(null, obj);
  });

  passport.use(
    new GitHubStrategy({
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: "http://localhost:3002/auth/github/callback"
    },
    async (_: any, __: any, profile: any, cb: (arg0: null, arg1: { accessToken: string; }) => any) => {
      let user = await User.findOne({ where: { githubId: profile.id } });
      if (user) {
        user.name = profile.displayName;
        await user.save();
      } else {
        user = await User.create({
          githubId: profile.id,
          name: profile.displayName,
        }).save();
      }
      cb(null, {
        accessToken: jwt.sign({ userId: user.id }, process.env.JWT_ACCESS, {
          expiresIn: "1y",
        }),
      });
    }
  
  ));

  var app = express();

  const oneDay = 1000 * 60 * 60 * 24;
  app.use(session({
      secret: process.env.SESSION_SECRET,
      saveUninitialized:true,
      cookie: { maxAge: oneDay },
      resave: false 
  }));

  app.use(cors({origin: '*'}));

  app.use(express.json());

  app.use(passport.initialize());
  
  app.use(passport.session());

  app.get('/auth/github',
    passport.authenticate('github'),
    function(_req, _res){
      // The request will be redirected to GitHub for authentication, so this
      // function will not be called.
  }
  );

  app.get('/auth/github/callback', passport.authenticate('github',  { scope: [ 'user:email' ] }), // { failureRedirect: '/login' } ??
      (req: any, res) => {
        res.redirect(`http://localhost:54321/auth/${req.user.accessToken}`);
      }
    );

    app.get("/scans", async (req: any, res) => {
      try {
        // Fetch scans based on the creatorId
        const scans = await Scan.find({
          where: { creatorId: req.userId },
          order: { id: "DESC" },
        });
    
        // Extract all unique standardIds from the scans
        const standardIds = scans.map((scan) => scan.standardId);
    
        // Fetch associated standards using the standardIds
        const standards = await conn.getRepository(Standard).findBy({ id: In(standardIds) });
    
        // Create a map of standardId to the standard name for easy lookup
        const standardNameMap = new Map();
        standards.forEach((standard: { id: any; standard: any; }) => {
          standardNameMap.set(standard.id, standard.standard);
        });
    
        // Update the scans with the associated standard names
        scans.forEach((scan) => {
          scan.standardName = standardNameMap.get(scan.standardId);
        });
    
        // Return the updated scans with the associated standard names
        res.send({ scans });
      } catch (error) {
        console.error("Error fetching scans:", error);
        res.status(500).send({ error: "Error fetching scans" });
      }
    });


  app.post("/scans", isAuth, async (req: any, res) => {

    try {
      // some tests to see if valid scan
      if (req.body.value.length > 50000) {
        res.status(400).json({ error: "Text too long" });
        return;
      }

      //use axios to get the standard from database
      const standard = await Standard.findOneBy({id: req.body.standardId});

      // Check if standard exists
      if (!standard) {
        res.status(400).json({ error: "Standard not found" });
        return;
      }

      // Import the analyzeCompliance function from the compliance module
      const pythonCode = req.body.value;
      const rules = standard.content;
  
      // Analyze the compliance using the imported function
      const complianceScore = await analyzeCompliance(pythonCode, rules);

      const scan = Scan.create({
        standardId: req.body.standardId,
        value: 0.5,
        file: req.body.file,
        creatorId: req.userId,
      }); 

      await scan.save();

      res.send({ scan });

    } catch (err) {
      console.log(err);
      res.status(400).json({ error: "Something went wrong" });
    }

  });

  app.get("/standards", async (req: any, res) => {
    // this desperately needs to be secured
    const standards = await Standard.find({where: {creatorId: req.userId}, order: {id: "DESC"}});
    res.send({ standards });
  });


  app.post("/standards", isAuth, async (req: any, res) => {

    try {
      // some tests to see if valid scan
      if (req.body.content.length > 50000) {
        res.status(400).json({ error: "Text too long" });
        return;
      }

      //use axios to get the standard from database

      const standard = Standard.create({
        standard: req.body.standard,
        content: req.body.content,
        creatorId: req.userId,
      }); 

      await standard.save();

      res.send({ standard });
    } catch (err) {
      console.log(err);
      res.status(400).json({ error: "Something went wrong" });
    }

  });

  app.get("/me", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.send({ user:null });
      return;
    }
    
    const token = authHeader.split(" ")[1];
    if (!token) {
      res.send({ user:null });
      return;
    }

    let userId: number | null | undefined;

    try {
      const payload: any = jwt.verify(token, process.env.JWT_ACCESS);
      userId = payload.userId;

    } catch (err){
      res.send({ user:null });
      console.log(err);
      return;
    }

    if (!userId) {
      res.send({ user:null });
      return;
    }

    const user = await User.findOneBy({id: userId});
    res.json({ user });

  });


  app.get("/", (_req, res) => {
    res.send("hello");
  });

  app.listen(3002, () => {
    console.log("listening on localhost:3002");
  });
};

main();
