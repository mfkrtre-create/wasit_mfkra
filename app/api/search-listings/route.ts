import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthenticatedRequest } from '@/lib/app-auth';
import { getServerAiKey } from '@/lib/server-ai-keys';

export const runtime = 'nodejs';

const requestSchema = z.object({ query: z.string().trim().min(2).max(500) });
const filtersSchema = z.object({
  propertyType: z.enum(['land', 'villa', 'apartment', 'building', 'block', 'warehouse', 'rest_house', 'office', 'shop', 'farm', 'tower', 'other']).nullable(),
  city: z.string().nullable(),
  districts: z.array(z.string()),
  minArea: z.number().nonnegative().nullable(),
  maxArea: z.number().nonnegative().nullable(),
  minPrice: z.number().nonnegative().nullable(),
  maxPrice: z.number().nonnegative().nullable(),
  transaction: z.enum(['sale', 'rent', 'buy', 'rent_request']).nullable(),
});

const responseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    propertyType: { type: ['string', 'null'], enum: ['land', 'villa', 'apartment', 'building', 'block', 'warehouse', 'rest_house', 'office', 'shop', 'farm', 'tower', 'other', null] },
    city: { type: ['string', 'null'] },
    districts: { type: 'array', items: { type: 'string' } },
    minArea: { type: ['number', 'null'] }, maxArea: { type: ['number', 'null'] },
    minPrice: { type: ['number', 'null'] }, maxPrice: { type: ['number', 'null'] },
    transaction: { type: ['string', 'null'], enum: ['sale', 'rent', 'buy', 'rent_request', null] },
  },
  required: ['propertyType', 'city', 'districts', 'minArea', 'maxArea', 'minPrice', 'maxPrice', 'transaction'],
} as const;

export async function POST(request: Request) {
  const { response } = await requireAuthenticatedRequest();
  if (response) return response;
  const payload = requestSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) return NextResponse.json({ error: 'عبارة البحث غير صالحة.' }, { status: 400 });
  const apiKey = getServerAiKey('GEMINI_API_KEY');
  if (!apiKey) return NextResponse.json({ error: 'مفتاح Gemini غير مضبوط.' }, { status: 500 });
  try {
    const client = new GoogleGenAI({ apiKey });
    const result = await client.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
      contents: `عبارة البحث: ${payload.data.query}`,
      config: {
        systemInstruction: 'حول البحث العقاري العربي، بما في ذلك اللهجة السعودية، إلى فلاتر دقيقة. لا تضف قيمة لم يذكرها المستخدم. افهم من/إلى، حدود، ما يتجاوز، يبي، يدور، والأرقام العربية.',
        responseMimeType: 'application/json',
        responseSchema,
      },
    });
    const rawResult = result as unknown as { text?: string | (() => string) };
    const text = typeof rawResult.text === 'function' ? rawResult.text() : rawResult.text;
    if (!text) throw new Error('Gemini returned an empty search response.');
    return NextResponse.json(filtersSchema.parse(JSON.parse(String(text))));
  } catch {
    return NextResponse.json({ error: 'تعذر تحليل البحث الذكي.' }, { status: 502 });
  }
}
