import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { studyId, findings, impression, recommendation, clinicalInfo, technique, comparison } = body;

    if (!studyId || !findings || !impression) {
      return NextResponse.json(
        { error: 'studyId, findings, and impression are required' },
        { status: 400 }
      );
    }

    // Verify study exists
    const study = await db.study.findUnique({ where: { id: studyId } });
    if (!study) {
      return NextResponse.json(
        { error: 'Study not found' },
        { status: 404 }
      );
    }

    // Upsert report — update if exists for this study, create otherwise
    const report = await db.report.upsert({
      where: { studyId },
      update: {
        findings,
        impression,
        recommendation: recommendation ?? undefined,
        clinicalInfo: clinicalInfo ?? undefined,
        technique: technique ?? undefined,
        comparison: comparison ?? undefined,
        reportStatus: 'draft',
      },
      create: {
        studyId,
        findings,
        impression,
        recommendation: recommendation ?? undefined,
        clinicalInfo: clinicalInfo ?? undefined,
        technique: technique ?? undefined,
        comparison: comparison ?? undefined,
      },
    });

    return NextResponse.json({ report });
  } catch (error) {
    console.error('Error saving report:', error);
    return NextResponse.json(
      { error: 'Failed to save report' },
      { status: 500 }
    );
  }
}