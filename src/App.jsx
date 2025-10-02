import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8080';

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

const topN = (arr, n=5) => Object.entries(
  arr.reduce((acc, x) => { acc[x] = (acc[x]||0)+1; return acc; }, {})
).sort((a,b)=>b[1]-a[1]).slice(0,n).map(([k,v])=>({theme:k,count:v}));

export default function App() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(()=>{ fetchPosts(); },[]);

  async function fetchPosts(){
    setLoading(true);
    try{
      const res = await axios.get(API + '/api/posts');
      setPosts(res.data || []);
    }catch(e){ console.error(e); }
    setLoading(false);
  }

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet, {defval:''});
    await axios.post(API + '/api/posts', json);
    fetchPosts();
  };

  const exportExcel = async () => {
    const res = await axios.get(API + '/api/download-excel', { responseType: 'arraybuffer' });
    const blob = new Blob([res.data]);
    saveAs(blob, 'posts.xlsx');
  };

  const summary = useMemo(()=>{
    const total = posts.length;
    const counts = { 'Strongly Positive':0,'Positive':0,'Neutral/Informational':0,'Negative':0,'Strongly Negative':0 };
    let scoreSum = 0;
    const positiveThemes=[], negativeThemes=[];
    posts.forEach(p=>{
      const s = p.sentiment || 'Neutral/Informational';
      counts[s] = (counts[s]||0)+1;
      scoreSum += sentimentToScore(s);
      if ((s==='Positive'||s==='Strongly Positive') && p.themes) positiveThemes.push(...(p.themes || []));
      if ((s==='Negative'||s==='Strongly Negative') && p.themes) negativeThemes.push(...(p.themes || []));
    });
    const actionable = total - counts['Neutral/Informational'];
    const overall = total ? Math.round((scoreSum/(2*total))*100) : 0;
    return { total, counts, actionable, overall, positiveThemes: topN(positiveThemes,5), negativeThemes: topN(negativeThemes,5) };
  },[posts]);

  const topViral = useMemo(()=>[...posts].sort((a,b)=> (b.engagement||0) - (a.engagement||0)).slice(0,10), [posts]);
  const topEscalation = useMemo(()=>posts.filter(p=> (p.sentiment==='Strongly Negative' || p.sentiment==='Negative')).sort((a,b)=> (b.engagement||0)-(a.engagement||0)).slice(0,5), [posts]);

  return (
    <div className="min-h-screen p-6 bg-gradient-to-r from-purple-50 via-blue-50 to-pink-50 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6 flex flex-col md:flex-row justify-between items-center">
          <h1 className="text-3xl font-bold text-indigo-800 mb-4 md:mb-0">CrisisWatch Admin Panel</h1>
          <div className="flex gap-2">
            <label className="px-4 py-2 bg-blue-500 text-white rounded cursor-pointer hover:bg-blue-600">
              Upload Excel
              <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} className="hidden"/>
            </label>
            <button onClick={exportExcel} className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">Download Excel</button>
            <button onClick={fetchPosts} className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">{loading ? 'Refreshing...' : 'Refresh'}</button>
          </div>
        </header>

        {/* Sentiment Cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {Object.entries(summary.counts).map(([k,v]) => (
            <div key={k} className={`p-4 rounded shadow ${sentimentColors[k]}`}>
              <h3 className="font-semibold">{k}</h3>
              <p className="text-lg">{v} mentions</p>
            </div>
          ))}
        </section>

        {/* Summary Section */}
        <section className="bg-white p-6 rounded shadow mb-6">
          <h2 className="text-xl font-bold mb-4">Summary</h2>
          <p>Total Mentions: <strong>{summary.total}</strong></p>
          <p>Actionable Mentions: <strong>{summary.actionable}</strong></p>
          <p>Overall Sentiment Index: <strong>{summary.overall}</strong></p>
        </section>

        {/* Top Themes */}
        <section className="bg-white p-6 rounded shadow mb-6">
          <h2 className="text-xl font-bold mb-4">Top Themes</h2>
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1">
              <h3 className="font-semibold mb-2">Positive</h3>
              <ul className="list-disc ml-5">
                {summary.positiveThemes.map(t => <li key={t.theme}>{t.theme} — {t.count}</li>)}
              </ul>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-2">Negative</h3>
              <ul className="list-disc ml-5">
                {summary.negativeThemes.map(t => <li key={t.theme}>{t.theme} — {t.count}</li>)}
              </ul>
            </div>
          </div>
        </section>

        {/* Top Viral */}
        <section className="bg-white p-6 rounded shadow mb-6">
          <h2 className="text-xl font-bold mb-4">Top Viral Mentions</h2>
          <ol className="list-decimal ml-5">
            {topViral.map(p => (
              <li key={p.id}>
               
