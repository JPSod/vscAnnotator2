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
import nodemailer from "nodemailer";
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

const environment = process.env.PAYPAL_ENVIRONMENT || "sandbox";

const paypalBaseURL = environment === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";

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
        value: complianceScore.compliancePercentage,
        failedFunctions: complianceScore.failedFunctions,
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

  app.post("/update-standard", isAuth, async (req: any, res) => {

    try {
      // some tests to see if valid scan
      if (req.body.content.length > 50000) {
        res.status(400).json({ error: "Text too long" });
        return;
      }

     // Use axios to get the standard from the database based on id
     const existingStandard = await Standard.findOne({ where: { id: req.body.id } });

     if (!existingStandard) {
       res.status(404).json({ error: "Standard not found" });
       return;
     }

     // Update the properties of the existing standard
     existingStandard.id = req.body.id;
     existingStandard.standard = req.body.standard;
     existingStandard.content = req.body.content;
     existingStandard.creatorId = req.userId;

     // Save the updated standard
     await existingStandard.save();

     res.send({ standard: existingStandard });

    } catch (err) {
      console.log(err);
      res.status(400).json({ error: "Something went wrong" });
    }

  });

  app.post("/email-scans", isAuth, async (req, res) => {
    try {
      const { scanId, email } = req.body;
  
      // Send the scanId and email in the email body

      const selectedScan = await Scan.findOne({
        where: { id: req.body.id },
        relations: ['origin'], // Load the 'origin' relationship
      });
      
      if (!selectedScan) {
        res.status(404).json({ error: "Standard not found" });
        return;
      }
      
      // Assuming 'origin' is an instance of Standard entity
      const standardName = (await selectedScan.origin)?.standard; // Change 'name' to the actual property name in Standard entity
      
      const emailContent = `Scan ID: ${selectedScan.id}\nStandard: ${standardName}\nValue: ${selectedScan.value}\nFile: ${selectedScan.file}\nCreated Date: ${selectedScan.createdDate}`;      

      // Configure Nodemailer transporter (SMTP settings)
      const transporter = nodemailer.createTransport({
        service: 'Gmail', // e.g., 'Gmail', 'Outlook'
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_PASS,
        },
      });
  
      // Define email options
      const mailOptions = {
        from: 'your-email@example.com',
        to: email,
        subject: `Scan Information: Scan ID: ${scanId}`,
        text: emailContent,
      };
  
      // Send the email
      await transporter.sendMail(mailOptions);
  
      // Respond with a success status
      return res.status(200).json({ status: 200, message: 'Scan sent successfully via email!' });
    } catch (error) {
      console.error(error);
      // Respond with an error status
      return res.status(500).json({ status: 500, message: 'Something went wrong - scan failed to send!' });
    }
  });

  // create a new order
  app.post("/create-paypal-order", async (_req, res) => {
    const order = await createOrder();
    res.json(order);
  });

  // capture payment & store order information or fullfill order
  app.post("/capture-paypal-order", async (req, res) => {
    const { orderID } = req.body;
    const captureData = await capturePayment(orderID);
    // TODO: store payment information such as the transaction ID
    res.json(captureData);
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

//////////////////////
// PayPal API helpers
//////////////////////

// use the orders api to create an order
async function createOrder() {
  const accessToken = await generateAccessToken();
  const url = `${paypalBaseURL}/v2/checkout/orders`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "GBP",
            value: "5.00",
          },
        },
      ],
    }),
  });
  const data = await response.json();
  return data;
}

// use the orders api to capture payment for an order
async function capturePayment(orderId: any) {
  const accessToken = await generateAccessToken();
  const url = `${paypalBaseURL}/v2/checkout/orders/${orderId}/capture`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const data = await response.json();
  return data;
}

// generate an access token using client id and app secret
async function generateAccessToken() {
  const auth = Buffer.from(process.env.PAYPAL_CLIENT_ID + ":" + process.env.PAYPAL_CLIENT_SECRET).toString("base64")
  const response = await fetch(`${paypalBaseURL}/v1/oauth2/token`, {
    method: "POST",
    body: "grant_type=client_credentials",
    headers: {
      Authorization: `Basic ${auth}`,
    },
  });
  const data = await response.json();
  return data.access_token;
}
