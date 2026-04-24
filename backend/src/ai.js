const fallbackAnswer = (question, mode, sources) => {
  const sourceTitles = sources.length
    ? sources.map((source) => source.title).slice(0, 3).join(', ')
    : 'your current notebook sources';

  return {
    role: 'assistant',
    content:
      `Based on ${sourceTitles}, I analyzed your request in ${mode} mode.\n\n` +
      `Question: ${question}\n\n` +
      'This backend is ready for real retrieval and model calls. Add source extraction/vector search next, or set OPENAI_API_KEY to let the chat endpoint call a model with the notebook context.',
    suggestions: ['Show me the citations', 'Summarize the sources', 'Deep dive into RAG']
  };
};

export async function generateAssistantMessage({ question, mode, sources }) {
  if (!process.env.OPENAI_API_KEY) {
    return fallbackAnswer(question, mode, sources);
  }

  const sourceContext = sources
    .map((source, index) => `[${index + 1}] ${source.title} (${source.type})\n${source.content || 'No extracted text available.'}`)
    .join('\n\n');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are CORELLM, a careful research assistant. Answer only from provided notebook context when possible. If context is thin, say what is missing.'
        },
        {
          role: 'user',
          content: `Mode: ${mode}\n\nNotebook context:\n${sourceContext || 'No sources yet.'}\n\nUser question:\n${question}`
        }
      ],
      temperature: mode === 'deep' ? 0.3 : 0.5
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return {
    role: 'assistant',
    content: data.choices?.[0]?.message?.content || 'I could not generate a response.',
    suggestions: ['Show me the citations', 'Summarize the sources', 'Deep dive into RAG']
  };
}
