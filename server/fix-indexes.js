import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function fixGroupIndexes() {
  try {
    const uri = process.env.MONGODB_URI;
    await mongoose.connect(uri);
    
    console.log('Connected to MongoDB');
    
    // Get the groups collection
    const db = mongoose.connection.db;
    const groupsCollection = db.collection('groups');
    
    // Drop the problematic index
    try {
      await groupsCollection.dropIndex('invites.code_1');
      console.log('Dropped invites.code_1 index successfully');
    } catch (error) {
      if (error.code === 27) {
        console.log('Index invites.code_1 does not exist, continuing...');
      } else {
        console.log('Error dropping index:', error.message);
      }
    }
    
    // List all indexes to verify
    const indexes = await groupsCollection.indexes();
    console.log('Current indexes:', indexes.map(i => i.name));
    
    console.log('Fix completed successfully');
  } catch (error) {
    console.error('Error fixing indexes:', error);
  } finally {
    await mongoose.connection.close();
  }
}

fixGroupIndexes();
