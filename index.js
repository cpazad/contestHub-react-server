const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
// const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.yiwkd5s.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const userCollection = client.db("contestHub").collection("users");
    const contestCollection = client.db("contestHub").collection("contests");

    // jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // Authetication middlewares
    const verifyToken = (req, res, next) => {
      console.log("inside verify token", req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        console.log(decoded);
        req.decoded = decoded;

        next();
      });
    };

    // use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // Update user role endpoint verifyToken,
    app.put("/users/updateRole/:email",  async (req, res) => {
      const { email } = req.params;
      const { newRole } = req.body; // Assuming you pass the new role in the request body

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      try {
        const query = { email: email };
        const updatedUser = await userCollection.findOneAndUpdate(
          query,
          { $set: { role: newRole } },
          { new: true }
        );

        if (!updatedUser) {
          return res.status(404).send({ message: "User not found" });
        }

        res.send({
          message: "User role updated successfully",
          user: updatedUser,
        });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    //users Collection
    app.get("/users", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });
    // sending user data to database
    app.post("/users", async (req, res) => {
      const user = req.body;
      //insert email if user does not exist
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists, insertedId:null" });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // --------------Contest Collection----------
      // Getting the contest list
      app.get("/contest", async (req, res) => {
        const result = await contestCollection.find().toArray();
        res.send(result);
      });
      app.get('/contest/:id', async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) }
        const result = await contestCollection.findOne(query);
        res.send(result);
      })    
    // Sending new contest to the database, add (verifyToken, verifyAdmin,) later
        app.post('/contest',  async (req, res) => {
          const item = req.body;
          const result = await contestCollection.insertOne(item);
          res.send(result);
        });
    // Update contest items to database
    app.patch('/contest/:id', async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          name: item.name,
          category: item.category,
          fee:item.fee,
          prize: item.prize,
          deadline: item.deadline,
          details:item.details,
          instruction:item.instruction,
          image: item.image
        }
      }

      const result = await contestCollection.updateOne(filter, updatedDoc)
      res.send(result);
    })
    // Delete contest Items, add (verifyToken, verifyAdmin,) later
    app.delete('/contest/:id', async(req, res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await contestCollection.deleteOne(query);
      res.send(result) 
    })

    //-------------------------

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// middleware
app.use(cors());
app.use(express.json());

// server route

app.get("/", (req, res) => {
  res.send("contestHub is in operation");
});

app.listen(port, () => {
  console.log(`ContestHub is open at port ${port}`);
});
