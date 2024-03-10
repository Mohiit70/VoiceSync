import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {Note, User} from './MongoDBSchemas.js';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import tmp from 'tmp';
import  WavEncoder from 'wav-encoder';
import fs from 'fs';
import mongoose, { mongo } from "mongoose"
import { createServer } from 'http';
import { Server } from 'socket.io';


dotenv.config();

// __dirname is not available in ES module scope, so you need to derive it
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const openai = new OpenAI(process.env.OPENAI_API_KEY);
const savedMessages =[{ role: "system", content: "You are a tool that receives two inputs: an html content and a user prompt. You are supposed to update the html according to the user prompt end respond with an updated html content. Output only plain text. Do not output markdown. If the user prompt does not have any instrucion, just add what they say to the end of the html, and respond with html." }];

const dbURI = 'mongodb+srv://'+process.env.MONGODB_USER+':'+process.env.MONGODB_KEY+'@cluster0.mjlk1.mongodb.net/voicesync';
mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected...'))
  .catch((err) => console.log(err));



// Create an instance of Express
const app = express();

const httpServer = createServer(app);
const io = new Server(httpServer);

// When a client connects to the server via WebSocket
io.on('connection', (socket) => {
  console.log('A user connected');

  // When the user disconnects
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

app.use(express.json());
app.use('/upload-audio', express.raw({ type: 'application/octet-stream', limit: '50mb' }));

const tools=[
  {
    "type": "function",
    "function": {
        "name": "saveNote",
        "description": "Whenever user ask you to save a note/content, you should call this function",
        "parameters": {
            "type": "object",
            "properties": {
            },
            "required": [],
        },
    },
  },
  {
    "type": "function",
    "function": {
        "name": "openNote",
        "description": "Whenever user asks you to open/load a note with some ID, you should call this function",
        "parameters": {
            "type": "object",
            "properties": {
              noteId: {
                type: Number,
                description: "The id of the note to open, an integer"
              }
            },
            "required": [],
        },
    },
  },
  {
    "type": "function",
    "function":{
      "name": "deleteNote",
      "description": "Whenever user asks you to delete a note with some ID, you should call this function",
      "parameters": {
          "type": "object",
          "properties": {
            noteId: {
              type: Number,
              description: "The id of the note to delete, an integer"
            }
          },
          "required": [],
      },
    }
  }
]


const PORT = process.env.PORT || 3000;

// Serve static files from the `public` directory
app.use(express.static(join(__dirname, 'public')));

app.post("/update-content", async(req, res) => {
    const {prompt, html} = req.body;
    savedMessages.push({role: "user", content: `user-prompt: ${prompt}, user-html: ${html}`});
    const completion = await openai.chat.completions.create({
        messages: savedMessages,
        model: "gpt-4-turbo-preview",
        tools: tools,
        tool_choice: "auto"
      });

    const newMessage = completion.choices[0].message;
    var gptResponse = newMessage.content;
    const toolCalls = completion.choices[0].message.tool_calls;

    if(gptResponse){
      savedMessages.push({role: 'assistant', content: gptResponse});
    }
    if(toolCalls){
      savedMessages.push(newMessage);
      gptResponse = await handleToolCalls(toolCalls, html);
      console.log(gptResponse);
    }
   
    //save the messages
    res.status(200).send({updatedHTML: gptResponse});  
});

async function handleToolCalls(toolCalls, html){

  for (const toolCall of toolCalls){
      const functionName = toolCall.function.name;
      const functionArgs = JSON.parse(toolCall.function.arguments);
      var functionResponse = "";
      switch(functionName){
        case "saveNote":
          console.log("Saving note");
          functionResponse = await saveNote(html);
          break;
        case "openNote":
          console.log("Opening note");  
          functionResponse = await openNote(functionArgs.noteId);
          break;
        case "deleteNote":
          console.log("Deleting note");
          functionResponse = await deleteNote(functionArgs.noteId);
          break;
        default:
          console.log("Unknown function call");
      }

      console.log("Function response: ", functionResponse);
      savedMessages.push({
        tool_call_id: toolCall.id,
        role: "tool",
        name: functionName,
        content: functionResponse
      });
      const completionAfterFunctionCall = await openai.chat.completions.create({messages: savedMessages, model: "gpt-4-0125-preview"});
      var gptResponse = completionAfterFunctionCall.choices[0].message.content; 
      savedMessages.push({ role: 'assistant', content: gptResponse });
  }
 return gptResponse;
}

async function saveNote(noteContent){
  try {
    // Find the highest id and increment it
    const lastNote = await Note.findOne().sort({ id: -1 }); // Get the last note by sorting in descending order
    const nextId = lastNote ? lastNote.id + 1 : 1; // If there's no last note, start with id 1

    const note = new Note({
      id: nextId,
      content: noteContent
    });

    await note.save();
    updateNotes(); // Make sure this function correctly notifies clients about the update
    return "Note saved successfully";
  } catch (err) {
    console.log(err);
    return "Error saving note";
  }
}


async function openNote(noteId){
  try{
    const note = await Note.findOne({id: Number(noteId)});
    return  "You need to reply with this HTML: " +  note.content;

  }catch(err){
    return "Note not found";

  }
}

async function deleteNote(noteId) {
  try {
    console.log("Attempting to delete note with ID:", noteId);
    const result = await Note.findOneAndDelete({ id: noteId });
    if (result) {
      console.log("Note deleted successfully:", result);
      updateNotes(); // Notify clients
      return "Note deleted successfully";
    } else {
      console.log("Note not found with ID:", noteId);
      return "Note not found";
    }
  } catch (err) {
    console.error("Error deleting note:", err);
    return "Error deleting note";
  }
}

// Use this function to emit an event to all connected clients when a new note is saved
function updateNotes() {
  io.emit('update_notes');
}

    

app.post("/upload-audio", async(req, res) => { 
    const audioData = req.body;
    const audioWavData = {
        sampleRate: 16000,
        channelData: [
          new Float32Array(audioData.buffer)
        ]
      };
    try {
    const buffer = await WavEncoder.encode(audioWavData);

    // Create a temporary file using the tmp library
    tmp.file({ postfix: '.wav' }, async (err, path, fd, cleanupCallback) => {
        if (err) {
        console.error('Error during temporary file creation:', err);
        return res.status(500).send("Error processing audio data");
        }

        fs.writeFileSync(path, Buffer.from(buffer));

        // Call the transcription function on the temporary file
        try {
        const transcription = await transcribeAudio(path);
        //var transcription = "Test";
        
        // Send the transcription result back to the client
        res.status(200).send({transcription: transcription});
        } catch (transcriptionError) {
        console.error('Error during transcription:', transcriptionError);
        res.status(500).send("Error during transcription");
        } finally {
        // Clean up the temporary file
        cleanupCallback();
        }
    });
    } catch (error) {
    console.error('Error during WAV encoding:', error);
    res.status(500).send("Error processing audio data");
    }
    




}); 

app.get("/get-notes", async(req, res) => {
  try{
    const notes = await Note.find();
    res.status(200).send(notes);
  }catch(err){
    console.log(err);
  }
});

async function transcribeAudio(tmpObjName) {
    let transcription;
    try {
      transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tmpObjName),
        model: "whisper-1",
        response_format: "text"
      });
    } catch (error) {
      console.error('Error during transcription:', error);
      throw error; // Rethrow the error to handle it in the calling function
    }
  
    return transcription;
  }

// Start the server
httpServer.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});