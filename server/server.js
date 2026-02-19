import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import { clerkMiddleware, requireAuth } from '@clerk/express'
import aiRouter from './routes/aiRoutes.js'
import connectCloudinary from './configs/cloudinary.js'
import userRouter from './routes/userRoutes.js'

const app = express()

await connectCloudinary()

// Allow requests from the frontend origin.
// Set FRONTEND_URL in your .env for production deployment.
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
]

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}))

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use(clerkMiddleware())  // makes req.auth available

app.get('/', (req, res) => {
  res.send('Server is Live')
})

// Protected routes
app.use('/api/ai', requireAuth(), aiRouter)
app.use('/api/user', requireAuth(), userRouter)

// Global error handler — catches any unhandled errors from routes/middleware
app.use((err, req, res, next) => {
  console.error('[Global Error]', err)
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  })
})

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})
