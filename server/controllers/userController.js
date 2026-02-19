import sql from "../configs/db.js";

export const getUserCreations = async (req, res) => {
  try {
    const { userId } = req.auth()

    const creations = await sql`SELECT * FROM creations where user_id = ${userId} 
    ORDER BY created_at DESC`;

    res.json({ success: true, creations });

  } catch (error) {
    console.error('[getUserCreations]', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPublishedCreations = async (req, res) => {
  try {
    const creations = await sql`SELECT * FROM creations WHERE publish = true 
    ORDER BY created_at DESC`;

    res.json({ success: true, creations });
  } catch (error) {
    console.error('[getPublishedCreations]', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const toggleLokeCreation = async (req, res) => {
  try {
    const { userId } = req.auth()
    const { id } = req.body

    if (!id) {
      return res.status(400).json({ success: false, message: "id is required" });
    }

    const [creation] = await sql`SELECT * FROM creations where id = ${id}`

    if (!creation) {
      return res.json({ success: false, message: "Creation not found" })
    }

    const currentLikes = creation.likes
    const userIDStr = userId.toString()

    let updatedLikes;
    let message;

    if (currentLikes.includes(userIDStr)) {
      updatedLikes = currentLikes.filter((user) => user !== userIDStr)
      message = 'Creation Unliked'
    } else {
      updatedLikes = [...currentLikes, userIDStr]
      message = 'Creation Liked'
    }

    const formattedArray = `{${updatedLikes.join(',')}}`

    await sql`UPDATE creations SET likes = ${formattedArray}::text[] where id=${id}`

    res.json({ success: true, message });

  } catch (error) {
    console.error('[toggleLokeCreation]', error);
    res.status(500).json({ success: false, message: error.message });
  }
};