import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { githubRoutes, reviewRoutes } from './routes';
import { errorHandler } from './middlewares';

const app = express();

// Rate limiting to prevent API overuse
const reviewLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: {
    error: 'Too many review requests from this IP, please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
const githubManualReviewLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: {
    error: 'Too many review requests from this IP, please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Apply rate limiting to review endpoint
app.use('/api/review', reviewLimiter);
app.use('/api/github/manual-review', githubManualReviewLimiter);

// Routes
app.use('/api', reviewRoutes);
app.use('/api', githubRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Global error handler (should be after routes)
app.use(errorHandler);

export default app;
