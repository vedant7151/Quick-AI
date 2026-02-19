import express from 'express'
import { getPublishedCreations, getUserCreations, toggleLokeCreation } from '../controllers/userController.js'
import { customAuthLogic } from '../middlewares/auth.js'

const userRouter = express.Router()

userRouter.get('/get-user-creations',customAuthLogic ,getUserCreations )
userRouter.get('/get-published-creations' ,customAuthLogic,getPublishedCreations )
userRouter.post('/toggle-like-creation',customAuthLogic ,toggleLokeCreation)

export default userRouter