const express = require("express");
const session = require("express-session");
const UserModel = require("./config");
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const http = require('http');
const socketIo = require('socket.io');
const cron = require('node-cron'); // Import node-cron

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.json());
app.use(express.static("public"));
app.use(express.urlencoded({ extended: false }));
app.set("view engine", "ejs");
app.use(session({ secret: 'your_secret_here', resave: false, saveUninitialized: true }));

// Define Socket.IO setup
io.on('connection', (socket) => {
  console.log('A user connected');

  // Handle loan updates
  socket.on('updateLoanValues', async (data) => {
    try {
      const { username } = data;
      const user = await UserModel.findOne({ name: username });

      if (user) {
        // Emit the updated loan values to all connected clients
        io.emit('loanValuesUpdated', {
          loanLimit: user.loanLimit,
          loanIssued: user.loanIssued,
          loanPayable: user.loanPayable,
          paymentDeadline: user.paymentDeadline
        });
      }
    } catch (error) {
      console.error('Error updating loan values:', error);
    }
  });
});

// Define the cron job to handle timer expiration
cron.schedule('0 0 * * *', async () => {
  try {
    // Retrieve all users from the database
    const users = await UserModel.find();

    // Iterate through each user and handle timer expiration
    for (const user of users) {
      // Pass necessary parameters to handleTimerExpiration function
      await handleTimerExpiration(user.phoneNumber);
    }

    console.log('Timer expiration handled for all users.');
  } catch (error) {
    console.error('Error handling timer expiration for all users:', error);
  }
});

async function startCountdownTimer(req, phoneNumber) {
  try {
    const user = await UserModel.findOne({ phoneNumber: phoneNumber });
    if (user && !user.countdownStartTime) {
      user.countdownStartTime = new Date();
      const totalDuration = (7 * 24 * 60 * 60 * 1000) - (2 * 60 * 1000);
      user.remainingTime = totalDuration;
      await user.save();
      console.log(`Countdown timer started for user ${phoneNumber}`);
      req.session.countdownStartTime = user.countdownStartTime;
      req.session.remainingTime = user.remainingTime;
    } else if (user && user.countdownStartTime && user.remainingTime > 0) {
      const currentTime = new Date();
      const elapsedTime = currentTime - user.countdownStartTime;
      user.remainingTime -= elapsedTime;
      user.countdownStartTime = currentTime;
      await user.save();
      console.log(`Countdown timer resumed for user ${phoneNumber}`);
      req.session.countdownStartTime = currentTime;
      req.session.remainingTime = user.remainingTime;
    }
  } catch (error) {
    console.error(`Error starting/resuming countdown timer for user ${phoneNumber}:`, error);
  }
}

async function handleTimerExpiration(phoneNumber, req) {
  try {
    const user = await UserModel.findOne({ phoneNumber: phoneNumber });
    if (user && user.countdownStartTime) {
      const currentTime = new Date();
      const elapsedTime = currentTime - user.countdownStartTime;
      if (elapsedTime >= user.remainingTime) {
        let topupValue = 0;
        if (user.topup) {
          topupValue = parseFloat(user.topup);
          topupValue = Math.round((topupValue + Number.EPSILON) * 100) / 100; // Round to two decimal places
        }
        user.investmentEarnings += topupValue;
        user.countdownStartTime = currentTime;
        user.remainingTime = (7 * 24 * 60 * 60 * 1000) - (2 * 60 * 1000);
        await user.save();
        console.log(`Timer expired for user ${phoneNumber}. Added ${topupValue} to investment earnings.`);
        req.session.countdownStartTime = user.countdownStartTime;
        req.session.remainingTime = user.remainingTime;

        // Restart the timer afresh
        user.countdownStartTime = currentTime;
        user.remainingTime = (7 * 24 * 60 * 60 * 1000) - (2 * 60 * 1000);
        await user.save();
        console.log(`Timer restarted afresh for user ${phoneNumber}`);
        req.session.countdownStartTime = user.countdownStartTime;
        req.session.remainingTime = user.remainingTime;
      }
    } else if (user && user.countdownStartTime && user.investmentAmount === 0) {
      // Pause the timer when the investment amount is zero
      user.countdownStartTime = null;
      user.remainingTime = null;
      await user.save();
      console.log(`Timer paused for user ${phoneNumber}`);
      req.session.countdownStartTime = null;
      req.session.remainingTime = null;
    }
  } catch (error) {
    console.error(`Error handling timer expiration for user ${phoneNumber}:`, error);
  }
}




app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/changes", (req, res) => {
  res.render("changes");
});

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Check if the username exists in the database
    const user = await UserModel.findOne({ name: username });

    // If both username and password are not found, return "Account does not exist"
    if (!user && !password) {
      return res.status(404).send("Account does not exist");
    }

    // If the username doesn't exist in the database, return "Incorrect username"
    if (!user) {
      const htmlResponse = `
          <!DOCTYPE html>
          <html lang="en">
          <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Oops! Incorrect Username</title>
              <style>
                  body {
                      font-family: Arial, sans-serif;
                      background-color: white; /* White background */
                  }
                  .container {
                      text-align: center;
                      margin-top: 50px;
                  }
                  .error-message {
                      background-color: #1e90ff; /* Thicker blue background */
                      color: white;
                      padding: 20px;
                      border-radius: 10px;
                      box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                      max-width: 400px;
                      margin: 0 auto;
                  }
                  .error-message a {
                      color: white;
                      text-decoration: underline;
                      margin-top: 10px;
                      display: block;
                  }
              </style>
          </head>
          <body>
              <div class="container">
                  <div class="error-message">
                      <h2>Oops!</h2>
                      <p>Incorrect username</p>
                      <a href="/login">Retry with correct username</a>
                      <a href="/changes">Forgot your username? Click here! to reset it</a>
                  </div>
              </div>
          </body>
          </html>
      `;
      return res.status(401).send(htmlResponse);
  }
  

    // If the password exists but doesn't match, return "Incorrect password"
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      const htmlResponse = `
          <!DOCTYPE html>
          <html lang="en">
          <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Oops! Incorrect Password</title>
              <style>
                  body {
                      font-family: Arial, sans-serif;
                      background-color: white;
                  }
                  .container {
                      text-align: center;
                      margin-top: 50px;
                  }
                  .error-message {
                      background-color: #1e90ff;
                      color: white;
                      padding: 20px;
                      border-radius: 10px;
                      box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                      max-width: 400px;
                      margin: 0 auto;
                  }
                  .error-message h2 {
                      margin-top: 0;
                  }
                  .error-message p {
                      margin-bottom: 20px;
                  }
                  .error-message a {
                      color: white;
                      text-decoration: underline;
                      display: block;
                      margin-bottom: 10px;
                  }
              </style>
          </head>
          <body>
              <div class="container">
                  <div class="error-message">
                      <h2>Oops!</h2>
                      <p>Incorrect password</p>
                      <a href="/login">Retry with correct password</a>
                      <a href="/changes">Forgot your password? Click here! to reset it</a>
                  </div>
              </div>
          </body>
          </html>
      `;
      return res.status(401).send(htmlResponse);
  }
  
  
      await startCountdownTimer(req, username);
      await handleTimerExpiration(username, req);
  
      const currentTime = new Date();
      const elapsedMilliseconds = currentTime - user.countdownStartTime;
      const adjustedRemainingTime = Math.max(user.remainingTime - elapsedMilliseconds, 0);
  
      return res.render("home", {
        username: user.name,
        investmentAmount: user.investmentAmount,
        investmentEarnings: user.investmentEarnings,
        referralEarnings: user.referralEarnings,
        referralCredits: user.referralCredits,
        referralCode: user.referralCode,
        remainingTime: adjustedRemainingTime
      });
    } catch (error) {
      console.error(error);
      return res.status(500).send("Internal Server Error");
    }
  });

  app.post("/login1", async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await UserModel.findOne({ name: username });

      if (!user) {
        const htmlResponse = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Oops! Incorrect Username</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        background-color: white; /* White background */
                    }
                    .container {
                        text-align: center;
                        margin-top: 50px;
                    }
                    .error-message {
                        background-color: #1e90ff; /* Thicker blue background */
                        color: white;
                        padding: 20px;
                        border-radius: 10px;
                        box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                        max-width: 400px;
                        margin: 0 auto;
                    }
                    .error-message a {
                        color: white;
                        text-decoration: underline;
                        margin-top: 10px;
                        display: block;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="error-message">
                        <h2>Oops!</h2>
                        <p>Incorrect username!</p>
                        <a href="/login1">Use your correct account username</a>
                        <a href="/login2">Forgot your username? re-login here! to reset it</a>
                    </div>
                </div>
            </body>
            </html>
        `;
        return res.status(401).send(htmlResponse);
    }

        const isPasswordMatch = await bcrypt.compare(password, user.password);

        if (!isPasswordMatch) {
          const htmlResponse = `
              <!DOCTYPE html>
              <html lang="en">
              <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>Oops! Incorrect Password</title>
                  <style>
                      body {
                          font-family: Arial, sans-serif;
                          background-color: white;
                      }
                      .container {
                          text-align: center;
                          margin-top: 50px;
                      }
                      .error-message {
                          background-color: #1e90ff;
                          color: white;
                          padding: 20px;
                          border-radius: 10px;
                          box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                          max-width: 400px;
                          margin: 0 auto;
                      }
                      .error-message h2 {
                          margin-top: 0;
                      }
                      .error-message p {
                          margin-bottom: 20px;
                      }
                      .error-message a {
                          color: white;
                          text-decoration: underline;
                          display: block;
                          margin-bottom: 10px;
                      }
                  </style>
              </head>
              <body>
                  <div class="container">
                      <div class="error-message">
                          <h2>Oops!</h2>
                          <p>Incorrect password!</p>
                          <a href="/login1">Use your correct account password</a>
                          <a href="/login2">Forgot your password? re-login here! to reset it</a>
                      </div>
                  </div>
              </body>
              </html>
          `;
          return res.status(401).send(htmlResponse);
      }

        await startCountdownTimer(req, username);
        await handleTimerExpiration(username, req);

        const currentTime = new Date();
        const elapsedMilliseconds = currentTime - user.countdownStartTime;
        const adjustedRemainingTime = Math.max(user.remainingTime - elapsedMilliseconds, 0);

        return res.render("loansportal", {
            username: user.name,
            loanLimit: user.loanLimit,
            loanIssued: user.loanIssued,
            loanPayable: user.loanPayable,
            paymentDeadline: user.paymentDeadline
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send("Internal Server Error");
    }
})
  
  app.get("/", (req, res) => {
    res.render("login");
  });
  
  app.get("/signup", (req, res) => {
    res.render("signup");
  });
app.get('/investments', (req, res) => {
  res.render('investments');
});

app.get("/signup_success", (req, res) => {
  res.render("signup_success");
});

app.get('/invpayments', (req, res) => {
  res.render('invpayments'); 
});

app.get('/loansform', (req, res) => {
  res.render('loansform'); 
});

app.get('/loansportal', (req, res) => {
  res.render('loansportal'); 
});

app.get('/investment_success', (req, res) => {
  res.render('investment_success'); 
});

app.get("/login1", (req, res) => {
  res.render("login1");
});

app.get("/loansapply", (req, res) => {
  res.render("loansapply");
});

app.get("/jobs", (req, res) => {
  res.render("jobs");
});

app.get("/login2", (req, res) => {
  res.render("login2");
});

app.get("/withdraw", (req, res) => {
  res.render("withdraw");
});


app.post("/update_credentials", async (req, res) => {
  const { phoneNumber, passwordCheckbox, newPassword, confirmPassword, usernameCheckbox, newUsername, confirmUsername } = req.body;

  try {
    if (passwordCheckbox) {
      // Password change request
      if (newPassword !== confirmPassword) {
        return res.status(400).send("Passwords don't match");
      }

      // Check if the phone number exists
      const user = await UserModel.findOne({ phoneNumber });
      if (!user) {
        return res.status(404).send("Phone number doesn't exist");
      }

      // Update the password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
      await user.save();

      return res.status(200).send("Password updated successfully");
    } else if (usernameCheckbox) {
      // Username change request
      if (newUsername !== confirmUsername) {
        return res.status(400).send("Usernames don't match");
      }

      // Check if the phone number exists
      const user = await UserModel.findOne({ phoneNumber });
      if (!user) {
        return res.status(404).send("Phone number doesn't exist");
      }

      // Update the username
      user.name = newUsername;
      await user.save();

      return res.status(200).send("Username updated successfully");
    } else {
      return res.status(400).send("Please select what you want to change.");
    }
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal Server Error");
  }
});

app.post("/signup", async (req, res) => {
  const { username, password, phoneNumber, referralCode } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    let data = {
      name: username,
      password: hashedPassword,
      phoneNumber,
      referralCode: uuidv4(),
      investmentAmount: 0,
      investmentEarnings: 0,
      referralEarnings: 0,
      referralCredits: 0,
      referredBy: null,
      countdownStartTime: null,
      remainingTime: 0,
      loanLimit: 0, // Add loan limit field
      loanIssued: 0, // Add loan issued field
      loanPayable: 0, // Add loan payable field
      paymentDeadline: 'N/A' // Add payment deadline field
    };

    const existingUser = await UserModel.findOne({ name: username });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    if (referralCode) {
      const referredByUser = await UserModel.findOne({ referralCode });
      if (referredByUser) {
        data.referredBy = referredByUser.name;
        const referrer = await UserModel.findOne({ name: referredByUser.name });
        if (!referrer.referralEarningsUpdated) {
          referrer.referralEarnings += 1000;
          referrer.referralEarningsUpdated = true;
          referrer.referralCredits += 1;
          await referrer.save();
        }
      }
    }

    await UserModel.create(data);

    return res.status(200).json({ message: "Signup successful" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/update_investment_amount", async (req, res) => {
  const { phoneNumber, amount } = req.body;

  try {
    const user = await UserModel.findOne({ phoneNumber });
    if (user) {
      // Ensure amount is treated as a number
      const numericAmount = parseFloat(amount);
      
      if (isNaN(numericAmount)) {
        return res.status(400).json({ error: "Invalid amount value" });
      }

      user.investmentAmount += numericAmount; // Use the numeric amount
      await user.save();

      // Start the timer after updating the investment amount
      await startCountdownTimer(req, user.phoneNumber);
      await handleTimerExpiration(user.phoneNumber, req);

      return res.status(200).json({ message: "Investment amount updated successfully" });
    } else {
      return res.status(404).json({ error: "User not found" });
    }
  } catch (error) {
    console.error(`Error updating investment amount for user ${phoneNumber}:`, error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});



// New route for handling password and username changes
app.post("/changes", async (req, res) => {
  const { phoneNumber, passwordCheckbox, newPassword, confirmPassword, usernameCheckbox, newUsername, confirmUsername } = req.body;

  try {
    if (passwordCheckbox) {
      // Password change request
      if (newPassword !== confirmPassword) {
        return res.status(400).send("Passwords don't match");
      }

      // Check if the phone number exists
      const user = await UserModel.findOne({ phoneNumber });
      if (!user) {
        return res.status(404).send("Phone number doesn't exist");
      }

      // Update the password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
      await user.save();

      return res.status(200).send("Password updated successfully");
    } else if (usernameCheckbox) {
      // Username change request
      if (newUsername !== confirmUsername) {
        return res.status(400).send("Usernames don't match");
      }

      // Check if the phone number exists
      const user = await UserModel.findOne({ phoneNumber });
      if (!user) {
        return res.status(404).send("Phone number doesn't exist");
      }

      // Update the username
      user.name = newUsername;
      await user.save();

      return res.status(200).send("Username updated successfully");
    } else {
      return res.status(400).send("Please select what you want to change.");
    }
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal Server Error");
  }
});

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});