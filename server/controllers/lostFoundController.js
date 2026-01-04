import LostFound from '../models/lostFoundModel.js';
import User from '../models/userModel.js';
import cloudinary from '../utils/cloudinaryConfig.js';

export const createLostFound = async (req, res) => {
  try {
    const { title, description, locationText, foundDate } = req.body;
    if (!title || !description) {
      return res.status(400).json({ success: false, message: 'Title and description are required' });
    }

    let photoUrl;
    let photoPublicId;
    if (req.file) {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({ folder: 'lostfound' }, (error, res) => {
          if (error) return reject(error);
          return resolve(res);
        });
        stream.end(req.file.buffer);
      });
      photoUrl = result.secure_url;
      photoPublicId = result.public_id;
    }

    const item = await LostFound.create({
      driver: req.user.id,
      title,
      description,
      locationText,
      foundDate: foundDate ? new Date(foundDate) : new Date(),
      photoUrl,
      photoPublicId,
      status: 'posted',
    });

    await User.findByIdAndUpdate(req.user.id, { $inc: { lostFoundPosted: 1 } }).catch(() => {});

    res.status(201).json({ success: true, data: item });
  } catch (error) {
    console.error('Error creating lost & found:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const listLostFound = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const items = await LostFound.find(filter)
      .populate('driver', 'firstname lastname username image')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: items });
  } catch (error) {
    console.error('Error listing lost & found:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const claimLostFound = async (req, res) => {
  try {
    const { id } = req.params;
    const { claimerName, claimerContact, claimNotes } = req.body;

    const item = await LostFound.findById(id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    // Only allow claim if still open
    if (item.status !== 'posted') {
      return res.status(400).json({ success: false, message: 'Item already claimed/returned' });
    }

    item.status = 'claimed';
    item.claimedAt = new Date();
    item.claimerName = claimerName;
    item.claimerContact = claimerContact;
    item.claimNotes = claimNotes;
    await item.save();

    await User.findByIdAndUpdate(item.driver, { $inc: { lostFoundClaimed: 1 } }).catch(() => {});

    res.status(200).json({ success: true, data: item });
  } catch (error) {
    console.error('Error claiming lost & found:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Admin: Verify/update lost and found item status
export const verifyLostFound = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, claimerName, claimerContact, claimNotes } = req.body;

    const item = await LostFound.findById(id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    // Validate status
    const validStatuses = ['posted', 'claimed', 'returned'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    // Update fields
    if (status) item.status = status;
    if (status === 'claimed' || status === 'returned') {
      item.claimedAt = item.claimedAt || new Date();
      if (claimerName) item.claimerName = claimerName;
      if (claimerContact) item.claimerContact = claimerContact;
      if (claimNotes) item.claimNotes = claimNotes;
    }

    await item.save();

    // Populate driver info before returning
    await item.populate('driver', 'firstname lastname username image');

    res.status(200).json({ success: true, data: item });
  } catch (error) {
    console.error('Error verifying lost & found:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Admin: Delete lost and found item
export const deleteLostFound = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await LostFound.findById(id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    // Delete image from cloudinary if exists
    if (item.photoPublicId) {
      await cloudinary.uploader.destroy(item.photoPublicId).catch(() => {});
    }

    await LostFound.findByIdAndDelete(id);

    res.status(200).json({ success: true, message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error deleting lost & found:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Admin: Get lost and found statistics
export const getLostFoundStats = async (req, res) => {
  try {
    const stats = await LostFound.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const formattedStats = {
      total: 0,
      posted: 0,
      claimed: 0,
      returned: 0
    };

    stats.forEach(stat => {
      formattedStats[stat._id] = stat.count;
      formattedStats.total += stat.count;
    });

    res.status(200).json({ success: true, data: formattedStats });
  } catch (error) {
    console.error('Error getting lost & found stats:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
