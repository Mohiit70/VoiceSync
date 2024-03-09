import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import tmp from 'tmp';
import  WavEncoder from 'wav-encoder';
import fs from 'fs';


dotenv.config();

// __dirname is not available in ES module scope, so you need to derive it
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const openai = new OpenAI(process.env.OPENAI_API_KEY);



// Create an instance of Express
const app = express();
app.use(express.json());
app.use('/upload-audio', express.raw({ type: 'application/octet-stream', limit: '50mb' }));


const PORT = process.env.PORT || 3000;

// Serve static files from the `public` directory
app.use(express.static(join(__dirname, 'public')));

app.post("/update-content", async(req, res) => {
    const {htmlContent, userPrompt} = req.body;
    const completion = await openai.chat.completions.create({
        messages: [{ role: "system", content: "You are a tool that receives two inputs: an html content and a prompt. You only respond with an updated html format that follows what the prompt says. If you are unable to make the changes just add \
        'did not undertand the instruction' message to the end of the html"}],
        model: "gpt-4-0125-preview",
      });

});

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

    console.log("here");
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
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
