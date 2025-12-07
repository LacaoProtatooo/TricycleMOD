import Message from '../models/messageModel.js';
import User from '../models/userModel.js';
import mongoose from 'mongoose';
import { messaging } from '../utils/firebase.js';

// Generate conversation ID (consistent for both users)
const getConversationId = (userId1, userId2) => {
  return [userId1, userId2].sort().join('_');
};

// Send a message
export const sendMessage = async (req, res) => {
  try {
    const { receiverId, text } = req.body;
    const senderId = req.user._id;

    console.log('Attempting to send message:');
    console.log('- From (senderId):', senderId.toString());
    console.log('- To (receiverId):', receiverId);
    console.log('- Text length:', text?.length);

    // Validate inputs
    if (!receiverId || !text) {
      return res.status(400).json({
        success: false,
        message: 'Receiver ID and message text are required',
      });
    }

    if (text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message text cannot be empty',
      });
    }

    // Validate receiverId
    if (!mongoose.Types.ObjectId.isValid(receiverId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid receiver ID',
      });
    }

    // Check if receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: 'Receiver not found',
      });
    }

    // Get sender info
    const sender = await User.findById(senderId).select('firstname lastname image');

    // Create message
    const message = await Message.create({
      senderId: new mongoose.Types.ObjectId(senderId),
      receiverId: new mongoose.Types.ObjectId(receiverId),
      text: text.trim(),
      read: false,
    });

    console.log('Message created with ID:', message._id.toString());

    // Populate the message with user details
    const populatedMessage = await Message.findById(message._id)
      .populate('senderId', 'firstname lastname image')
      .populate('receiverId', 'firstname lastname image');

    // 🔔 SEND PUSH NOTIFICATION TO RECEIVER
    if (receiver.FCMToken) {
      try {
        const notificationPayload = {
          token: receiver.FCMToken,
          notification: {
            title: `${sender.firstname} ${sender.lastname}`,
            body: text.length > 100 ? text.substring(0, 100) + '...' : text,
          },
          data: {
            type: 'message',
            senderId: senderId.toString(),
            senderName: `${sender.firstname} ${sender.lastname}`,
            senderImage: sender.image?.url || '',
            messageId: message._id.toString(),
            text: text,
          },
          android: {
            priority: 'high',
            notification: {
              channelId: 'default',
              sound: 'default',
              priority: 'high',
            },
          },
          apns: {
            payload: {
              aps: {
                sound: 'default',
                badge: 1,
              },
            },
          },
        };

        await messaging.send(notificationPayload);
        console.log('✅ Push notification sent to receiver');
      } catch (notifError) {
        console.error('❌ Failed to send push notification:', notifError);
        // Don't fail the message send if notification fails
      }
    } else {
      console.log('⚠️ Receiver has no FCM token registered');
    }

    console.log('Message sent successfully');

    res.status(201).json({
      success: true,
      message: populatedMessage,
    });
  } catch (error) {
    console.error('Send message error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send message',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

// Get conversation messages
export const getConversation = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    const conversationId = getConversationId(currentUserId, userId);

    const messages = await Message.find({ conversationId })
      .sort({ createdAt: 1 })
      .populate('senderId', 'name email profilePicture')
      .populate('receiverId', 'name email profilePicture');

    res.status(200).json({
      success: true,
      messages
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

// Get all conversations for current user
export const getConversations = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get unique conversations
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [
            { senderId: new mongoose.Types.ObjectId(userId) },
            { receiverId: new mongoose.Types.ObjectId(userId) },
          ],
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$senderId', new mongoose.Types.ObjectId(userId)] },
              '$receiverId',
              '$senderId',
            ],
          },
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$receiverId', new mongoose.Types.ObjectId(userId)] },
                    { $eq: ['$read', false] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    // Populate user details
    const conversationsWithUsers = await Promise.all(
      conversations.map(async (conv) => {
        const otherUser = await User.findById(conv._id).select(
          'firstname lastname email image'
        );
        
        if (!otherUser) return null;
        
        return {
          _id: conv._id,
          lastMessage: conv.lastMessage,
          unreadCount: conv.unreadCount,
          participants: [otherUser],
        };
      })
    );

    // Filter out null values (deleted users)
    const validConversations = conversationsWithUsers.filter(conv => conv !== null);

    res.status(200).json({
      success: true,
      conversations: validConversations,
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to load conversations',
    });
  }
};

// Get messages between two users
export const getMessages = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    console.log('Getting messages between:', currentUserId.toString(), 'and', userId);

    // Validate userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      });
    }

    const messages = await Message.find({
      $or: [
        { 
          senderId: new mongoose.Types.ObjectId(currentUserId), 
          receiverId: new mongoose.Types.ObjectId(userId) 
        },
        { 
          senderId: new mongoose.Types.ObjectId(userId), 
          receiverId: new mongoose.Types.ObjectId(currentUserId) 
        },
      ],
    })
      .sort({ createdAt: 1 })
      .populate('senderId', 'firstname lastname image')
      .populate('receiverId', 'firstname lastname image');

    // Mark messages as read
    await Message.updateMany(
      {
        senderId: new mongoose.Types.ObjectId(userId),
        receiverId: new mongoose.Types.ObjectId(currentUserId),
        read: false,
      },
      { 
        read: true,
        readAt: new Date(),
      }
    );

    console.log(`Found ${messages.length} messages`);

    res.status(200).json({
      success: true,
      messages,
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to load messages',
    });
  }
};

// Mark messages as read
export const markAsRead = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    const conversationId = getConversationId(currentUserId, userId);

    await Message.updateMany(
      {
        conversationId,
        receiverId: currentUserId,
        isRead: false
      },
      {
        $set: {
          isRead: true,
          readAt: new Date()
        }
      }
    );

    res.status(200).json({
      success: true,
      message: 'Messages marked as read'
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
};

// Get all users (for starting new conversations)
export const getUsers = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    
    const users = await User.find({ 
      _id: { $ne: currentUserId } 
    }).select('name email profilePicture');

    res.status(200).json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};