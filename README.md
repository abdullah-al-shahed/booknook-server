# BookNook Server

Backend API for the BookNook online library application built with Node.js, Express, and MongoDB.

## Technologies Used
- Node.js & Express.js
- MongoDB & Native MongoDB Driver
- Better Auth & JWT for Security
- CORS & Dotenv

## Getting Started / Running Locally
1. Clone the repository:
   ```bash
   git clone [https://github.com/abdullah-al-shahed/booknook-server.git](https://github.com/abdullah-al-shahed/booknook-server.git)


## API Endpoints
- `GET /books` - Get all books
- `GET /new-arrivals` - Get latest 6 books
- `GET /books/:id` - Get single book details
- `POST /books` - Add a new book (Protected)
- `PATCH /books/:id` - Update book info (Protected)
- `DELETE /books/:id` - Delete a book (Protected)
- `POST /borrows` - Borrow a book & decrease stock (Protected)
- `GET /borrows` - Get user specific borrowed books (Protected)
- `DELETE /borrows/:id` - Return a book & increase stock (Protected)