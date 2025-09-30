const { BlobServiceClient } = require('@azure/storage-blob');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
const LOCAL_FILE = path.join(DATA_DIR, 'posts.xlsx');

const AZ_CONN = process.env.AZURE_STORAGE_CONNECTION_STRING || null;
const CONTAINER = process.env.STORAGE_CONTAINER_NAME || 'posts';
const BLOB_NAME = 'posts.xlsx';

async function streamToBuffer(readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on('data', (data) => {
      chunks.push(data instanceof Buffer ? data : Buffer.from(data));
    });
    readableStream.on('end', () => resolve(Buffer.concat(chunks)));
    readableStream.on('error', reject);
  });
}

async function readAll() {
  if (AZ_CONN) {
    const blobServiceClient = BlobServiceClient.fromConnectionString(AZ_CONN);
    const containerClient = blobServiceClient.getContainerClient(CONTAINER);
    await containerClient.createIfNotExists();
    const blobClient = containerClient.getBlockBlobClient(BLOB_NAME);
    const exists = await blobClient.exists();
    if (!exists) return [];
    const downloadResp = await blobClient.download();
    const buffer = await streamToBuffer(downloadResp.readableStreamBody);
    const wb = XLSX.read(buffer);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { defval: '' });
  } else {
    if (!fs.existsSync(LOCAL_FILE)) {
      const ws = XLSX.utils.json_to_sheet([]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'posts');
      XLSX.writeFile(wb, LOCAL_FILE);
      return [];
    }
    const wb = XLSX.readFile(LOCAL_FILE);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { defval: '' });
  }
}

async function appendRows(rows) {
  const normalized = rows.map(r => ({
    id: r.id || uuidv4(),
    platform: r.platform || 'Unknown',
    text: r.text || r.content || '',
    sentiment: r.sentiment || 'Neutral/Informational',
    engagement: Number(r.engagement || 0) || 0,
    themes: Array.isArray(r.themes) ? r.themes : (r.themes ? r.themes.toString().split('|').map(s=>s.trim()) : []),
    url: r.url || '',
    created_at: r.created_at || new Date().toISOString()
  }));

  if (AZ_CONN) {
    const blobServiceClient = BlobServiceClient.fromConnectionString(AZ_CONN);
    const containerClient = blobServiceClient.getContainerClient(CONTAINER);
    await containerClient.createIfNotExists();
    const blobClient = containerClient.getBlockBlobClient(BLOB_NAME);

    const existing = await readAll();
    const out = existing.concat(normalized);
    const ws = XLSX.utils.json_to_sheet(out);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'posts');
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
    await blobClient.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
    });
    return normalized.length;
  } else {
    const existing = await readAll();
    const out = existing.concat(normalized);
    const ws = XLSX.utils.json_to_sheet(out);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'posts');
    XLSX.writeFile(wb, LOCAL_FILE);
    return normalized.length;
  }
}

module.exports = { readAll, appendRows };
