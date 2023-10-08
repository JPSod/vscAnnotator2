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
import { spawn } from 'child_process';
import { ComplianceScore, FailedFunction} from "./types/types";
const path = require('path');

// Initialize a DataSource for TypeORM to connect to PostgreSQL
export const conn = new DataSource({
  type: "postgres",
  database: "vscribe",
  username: "postgres",
  password: "postgres",
  entities: [join(__dirname, "./entities", "*.*")],
  logging: !__prod__,
  synchronize: !__prod__,
});

const runPythonScript = (args: string[]): Promise<ComplianceScore> => {
  return new Promise<ComplianceScore>((resolve, reject) => {
    // Specify the full path to the Anaconda Python executable
    const pythonExecutable = 'C:/Users/joaop/anaconda3/python.exe';
    const condaEnvName = 'MScBERT'; 
    const pythonWrapperScript = path.join(__dirname, '..', 'modules', 'condaWrapper.py');   
    const pythonScript = path.join(__dirname, '..', 'modules', 'scanAnalyzer.py');

    const pythonArgs = [
      pythonScript,
      '--pythonCode', args[0], // Pass the Python code as an argument to the Python script
      '--rulestext', args[1]  // Pass the standard as an argument to the Python script
    ];

    // Create a new Python child process with the specified Python executable
    const pythonProcess = spawn(pythonExecutable, [
      pythonWrapperScript,
      condaEnvName,
      ...pythonArgs
    ]);

    let pythonOutput = '';
    let complianceScore = {
      compliancePercentage: 0.0,
      failedFunctions: []
    };

    pythonProcess.stdout.on('data', (data) => {
      pythonOutput += data.toString();
    
      // Check if the line contains "output_json ="
      if (data.includes('output_json =')) {
        // Extract the output_json line and parse it
        const lines = pythonOutput.split('\n');
        for (const line of lines) {
          if (line.includes('output_json =')) {
            const outputJsonLine = line.split('output_json =')[1].trim();
            complianceScore = JSON.parse(outputJsonLine);
            console.log('Captured JSON:', complianceScore);
            break;
          }
        }
      }
    });
    
    // Handle standard error data from the Python script
    pythonProcess.stderr.on('data', (data) => {
      console.error(`Python Script Error: ${data}`);
    });
    

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        console.log('Python Script Exited Successfully');
        console.log('Compliance Percentage:', complianceScore.compliancePercentage);
        console.log('Failed Functions:', complianceScore.failedFunctions);
        resolve(complianceScore);
      } else {
        console.error(`Python Script Exited with Code ${code}`);
        reject(`Python Script Exited with Code ${code}`);
      }
    });
  });
}


// Determine the PayPal environment (sandbox or production)
const environment = process.env.PAYPAL_ENVIRONMENT as string || "sandbox";

// Define the PayPal base URL based on the environment
const paypalBaseURL = environment === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";

// Define the main function as an asynchronous function
const main = async () => {
  try {
    // Initialize the TypeORM connection to the database
    await conn.initialize();
    console.log('Database connection established:', conn.isInitialized);
  } catch (error) {
    console.error('Database connection error:', error);
  }

  // Configure passport for user authentication
  passport.serializeUser(function(user: any, done) {
    done(null, user.accessToken);
  });

  passport.deserializeUser(function(obj: false | null | undefined | User, done) {
    done(null, obj);
  });

  passport.use(
    // Configure GitHub authentication strategy
    new GitHubStrategy({
      clientID: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
      callbackURL: "http://localhost:3002/auth/github/callback"
    },
    async (_: any, __: any, profile: any, cb: (arg0: null, arg1: { accessToken: string; }) => any) => {
      // Check if the user exists in the database, create or update as needed
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
      // Generate an access token and pass it to the callback
      cb(null, {
        accessToken: jwt.sign({ userId: user.id }, process.env.JWT_ACCESS as string, {
          expiresIn: "1y",
        }),
      });
    }
  ));

  // Create an Express application
  var app = express();

  const oneDay = 1000 * 60 * 60 * 24;

  // Configure Express session middleware
  app.use(session({
    secret: process.env.SESSION_SECRET as string,
    saveUninitialized: true,
    cookie: { maxAge: oneDay },
    resave: false 
  }));

  // Enable CORS for all routes
  app.use(cors({origin: '*'}));

  // Parse incoming JSON requests
  app.use(express.json());

  // Initialize Passport and session support
  app.use(passport.initialize());
  app.use(passport.session());

  // Authenticate with GitHub using passport
  app.get('/auth/github',
    passport.authenticate('github'),
    function(_req, _res){
      // The request will be redirected to GitHub for authentication, so this
      // function will not be called.
  });

  // Callback route after GitHub authentication
  app.get('/auth/github/callback', passport.authenticate('github',  { scope: [ 'user:email' ] }),
    (req: any, res) => {
      // Redirect to a client route with the user's access token
      res.redirect(`http://localhost:54321/auth/${req.user.accessToken}`);
    }
  );

  // Fetch scans for a user
  app.get("/scans", async (req: any, res) => {
    try {
      // Fetch scans based on the creatorId
      const scans = await Scan.find({
        where: { creatorId: req.userId, archived: false },
        order: { id: "DESC" },
      });

      // Extract all unique standardIds from the scans
      const standardIds = scans.map((scan) => scan.standardId);

      // Fetch associated standards using the standardIds
      const standards = await conn.getRepository(Standard).findBy({ id: In(standardIds) });

      // Create a map of standardId to the standard name for easy lookup
      const standardNameMap = new Map();
      standards.forEach((standard: { id: number; standard: string; }) => {
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

  app.post('/archive-scan/:scanId', isAuth, async (req: any, res) => {
    try {
      const { scanId } = req.params as { scanId: string };
      // You can perform the archive logic here, e.g., updating the scan's archived status in the database
      // Example: Update the 'archived' field of the scan with the given scanId to true
      const updatedScan = await Scan.update({ id: parseInt(scanId) }, { archived: true });
  
      if (updatedScan) {
        res.status(200).send({ message: 'Scan archived successfully' });
      } else {
        res.status(404).send({ error: 'Scan not found' });
      }
    } catch (error) {
      console.error('Error archiving scan:', error);
      res.status(500).send({ error: error.message });
    }
  });

  // Create a new scan
  app.post("/scans", isAuth, async (req: any, res) => {
    try {
      // Check if the text length is too long
      if (req.body.value.length > 50000) {
        res.status(400).json({ error: "Text too long" });
        return;
      }

      // Use axios to get the standard from the database
      const standard = await Standard.findOneBy({id: req.body.standardId});

      // Check if the standard exists
      if (!standard) {
        res.status(400).json({ error: "Standard not found" });
        return;
      }

      // Import the analyzeCompliance function from the compliance module
      const pythonCode = req.body.value;
      const rules = standard.content;
      let args = [pythonCode, rules];

      // Run the Python script and wait for it to complete
      const complianceScore: ComplianceScore = await runPythonScript(args);

      // Create a new scan and save it
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

  // Fetch user-specific standards
  app.get("/standards", async (req: any, res) => {
    const standards = await Standard.find({where: {creatorId: req.userId}, order: {id: "DESC"}});
    res.send({ standards });
  });

  // Create a new standard
  app.post("/standards", isAuth, async (req: any, res) => {
    try {
      // Check if the content length is too long
      if (req.body.content.length > 50000) {
        return res.status(400).send('Text too Long');
      }

      const user = await User.findOne({ where: { id: req.userId } });

      if (!user || !user.paying) {
        const standards = await Standard.find({where: {creatorId: req.userId}, order: {id: "DESC"}});
        if (standards.length >= 1)
        return res.status(401).send('Not Authorized');
      }

      // Create a new standard and save it
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
     return;
  });

  // Update an existing standard
  app.post("/update-standard", isAuth, async (req: any, res) => {
    try {
      // Check if the content length is too long
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

  // Send scan information via email
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

      const failedFunctions: FailedFunction[] = selectedScan.failedFunctions as FailedFunction[];

      const formattedFailedFunctions = failedFunctions.map((failedFunction) => {
        return `
          <li>
            <p><strong>Rule:</strong> ${failedFunction['Rule']}</p>
            <p><strong>Function/Class:</strong></p>
            <pre><code>${failedFunction['Function/Class']}</code></pre>
          </li>
        `;
      });

      // Update the email content
      const emailContent = `
        <h1>Scan Information</h1>
        <p><strong>Scan ID:</strong> ${selectedScan.id}</p>
        <p><strong>Standard:</strong> ${standardName}</p>
        <p><strong>Compliance Percentage:</strong> ${selectedScan.value}</p>
        <p><strong>File:</strong> ${selectedScan.file}</p>
        <h2>Failed Functions:</h2>
        <ul>
          ${formattedFailedFunctions.join('')}
        </ul>
        <p><strong>Created Date:</strong> ${selectedScan.createdDate}</p>
      `;

      // Configure Nodemailer transporter (SMTP settings)
      const transporter = nodemailer.createTransport({
        service: 'Gmail', // e.g., 'Gmail', 'Outlook'
        auth: {
          user: process.env.GMAIL_USER as string,
          pass: process.env.GMAIL_PASS as string,
        },
      });

      // Define email options
      const mailOptions = {
        from: 'your-email@example.com',
        to: email,
        subject: `Scan Information: Scan ID: ${scanId}`,
        html: emailContent,
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

  // Create a new PayPal order
  app.post("/create-paypal-order", async (_req, res) => {
    const order = await createOrder();
    res.json(order);
  });

  // Capture a PayPal payment and store order information
  app.post("/capture-paypal-order", async (req, res) => {
    const { orderID } = req.body;
    const captureData = await capturePayment(orderID);
    // TODO: Store payment information such as the transaction ID
    res.json(captureData);
  });

  // Fetch user information
  app.get("/me", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.send({ user: null });
      return;
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      res.send({ user: null });
      return;
    }

    let userId: number | null | undefined;

    try {
      const payload: any = jwt.verify(token, process.env.JWT_ACCESS as string);
      userId = payload.userId;

    } catch (err){
      res.send({ user: null });
      console.log(err);
      return;
    }

    if (!userId) {
      res.send({ user: null });
      return;
    }

    const user = await User.findOneBy({id: userId});
    res.json({ user });
  });

  // Define a simple root route
  app.get("/", (_req, res) => {
    res.send("hello");
  });

  // Start the Express server
  app.listen(3002, () => {
    console.log("listening on localhost:3002");
  });
};

// Call the main function to start the application
main();

//////////////////////
// PayPal API helpers
//////////////////////

// Use the orders API to create an order
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

// Use the orders API to capture payment for an order
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

// Generate an access token using client id and app secret
async function generateAccessToken() {
  const auth = Buffer.from(process.env.PAYPAL_CLIENT_ID as string + ":" + process.env.PAYPAL_CLIENT_SECRET as string).toString("base64")
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
