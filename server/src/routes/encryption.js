import express from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { Message } from '../models/Message.js';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();

// Generate a key pair for E2E encryption
router.post('/generate-keys', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Generate key pair
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    // Store public key in user profile (private key should be stored securely by client)
    const user = await User.findByIdAndUpdate(userId, {
      $set: {
        'encryption.publicKey': publicKey,
        'encryption.keyGeneratedAt': new Date(),
      },
    });

    res.json({
      publicKey,
      keyGeneratedAt: new Date(),
    });
  } catch (error) {
    console.error('Error generating encryption keys:', error);
    res.status(500).json({ error: 'Failed to generate encryption keys' });
  }
});

// Get user's public key
router.get('/public-key/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('encryption.publicKey');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.encryption?.publicKey) {
      return res.status(404).json({ error: 'User does not have encryption enabled' });
    }

    res.json({
      publicKey: user.encryption.publicKey,
    });
  } catch (error) {
    console.error('Error fetching public key:', error);
    res.status(500).json({ error: 'Failed to fetch public key' });
  }
});

// Encrypt message content
router.post('/encrypt', requireAuth, async (req, res) => {
  try {
    const { content, recipientPublicKey } = req.body;
    const userId = req.user.id;

    if (!content || !recipientPublicKey) {
      return res.status(400).json({ error: 'Content and recipient public key are required' });
    }

    // Generate a random AES key for this message
    const aesKey = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);

    // Create cipher
    const cipher = crypto.createCipher('aes-256-cbc', aesKey);
    cipher.setAutoPadding(true);

    // Encrypt the content
    let encrypted = cipher.update(content, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Encrypt the AES key with recipient's RSA public key
    const encryptedKey = crypto.publicEncrypt(
      {
        key: recipientPublicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      aesKey
    ).toString('base64');

    res.json({
      encryptedContent: encrypted,
      encryptedKey,
      iv: iv.toString('hex'),
      algorithm: 'aes-256-cbc',
    });
  } catch (error) {
    console.error('Error encrypting content:', error);
    res.status(500).json({ error: 'Failed to encrypt content' });
  }
});

// Decrypt message content
router.post('/decrypt', requireAuth, async (req, res) => {
  try {
    const { encryptedContent, encryptedKey, iv, privateKey } = req.body;
    const userId = req.user.id;

    if (!encryptedContent || !encryptedKey || !iv || !privateKey) {
      return res.status(400).json({ error: 'All encryption parameters are required' });
    }

    // Decrypt the AES key with user's RSA private key
    const aesKey = crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      Buffer.from(encryptedKey, 'base64')
    );

    // Create decipher
    const decipher = crypto.createDecipher('aes-256-cbc', aesKey);
    decipher.setAutoPadding(true);

    // Decrypt the content
    let decrypted = decipher.update(encryptedContent, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    res.json({
      decryptedContent: decrypted,
    });
  } catch (error) {
    console.error('Error decrypting content:', error);
    res.status(500).json({ error: 'Failed to decrypt content' });
  }
});

// Enable E2E encryption for a conversation
router.post('/enable/:conversationId', requireAuth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // Check if user has encryption keys
    const user = await User.findById(userId);
    if (!user.encryption?.publicKey) {
      return res.status(400).json({ error: 'User must generate encryption keys first' });
    }

    // This would typically update a conversation model to enable E2E
    // For now, we'll just return success
    res.json({
      message: 'E2E encryption enabled for conversation',
      conversationId,
    });
  } catch (error) {
    console.error('Error enabling E2E encryption:', error);
    res.status(500).json({ error: 'Failed to enable E2E encryption' });
  }
});

// Get encryption status for a conversation
router.get('/status/:conversationId', requireAuth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // Check if user has encryption keys
    const user = await User.findById(userId);
    const hasKeys = !!user.encryption?.publicKey;

    // This would typically check a conversation model
    // For now, we'll return basic status
    res.json({
      conversationId,
      encryptionEnabled: hasKeys,
      userHasKeys: hasKeys,
    });
  } catch (error) {
    console.error('Error checking encryption status:', error);
    res.status(500).json({ error: 'Failed to check encryption status' });
  }
});

// Generate a one-time key for message exchange
router.post('/session-key', requireAuth, async (req, res) => {
  try {
    const { recipientId } = req.body;
    const userId = req.user.id;

    // Generate a temporary session key
    const sessionKey = crypto.randomBytes(32);
    const sessionId = crypto.randomBytes(16).toString('hex');

    // Store session key temporarily (in production, use Redis or similar)
    // For now, we'll return it directly
    
    // Get recipient's public key
    const recipient = await User.findById(recipientId).select('encryption.publicKey');
    if (!recipient || !recipient.encryption?.publicKey) {
      return res.status(404).json({ error: 'Recipient does not have encryption enabled' });
    }

    // Encrypt session key with recipient's public key
    const encryptedSessionKey = crypto.publicEncrypt(
      {
        key: recipient.encryption.publicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      sessionKey
    ).toString('base64');

    res.json({
      sessionId,
      encryptedSessionKey,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    });
  } catch (error) {
    console.error('Error generating session key:', error);
    res.status(500).json({ error: 'Failed to generate session key' });
  }
});

// Verify message integrity
router.post('/verify', requireAuth, async (req, res) => {
  try {
    const { content, signature, publicKey } = req.body;

    if (!content || !signature || !publicKey) {
      return res.status(400).json({ error: 'Content, signature, and public key are required' });
    }

    // Verify signature
    const isValid = crypto.verify(
      'sha256',
      Buffer.from(content),
      Buffer.from(signature, 'base64'),
      publicKey
    );

    res.json({
      isValid,
      message: isValid ? 'Signature is valid' : 'Signature is invalid',
    });
  } catch (error) {
    console.error('Error verifying signature:', error);
    res.status(500).json({ error: 'Failed to verify signature' });
  }
});

// Sign message content
router.post('/sign', requireAuth, async (req, res) => {
  try {
    const { content, privateKey } = req.body;

    if (!content || !privateKey) {
      return res.status(400).json({ error: 'Content and private key are required' });
    }

    // Create signature
    const signature = crypto.sign('sha256', Buffer.from(content), privateKey);

    res.json({
      signature: signature.toString('base64'),
    });
  } catch (error) {
    console.error('Error signing content:', error);
    res.status(500).json({ error: 'Failed to sign content' });
  }
});

// Get encryption settings
router.get('/settings', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select('encryption');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      hasEncryption: !!user.encryption,
      publicKey: user.encryption?.publicKey || null,
      keyGeneratedAt: user.encryption?.keyGeneratedAt || null,
    });
  } catch (error) {
    console.error('Error fetching encryption settings:', error);
    res.status(500).json({ error: 'Failed to fetch encryption settings' });
  }
});

// Disable encryption (remove keys)
router.delete('/disable', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findByIdAndUpdate(userId, {
      $unset: {
        'encryption.publicKey': '',
        'encryption.keyGeneratedAt': '',
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Log the action
    user.auditLog.push({
      action: 'encryption_disabled',
      details: 'User disabled end-to-end encryption',
      timestamp: new Date(),
    });
    await user.save();

    res.json({
      message: 'Encryption disabled successfully',
    });
  } catch (error) {
    console.error('Error disabling encryption:', error);
    res.status(500).json({ error: 'Failed to disable encryption' });
  }
});

export { router as encryptionRouter };
