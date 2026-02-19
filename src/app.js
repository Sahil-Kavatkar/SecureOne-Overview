// // src/app.js - Enhanced Production-Ready Application
// // ✅ Improved Socket.IO, Error Handling, and Performance Optimizations

// const express = require('express');
// const mongoose = require('mongoose');
// const cors = require('cors');
// const helmet = require('helmet');
// const morgan = require('morgan');
// const compression = require('compression');
// const http = require('http');
// const { Server } = require('socket.io');
// require('dotenv').config();

// // Import routes
// const authRoutes = require('./routes/auth');
// const scanRoutes = require('./routes/scan');
// const aiRoutes = require('./routes/ai');
// const githubRoutes = require('./routes/github');

// // Import middleware
// const errorHandler = require('./middleware/errorHandler');
// const rateLimiter = require('./middleware/rateLimit');

// // ========================================
// // EXPRESS & HTTP SERVER SETUP
// // ========================================

// const app = express();
// const server = http.createServer(app);
// const PORT = process.env.PORT || 4000;
// const NODE_ENV = process.env.NODE_ENV || 'development';
// const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// // ========================================
// // SOCKET.IO CONFIGURATION
// // ========================================

// const io = new Server(server, {
//   cors: {
//     origin: FRONTEND_URL,
//     methods: ['GET', 'POST'],
//     credentials: true,
//     allowedHeaders: ['Content-Type', 'Authorization']
//   },
//   transports: ['websocket', 'polling'],
//   pingTimeout: 60000,
//   pingInterval: 25000,
//   maxHttpBufferSize: 1e6,
//   allowEIO3: true
// });

// global.io = io;

// // ========================================
// // SOCKET.IO EVENT HANDLERS
// // ========================================

// let activeConnections = 0;
// const scanRooms = new Map(); 

// io.on('connection', (socket) => {
//   activeConnections++;
//   console.log(`✅ Client connected: ${socket.id}`);

//   socket.on('join_scan', (scanId) => {
//     if (!scanId) return;
//     const roomName = `scan_${scanId}`;
    
//     // Cleanup previous rooms
//     Array.from(socket.rooms).forEach(room => {
//       if (room.startsWith('scan_') && room !== roomName) socket.leave(room);
//     });
    
//     socket.join(roomName);
//     console.log(`📡 Socket ${socket.id} joined ${roomName}`);
//   });

//   socket.on('leave_scan', (scanId) => {
//     if (!scanId) return;
//     socket.leave(`scan_${scanId}`);
//   });

//   socket.on('disconnect', () => {
//     activeConnections--;
//   });
// });

// // ========================================
// // MONGODB CONNECTION
// // ========================================

// const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/secureone';

// // ✅ FIX: Removed deprecated options
// mongoose.connect(MONGO_URI, {
//   serverSelectionTimeoutMS: 5000,
//   socketTimeoutMS: 45000,
// })
//   .then(() => console.log('✅ MongoDB connected successfully'))
//   .catch((err) => {
//     console.error('❌ MongoDB connection failed:', err.message);
//     // Do not exit process here to allow server to start even if DB fails initially
//   });

// // ========================================
// // EXPRESS MIDDLEWARE
// // ========================================

// app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
// app.set("trust proxy", 1);
// const allowedOrigins = [
//   FRONTEND_URL,
//   'http://localhost:3000',
//   'http://localhost:4000',
//   'https://tegminal-unideaed-crystle.ngrok-free.dev',
//   /\.ngrok-free\.dev$/  // Allow all ngrok subdomains
// ];

// app.use(cors({
//   origin: function(origin, callback) {
//     // Allow requests with no origin (like mobile apps, curl)
//     if (!origin) return callback(null, true);
    
//     // Check if origin is allowed
//     const allowed = allowedOrigins.some(allowed => {
//       if (typeof allowed === 'string') {
//         return allowed === origin;
//       }
//       if (allowed instanceof RegExp) {
//         return allowed.test(origin);
//       }
//       return false;
//     });
    
//     if (allowed) {
//       callback(null, true);
//     } else {
//       console.log('❌ CORS blocked origin:', origin);
//       callback(new Error('Not allowed by CORS'));
//     }
//   },
//   credentials: true,
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'], // ✅ Add this header
//   exposedHeaders: ['Content-Range', 'X-Content-Range']
// }));

// // Add middleware to explicitly handle ngrok-skip-browser-warning
// app.use((req, res, next) => {
//   // Log all requests with their headers for debugging
//   console.log(`📡 ${req.method} ${req.url}`);
//   console.log('Headers:', {
//     'ngrok-skip-browser-warning': req.headers['ngrok-skip-browser-warning'],
//     'origin': req.headers.origin,
//     'authorization': req.headers.authorization ? 'Present' : 'Missing'
//   });
  
//   // Ensure CORS headers are set for ngrok
//   res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
//   res.header('Access-Control-Allow-Credentials', 'true');
//   res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
//   res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, ngrok-skip-browser-warning');
  
//   // Handle preflight requests
//   if (req.method === 'OPTIONS') {
//     return res.sendStatus(200);
//   }
  
//   next();
// });

// app.use(express.json({ limit: '50mb' }));
// app.use(express.urlencoded({ extended: true, limit: '50mb' }));
// app.use(compression());
// app.use(morgan(NODE_ENV === 'development' ? 'dev' : 'combined'));

// // Rate Limiting
// app.use('/api/', rateLimiter);

// // ========================================
// // ROUTES
// // ========================================

// app.get('/health', (req, res) => {
//   res.json({ status: 'OK', socketIO: { activeConnections } });
// });

// const API_PREFIX = '/api/v1';
// app.use(`${API_PREFIX}/auth`, authRoutes);
// app.use(`${API_PREFIX}/scans`, scanRoutes);
// app.use(`${API_PREFIX}/ai`, aiRoutes);
// app.use(`${API_PREFIX}/github`, githubRoutes);

// // Error Handling
// app.use('*', (req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
// app.use(errorHandler);

// // ========================================
// // START SERVER
// // ========================================

// server.listen(PORT, () => {
//   console.log(`
// ╔═══════════════════════════════════════════╗
// ║   🛡️  SecureOne Server Running on ${PORT}    ║
// ╚═══════════════════════════════════════════╝
//   `);
// });

// // ========================================
// // GRACEFUL SHUTDOWN (FIXED)
// // ========================================

// const gracefulShutdown = (signal) => {
//   console.log(`\n⚠️  ${signal} received. Shutting down...`);
  
//   server.close(async () => {
//     console.log('✅ HTTP server closed');
    
//     io.close(() => {
//       console.log('✅ Socket.IO closed');
      
//       // ✅ FIX: Properly await Mongoose disconnect
//       mongoose.connection.close().then(() => {
//         console.log('✅ MongoDB closed');
//         process.exit(0);
//       }).catch(err => {
//         console.error('❌ MongoDB close error:', err);
//         process.exit(1);
//       });
//     });
//   });

//   setTimeout(() => {
//     console.error('⚠️  Forced shutdown after timeout');
//     process.exit(1);
//   }, 10000);
// };

// process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
// process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// module.exports = { app, server, io };
















// src/app.js - Fully Open CORS Version
// ✅ Allows ALL origins (No restrictions)
// ✅ Works with credentials
// ✅ Works with Socket.IO
// ✅ No frontend changes required

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const scanRoutes = require('./routes/scan');
const aiRoutes = require('./routes/ai');
const githubRoutes = require('./routes/github');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const rateLimiter = require('./middleware/rateLimit');

// ========================================
// EXPRESS & HTTP SERVER SETUP
// ========================================

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ========================================
// SOCKET.IO CONFIGURATION (OPEN CORS)
// ========================================

const io = new Server(server, {
  cors: {
    origin: true,        // Allow all origins
    credentials: true    // Allow cookies/auth headers
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6,
  allowEIO3: true
});

global.io = io;

// ========================================
// SOCKET.IO EVENT HANDLERS
// ========================================

let activeConnections = 0;

io.on('connection', (socket) => {
  activeConnections++;
  console.log(`✅ Client connected: ${socket.id}`);

  socket.on('join_scan', (scanId) => {
    if (!scanId) return;
    const roomName = `scan_${scanId}`;

    Array.from(socket.rooms).forEach(room => {
      if (room.startsWith('scan_') && room !== roomName) {
        socket.leave(room);
      }
    });

    socket.join(roomName);
    console.log(`📡 Socket ${socket.id} joined ${roomName}`);
  });

  socket.on('leave_scan', (scanId) => {
    if (!scanId) return;
    socket.leave(`scan_${scanId}`);
  });

  socket.on('disconnect', () => {
    activeConnections--;
    console.log(`❌ Client disconnected: ${socket.id}`);
  });
});

// ========================================
// MONGODB CONNECTION
// ========================================

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/secureone';

mongoose.connect(MONGO_URI, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch((err) => {
  console.error('❌ MongoDB connection failed:', err.message);
});

// ========================================
// EXPRESS MIDDLEWARE
// ========================================

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.set("trust proxy", 1);

// ✅ FULLY OPEN CORS (ALLOW ALL ORIGINS)
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['*']
}));

// Handle preflight
app.options('*', cors());

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(compression());
app.use(morgan(NODE_ENV === 'development' ? 'dev' : 'combined'));

// Rate Limiting
app.use('/api/', rateLimiter);

// ========================================
// ROUTES
// ========================================

app.get('/health', (req, res) => {
  res.json({ status: 'OK', socketIO: { activeConnections } });
});

const API_PREFIX = '/api/v1';
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/scans`, scanRoutes);
app.use(`${API_PREFIX}/ai`, aiRoutes);
app.use(`${API_PREFIX}/github`, githubRoutes);

// ========================================
// ERROR HANDLING
// ========================================

app.use('*', (req, res) =>
  res.status(404).json({ success: false, message: 'Route not found' })
);

app.use(errorHandler);

// ========================================
// START SERVER
// ========================================

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║   🛡️  SecureOne Server Running on ${PORT}    ║
╚═══════════════════════════════════════════╝
  `);
});

// ========================================
// GRACEFUL SHUTDOWN
// ========================================

const gracefulShutdown = (signal) => {
  console.log(`\n⚠️  ${signal} received. Shutting down...`);

  server.close(async () => {
    console.log('✅ HTTP server closed');

    io.close(() => {
      console.log('✅ Socket.IO closed');

      mongoose.connection.close().then(() => {
        console.log('✅ MongoDB closed');
        process.exit(0);
      }).catch(err => {
        console.error('❌ MongoDB close error:', err);
        process.exit(1);
      });
    });
  });

  setTimeout(() => {
    console.error('⚠️  Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = { app, server, io };
