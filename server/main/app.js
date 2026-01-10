import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';

// Route Imports
import authRoutes from '../routes/authRoute.js';
import loginRoutes from '../routes/loginRoute.js';
import tricycleRoutes from '../routes/tricycleRoute.js';
import operatorRoutes from '../routes/operatorRoute.js';
import messageRoutes from '../routes/messageRoute.js';
import licenseRoutes from '../routes/licenseRoute.js';
import sickLeaveRoutes from '../routes/sickLeaveRoute.js';
import forumRoutes from '../routes/forumRoute.js';
import queueRoutes from '../routes/queueRoute.js';
import lostFoundRoutes from '../routes/lostFoundRoute.js';
import announcementRoute from '../routes/announcementRoute.js';
import bookingRoutes from '../routes/bookingRoute.js';
import trackingRoutes from '../routes/trackingRoute.js';
import dashboardRoutes from '../routes/dashboardRoute.js';
import userActivityRoutes from '../routes/userActivityRoute.js';
import adminRoutes from '../routes/adminRoute.js';
import leaderboardRoutes from '../routes/leaderboardRoute.js';


const app = express();

// Increase payload limit for base64 image uploads (10MB)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Middleware for parsing request bodies
app.use(cookieParser());
const allowedOrigins = ['http://localhost:8081',
    'http://localhost:5173', // Vite dev server for web admin
    'http://localhost:3000', // Alternative web port
    'http://192.168.254.105:8081', // Expo dev client
    // 'https://example.com',
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(null, true); // Allow all origins for development
        }
    },
    credentials: true,
}));

// Middleware for setting security headers
app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    // Removed Cross-Origin-Embedder-Policy as it blocks Firebase Google Sign-In popups
    next();
});

// Router Connection || Dito ka maglagay donn ng mga routes, import mo din sa bandang taas
app.use('/api/auth', authRoutes);
app.use('/api/auth', loginRoutes);
app.use('/api/tricycles', tricycleRoutes);
app.use('/api/operator', operatorRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/license', licenseRoutes);
app.use('/api/sick-leave', sickLeaveRoutes);
app.use('/api/forum', forumRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/lost-found', lostFoundRoutes);
app.use('/api/announcements', announcementRoute);
app.use('/api/booking', bookingRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/activity', userActivityRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/leaderboard', leaderboardRoutes);


// Fallback for unknown routes
app.use((req, res, next) => {
    res.status(404).json({
        success: false,
        message: "Resource not found",
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || "Internal Server Error",
    });
});

export default app;