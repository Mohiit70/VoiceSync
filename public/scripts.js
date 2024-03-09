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
    //tempSendMessageForAudio(transcript);
  })
  .catch((error) => {
    console.error('Error:', error);
  });
  }