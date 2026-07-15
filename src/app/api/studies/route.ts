import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const studies = await db.study.findMany({
      include: {
        patient: true,
        measurements: true,
        report: true,
        aiSuggestions: true,
        keyImages: true,
      },
      orderBy: { studyDate: 'desc' },
    });

    // If DB is empty, return mock studies
    if (studies.length === 0) {
      return NextResponse.json({ studies: [], message: 'No studies found. Demo mode — connect to PACS for live data.' });
    }

    return NextResponse.json({ studies });
  } catch (error) {
    console.error('Error fetching studies:', error);
    return NextResponse.json(
      { error: 'Failed to fetch studies' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { patientName, patientAge, patientSex, uhid, referringDoctor, studyType, studyUid, studyDate, machine, studyDesc } = body;

    // Create or find patient
    const patient = await db.patient.upsert({
      where: { uhid },
      update: { name: patientName, age: patientAge, sex: patientSex, referringDoctor },
      create: {
        name: patientName,
        age: patientAge,
        sex: patientSex,
        uhid,
        referringDoctor,
      },
    });

    const study = await db.study.create({
      data: {
        studyUid: studyUid || `STUDY-${Date.now()}`,
        studyDate: studyDate ? new Date(studyDate) : new Date(),
        studyType: studyType || 'GENERAL',
        machine: machine || 'GE Voluson E9',
        studyDesc: studyDesc || '',
        status: 'pending',
        patientId: patient.id,
      },
      include: {
        patient: true,
        measurements: true,
        report: true,
        aiSuggestions: true,
        keyImages: true,
      },
    });

    return NextResponse.json({ study }, { status: 201 });
  } catch (error) {
    console.error('Error creating study:', error);
    return NextResponse.json(
      { error: 'Failed to create study' },
      { status: 500 }
    );
  }
}