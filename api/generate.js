
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, licenseKey, storeName, industry, rating, reviewText } = req.body;

  // ── ライセンス認証 ──────────────────────────────
  if (action === 'verify') {
    const validKeys = (process.env.LICENSE_KEYS || '').split(',').map(k => k.trim());
    const isValid = validKeys.includes(licenseKey);
    return res.status(200).json({ valid: isValid });
  }

  // ── 返信文生成 ──────────────────────────────────
  if (action === 'generate') {
    // ライセンス再確認
    const validKeys = (process.env.LICENSE_KEYS || '').split(',').map(k => k.trim());
    if (!validKeys.includes(licenseKey)) {
      return res.status(403).json({ error: '無効なライセンスキーです' });
    }

    const ratingMap = {
      1: '非常に不満',
      2: 'やや不満',
      3: '普通',
      4: '満足',
      5: '非常に満足'
    };

    const prompt = `あなたは${industry}のオーナーです。Googleマップに以下のレビューが投稿されました。MEO対策を意識した、丁寧で自然なオーナー返信文を作成してください。

店舗名：${storeName}
星評価：${rating}（${ratingMap[rating] || ''}）
レビュー内容：${reviewText}

【返信文の条件】
- 200〜300文字程度
- 業種キーワード（${industry}）を自然に1〜2回含める
- 高評価(4-5)：感謝・再来店を促す温かい文章
- 低評価(1-2)：誠実なお詫び・改善への姿勢・再来店のお願い
- 中評価(3)：感謝しつつ改善への姿勢を示す
- 署名は「${storeName} スタッフ一同」で締める
- 返信文のみ出力（説明・前置き不要）`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      const data = await response.json();
      const text = data.content?.[0]?.text || '';
      return res.status(200).json({ reply: text });
    } catch (err) {
      return res.status(500).json({ error: '生成に失敗しました' });
    }
  }

  return res.status(400).json({ error: '不明なアクションです' });
}
