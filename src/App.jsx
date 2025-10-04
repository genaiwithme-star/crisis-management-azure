import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

const API = import.meta.env.VITE_API_URL || 'https://crisiswatch-backend-cvhseuawceckefcm.centralindia-01.azurewebsites.net';

const sentimentColors = {
  "Strongly Positive": "bg-green-500 text-white",
  "Positive": "bg-green-300 text-black",
  "Neutral/Informational": "bg-gray-300 text-black",
  "Negative": "bg-red-300 text-black",
  "Strongly Negative": "bg-red-500 text-white"
};

const sentimentToScore = (sentiment) => {
  switch (sentiment) {
    case 'Strongly Positive': return 2;
    case 'Positive': return 1;
    case 'Neutral/Informational': return 0;
    case 'Negative': return -1;
    case 'Strongly Negative': return -2;
    default: return 0;
  }
};

const topN = (arr, n = 5) =>
  Object.entries(
    arr.reduce((acc, x) => {
      acc[x] = (acc[x] || 0) + 1;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([theme, count]) => ({ theme, count }));

export default function App() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPosts();
  }, []);

  async function fetchPosts() {
    setLoading(true);
    try {
      const res = await axios.get(API + '/api/posts');
      setPosts(res.data || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    await axios.post(API + '/api/posts', json);
    fetchPosts();
  };

  const exportExcel = async () => {
    const res = await axios.get(API + '/api/download-excel', { responseType: 'arraybuffer' });
    const blob = new Blob([res.data]);
    saveAs(blob, 'posts.xlsx');
  };

  const summary = useMemo(() => {
    const total = posts.length;
    const counts = { 'Strongly Positive': 0, 'Positive': 0, 'Neutral/Informational': 0, 'Negative': 0, 'Strongly Negative': 0 };
    let scoreSum = 0;
    const positiveThemes = [], negativeThemes = [];

    posts.forEach((p) => {
      const s = p.sentiment || 'Neutral/Informational';
      counts[s] = (counts[s] || 0) + 1;
      scoreSum += sentimentToScore(s);
      if ((s === 'Positive' || s === 'Strongly Positive') && p.themes) positiveThemes.push(...(p.themes || []));
      if ((s === 'Negative' || s === 'Strongly Negative') && p.themes) negativeThemes.push(...(p.themes || []));
    });

    const actionable = total - counts['Neutral/Informational'];
    const overall = total ? Math.round((scoreSum / (2 * total)) * 100) : 0;

    return { total, counts, actionable, overall, positiveThemes: topN(positiveThemes, 5), negativeThemes: topN(negativeThemes, 5) };
  }, [posts]);

  const topViral = useMemo(() => [...posts].sort((a, b) => (b.engagement || 0) - (a.engagement || 0)).slice(0, 10), [posts]);
  const topEscalation = useMemo(() => posts.filter(p => (p.sentiment === 'Strongly Negative' || p.sentiment === 'Negative')).sort((a, b) => (b.engagement || 0) - (a.engagement || 0)).slice(0, 5), [posts]);

  return (
    <div className="min-h-screen bg-gradient-to-r from-purple-50 via-blue-50 to-pink-50 p-6 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-indigo-800 mb-4 md:mb-0">CrisisWatch Admin Panel</h1>
          <div className="flex gap-2">
            <label className="px-4 py-2 bg-blue-500 text-white rounded cursor-pointer hover:bg-blue-600">
              Upload Excel
              <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} className="hidden" />
            </label>
            <button onClick={exportExcel} className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">Download Excel</button>
            <button onClick={fetchPosts} className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">{loading ? 'Refreshing...' : 'Refresh'}</button>
          </div>
        </header>

        {/* Summary Cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {Object.entries(summary.counts).map(([k, v]) => (
            <div key={k} className={`p-4 rounded shadow ${sentimentColors[k]}`}>
              <h3 className="font-semibold">{k}</h3>
              <p className="text-lg">{v} mentions</p>
            </div>
          ))}
        </section>

        {/* Top Viral & Escalations */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="card bg-white p-4 rounded shadow">
            <h3 className="text-xl font-semibold mb-2">Top Viral Mentions</h3>
            <ol className="list-decimal pl-5">
              {topViral.map(p => (
                <li key={p.id} className="mb-2">
                  <a href={p.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                    {p.platform} #{p.id}
                  </a> — Engagement: {p.engagement || 0} — Sentiment: {p.sentiment || 'Neutral'}
                </li>
              ))}
            </ol>
          </div>

          <div className="card bg-white p-4 rounded shadow">
            <h3 className="text-xl font-semibold mb-2">Escalations (Top Negative)</h3>
            <ol className="list-decimal pl-5">
              {topEscalation.map(p => (
                <li key={p.id} className="mb-2">
                  <a href={p.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                    {p.platform} #{p.id}
                  </a> — Theme: {(p.themes || []).join(', ') || '—'} — Engagement: {p.engagement || 0}
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Raw Posts Table */}
        <div className="card bg-white p-4 rounded shadow mb-6">
          <h3 className="text-xl font-semibold mb-2">Raw Posts (first 500)</h3>
          <div className="overflow-x-auto">
            <table className="table-auto w-full border border-gray-300">
              <thead>
                <tr className="bg-gray-200">
                  <th className="px-2 py-1 border">ID</th>
                  <th className="px-2 py-1 border">Platform</th>
                  <th className="px-2 py-1 border">Sentiment</th>
                  <th className="px-2 py-1 border">Engagement</th>
                  <th className="px-2 py-1 border">Themes</th>
                </tr>
              </thead>
              <tbody>
                {posts.slice(0, 500).map(p => (
                  <tr key={p.id}>
                    <td className="px-2 py-1 border">{p.id}</td>
                    <td className="px-2 py-1 border">{p.platform}</td>
                    <td className="px-2 py-1 border">{p.sentiment}</td>
                    <td className="px-2 py-1 border">{p.engagement}</td>
                    <td className="px-2 py-1 border">{(p.themes || []).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="text-sm text-gray-600">API: {API}</div>
      </div>
    </div>
  );
}
