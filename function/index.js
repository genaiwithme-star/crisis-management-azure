const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

module.exports = async function (context, myTimer) {
  context.log('TwitterPoller started at', new Date().toISOString());
  const BEARER = process.env.TWITTER_BEARER_TOKEN;
  const BACKEND = process.env.BACKEND;
  const KEYWORDS = process.env.KEYWORDS || 'CompanyXYZ OR @CompanyXYZ OR #CompanyXYZ';
  if (!BEARER) { context.log('No TWITTER_BEARER_TOKEN'); return; }
  try {
    const url = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(KEYWORDS)}&tweet.fields=public_metrics,created_at,author_id&expansions=author_id&user.fields=username,public_metrics&max_results=10`;
    const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${BEARER}` } });
    if (!resp.ok) {
      context.log('Twitter API error', resp.status, await resp.text());
      return;
    }
    const data = await resp.json();
    if (!data?.data || data.data.length === 0) { context.log('No tweets'); return; }
    const posts = data.data.map(t => ({
      id: t.id,
      platform: 'Twitter',
      text: t.text,
      created_at: t.created_at,
      engagement: t.public_metrics ? (t.public_metrics.retweet_count + t.public_metrics.reply_count + t.public_metrics.like_count + t.public_metrics.quote_count) : 0,
      url: `https://twitter.com/i/web/status/${t.id}`,
      sentiment: 'Neutral/Informational',
      themes: []
    }));
    const forward = await fetch(BACKEND + '/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(posts)
    });
    context.log('Forwarded tweets to backend, status:', forward.status);
  } catch (err) {
    context.log('Error in TwitterPoller', err);
  }
};
