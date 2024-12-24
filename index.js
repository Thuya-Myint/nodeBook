const express = require('express');
const fs = require('fs');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const app = express();
const PORT = 3000;

app.use(bodyParser.json());

const SECRET_KEY = 'mysecretkey';
const dataFilePath = './data.json';

// Helper to read/write JSON data
const readData = () => JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));
const writeData = (data) => fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));

// Middleware to authenticate users
const authenticate = (req, res, next) => {
   const token = req.headers['authorization'];
   if (!token) return res.status(403).json({ message: 'Token required' });
   try {
      req.user = jwt.verify(token, SECRET_KEY);
      next();
   } catch {
      res.status(401).json({ message: 'Invalid token' });
   }
};

// Retrieve all books
app.get('/books', (req, res) => {
   const data = readData();
   res.json(data.books);
});

// Search for specific books
app.get('/books/search', (req, res) => {
   const { isbn, author, title } = req.query;
   const data = readData();
   const books = data.books.filter((book) => {
      return (
         (!isbn || book.isbn === isbn) &&
         (!author || book.author.toLowerCase().includes(author.toLowerCase())) &&
         (!title || book.title.toLowerCase().includes(title.toLowerCase()))
      );
   });
   res.json(books);
});

// Retrieve reviews for a book
app.get('/books/:isbn/reviews', (req, res) => {
   const { isbn } = req.params;
   const data = readData();
   const book = data.books.find((book) => book.isbn === isbn);
   if (!book) return res.status(404).json({ message: 'Book not found' });
   res.json(book.reviews);
});

// Register a new user
app.post('/register', (req, res) => {
   const { username, password } = req.body;
   if (!username || !password) return res.status(400).json({ message: 'Invalid input' });

   const data = readData();
   if (data.users.find((user) => user.username === username)) {
      return res.status(400).json({ message: 'User already exists' });
   }

   const newUser = { id: Date.now(), username, password };
   data.users.push(newUser);
   writeData(data);
   res.status(201).json({ message: 'User registered', user: newUser });
});

// Login user
app.post('/login', (req, res) => {
   const { username, password } = req.body;
   const data = readData();
   const user = data.users.find((user) => user.username === username && user.password === password);
   if (!user) return res.status(401).json({ message: 'Invalid credentials' });

   const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY);
   res.json({ message: 'Login successful', token });
});

// Add a new review (logged-in users)
app.post('/books/:isbn/reviews', authenticate, (req, res) => {
   const { isbn } = req.params;
   const { review } = req.body;
   if (!review) return res.status(400).json({ message: 'Review text required' });

   const data = readData();
   const book = data.books.find((book) => book.isbn === isbn);
   if (!book) return res.status(404).json({ message: 'Book not found' });

   const newReview = { userId: req.user.id, review, id: Date.now() };
   book.reviews.push(newReview);
   writeData(data);
   res.status(201).json({ message: 'Review added', review: newReview });
});

// Modify a book review
app.put('/books/:isbn/reviews/:reviewId', authenticate, (req, res) => {
   const { isbn, reviewId } = req.params;
   const { review } = req.body;
   if (!review) return res.status(400).json({ message: 'Review text required' });

   const data = readData();
   const book = data.books.find((book) => book.isbn === isbn);
   if (!book) return res.status(404).json({ message: 'Book not found' });

   const reviewToEdit = book.reviews.find((r) => r.id === parseInt(reviewId) && r.userId === req.user.id);
   if (!reviewToEdit) return res.status(403).json({ message: 'Not authorized to edit this review' });

   reviewToEdit.review = review;
   writeData(data);
   res.json({ message: 'Review updated', review: reviewToEdit });
});

// Delete a book review
app.delete('/books/:isbn/reviews/:reviewId', authenticate, (req, res) => {
   const { isbn, reviewId } = req.params;

   const data = readData();
   const book = data.books.find((book) => book.isbn === isbn);
   if (!book) return res.status(404).json({ message: 'Book not found' });

   const reviewIndex = book.reviews.findIndex((r) => r.id === parseInt(reviewId) && r.userId === req.user.id);
   if (reviewIndex === -1) return res.status(403).json({ message: 'Not authorized to delete this review' });

   book.reviews.splice(reviewIndex, 1);
   writeData(data);
   res.json({ message: 'Review deleted' });
});

// Start the server
app.listen(PORT, () => {
   console.log(`Server running on http://localhost:${PORT}`);
});
