import mongoose, { mongo } from "mongoose"
const Schema = mongoose.Schema;

// Define the Note schema
const NoteSchema = new Schema({
  id: {
    type: Number,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  }
});

// Define the User schema with embedded notes
const UserSchema = new Schema({
  username: {
    type: String,
    required: true
  },
  notes: [NoteSchema] // This embeds Note documents directly within a User document
});

// Create models
export const Note = mongoose.model('Note', NoteSchema);
export const User = mongoose.model('User', UserSchema);

