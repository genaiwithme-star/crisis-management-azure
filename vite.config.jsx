import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8080';

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

export default function App(){
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
    // send to backend to append
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

  const topViral = useMemo(()=>{ return [...posts].sort((a,b)=> (b.engagement||0) - (a.engagement||0)).slice(0,10); },[posts]);
  const topEscalation = useMemo(()=>{ return posts.filter(p=> (p.sentiment==='Strongly Negative' || p.sentiment==='Negative')).sort((a,b)=> (b.engagement||0)-(a.engagement||0)).slice(0,5); },[posts]);

  return (
    <div className="container">
      <div className="header">
        <h1>CrisisWatch — Admin Panel (Demo)</h1>
        <div>
          <label className="btn" style={{marginRight:8}}>Upload Excel<input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} style={{display:'none'}} /></label>
          <button className="btn" onClick={exportExcel}>Download Excel</button>
          <button className="btn" onClick={fetchPosts} style={{marginLeft:8}}>{loading?'Refreshing...':'Refresh'}</button>
        </div>
      </div>

      <div className="grid grid-3">
        <div className="card">
          <h3>Executive Summary</h3>
          <p>Total Mentions Scanned: <strong>{summary.total}</strong></p>
          <p>Actionable Mentions (Non-Neutral): <strong>{summary.actionable}</strong></p>
          <p>Overall Sentiment Index: <strong>{summary.overall}</strong></p>
        </div>

        <div className="card">
          <h3>Sentiment Distribution</h3>
          <ul className="small">
            {Object.entries(summary.counts).map(([k,v])=> (<li key={k} className="small">{k}: {v} ({summary.total?Math.round((v/summary.total)*100):0}%)</li>))}
          </ul>
        </div>

        <div className="card">
          <h3>Top Themes</h3>
          <div>
            <strong>Positive</strong>
            <ul>{summary.positiveThemes.map(t=> <li key={t.theme}>{t.theme} — {t.count}</li>)}</ul>
            <strong>Negative</strong>
            <ul>{summary.negativeThemes.map(t=> <li key={t.theme}>{t.theme} — {t.count}</li>)}</ul>
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Top Viral Mentions</h3>
          <ol>
            {topViral.map(p=> (<li key={p.id}><a href={p.url} target="_blank" rel="noreferrer">{p.platform} #{p.id}</a> — Engagement: {p.engagement || 0} — Sentiment: {p.sentiment || 'Neutral'}</li>))}
          </ol>
        </div>
        <div className="card">
          <h3>Escalations (Top Negative)</h3>
          <ol>
            {topEscalation.map(p=> (<li key={p.id}><a href={p.url} target="_blank" rel="noreferrer">{p.platform} #{p.id}</a> — Theme: {(p.themes||[]).join(', ') || '—'} — Engagement: {p.engagement || 0}</li>))}
          </ol>
        </div>
      </div>

      <div className="card">
        <h3>Raw Posts (first 500)</h3>
        <table className="table"><thead><tr><th>ID</th><th>Platform</th><th>Sentiment</th><th>Engagement</th><th>Themes</th></tr></thead>
        <tbody>{posts.slice(0,500).map(p=> (<tr key={p.id}><td>{p.id}</td><td>{p.platform}</td><td>{p.sentiment}</td><td>{p.engagement}</td><td>{(p.themes||[]).join(', ')}</td></tr>))}</tbody></table>
      </div>
      <div className="small">API: {API}</div>
    </div>
  );
}
