import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const study = await db.study.findUnique({
      where: { id },
      include: {
        patient: true,
        series: {
          include: { images: true },
          orderBy: { seriesNumber: 'asc' },
        },
        measurements: true,
        report: true,
        aiSuggestions: true,
        keyImages: true,
      },
    });

    if (!study) {
      return NextResponse.json(
        { error: 'Study not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ study });
  } catch (error) {
    console.error('Error fetching study:', error);
    return NextResponse.json(
      { error: 'Failed to fetch study' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json(
        { error: 'Status is required' },
        { status: 400 }
      );
    }

    const validStatuses = ['pending', 'in-progress', 'reporting', 'qa', 'signed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const study = await db.study.update({
      where: { id },
      data: { status },
      include: {
        patient: true,
        measurements: true,
        report: true,
        aiSuggestions: true,
        keyImages: true,
      },
    });

    return NextResponse.json({ study });
  } catch (error) {
    console.error('Error updating study:', error);
    return NextResponse.json(
      { error: 'Failed to update study' },
      { status: 500 }
    );
  }
}