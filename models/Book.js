import mongoose from "mongoose";

// strict:false keeps any extra fields the client sends (to match the behaviour
// the native-driver version had), while still validating the fields declared below.
const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Book title is required"],
      trim: true,
    },
    author: { type: String, trim: true, default: "" },
    category: { type: String, trim: true, default: "" },
    coverPhoto: { type: String, trim: true, default: "" },
    description: { type: String, default: "" },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    publisher: { type: String, trim: true, default: "" },
    yearPublished: { type: Number },
    totalPages: { type: Number, min: 0 },
    // The email of the user who added the book. Used for the
    // "only the owner can edit/delete" checks on PATCH & DELETE.
    userEmail: { type: String, trim: true, default: "" },
    // Available copies: decreased by 1 on borrow, increased by 1 on return.
    totalCopies: { type: Number, min: 0, default: 1 },
  },
  { timestamps: true, versionKey: false, strict: false, minimize: false }
);

const Book = mongoose.models.Book || mongoose.model("Book", bookSchema);

export default Book;
