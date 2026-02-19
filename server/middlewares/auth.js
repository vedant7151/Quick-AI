import { clerkClient } from "@clerk/express";

// Custom middleware after Clerk's requireAuth() — attaches userId, plan, free_usage to req
export const customAuthLogic = async (req, res, next) => {
  try {
    const { userId } = req.auth();

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "No user ID found"
      });
    }

    const user = await clerkClient.users.getUser(userId);

    const freeUsage = user.privateMetadata?.free_usage || 0;
    const hasPremiumPlan = user.publicMetadata?.plan === 'Premium';

    req.userId = userId;
    req.plan = hasPremiumPlan ? 'Premium' : 'free';
    req.free_usage = freeUsage;

    next();

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
