import QueueEntry from '../models/queueEntryModel.js';
import Tricycle from '../models/tricycleModel.js';

const activeStatuses = ['waiting', 'called'];

// Fixed terminals (can be moved to DB later)
const terminals = [
  { id: 'terminal-1', name: 'Terminal 1', latitude: 14.511445966700096, longitude: 121.03384457224557, radiusMeters: 120 },
  { id: 'terminal-2', name: 'Terminal 2', latitude: 14.513932064735052, longitude: 121.04019584947487, radiusMeters: 120 },
  { id: 'terminal-3', name: 'Terminal 3', latitude: 14.514534704611194, longitude: 121.04273098634214, radiusMeters: 120 },
];

const haversineMeters = (lat1, lon1, lat2, lon2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000; // earth radius meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const computePosition = (entries, targetId) => {
  const idx = entries.findIndex((e) => String(e._id) === String(targetId));
  return idx === -1 ? null : idx + 1;
};

export const listTerminals = async (req, res) => {
  res.status(200).json({ success: true, data: terminals });
};

export const listQueue = async (req, res) => {
  try {
    const terminal = req.query.terminal || 'default';
    const entries = await QueueEntry.find({ terminal, status: { $in: activeStatuses } })
      .sort({ createdAt: 1 })
      .populate('tricycle', 'plateNumber bodyNumber model')
      .populate('driver', 'firstname lastname username phone');

    res.status(200).json({ success: true, data: entries });
  } catch (error) {
    console.error('Error listing queue:', error.message);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const joinQueue = async (req, res) => {
  try {
    const { bodyNumber, terminal: terminalId, latitude, longitude } = req.body;
    if (!bodyNumber || !bodyNumber.trim()) {
      return res.status(400).json({ success: false, message: 'Body number is required' });
    }

    const terminal = terminals.find((t) => t.id === terminalId) || terminals[0];
    if (!terminal) {
      return res.status(400).json({ success: false, message: 'Invalid terminal' });
    }

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ success: false, message: 'Location (latitude, longitude) is required to queue' });
    }

    const distance = haversineMeters(latitude, longitude, terminal.latitude, terminal.longitude);
    if (distance > terminal.radiusMeters) {
      return res.status(403).json({ success: false, message: 'You are outside the terminal detection zone' });
    }

    const normalized = bodyNumber.trim().toUpperCase();

    const tricycle = await Tricycle.findOne({ bodyNumber: normalized });
    if (!tricycle) {
      return res.status(404).json({ success: false, message: 'Tricycle not found for that body number' });
    }

    // If driver already has an active entry, return that instead of duplicating
    const existing = await QueueEntry.findOne({ driver: req.user.id, status: { $in: activeStatuses } });
    if (existing) {
      const entries = await QueueEntry.find({ terminal: terminal.id, status: { $in: activeStatuses } }).sort({ createdAt: 1 });
      const position = computePosition(entries, existing._id);
      return res.status(200).json({ success: true, data: existing, position, message: 'Already queued' });
    }

    const duplicateBody = await QueueEntry.findOne({ bodyNumber: normalized, status: { $in: activeStatuses } });
    if (duplicateBody) {
      const entries = await QueueEntry.find({ terminal: terminal.id, status: { $in: activeStatuses } }).sort({ createdAt: 1 });
      const position = computePosition(entries, duplicateBody._id);
      return res.status(200).json({ success: true, data: duplicateBody, position, message: 'Body number already queued' });
    }

    const entry = await QueueEntry.create({
      tricycle: tricycle._id,
      driver: req.user.id,
      bodyNumber: normalized,
      terminal: terminal.id,
      status: 'waiting',
    });

    const entries = await QueueEntry.find({ terminal: terminal.id, status: { $in: activeStatuses } }).sort({ createdAt: 1 });
    const position = computePosition(entries, entry._id);

    res.status(201).json({ success: true, data: entry, position, terminal: terminal.id, distance });
  } catch (error) {
    console.error('Error joining queue:', error.message);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const cancelQueue = async (req, res) => {
  try {
    const { id } = req.params;
    const entry = await QueueEntry.findById(id);
    if (!entry || !activeStatuses.includes(entry.status)) {
      return res.status(404).json({ success: false, message: 'Active queue entry not found' });
    }
    if (String(entry.driver) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Not your queue entry' });
    }

    entry.status = 'cancelled';
    await entry.save();
    res.status(200).json({ success: true, message: 'Queue entry cancelled' });
  } catch (error) {
    console.error('Error cancelling queue entry:', error.message);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
