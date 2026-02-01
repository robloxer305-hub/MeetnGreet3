import express from 'express';
import { z } from 'zod';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();

// Schema for 2FA verification
const verify2FASchema = z.object({
  token: z.string().length(6),
});

// Generate 2FA secret and QR code
router.post('/setup', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.twoFactorEnabled) {
      return res.status(400).json({ error: '2FA is already enabled' });
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `Meet&Greet (${user.email})`,
      issuer: 'Meet&Greet',
      length: 32,
    });

    // Store temporary secret (not enabled yet)
    user.twoFactorSecret = secret.base32;
    await user.save();

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    res.json({
      secret: secret.base32,
      qrCode: qrCodeUrl,
      manualEntryKey: secret.base32,
    });
  } catch (error) {
    console.error('Error setting up 2FA:', error);
    res.status(500).json({ error: 'Failed to setup 2FA' });
  }
});

// Verify and enable 2FA
router.post('/enable', requireAuth, async (req, res) => {
  try {
    const { token } = verify2FASchema.parse(req.body);
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.twoFactorSecret) {
      return res.status(400).json({ error: '2FA setup not initiated' });
    }

    // Verify token
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: token,
      window: 2, // Allow 2 time steps for clock drift
    });

    if (!verified) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Enable 2FA
    user.twoFactorEnabled = true;
    
    // Generate backup codes
    const backupCodes = generateBackupCodes();
    user.backupCodes = backupCodes.map(code => hashBackupCode(code));
    
    await user.save();

    // Log the action
    user.auditLog.push({
      action: '2fa_enabled',
      details: 'Two-factor authentication enabled',
      timestamp: new Date(),
    });
    await user.save();

    res.json({
      message: '2FA enabled successfully',
      backupCodes, // Send plain backup codes to user for safe keeping
    });
  } catch (error) {
    console.error('Error enabling 2FA:', error);
    res.status(500).json({ error: 'Failed to enable 2FA' });
  }
});

// Disable 2FA
router.post('/disable', requireAuth, async (req, res) => {
  try {
    const { token } = verify2FASchema.parse(req.body);
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.twoFactorEnabled) {
      return res.status(400).json({ error: '2FA is not enabled' });
    }

    // Verify token
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: token,
      window: 2,
    });

    if (!verified) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Disable 2FA
    user.twoFactorEnabled = false;
    user.twoFactorSecret = '';
    user.backupCodes = [];
    
    await user.save();

    // Log the action
    user.auditLog.push({
      action: '2fa_disabled',
      details: 'Two-factor authentication disabled',
      timestamp: new Date(),
    });
    await user.save();

    res.json({
      message: '2FA disabled successfully',
    });
  } catch (error) {
    console.error('Error disabling 2FA:', error);
    res.status(500).json({ error: 'Failed to disable 2FA' });
  }
});

// Verify 2FA token (for login)
router.post('/verify', async (req, res) => {
  try {
    const { token, email } = verify2FASchema.parse(req.body);
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.twoFactorEnabled) {
      return res.status(400).json({ error: '2FA is not enabled for this account' });
    }

    // Verify token
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: token,
      window: 2,
    });

    if (!verified) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    res.json({
      verified: true,
      message: '2FA verification successful',
    });
  } catch (error) {
    console.error('Error verifying 2FA:', error);
    res.status(500).json({ error: 'Failed to verify 2FA' });
  }
});

// Verify backup code
router.post('/backup-code', async (req, res) => {
  try {
    const { code, email } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.twoFactorEnabled) {
      return res.status(400).json({ error: '2FA is not enabled for this account' });
    }

    // Hash the provided code and check against stored codes
    const hashedCode = hashBackupCode(code);
    const backupCodeIndex = user.backupCodes.findIndex(storedCode => 
      storedCode === hashedCode
    );

    if (backupCodeIndex === -1) {
      return res.status(400).json({ error: 'Invalid backup code' });
    }

    // Remove used backup code
    user.backupCodes.splice(backupCodeIndex, 1);
    await user.save();

    // Log the action
    user.auditLog.push({
      action: 'backup_code_used',
      details: 'Backup code used for 2FA verification',
      timestamp: new Date(),
    });
    await user.save();

    res.json({
      verified: true,
      message: 'Backup code verified successfully',
      remainingCodes: user.backupCodes.length,
    });
  } catch (error) {
    console.error('Error verifying backup code:', error);
    res.status(500).json({ error: 'Failed to verify backup code' });
  }
});

// Generate new backup codes
router.post('/regenerate-backup-codes', requireAuth, async (req, res) => {
  try {
    const { token } = verify2FASchema.parse(req.body);
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.twoFactorEnabled) {
      return res.status(400).json({ error: '2FA is not enabled' });
    }

    // Verify current token
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: token,
      window: 2,
    });

    if (!verified) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Generate new backup codes
    const backupCodes = generateBackupCodes();
    user.backupCodes = backupCodes.map(code => hashBackupCode(code));
    
    await user.save();

    // Log the action
    user.auditLog.push({
      action: 'backup_codes_regenerated',
      details: 'Backup codes regenerated',
      timestamp: new Date(),
    });
    await user.save();

    res.json({
      message: 'Backup codes regenerated successfully',
      backupCodes,
    });
  } catch (error) {
    console.error('Error regenerating backup codes:', error);
    res.status(500).json({ error: 'Failed to regenerate backup codes' });
  }
});

// Get 2FA status
router.get('/status', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      twoFactorEnabled: user.twoFactorEnabled,
      hasBackupCodes: user.backupCodes.length > 0,
      backupCodeCount: user.backupCodes.length,
    });
  } catch (error) {
    console.error('Error fetching 2FA status:', error);
    res.status(500).json({ error: 'Failed to fetch 2FA status' });
  }
});

// Helper functions
function generateBackupCodes() {
  const codes = [];
  for (let i = 0; i < 10; i++) {
    codes.push(generateBackupCode());
  }
  return codes;
}

function generateBackupCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    if (i > 0 && i % 4 === 0) code += '-';
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function hashBackupCode(code) {
  // In production, use a proper hashing algorithm like bcrypt
  // For now, we'll use a simple hash
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(code).digest('hex');
}

export { router as twoFactorRouter };
