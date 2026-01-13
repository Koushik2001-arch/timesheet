import User from '../models/User.js';
import PendingUser from '../models/PendingUser.js';
import PendingReset from '../models/PendingReset.js';
import { generateToken } from '../utils/generateToken.js';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// Signup - create pending user
export const signup = async (req, res) => {
  try {
    const { empId, email, password, name } = req.body;

    if (!empId || !email || !password || !name) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    // Check if already approved user
    const existingUser = await User.findOne({ $or: [{ email }, { empId }] });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Check if already pending
    const pending = await PendingUser.findOne({ $or: [{ email }, { empId }] });
    if (pending) {
      return res.status(400).json({ message: 'Signup request already pending' });
    }

    // Hash password manually (NO HOOKS)
    const hashedPassword = bcrypt.hashSync(password, 12);

    // Create pending user
    await PendingUser.create({ 
      empId, 
      email, 
      password: hashedPassword,
      name 
    });

    res.status(201).json({
      message: 'Request sent to admin for approval',
    });
  } catch (err) {
    console.error('Signup error:', err.message);
    
    if (err.code === 11000) {
      return res.status(400).json({ 
        message: 'Email or EMP ID already exists' 
      });
    }
    
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all users (admin only)
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ role: 'user' })
      .select('-password')
      .sort({ createdAt: -1 });
    
    res.json(users);
  } catch (err) {
    console.error('Get all users error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get user by empId
export const getUserByEmpId = async (req, res) => {
  try {
    const { empId } = req.params;
    
    const user = await User.findOne({ empId })
      .select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user);
  } catch (err) {
    console.error('Get user by empId error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user with password
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Compare password manually
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user._id, user.role, user.empId, user.email, user.name);
    res.json({ token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin Login
export const adminLogin = async (req, res) => {
  try {
    const { empId, password } = req.body;
    
    if (empId !== 'AT0198' || password !== 'AT0198') {
      return res.status(401).json({ message: 'Invalid admin credentials' });
    }

    const token = generateToken('admin123', 'admin', 'AT0198', 'admin@arohak.com', 'Admin');
    res.json({ token });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get pending signups (admin)
export const getPendingUsers = async (req, res) => {
  try {
    const pending = await PendingUser.find().sort({ createdAt: -1 });
    res.json(pending);
  } catch (err) {
    console.error('Get pending users error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Approve signup (admin) - UPDATED
export const approveUser = async (req, res) => {
  try {
    const pending = await PendingUser.findById(req.params.id);
    if (!pending) {
      return res.status(404).json({ message: 'Pending user not found' });
    }

    // Double-check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email: pending.email }, { empId: pending.empId }] 
    });
    
    if (existingUser) {
      await PendingUser.findByIdAndDelete(req.params.id);
      return res.status(400).json({ message: 'User already exists' });
    }

    // CREATE USER IN USER COLLECTION
    const newUser = await User.create({
      empId: pending.empId,
      email: pending.email,
      password: pending.password, // Already hashed
      name: pending.name || 'Employee',
      role: 'user'
    });

    // Delete from pending
    await PendingUser.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'User approved successfully',
      email: pending.email,
      empId: pending.empId,
      name: pending.name || 'Employee',
      userId: newUser._id
    });
  } catch (err) {
    console.error('Approve user error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};


export const revokeUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.empId); 
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    await User.findByIdAndDelete(req.params.empId);
    res.json({ message: 'User access revoked successfully', email: user.email });
  } catch (err) {
    console.error('Revoke user error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Reject signup
export const rejectUser = async (req, res) => {
  try {
    const pending = await PendingUser.findById(req.params.id);
    if (!pending) {
      return res.status(404).json({ message: 'Pending user not found' });
    }

    await PendingUser.findByIdAndDelete(req.params.id);
    res.json({ message: 'User rejected', email: pending.email });
  } catch (err) {
    console.error('Reject user error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Request password reset
export const requestReset = async (req, res) => {
  try {
    const { empId, email } = req.body;
    
    if (!empId && !email) {
      return res.status(400).json({ message: 'Provide EMP ID or Email' });
    }

    const user = await User.findOne({ $or: [{ empId }, { email }] });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const token = crypto.randomBytes(32).toString('hex');

    await PendingReset.create({
      empId: user.empId,
      email: user.email,
      userId: user._id,
      token,
    });

    res.json({ message: 'Reset request sent to admin' });
  } catch (err) {
    console.error('Request reset error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get pending resets
export const getPendingResets = async (req, res) => {
  try {
    const resets = await PendingReset.find().sort({ createdAt: -1 });
    res.json(resets);
  } catch (err) {
    console.error('Get pending resets error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Approve reset
export const approveReset = async (req, res) => {
  try {
    const pending = await PendingReset.findById(req.params.id);
    if (!pending) {
      return res.status(404).json({ message: 'Reset request not found' });
    }

    const resetUrl = `http://localhost:5173/login?token=${pending.token}&action=reset`;

    res.json({
      message: 'Ready to send reset link',
      email: pending.email,
      empId: pending.empId,
      resetUrl,
      pendingId: pending._id,
    });
  } catch (err) {
    console.error('Approve reset error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete pending reset
export const deleteReset = async (req, res) => {
  try {
    const pending = await PendingReset.findById(req.params.id);
    if (!pending) {
      return res.status(404).json({ message: 'Reset request not found' });
    }

    await PendingReset.findByIdAndDelete(req.params.id);
    res.json({ message: 'Reset request deleted successfully' });
  } catch (err) {
    console.error('Delete reset error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Reset password
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ message: 'Invalid request' });
    }

    const pending = await PendingReset.findOne({ token });
    if (!pending) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    const user = await User.findById(pending.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Hash new password manually
    const hashedPassword = bcrypt.hashSync(newPassword, 12);
    
    // Update user password directly
    user.password = hashedPassword;
    await user.save();

    // Delete pending reset
    await PendingReset.deleteOne({ token });

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};