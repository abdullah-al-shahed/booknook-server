import mongoose from "mongoose";

const borrowSchema = new mongoose.Schema(
  {
    // ObjectId string of the borrowed book
    bookId: { type: String, required: true },
    bookTitle: { type: String, required: true },
    bookImage: { type: String, default: "" },
    userEmail: { type: String, required: true, trim: true },
    // Borrowed date as "YYYY-MM-DD" (kept as a string so the client
    // can render it directly).
    borrowDate: { type: String, required: true },
    returnDate: { type: String, default: "N/A" },
  },
  { versionKey: false }
);

const Borrow = mongoose.models.Borrow || mongoose.model("Borrow", borrowSchema);

export default Borrow;
