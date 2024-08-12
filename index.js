const express = require('express');
const app = express();
const cors = require('cors');
const bodyParser = require('body-parser');
const { ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();
const PORT = process.env.PORT || 5000;


app.use(cors());
app.use(express.json());

// user  - job-task
// pass -- Ibyn1tLovTiOKoM1



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.6irp4bx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};


async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)

    const userCollection = client.db('MFS').collection('users')
    const transactionsCollection = client.db('MFS').collection('transactions')


    // Routes
    app.post('/register', async (req, res) => {
      const { name, pin, mobileNumber, email } = req.body;

      try {
        const user = await userCollection.findOne({ $or: [{ mobileNumber }, { email }] });

        if (user) {
          return res.status(400).json({ message: 'User phone number or email already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPin = await bcrypt.hash(pin, salt);

        await userCollection.insertOne({
          name,
          pin: hashedPin,
          mobileNumber,
          email,
          status: 'pending',
          balance: 0,
          role:'user'
        });

        res.status(201).json({ message: 'User registered, pending approval' });
      } catch (error) {
        res.status(500).json({ message: 'Server error' });
      }
    });


    // login
    app.post('/login', async (req, res) => {
      const { identifier, pin } = req.body;

      try {
        const user = await userCollection.findOne({
          $or: [{ mobileNumber: identifier }, { email: identifier }]
        });

        if (!user) {
          return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(pin, user.pin);

        if (!isMatch) {
          return res.status(400).json({ message: 'Invalid credentials pin' });
        }

        if (user.status !== 'active') {
          return res.status(403).json({ message: 'Account is not active' });
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

        res.json({ token });
      } catch (error) {
        console.error('Error during login', error);
        res.status(500).json({ message: 'Server error' });
      }
    });

    // current user
    app.get('/me', authenticateToken, async (req, res) => {
      try {
        const userId = req.user.id
        const user = await userCollection.findOne(
          { _id: new ObjectId(userId) },
          { projection: { pin: 0 } }
        )

        if (!user) {
          return res.status(404).json({ message: 'User not found' })
        }
        res.json({ user })

      } catch (error) {
        console.error('Error fetching user data', error);
        res.status(500).json({message:'Server error'})
      }
    })






    // Endpoint to get user details and transaction history
    app.get('/dashboard', authenticateToken, async (req, res) => {
      try {
        const userId = req.user.id;

        const user = await userCollection.findOne(
          { _id: new ObjectId(userId) },
          { projection: { pin: 0 } } // Exclude the pin from the response
        );

        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }

        const transactions = await transactionsCollection
          .find({ userId: new ObjectId(userId) })
          .sort({ date: -1 })
          .limit(10)
          .toArray();

        res.json({ user, transactions });
      } catch (error) {
        console.error('Error fetching dashboard data', error);
        res.status(500).json({ message: 'Server error' });
      }
    });




    app.post('/admin', async (req, res) => {
      const { userId } = req.body;

      try {
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }

        await db.collection('users').updateOne(
          { _id: new ObjectId(userId) },
          { $set: { status: 'active', balance: user.balance + 40 } } // Adding bonus
        );

        res.json({ message: 'User approved and bonus added' });
      } catch (error) {
        res.status(500).json({ message: 'Server error' });
      }
    });




    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error

  }
}
run().catch(console.dir);




app.get('/', (req, res) => {
  res.send('This program is running!')
})

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`)
})