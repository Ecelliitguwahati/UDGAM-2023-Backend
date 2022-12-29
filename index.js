const PORT = process.env.PORT || 5000;
const express = require('express');
const app = express();
const { mongoClient, MongoClient } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cors = require('cors');
const Razorpay = require('razorpay');
const saltRounds = 10;
const mongoose = require('mongoose');
var nodemailer = require("nodemailer");
require('dotenv').config();

// const url = process.env.URI
console.log(process.env.URI)
const url = process.env.URI
app.use(express.json());
const connectionParams = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}
mongoose.connect(url, connectionParams)
  .then(() => {
    console.log('Connected to database ')
  })
  .catch((err) => {
    console.error(`Error connecting to the database. \n${err}`);
  })


app.use(cors());

app.use(express.json({ exrended: false }));


app.get('/', (req, res) => {
  res.json('hello this is raj');
})

//schema for payment
const OrderSchema = new mongoose.Schema({
  isPaid: Boolean,
  amount: Number,
  razorpay: {
    orderId: String,
    paymentId: String,
    signature: String
  },
});

const Order = mongoose.model('Order', OrderSchema);

app.get('get-razorpay-key', (req, res) => {
  res.send({ key: process.env.RAZORPAY_KEY_ID });
})
app.get('/get-razorpay-key', (req, res) => {
  res.send({ key: process.env.RAZORPAY_KEY_ID });
});

app.post('/create-order', async (req, res) => {
  try {
    console.log("I am here")
    const instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_SECRET,
    });
    const options = {
      amount: req.body.amount,
      currency: 'INR',
    };
    const order = await instance.orders.create(options);
    if (!order) return res.status(500).send('Some error occured');
    res.send(order);
  } catch (error) {

    console.log(error)
    res.status(500).send(error);
  }
});

app.post('/pay-order', async (req, res) => {
  try {
    const { amount, razorpayPaymentId, razorpayOrderId, razorpaySignature } =
      req.body;
    const newOrder = Order({
      isPaid: true,
      amount: amount,
      razorpay: {
        orderId: razorpayOrderId,
        paymentId: razorpayPaymentId,
        signature: razorpaySignature,
      },
    });
    await newOrder.save();
    res.send({
      msg: 'Payment was successfull',
    });
  } catch (error) {
    console.log(error);
    res.status(500).send(error);
  }
});
//register

app.post('/registersave', async (req, res) => {
  console.log("I am here registering")
  const client = new MongoClient(url);
  const { lastName, firstName, outlook, rollNo, email, password } = req.body;
  client.connect();
  const database = client.db('app-data');
  const users = database.collection('usersData');
  try {
    const existingUser = await users.findOne({ email });
    console.log(existingUser)
    if (existingUser) {
      console.log('user already exists');
      res.status(201).send({ message: "You had already purchased the UDGAM Pass. Still you will be mailed for the same." });
    }
  } catch (err) {
    console.log(err);
    return res.status(500).send({ message: err.message });
  }
  const generatedId = uuidv4();
  // const salt = await bcrypt.genSalt(10);
  // const hashedPassword = await bcrypt.hash(password,salt);
  bcrypt.genSalt(saltRounds, function (err, salt) {
    bcrypt.hash(password, salt, async function (err, hash) {
      try {

        const sanitizedEmail = email// === 'string' ? email.toLowerCase() : '';
        const sanitizedName = firstName
        const sanitizedLastname = lastName
        const data = {
          user_id: generatedId,
          firstName: sanitizedName,
          lastName: sanitizedLastname,
          outlook: outlook,
          rollno: rollNo,
          email: sanitizedEmail,
          hashedPassword: hash,
        }
        await users.insertOne(data);
        res.status(201).json({ userId: generatedId });
      } catch (err) {
        return res.status(500).send({ message: err.message });
      }
    });
  });



})

app.post('/checkifpurchased', async (req, res) => {
  console.log("I am here checking")
  const client = new MongoClient(url);
  const { email } = req.body;
  client.connect();
  const database = client.db('app-data');
  const users = database.collection('usersData');
  try {
    const existingUser = await users.findOne({ email });
    console.log(existingUser)
    if (existingUser) {
      console.log('user already exists');
      res.status(201).send({ message: "YES" });
    }
    else {
      res.status(201).send({ message: "NO" });
    }
  } catch (err) {
    console.log(err);
    return res.status(500).send({ message: err.message });
  }
});

var transporter = nodemailer.createTransport({
  service: "outlook", // hostname
  secureConnection: false, // TLS requires secureConnection to be false
  port: 587, // port for secure SMTP
  tls: {
    ciphers: "SSLv3",
  },
  auth: {
    user: process.env.USEREMAIL,
    pass: process.env.USERPASSWORD,
  },
});

app.post('/mailpass', async (req, res) => {
  console.log("I am here checking")
  const client = new MongoClient(url);
  const { email } = req.body;
  client.connect();
  const database = client.db('app-data');
  const users = database.collection('usersData');
  try {
    const existingUser = await users.findOne({ email });
    console.log(existingUser)
    if (existingUser) {
      var mailOptions = {
        from: `UDGAM 2023 <${process.env.USEREMAIL}>`,
        to: existingUser.email,
        subject: "Welcome to UDGAM 2023",
        html: `Hi ${existingUser.firstName},
              <br><br>
              Thanks for registering for UDGAM and purchasing the pass!
              <br>
              Here is your pass credentials<br>
              <b>Email- ${email}</b><br>
              <b>Unique ID- </b><br><br>
              Regards,<br>
              UDGAM Web Operations`,
      };
      //sending verification mail
      transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
          res.status(500).send({ message: error });
        }
        res.status(201).send({ message: "YES" });
      });
    }
    else{
      res.status(201).send({ message: "NO" });
    }
  } catch (err) {
    console.log(err);
    return res.status(500).send({ message: err.message });
  }
});

app.listen(PORT, () => {
  console.log('server is running on port ' + PORT);
})