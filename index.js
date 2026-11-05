import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import "dotenv/config";
import Book from "./models/Book.js";
import Borrow from "./models/Borrow.js";
const app = express();
const PORT = process.env.PORT || 8000;
app.use(
  cors({
    origin: process.env.CLIENT_URL || "https://booknook-client-amber.vercel.app/",
    credentials: true,
  })
);
app.use(express.json());
try {
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGODB_DB || "booknook",
  });
  console.log("Connected to MongoDB successfully!");
} catch (error) {
  console.error("MongoDB connection error:", error);
  process.exit(1);
}

const db = mongoose.connection.db;
const { ObjectId } = mongoose.Types;
const isObjectId = (value) => ObjectId.isValid(value) && value.length === 24;
const parseLimit = (value) => {
  const limit = parseInt(value, 10);
  return Number.isNaN(limit) ? null : Math.min(Math.max(limit, 0), 100);
};

const verifyToken = async (req, res, next) => {
  try {
    if (!db) {
      return res.status(503).send({ msg: "Forbidden! Database not connected." });
    }

    let token = null;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }
  
    if (!token && req.headers.cookie) {
      const cookies = req.headers.cookie.split(";").reduce((acc, cookie) => {
        const idx = cookie.indexOf("=");
        acc[cookie.slice(0, idx).trim()] = cookie.slice(idx + 1);
        return acc;
      }, {});

      token = cookies["better-auth.session_token"] || cookies["session_token"];
      if (token) {
        try {
          token = decodeURIComponent(token);
        } catch {
         
        }
      }
    }

    if (!token) {
      return res.status(401).send({ msg: "Unauthorized! No token found." });
    }

    
    const rawToken = token;
    const plainToken = token.includes(".") ? token.split(".")[0] : token;

    const session = await db.collection("session").findOne({
      $or: [{ token: plainToken }, { token: rawToken }],
    });

    if (!session) {
      return res.status(403).send({ msg: "Forbidden! Invalid session." });
    }

    if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
      return res.status(403).send({ msg: "Forbidden! Session expired." });
    }

    req.user = session;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(403).send({ msg: "Forbidden! Invalid token." });
  }
};

async function getOwnerEmail(session) {
  if (!session?.userId || !db) return null;
  const user = await db.collection("user").findOne({ _id: new ObjectId(session.userId) });
  return user?.email || null;
}

const isValidationError = (error) => error?.name === "ValidationError";


app.get("/books", async (req, res) => {
  try {
    const { sort } = req.query;
    const limit = parseLimit(req.query.limit);

    let booksQuery = Book.find({});

    if (sort === "desc" || sort === "newest") {
      booksQuery = booksQuery.sort({ createdAt: -1, _id: -1 });
    } else if (sort === "asc" || sort === "oldest") {
      booksQuery = booksQuery.sort({ createdAt: 1, _id: 1 });
    }

    if (limit !== null) {
      booksQuery = booksQuery.limit(limit);
    }

    res.send(await booksQuery);
  } catch (error) {
    res.status(500).send({ error: "Failed to fetch books" });
  }
});

app.get("/new-arrivals", async (req, res) => {
  try {
    const result = await Book.find({}).sort({ createdAt: -1, _id: -1 }).limit(6);
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Failed to fetch new arrivals" });
  }
});

app.get("/books/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      return res.status(400).send({ error: "Invalid book id!" });
    }

    const result = await Book.findById(id);
    if (!result) {
      return res.status(404).send({ error: "Book not found!" });
    }

    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Failed to fetch book details" });
  }
});

app.post("/books", verifyToken, async (req, res) => {
  try {
    const bookData = { ...req.body };

    const ownerEmail = await getOwnerEmail(req.user);
    if (ownerEmail && bookData.userEmail && bookData.userEmail !== ownerEmail) {
      return res.status(403).send({ error: "You can only add books as yourself!" });
    }
    if (ownerEmail) {
      bookData.userEmail = ownerEmail;
    }
    
    delete bookData.createdAt;
    delete bookData.updatedAt;
    delete bookData._id;

    const copies = parseInt(bookData.totalCopies, 10);
    bookData.totalCopies = Number.isNaN(copies) ? 1 : Math.max(copies, 0);

    const book = await Book.create(bookData);

    
    res.send({ acknowledged: true, insertedId: book._id, book });
  } catch (error) {
    if (isValidationError(error)) {
      return res.status(400).send({ error: error.message });
    }
    res.status(500).send({ error: "Failed to add book" });
  }
});

app.patch("/books/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      return res.status(400).send({ error: "Invalid book id!" });
    }

    const book = await Book.findById(id);
    if (!book) {
      return res.status(404).send({ error: "Book not found" });
    }

    
    if (book.userEmail) {
      const ownerEmail = await getOwnerEmail(req.user);
      if (ownerEmail !== book.userEmail) {
        return res.status(403).send({ error: "You can only edit books you added." });
      }
    }
    const updates = { ...req.body };
    
    delete updates.userEmail;
    delete updates._id;
    delete updates.createdAt;
    delete updates.updatedAt;

    if (updates.totalCopies != null) {
      const copies = parseInt(updates.totalCopies, 10);
      if (Number.isNaN(copies) || copies < 0) {
        return res.status(400).send({ error: "totalCopies must be a non-negative number!" });
      }
      updates.totalCopies = copies;
    }

    const result = await Book.updateOne({ _id: book._id }, { $set: updates }, { runValidators: true });
    res.send(result);
  } catch (error) {
    if (isValidationError(error)) {
      return res.status(400).send({ error: error.message });
    }
    res.status(500).send({ error: "Failed to update book" });
  }
});

app.delete("/books/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      return res.status(400).send({ error: "Invalid book id!" });
    }

    const book = await Book.findById(id);
    if (!book) {
      return res.status(404).send({ error: "Book not found" });
    }

    if (book.userEmail) {
      const ownerEmail = await getOwnerEmail(req.user);
      if (ownerEmail !== book.userEmail) {
        return res.status(403).send({ error: "You can only delete books you added." });
      }
    }
    const result = await Book.deleteOne({ _id: book._id });
    await Borrow.deleteMany({ bookId: book._id.toString() });
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Failed to delete book" });
  }
});


app.post("/borrows", verifyToken, async (req, res) => {
  try {
    const { bookId, userEmail, bookTitle, bookImage, returnDate } = req.body;

    if (!bookId || !isObjectId(bookId)) {
      return res.status(400).send({ error: "A valid bookId is required!" });
    }

   
    const ownerEmail = await getOwnerEmail(req.user);
    if (ownerEmail && userEmail && userEmail !== ownerEmail) {
      return res.status(403).send({ error: "You can only borrow books for yourself!" });
    }
    const borrowEmail = ownerEmail || userEmail;
    if (!borrowEmail) {
      return res.status(401).send({ error: "Could not determine your email! Please log in." });
    }

    
    const existingBorrow = await Borrow.findOne({ bookId, userEmail: borrowEmail });
    if (existingBorrow) {
      return res.status(400).send({ error: "You have already borrowed this book!" });
    }

    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).send({ error: "Book not found!" });
    }
    const stockUpdate = await Book.updateOne(
      { _id: book._id, totalCopies: { $gt: 0 } },
      { $inc: { totalCopies: -1 } }
    );
    if (stockUpdate.modifiedCount === 0) {
      return res.status(400).send({ error: "Book is not available for borrowing!" });
    }

    const borrowRecord = {
      bookId,
      bookTitle: bookTitle || book.title || "Unknown title",
      bookImage: bookImage || book.coverPhoto || "",
      userEmail: borrowEmail,
      borrowDate: new Date().toISOString().split("T")[0],
      returnDate: returnDate || "N/A",
    };

    try {
      const borrow = await Borrow.create(borrowRecord);
      res.send({ success: true, result: { acknowledged: true, insertedId: borrow._id } });
    } catch (insertError) {
 
      await Book.updateOne({ _id: book._id }, { $inc: { totalCopies: 1 } });
      throw insertError;
    }
  } catch (error) {
    if (isValidationError(error)) {
      return res.status(400).send({ error: error.message });
    }
    res.status(500).send({ error: "Failed to borrow book" });
  }
});

app.get("/borrows", verifyToken, async (req, res) => {
  try {
    const ownerEmail = await getOwnerEmail(req.user);
    if (!ownerEmail) {
      return res.status(403).send({ error: "Could not verify your account!" });
    }
    const { email } = req.query;
    if (email && email !== ownerEmail) {
      return res.status(403).send({ error: "You can only view your own borrowed books!" });
    }

    const result = await Borrow.find({ userEmail: ownerEmail });
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Failed to fetch borrows" });
  }
});

app.delete("/borrows/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      return res.status(400).send({ error: "Invalid borrow id!" });
    }

    const borrowItem = await Borrow.findById(id);
    if (!borrowItem) {
      return res.status(404).send({ error: "Borrow record not found" });
    }

    if (borrowItem.userEmail) {
      const ownerEmail = await getOwnerEmail(req.user);
      if (ownerEmail && borrowItem.userEmail !== ownerEmail) {
        return res.status(403).send({ error: "You can only return books you borrowed!" });
      }
    }

    
    await Book.updateOne({ _id: new ObjectId(borrowItem.bookId) }, { $inc: { totalCopies: 1 } });

    const result = await Borrow.deleteOne({ _id: borrowItem._id });
    res.send({ success: true, result });
  } catch (error) {
    res.status(500).send({ error: "Failed to return book" });
  }
});
app.get("/", (req, res) => {
  res.send({
    message: "BookNook Server is running fine!",
    dbConnected: mongoose.connection.readyState === 1,
  });
});
app.listen(PORT, () => {
  console.log(`Server is running at port ${PORT}`);
});

// Optimize routing middleware and error handling
