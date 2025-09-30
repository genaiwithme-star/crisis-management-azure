const express = require("express");
const cors = require("cors");
const { BlobServiceClient } = require("@azure/storage-blob");
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const AZURE_CONN = process.env.AZURE_STORAGE_CONNECTION_STRING;
const CONTAINER_NAME = process.env.STORAGE_CONTAINER_NAME || "posts";

const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_CONN);
const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);

// Test endpoint
app.get("/", (req, res) => {
  res.send("CrisisWatch Backend Running");
});

// Fetch all posts from Azure container and return as JSON
app.get("/posts", async (req, res) => {
  try {
    const posts = [];
    for await (const blob of containerClient.listBlobsFlat()) {
      const blockBlobClient = containerClient.getBlockBlobClient(blob.name);
      const downloadBlockBlobResponse = await blockBlobClient.downloadToBuffer();
      const filePath = path.join(__dirname, blob.name);
      fs.writeFileSync(filePath, downloadBlockBlobResponse);

      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
      posts.push(...data);

      fs.unlinkSync(filePath); // clean up
    }
    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
