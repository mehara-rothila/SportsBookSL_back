// server.js
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require("socket.io");
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const mongoose = require('mongoose');

const connectDB = require('./config/db');
const apiRoutes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const { transformImageUrls } = require('./middleware/urlTransformMiddleware'); // Add this line

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

// Initialize Express app
const app = express();

// Create HTTP server and integrate Express
const server = http.createServer(app);

// Monitor MongoDB connection
mongoose.connection.on('connected', () => {
  console.log('MongoDB connected successfully');
});
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});
mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

// --- Configure CORS for both Express and Socket.IO ---
const corsOptions = {
  origin: function(origin, callback) {
    const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:3000").split(',');
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log("Blocked by CORS:", origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
};

// --- Initialize Socket.IO ---
const io = new Server(server, {
  cors: corsOptions
});

// --- Middleware ---
app.use(cors(corsOptions)); // Enable configured CORS early
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(transformImageUrls); // Add this line to transform image URLs

// --- Serve Static Files ---
app.use(express.static(path.join(__dirname, 'public')));

// --- Basic Route for Testing ---
app.get('/', (req, res) => {
  res.send('SportsBookSL API Running...');
});

// --- Mount API Routes ---
app.use('/api', apiRoutes);

// --- Socket.IO Connection Logic ---
const onlineUsers = new Map(); // Simple in-memory store: userId -> socket.id

io.on('connection', (socket) => {
  console.log(`[Socket.IO] User connected: ${socket.id}`);

  // Handle authentication attempt from client
  socket.on('authenticate', async (token) => {
    if (!token) {
      console.log(`[Socket.IO] Auth failed: No token provided for ${socket.id}`);
      socket.disconnect(true); // Disconnect if no token
      return;
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.id;

      // Optional: Verify user exists in DB
      const userExists = await User.findById(userId).select('_id');
      if (!userExists) {
         console.log(`[Socket.IO] Auth failed: User ${userId} not found for ${socket.id}`);
         socket.disconnect(true);
         return;
      }

      console.log(`[Socket.IO] User ${userId} authenticated for socket ${socket.id}`);
      onlineUsers.set(userId.toString(), socket.id); // Store mapping
      socket.join(userId.toString()); // Join a room named after the userId

      // Optional: Send confirmation back to client
      socket.emit('authenticated');

    } catch (error) {
      console.error(`[Socket.IO] Auth failed for socket ${socket.id}:`, error.message);
      socket.disconnect(true); // Disconnect on verification failure
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.IO] User disconnected: ${socket.id}`);
    // Remove user from mapping on disconnect
    for (let [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        console.log(`[Socket.IO] Removed user ${userId} from online map.`);
        break;
      }
    }
  });
});
// --- End Socket.IO Logic ---

// --- Error Handling Middleware ---
// Apply LAST for Express routes
app.use(notFound);
app.use(errorHandler);

// --- Server Startup ---
const PORT = process.env.PORT || 5001;
// Listen on the HTTP server, not the Express app directly
server.listen(PORT, () =>
  console.log(
    `Server (with Socket.IO) running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`
  )
);

// --- Export io instance for use in other modules ---
module.exports.io = io;
module.exports.onlineUsers = onlineUsers;