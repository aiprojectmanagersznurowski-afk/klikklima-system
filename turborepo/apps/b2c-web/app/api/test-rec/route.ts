import { NextResponse } from 'next/server';
import { getRecommendation } from '@/app/actions/getRecommendation';

export async function GET(request: Request) {
  try {
    const res = await getRecommendation(5, { 1: '21-25 m²', 2: '21-25 m²', 3: '21-25 m²', 4: '21-25 m²', 5: '21-25 m²' }, 'KJCAL');
    return NextResponse.json({ success: true, result: res });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}
