import express from "express";
import "reflect-metadata";
require('dotenv').config();
import { DataSource } from "typeorm";
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
    const scans = await Scan.find({where: {creatorId: req.userId}, order: {id: "DESC"}});
    res.send({ scans });
  });


  app.post("/scans", isAuth, async (req: any, res) => {

    // some tests to see if valid scan
    if (req.body.text.length > 5000) {
      res.send({ error: "Text too long" });
      return;
    }

    // send stuff to flask server and get back value
    req.body.value = 0.5;

    const scan = Scan.create({
      standard: req.body.standard,
      value: req.body.value,
      file: req.body.file,
      creatorId: req.userId,
    }); 
    
    await scan.save();
    
    res.send({ scan });

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
