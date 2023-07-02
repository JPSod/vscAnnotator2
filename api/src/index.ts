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
        accessToken: jwt.sign({ userId: user.id }, "asfoiquwofjqwofq", {
          expiresIn: "1y",
        }),
      });
    }
  
  ));

  var app = express();
  
  app.use(passport.initialize());
  
  app.use(passport.session());

  app.get('/auth/github',
    passport.authenticate('github'),
    function(_req, _res){
      // The request will be redirected to GitHub for authentication, so this
      // function will not be called.
  }
  );

  app.get('/auth/github/callback', passport.authenticate('github', { session: false }), // { failureRedirect: '/login' } ??
    (_req, res) => {
      // Successful authentication
      res.send('Successful login');
    });


  app.get("/", (_req, res) => {
    res.send("hello");
  });

  app.listen(3002, () => {
    console.log("listening on localhost:3002");
  });
};

main();
