const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const storage = require('./storage');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// API: add posts
app.post('/api/posts', async (req, res) => {
  try {
    const data = req.body;
    const rows = Array.isArray(data) ? data : [data];
    const added = await storage.appendRows(rows);
    res.json({ ok: true, added });
  } catch (err) {
    console.error('Error saving posts:', err);
    res.status(500).json({ error: 'Failed to save posts' });
  }
});

// API: get posts
app.get('/api/posts', async (req, res) => {
  try {
    const all = await storage.readAll();
    res.json((all || []).reverse());
  } catch (err) {
    console.error('Error reading posts:', err);
    res.status(500).json({ error: 'Failed to read posts' });
  }
});

// API: download Excel
app.get('/api/download-excel', async (req, res) => {
  try {
    if (process.env.AZURE_STORAGE_CONNECTION_STRING) {
      const { BlobServiceClient } = require('@azure/storage-blob');
      const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
      const containerClient = blobServiceClient.getContainerClient(process.env.STORAGE_CONTAINER_NAME || 'posts');
      const blobClient = containerClient.getBlockBlobClient('posts.xlsx');
      if (!(await blobClient.exists())) return res.status(404).send('No excel');
      const buffer = await blobClient.downloadToBuffer();
      res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.set('Content-Disposition', 'attachment; filename=posts.xlsx');
      return res.send(buffer);
    } else {
      const file = path.join(__dirname, 'data', 'posts.xlsx');
      if (!fs.existsSync(file)) return res.status(404).send('No excel');
      return res.download(file);
    }
  } catch (err) {
    console.error('Error downloading Excel:', err);
    res.status(500).json({ error: 'Failed to download Excel' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log('Backend running on port', PORT));
