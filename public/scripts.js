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