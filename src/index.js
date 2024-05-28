const express = require("express");
const session = require("express-session");
const UserModel = require("./config");
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const http = require('http');
const socketIo = require('socket.io');
const cron = require('node-cron');
const africastalking = require('africastalking'); // Import Africa's Talking SDK
const path = require('path');

// Initialize Africa's Talking SDK with your credentials
const username = 'VenusCompany';
const apiKey = '5816663231f41682288749bb987f605bddbed649dbcf53712d7342c524a2b07c';
const africastalkingOptions = {
  apiKey,
  username
};
// Here you should use a different variable name to avoid redeclaration
const africastalkingClient = africastalking(africastalkingOptions);

// Create a new Express application
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Express middleware and configuration
app.use(express.json());
app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));
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

// Add this route to your backend code

app.post("/fetchUsername", async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    // Find user by phone number
    const user = await UserModel.findOne({ phoneNumber: phoneNumber });

    if (user) {
      return res.status(200).json({ username: user.name });
    } else {
      return res.status(404).json({ error: "User not found" });
    }
  } catch (error) {
    console.error("Error fetching username:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

const sendSMS = async (phoneNumber, username, amount) => {
  try {
    // Remove leading '0' from the phone number and add the country code prefix +254 (Kenya)
    const formattedPhoneNumber = `+254${phoneNumber.replace(/^0+/, '')}`;
    
    // Create the personalized message using template literals
    const message = `You have received a transfer of Ksh ${amount} from ${username}. Log in to venus.co.ke to view your balance.`;
    // Send the personalized SMS via Africa's Talking SMS service
    const smsResponse = await africastalkingClient.SMS.send({
      to: [formattedPhoneNumber],
      message: message
    });

    console.log('Message sent successfully:', smsResponse);
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};


app.post('/transfer', async (req, res) => {
  const { senderPhoneNumber, receiverPhoneNumber, amount } = req.body;

  try {
    // Check if sender and receiver phone numbers are the same
    if (senderPhoneNumber === receiverPhoneNumber) {
        return res.status(400).json({ success: false, error: 'Same Account tranfer not allowed!' });
    }

    // Parse the amount to a float
    const transferAmount = parseFloat(amount);

      // Check if the parsed amount is a valid number
      if (isNaN(transferAmount)) {
          return res.status(400).json({ success: false, error: 'Invalid amount' });
      }

      // Find the users involved in the transfer based on phone numbers
      const senderUser = await UserModel.findOne({ phoneNumber: senderPhoneNumber });
      const receiverUser = await UserModel.findOne({ phoneNumber: receiverPhoneNumber });

      if (!senderUser) {
          return res.status(404).json({ success: false, error: 'Sender user not found' });
      }

      if (!receiverUser) {
          return res.status(404).json({ success: false, error: 'Receiver user not found' });
      }

      // Ensure the senderUser has enough investmentAmount
      if (senderUser.investmentAmount < transferAmount) {
          return res.status(400).json({ success: false, error: 'Insufficient investment amount' });
      }


      // Perform the transfer
      senderUser.investmentAmount -= transferAmount;
      receiverUser.investmentAmount += transferAmount;

      await senderUser.save();
      await receiverUser.save();

      // Send the SMS to the sender
      await sendSMS(receiverUser.phoneNumber, senderUser.name, transferAmount);

   // Send success response with receiver's username, transfer amount, and HTML content
res.json({ 
  success: true, 
  receiverUsername: receiverUser.name, 
  amount: transferAmount,
  htmlContent: `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta http-equiv="content-type" content="text/html; charset=UTF-8">
      <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Registration Successful Message Example</title>
      <meta name="author" content="Codeconvey">
      <!-- Message Box CSS -->
      <style>
          body {
              background: #1488EA;
          }
  
          #card {
              position: relative;
              width: 320px;
              display: block;
              margin: 40px auto;
              text-align: center;
              font-family: 'Source Sans Pro', sans-serif;
          }
  
          #upper-side {
              padding: 2em;
              background-color: #8BC34A;
              display: block;
              color: #fff;
              border-top-right-radius: 8px;
              border-top-left-radius: 8px;
          }
  
          #checkmark {
              font-weight: lighter;
              fill: #fff;
              margin: -3.5em auto auto 20px;
          }
  
          #status {
              font-weight: lighter;
              text-transform: uppercase;
              letter-spacing: 2px;
              font-size: 1em;
              margin-top: -.2em;
              margin-bottom: 0;
          }
  
          #lower-side {
              padding: 2em 2em 5em 2em;
              background: #fff;
              display: block;
              border-bottom-right-radius: 8px;
              border-bottom-left-radius: 8px;
          }
  
          #message {
              margin-top: -.5em;
              color: #757575;
              letter-spacing: 1px;
          }
  
          #contBtn {
              position: relative;
              top: 1.5em;
              text-decoration: none;
              background: #8bc34a;
              color: #fff;
              margin: auto;
              padding: .8em 3em;
              -webkit-box-shadow: 0px 15px 30px rgba(50, 50, 50, 0.21);
              -moz-box-shadow: 0px 15px 30px rgba(50, 50, 50, 0.21);
              box-shadow: 0px 15px 30px rgba(50, 50, 50, 0.21);
              border-radius: 25px;
              -webkit-transition: all .4s ease;
              -moz-transition: all .4s ease;
              -o-transition: all .4s ease;
              transition: all .4s ease;
          }
  
          #contBtn:hover {
              -webkit-box-shadow: 0px 15px 30px rgba(50, 50, 50, 0.41);
              -moz-box-shadow: 0px 15px 30px rgba(50, 50, 50, 0.41);
              box-shadow: 0px 15px 30px rgba(50, 50, 50, 0.41);
              -webkit-transition: all .4s ease;
              -moz-transition: all .4s ease;
              -o-transition: all .4s ease;
              transition: all .4s ease;
          }
      </style>
      <!--Only for demo purpose - no need to add.-->
      <!-- <link rel="stylesheet" href="css/demo.css"> -->
    </head>
    <body>
      <section>
        <div class="rt-container">
          <div class="col-rt-12">
            <div class="Scriptcontent">
              <!-- partial:index.partial.html -->
              <div id="card" class="animated fadeIn">
                <div id="upper-side">
                  <?xml version="1.0" encoding="utf-8"?>
                  <!-- Generator: Adobe Illustrator 17.1.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->
                  <svg version="1.1" id="checkmark" xmlns="http://www.w3.org/2000/svg"
  
                    xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" xml:space="preserve">
                    <path d="M131.583,92.152l-0.026-0.041c-0.713-1.118-2.197-1.447-3.316-0.734l-31.782,20.257l-4.74-12.65
      c-0.483-1.29-1.882-1.958-3.124-1.493l-0.045,0.017c-1.242,0.465-1.857,1.888-1.374,3.178l5.763,15.382	c0.131,0.351,0.334,0.65,0.579,0.898c0.028,0.029,0.06,0.052,0.089,0.08c0.08,0.073,0.159,0.147,0.246,0.209    c0.071,0.051,0.147,0.091,0.222,0.133c0.058,0.033,0.115,0.069,0.175,0.097c0.081,0.037,0.165,0.063,0.249,0.091	c0.065,0.022,0.128,0.047,0.195,0.063c0.079,0.019,0.159,0.026,0.239,0.037c0.074,0.01,0.147,0.024,0.221,0.027    c0.097,0.004,0.194-0.006,0.292-0.014c0.055-0.005,0.109-0.003,0.163-0.012c0.323-0.048,0.641-0.16,0.933-0.346l34.305-21.865	C131.967,94.755,132.296,93.271,131.583,92.152z"></path>
                    <circle fill="none" stroke="#ffffff" stroke-width="5" stroke-miterlimit="10"
  
                      cx="109.486" cy="104.353" r="32.53"></circle> </svg>
                                  <h3 id="status">Transfer Success!!</h3>
                              </div>
                              <div id="lower-side">
                                  <p id="message">You have successfully transferred Ksh ${transferAmount} to ${receiverUser.name}.</p>
                                  <a href="/login2" id="contBtn">Continue</a>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          </section>
      </body>
      </html>
  `
});


  } catch (error) {
    console.error('Error during transfer:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});


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

app.get("/transfer", (req, res) => {
  res.render("transfer");
});

app.get("/transfer_success", (req, res) => {
  res.render("transfer_success");
});

app.get("/login3", (req, res) => {
  res.render("login3");
});

app.get("/error", (req, res) => {
  res.render("error");
});

const sendOTP = async (phoneNumber, otp) => {
  try {
    // Remove leading '0' and add the country code prefix
    const formattedPhoneNumber = `+254${phoneNumber.replace(/^0+/, '')}`;

    const smsResponse = await africastalkingClient.SMS.send({
      to: [formattedPhoneNumber],
      message: `Your OTP is: ${otp}`
    });
    console.log('OTP sent successfully:', smsResponse);
  } catch (error) {
    console.error('Error sending OTP:', error);
    throw error;
  }
}


// Function to verify OTP
const verifyOTP = (enteredOTP, expectedOTP) => {
  return enteredOTP === expectedOTP;
};

// Generate a random 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000);
};

let storedOTP = null; // Store OTP temporarily for demonstration purposes
let storedData = {}; // Store the data for later use after OTP verification

// Endpoint to update credentials
app.post("/update_credentials", async (req, res) => {
  const { phoneNumber, phoneNumberUsername, passwordCheckbox, newPassword, confirmPassword, usernameCheckbox, newUsername, confirmUsername } = req.body;

  try {
      let otp = null;

      if (passwordCheckbox) {
          // Password change request
          if (newPassword !== confirmPassword) {
              return res.status(400).send("Passwords don't match");
          }

          otp = generateOTP(); // Generate OTP for password change
          storedData = { phoneNumber, passwordCheckbox, newPassword }; // Store data
      } else if (usernameCheckbox) {
          // Username change request
          if (newUsername !== confirmUsername) {
              return res.status(400).send("Usernames don't match");
          }

          otp = generateOTP(); // Generate OTP for username change
          storedData = { phoneNumber: phoneNumberUsername, usernameCheckbox, newUsername }; // Use phoneNumberUsername if usernameCheckbox is selected
      } else {
          return res.status(400).send("Please select what you want to change.");
      }

      // Check if the phone number exists
      const user = await UserModel.findOne({ phoneNumber: phoneNumberUsername || phoneNumber }); // Use phoneNumberUsername if available, else use phoneNumber
      if (!user) {
          return res.status(404).send("Phone number doesn't exist");
      }


   // If all checks pass, send OTP
storedOTP = otp; // Store OTP temporarily
await sendOTP(phoneNumberUsername || phoneNumber, otp); // Use phoneNumberUsername if available, else use phoneNumber



    // Clear the stored OTP after 1 minute
setTimeout(() => {
  storedOTP = null;
  console.log('Stored OTP has been cleared');
}, 60000); // 60000 milliseconds = 1 minute


    // Render the OTP page
    res.render('OTP', { phoneNumber });

  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal Server Error");
  }
});

// Endpoint to verify OTP
app.post("/verify_otp", async (req, res) => {
  const { enteredOTP } = req.body;

  try {
    // Retrieve the expected OTP
    const expectedOTP = storedOTP.toString(); // Ensure consistent format

    // Check for null or undefined stored OTP
    if (!expectedOTP) {
      return res.status(400).send("Stored OTP not found. Please try again.");
    }

    // Verify OTP using exact comparison
    if (enteredOTP === expectedOTP) {
      // OTP verification successful, proceed with credential update
      const user = await UserModel.findOne({ phoneNumber: storedData.phoneNumber });
      if (storedData.passwordCheckbox) {
        // Update the password
        const hashedPassword = await bcrypt.hash(storedData.newPassword, 10);
        user.password = hashedPassword;
        await user.save();
        return res.status(200).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Updated</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              background-color: white;
            }
            .container {
              text-align: center;
              margin-top: 50px;
            }
            .success-message {
              background-color: #1e90ff;
              color: white;
              padding: 20px;
              border-radius: 10px;
              box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
              max-width: 400px;
              margin: 0 auto;
            }
            .success-message a {
              color: white;
              text-decoration: underline;
              display: block;
              margin-bottom: 10px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-message">
              <h2>Success!</h2>
              <p>Password updated successfully.</p>
              <a href="/login2">Login</a>
            </div>
          </div>
        </body>
        </html>
      `);
      
      } else if (storedData.usernameCheckbox) {
        // Update the username
        user.name = storedData.newUsername;
        await user.save();
        return res.status(200).send(`
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Username Updated</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        background-color: white;
      }
      .container {
        text-align: center;
        margin-top: 50px;
      }
      .success-message {
        background-color: #1e90ff;
        color: white;
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        max-width: 400px;
        margin: 0 auto;
      }
      .success-message a {
        color: white;
        text-decoration: underline;
        display: block;
        margin-bottom: 10px;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="success-message">
        <h2>Success!</h2>
        <p>Username updated successfully.</p>
        <a href="/login2">Login</a>
      </div>
    </div>
  </body>
  </html>
`);

      }
    } else {
      // OTP verification failed
      return res.status(400).send(`
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invalid OTP</title>
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
        <p>Invalid OTP. Please try again.</p>
        <a href="/changes">Resend OTP</a>
      </div>
    </div>
  </body>
  </html>
`);

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
          referrer.referralEarnings += 1195;
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

app.post("/login3", async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    const user = await UserModel.findOne({ phoneNumber });

    if (!user) {
      const htmlResponse = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Oops! Incorrect Phone Number</title>
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
              <p>Incorrect phone number!</p>
              <a href="/login3">Try again</a>
            </div>
          </div>
        </body>
        </html>
      `;
      return res.status(401).send(htmlResponse);
    }

    const otp = generateOTP(); // Implement this function to generate an OTP
    storedOTP = otp;
    storedData = { phoneNumber, username: user.name, investmentAmount: user.investmentAmount };

    await sendOTP(phoneNumber, otp); // Your function to send OTP

     // Clear the stored OTP after 1 minute
setTimeout(() => {
  storedOTP = null;
  console.log('Stored OTP has been cleared');
}, 60000); // 60000 milliseconds = 1 minute

    res.render('OTP1', { 
      phoneNumber, 
      username: user.name, 
      investmentAmount: user.investmentAmount 
    });

  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal Server Error");
  }
});

// OTP Verification Endpoint
app.post("/verify_otp1", async (req, res) => {
  const { enteredOTP, phoneNumber, username, investmentAmount } = req.body;

  try {
    const expectedOTP = storedOTP.toString();

    if (!expectedOTP) {
      return res.status(400).send("Stored OTP not found. Please try again.");
    }

    if (enteredOTP === expectedOTP) {
      storedOTP = null; // Clear the stored OTP after successful verification
      res.render('transfer', { phoneNumber, username, investmentAmount });
    } else {
      return res.status(400).send("Invalid OTP. Please try again.");
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