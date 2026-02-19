import express from 'express'
import { customAuthLogic } from '../middlewares/auth.js'
import { generateArticle, generateBlogTitle, generateImage, removeImageBackground, removeImageObject, resumeReview } from '../controllers/aiController.js'
import { upload } from '../configs/multer.js'

const aiRouter = express.Router()

// requireAuth() is applied in server.js — customAuthLogic handles user metadata
aiRouter.post('/generate-article', customAuthLogic, generateArticle)
aiRouter.post('/generate-blog-title', customAuthLogic, generateBlogTitle)
aiRouter.post('/generate-image', customAuthLogic, generateImage)
aiRouter.post('/remove-image-background', upload.single('image'), customAuthLogic, removeImageBackground)
aiRouter.post('/remove-object', upload.single('image'), customAuthLogic, removeImageObject)
aiRouter.post('/resume-review', upload.single('resume'), customAuthLogic, resumeReview)

export default aiRouter