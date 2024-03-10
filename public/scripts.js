const savedNotes = [];
const socket = io('http://localhost:3000');

socket.on('update_notes', function() {
    updateNotes(); // Call your function that fetches and updates the notes list
  });
  

function getContent() {
    const editorContent = tinymce.get('mytextarea').getContent();
    return editorContent;
}

function sendAudioPromptToServer(blob) {
    fetch('http://localhost:3000/upload-audio', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream'
          },
      body: blob
  })
  .then(response => {
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json(); // Assuming the server responds with JSON
  })
  .then(data => {
    let transcript = data.transcription;
    console.log('Success:', transcript);
    
    sendUserPromptAndHTMLtoServer(transcript);
  })
  .catch((error) => {
    console.error('Error:', error);
  });
  }

async function sendUserPromptAndHTMLtoServer(userPrompt){
    const htmlContent = getContent();

    fetch('http://localhost:3000/update-content', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
          },
      body: JSON.stringify({prompt: userPrompt, html: htmlContent})
  })
  .then(response => {
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json(); // Assuming the server responds with JSON
  })
    .then(data => {
        let updatedContent = data.updatedHTML;
        updateContent(updatedContent);
               
    })
}

function updateContent(content){
    tinymce.get('mytextarea').setContent(content);
}

function updateNotes(){

    fetch('http://localhost:3000/get-notes', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
          }
  })
  .then(response => {
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json(); // Assuming the server responds with JSON
  })
    .then(data => {
        let notes = data;
        updateNotesList(notes);
               
    })
}

function updateNotesList(notes) {
    const notesContainer = document.getElementById('saved-notes');
    notesContainer.innerHTML = ''; // Clear any existing notes

    // Sort the notes by id in descending order
    notes.sort((a, b) => b.id - a.id);

    // Iterate over the sorted notes to create Bootstrap cards
    notes.forEach(note => {
        // Create the card container
        const card = document.createElement('div');
        card.className = 'card mb-3'; // 'mb-3' for margin at the bottom
        card.style.overflowY = 'auto'; // Set overflowY to auto to enable scrolling
        card.style.height = '300px'; // Set the height of the cards

        // Create the card header for the note id
        const cardHeader = document.createElement('div');
        cardHeader.className = 'card-header';
        cardHeader.textContent = `Note ID: ${note.id}`;

        // Create the card body
        const cardBody = document.createElement('div');
        cardBody.className = 'card-body';

        // Insert the formatted content into the card body
        cardBody.innerHTML = note.content; // This will render the HTML properly

        // Append the card header and body to the card container
        card.appendChild(cardHeader);
        card.appendChild(cardBody);

        // Add the card to the notes container
        notesContainer.appendChild(card);
    });
}
updateNotes();

