import sql from "../configs/db.js";
import { clerkClient } from "@clerk/express";
import axios from 'axios'
import OpenAI from "openai";
import {v2 as cloudinary} from 'cloudinary'
import fs from 'fs'
import pdf from 'pdf-parse/lib/pdf-parse.js'
import FormData from 'form-data';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize the API with your key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// Use 'gemini-1.5-flash' - it is the fastest and most reliable free-tier model
const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview"
  
 });

export const generateArticle = async (req, res) => {
  try {
    const { prompt, length } = req.body;
    const { userId, plan, free_usage } = req;

    if (!prompt) {
      return res.status(400).json({ success: false, message: "prompt is required" });
    }

    // Free tier check
    if (plan !== 'Premium' && free_usage >= 10) {
      return res.status(403).json({ success: false, message: "Limit reached. Upgrade to premium" });
    }

    // Generate content using the native SDK
    // No need for baseURL or complex headers
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Save to Database
    await sql`INSERT INTO creations (user_id, prompt, content, type)
              VALUES (${userId}, ${prompt}, ${responseText}, 'article')`;

    // Update Metadata (Usage count)
    if (plan !== 'Premium') {
      await clerkClient.users.updateUserMetadata(userId, {
        privateMetadata: { free_usage: (free_usage || 0) + 1 },
      });
    }

    res.json({ success: true, content: responseText });

  } catch (error) {
    console.error('Gemini Error:', error);
    res.status(500).json({ 
      success: false, 
      message: "AI failed to respond. Check your API key or rate limits." 
    });
  }
};

export const generateBlogTitle = async (req, res) => {
  try {
    const { userId, plan, free_usage } = req; // Assuming these come from middleware
    const { prompt } = req.body;

    // 1. Validation
    if (!prompt) {
      return res.status(400).json({ success: false, message: "prompt is required" });
    }

    // 2. Usage/Plan Check
    if (plan !== 'Premium' && free_usage >= 10) {
      return res.status(403).json({
        success: false,
        message: "Limit reached. Upgrade to premium",
      });
    }

    // 3. Generate Content using the official SDK
    // The SDK uses generateContent instead of chat.completions.create
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // 4. Save to Database (using your existing sql template tag)
    await sql`INSERT INTO creations (user_id, prompt, content, type)
              VALUES (${userId}, ${prompt}, ${responseText}, 'blog_title')`;

    // 5. Update Metadata if on Free Plan
    if (plan !== 'Premium') {
      await clerkClient.users.updateUserMetadata(userId, {
        privateMetadata: { free_usage: (Number(free_usage) || 0) + 1 },
      });
    }

    // 6. Success Response
    res.json({ success: true, content: responseText });

  } catch (error) {
    console.error('[generateBlogTitle Error]', error);
    
    // Check if error is a rate limit or a safety block
    const errorMessage = error.status === 429 
      ? "AI rate limit reached. Please wait a moment." 
      : "Failed to generate title. Please try again.";

    res.status(500).json({ success: false, message: errorMessage });
  }
};

export const generateImage = async (req, res) => {
  try {
    const userId = req.userId;
    const { prompt, publish } = req.body;

    if (!prompt) {
      return res.status(400).json({ success: false, message: "prompt is required" });
    }

    if (!process.env.CLIPDROP_API_KEY) {
      return res.status(500).json({
        success: false,
        message: "API configuration error"
      });
    }

    const formData = new FormData();
    formData.append('prompt', prompt);

    const response = await axios({
      method: 'post',
      url: 'https://clipdrop-api.co/text-to-image/v1',
      data: formData,
      headers: {
        ...formData.getHeaders(),
        'x-api-key': process.env.CLIPDROP_API_KEY
      },
      responseType: 'arraybuffer'
    });

    if (!response.data) {
      throw new Error('No data received from ClipDrop API');
    }

    const base64Image = Buffer.from(response.data).toString('base64');
    const dataUri = `data:image/png;base64,${base64Image}`;

    const uploadResponse = await cloudinary.uploader.upload(dataUri);

    await sql`
      INSERT INTO creations (user_id, prompt, content, type, publish)
      VALUES (${userId}, ${prompt}, ${uploadResponse.secure_url}, 'image', ${publish ?? false})
    `;

    res.json({ success: true, content: uploadResponse.secure_url });

  } catch (error) {
    console.error('[generateImage]', error);
    res.status(error.response?.status || 500).json({
      success: false,
      message: getErrorMessage(error)
    });
  }
};

export const removeImageBackground = async (req, res) => {
  try {
    const userId = req.userId;
    const image = req.file;

    if (!image) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }

    // Upload with Cloudinary AI background removal add-on
    const uploadResult = await cloudinary.uploader.upload(image.path, {
      background_removal: 'cloudinary_ai',
    });

    // Clean up temp file
    fs.unlink(image.path, () => {});

    await sql`INSERT INTO creations (user_id, prompt, content, type)
              VALUES (${userId}, 'Remove background from image', ${uploadResult.secure_url}, 'image')`;

    res.json({ success: true, content: uploadResult.secure_url });
  } catch (error) {
    console.error('[removeImageBackground]', error);
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

export const removeImageObject = async (req, res) => {
  try {
    const userId = req.userId;
    const { object } = req.body;
    const image = req.file;

    if (!image) {
      return res.status(400).json({
        success: false,
        message: "No image file provided"
      });
    }

    if (!object) {
      return res.status(400).json({
        success: false,
        message: "object name is required"
      });
    }

    const uploadResult = await cloudinary.uploader.upload(image.path, {
      resource_type: 'image'
    });

    const transformedImageURL = cloudinary.url(uploadResult.public_id, {
      transformation: [{ effect: `gen_remove:${object}` }],
      secure: true,
      resource_type: 'image',
      format: 'png'
    });

    await sql`
      INSERT INTO creations (user_id, prompt, content, type)
      VALUES (${userId}, ${`Removed ${object} from image`}, ${transformedImageURL}, 'image')
    `;

    fs.unlink(image.path, () => {});

    return res.json({ success: true, content: transformedImageURL });

  } catch (error) {
    console.error('[removeImageObject]', error);
    return res.status(500).json({
      success: false,
      message: getErrorMessage(error)
    });
  }
};

export const resumeReview = async (req, res) => {
  try {
    const userId = req.userId;
    const resume = req.file; // Assuming you're using multer

    if (!resume) {
      return res.status(400).json({ success: false, message: 'No resume file provided' });
    }

    // 1. Validation for File Size
    if (resume.size > 5 * 1024 * 1024) {
      return res.status(400).json({ success: false, message: "Resume file size exceeds 5MB" });
    }

    // 2. Prepare file for Gemini (Base64 encoding)
    const dataBuffer = fs.readFileSync(resume.path);
    const resumeBase64 = dataBuffer.toString("base64");

    const pdfPart = {
      inlineData: {
        data: resumeBase64,
        mimeType: "application/pdf"
      }
    };

    const promptText = "You are a professional HR recruiter. Review this resume and provide constructive feedback on its strengths, weaknesses, and clear areas for improvement. Format the response in clean Markdown.";

    // 3. Generate Content using native SDK (Text + PDF)
    const result = await model.generateContent([promptText, pdfPart]);
    const responseText = result.response.text();

    // 4. Clean up temp file
    fs.unlink(resume.path, (err) => {
      if (err) console.error("Temp file cleanup failed:", err);
    });

    // 5. Database Entry
    await sql`INSERT INTO creations (user_id, prompt, content, type)
              VALUES (${userId}, 'Resume Review Request', ${responseText}, 'resume-review')`;

    // 6. Response
    res.json({ success: true, content: responseText });

  } catch (error) {
    console.error('[resumeReview Error]', error);
    res.status(500).json({ 
      success: false, 
      message: "AI failed to review the resume. Ensure the file is not password protected." 
    });
  }
};