import OpenAI from 'openai';

const omniClient = new OpenAI({
  baseURL: 'http://localhost:20128/v1',
  apiKey: 'not-needed',
});

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    const completion = await omniClient.chat.completions.create({
      model: 'gweb/gemini-3.7-flash',
      messages: [{ role: 'user', content: message }],
    });

    const reply = completion.choices[0].message.content;

    return Response.json({ success: true, reply });
  } catch (error: any) {
    // KITA TAMPILKAN DETAIL ERROR ASLINYA DI RESPONSE
    const errorDetail = error.error || error.response?.data || error.message || "Unknown error";
    console.error("OmniRoute Error:", errorDetail);
    
    return Response.json({ 
      success: false, 
      error: typeof errorDetail === 'string' ? errorDetail : JSON.stringify(errorDetail) 
    }, { status: 500 });
  }
}