const express = require("express");
const app = express();
const { mongoClient, MongoClient } = require("mongodb");
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const cors = require("cors");
const Razorpay = require("razorpay");
const saltRounds = 10;
const mongoose = require("mongoose");
var nodemailer = require("nodemailer");
const pdfkit = require('pdfkit');
// const blobStream  = require('blob-stream');
// const doc = new PDFDocument;
// const stream = doc.pipe(blobStream());
require("dotenv").config({ path: "./config/config.env" });

const PORT = process.env.PORT || 3000;
// const url = process.env.URI
console.log(process.env.PORT);
const url = process.env.URI;
app.use(express.json());
const connectionParams = {
	useNewUrlParser: true,
	useUnifiedTopology: true,
};

mongoose
	.connect(url, connectionParams)
	.then(() => {
		console.log("Connected to database ");
	})
	.catch((err) => {
		console.error(`Error connecting to the database. \n${err}`);
	});

app.use(cors());

app.use(express.json({ exrended: false }));

app.get("/backend/", (req, res) => {
	res.json("hello this is Raj from UDGAM");
});

//schema for payment
const OrderSchema = new mongoose.Schema({
	isPaid: Boolean,
	amount: Number,
	razorpay: {
		orderId: String,
		paymentId: String,
		signature: String,
	},
});

const Order = mongoose.model("Order", OrderSchema);

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

// app.get('/backend/get-razorpay-key', (req, res) => {
//   res.send({ key: process.env.RAZORPAY_KEY_ID });
// })
app.get("/backend/get-razorpay-key", (req, res) => {
	res.send({ key: process.env.RAZORPAY_KEY_ID });
});

app.post("/backend/create-order", async (req, res) => {
	try {
		console.log("I am here");
		const instance = new Razorpay({
			key_id: process.env.RAZORPAY_KEY_ID,
			key_secret: process.env.RAZORPAY_SECRET,
		});
		const options = {
			amount: req.body.amount,
			currency: "INR",
		};
		const order = await instance.orders.create(options);
		if (!order) return res.status(500).send("Some error occured");
		res.send(order);
	} catch (error) {
		console.log(error);
		res.status(500).send(error);
	}
});

app.post("/backend/pay-order", async (req, res) => {
	try {
		const {
			amount,
			razorpayPaymentId,
			razorpayOrderId,
			razorpaySignature,
		} = req.body;
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
			msg: "Payment was successfull",
		});
	} catch (error) {
		console.log(error);
		res.status(500).send(error);
	}
});
//register
async function generateudgid(min, max, users) { // min and max included 
	udgid = 'UDG-' + Math.floor(Math.random() * (max - min + 1) + min).toString();
	const udgsame = await users.findOne({ udgid });
	if (udgsame) {
		generateudgid(1000, 9999, users);
	}
	else {
		return udgid;
	}
}

app.post("/backend/addtolist", async (req, res) => {
	console.log("I am here registering");
	const client = new MongoClient(url);
	const database = client.db("app-data");
	const users = database.collection("emaillists");
	client.connect();
	const {
		email
	} = req.body;
	const dupemail = email.email;
	const existingUser = await users.findOne({ email: dupemail });
	console.log(existingUser)
	if (existingUser) {
	}
	else {
		await users.insertOne(email);
	}
	return res.status(201).send("YES");
});
app.post("/backend/registersave", async (req, res) => {
	console.log("I am here registering");
	const client = new MongoClient(url);
	const {
		lastName,
		firstName,
		outlook,
		rollno,
		department,
		contact,
		email,
		password,
	} = req.body;

	client.connect();
	var udgid;
	try {
		const database = client.db("app-data");
		const users = database.collection("usersData");
		const existingUser = await users.findOne({ email });
		udgid = await generateudgid(1000, 9999, users);
		console.log(existingUser);
		if (existingUser) {


			console.log("user already exists");
			return res.status(201).send({
				message:
					"You had already purchased the UDGAM Pass. Still you will be mailed for the same.",
			});
		}

		const generatedId = uuidv4();
		// const salt = await bcrypt.genSalt(10);
		// const hashedPassword = await bcrypt.hash(password,salt);
		bcrypt.genSalt(saltRounds, function (err, salt) {
			bcrypt.hash(password, salt, async function (err, hash) {
				try {
					const sanitizedEmail = email; // === 'string' ? email.toLowerCase() : '';
					const sanitizedName = firstName;
					const sanitizedLastname = lastName;
					var data;
					if (outlook && rollno && department) {
						data = {
							udgid: udgid,
							user_id: generatedId,
							firstName: sanitizedName,
							lastName: sanitizedLastname,
							contact: contact,
							outlook: outlook,
							rollno: rollno,
							email: sanitizedEmail,
							department: department,
							hashedPassword: hash,
						};
					}
					else {
						data = {
							udgid: udgid,
							user_id: generatedId,
							firstName: sanitizedName,
							lastName: sanitizedLastname,
							contact: contact,
							email: sanitizedEmail,
							hashedPassword: hash,
						};
					}

					await users.insertOne(data);
					res.status(201).json({ userId: generatedId });
				} catch (err) {
					return res.status(500).send({ message: err.message });
				}
			});
		});
	} catch (err) {
		console.log(err);
		return res.status(500).send({ message: err.message });
	}
});

//RESET PASSWORD REQ
app.post("/backend/resetpasswordreq", async (req, res) => {
	console.log("I am here resetting req");
	const client = new MongoClient(url);
	const { email } = req.body;
	client.connect();
	const database = client.db("app-data");
	const users = database.collection("usersData");
	const tokens = database.collection("tokens");
	await tokens.deleteMany({ email });
	try {
		const existingUser = await users.findOne({ email });
		console.log(existingUser);
		if (existingUser) {
			const generatedId = uuidv4();
			const tokendetails = {
				token: generatedId,
				email: email,
			};
			await tokens.insertOne(tokendetails);
			var mailOptions = {
				from: `UDGAM 2023 <${process.env.USEREMAIL}>`,
				to: existingUser.email,
				subject: "Request for resetting password of UDGAM Pass",
				html: `Hello ${existingUser.firstName},
        <br><br>
        We received a request for resetting your UDGAM Pass password
        <br><br>
        Please set your new password here<br> www.udgamiitg.com/resetpass/do?token=${generatedId}&email=${email}
         <br><br>
        Don't share the link with anyone
        <br><br>
        With best wishes,<br>
        Team UDGAM`,
			};
			//sending verification mail
			await transporter.sendMail(mailOptions, function (error, info) {
				if (error) {
					console.log(error);
					res.status(500).send({ message: error });
				}
				res.status(201).send({ message: "YES" });
			});
		} else {
			res.status(201).send({ message: "NO" });
		}
	} catch (err) {
		console.log(err);
		return res.status(500).send({ message: err.message });
	}
});

// RESET PASSWORD
app.post("/backend/resetpassword", async (req, res) => {
	console.log("I am here resetting");
	const client = new MongoClient(url);
	const { email, newpwd, token } = req.body;
	console.log(newpwd);
	client.connect();
	const database = client.db("app-data");
	const users = database.collection("usersData");
	const tokens = database.collection("tokens");
	try {
		const existingUser = await users.findOne({ email });
		const existingtoken = await tokens.findOne({ token, email });
		console.log(existingUser);

		if (existingUser && existingtoken) {
			bcrypt.genSalt(saltRounds, function (err, salt) {
				bcrypt.hash(newpwd, salt, async function (err, hash) {
					try {
						await users.updateOne(
							{ email: email },
							{
								$set: {
									hashedPassword: hash,
								},
							}
						);
						await tokens.deleteMany({ email });
						return res.status(201).json({ message: "YES" });
					} catch (err) {
						return res.status(500).send({ message: err.message });
					}
				});
			});
		} else {
			res.status(201).send({ message: "NO" });
		}
	} catch (err) {
		console.log(err);
		return res.status(500).send({ message: err.message });
	}
});

//Checking if he has purchased. If this API returns yes, then he purchased. If no then he didnt purchase. In req.body send only email address as udgam id
app.post("/backend/checkifpurchased", async (req, res) => {
	console.log("I am here checking");
	const client = new MongoClient(url);
	const { email } = req.body;
	client.connect();
	const database = client.db("app-data");
	const users = database.collection("usersData");
	try {
		const existingUser = await users.findOne({ email });
		console.log(existingUser);
		if (existingUser) {
			console.log("user already exists");
			res.status(201).send({ message: "YES" });
		} else {
			res.status(201).send({ message: "NO" });
		}
	} catch (err) {
		console.log(err);
		return res.status(500).send({ message: err.message });
	}
});
// For auth in IF website using outlook and pwd
app.post("/backend/internfairauth", async (req, res) => {
	console.log("I am here checking");
	const client = new MongoClient(url);
	const { outlook, password } = req.body;
	client.connect();
	const database = client.db("app-data");
	const users = database.collection("usersData");
	try {
		const existingUser = await users.findOne({ outlook });
		console.log(existingUser);
		if (existingUser) {
			await bcrypt.compare(
				password,
				existingUser.hashedPassword,
				function (err, result) {
					if (result) {
						return res
							.status(201)
							.send({ message: "YES", data: existingUser });
					} else {
						return res.status(201).send({ message: "PWDWRONG" });
					}
				}
			);
		} else {
			res.status(201).send({ message: "NO" });
		}
	} catch (err) {
		console.log(err);
		return res.status(500).send({ message: err.message });
	}
});
// Check if outlook and roll no are duplicate or not
app.post("/backend/checkoutlook", async (req, res) => {
	console.log("I am here checking outlook");
	const client = new MongoClient(url);
	const { outlook, rollno } = req.body;
	client.connect();
	const database = client.db("app-data");
	const users = database.collection("usersData");
	try {
		const existingUser = await users.findOne({ outlook });
		console.log(existingUser);
		if (existingUser) {
			return res.status(201).send({ message: "OUTLOOKSAME" });
		}
		const existingUser2 = await users.findOne({ rollno });
		console.log(existingUser2);
		if (existingUser2) {
			return res.status(201).send({ message: "ROLLNOSAME" });
		}

		return res.status(201).send({ message: "NO" });
	} catch (err) {
		console.log(err);
		return res.status(500).send({ message: err.message });
	}
});

// Mail pass
app.post("/backend/mailpass", async (req, res) => {
	console.log("I am here checking");
	const client = new MongoClient(url);
	const pdf = new pdfkit({
		autoFirstPage: false
	});
	const { email } = req.body;
	client.connect();
	const database = client.db("app-data");
	const users = database.collection("usersData");
	try {
		const existingUser = await users.findOne({ email });
		const name = existingUser.firstName + " " + existingUser.lastName;
		const id = existingUser.udgid;
		console.log(existingUser);
		if (existingUser) {
			const buffers = [];
			pdf.on('data', buffers.push.bind(buffers));
			pdf.on('end', async () => {
				let pdfData = Buffer.concat(buffers);
				var mailOptions = {
					from: `UDGAM 2023 <${process.env.USEREMAIL}>`,
					to: existingUser.email,
					subject: "Welcome to UDGAM 2023",
					html: `Hello ${existingUser.firstName},
						<br><br>
						Thank you for purchasing the <b>UDGAM Pass</b>. With this pass, you can get access to events like Lecture Series, Internfair and Fun events.
						<br><br>
						Your pass credentials are your email id and the password you entered during registration.<br/><i><b>For IITG students:</b> Please use these credentials to login into intern fair website later</i>
						<br><br>
						In case you forget your password, please reset your password at www.udgamiitg.com/resetpass
						<br><br>
						With best wishes,<br>
						Team UDGAM`,
					attachments: [{
						filename: 'UDGAM Pass.pdf',
						content: pdfData
					}]
				};
				//sending verification mail
				await transporter.sendMail(mailOptions, function (error, info) {
					if (error) {
						console.log(error);
						res.status(500).send({ message: error });
					}
					return res.status(201).send({ message: "YES" });
				});
			});


			var img = pdf.openImage('./UDGAMFRONT.png');
			pdf.fontSize(8);
			pdf.addPage({ size: [img.width, img.height], margin: 0 });
			pdf.image(img, 0, 0);

			pdf.text(name, 325.2345, 106.836)
			pdf.text(id, 314.5105, 120.970667)
			var img = pdf.openImage('./UDGAMBACK.png');
			pdf.addPage({ size: [img.width, img.height], margin: 0 });
			pdf.image(img, 0, 0);
			pdf.end();

		} else {
			res.status(201).send({ message: "NO" });
		}
	} catch (err) {
		console.log(err);
		return res.status(500).send({ message: err.message });
	}
});

app.post("/backend/contact", async (req, res) => {
	console.log("I am here checking");
	const client = new MongoClient(url);
	const { firstName, lastName, email, reason, message } = req.body;
	client.connect();

	try {
		var mailOptions = {
			from: `UDGAM 2023 <${process.env.USEREMAIL}>`,
			to: process.env.USEREMAIL,
			subject: `An user contcted (${reason})`,
			html: `Name: ${firstName + " " + lastName}
        <br>
        Email: ${email}
        <br>
        Reason: ${reason}
        <br>
        Message: ${message}`,
		};
		//sending verification mail
		await transporter.sendMail(mailOptions, function (error, info) {
			if (error) {
				console.log(error);
				res.status(500).send({ message: error });
			}
			res.status(201).send({ message: "YES" });
		});
	} catch (err) {
		console.log(err);
		return res.status(500).send({ message: err.message });
	}
});

app.listen(PORT, () => {
	console.log("server is running on port " + PORT);
});
