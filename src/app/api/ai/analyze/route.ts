import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Mock AI analysis response generator based on study type
function generateMockAnalysis(studyType: string, studyId: string) {
  const baseSuggestions = [
    { category: 'finding', message: 'AI analysis complete. Review AI-suggested measurements.', severity: 'info' as const, source: 'measurement' },
    { category: 'quality', message: 'Overall image quality is adequate for interpretation.', severity: 'info' as const, source: 'qa' },
  ];

  const typeSpecificSuggestions: Record<string, Array<{ category: string; message: string; severity: 'info' | 'warning' | 'critical'; source: string }>> = {
    OB: [
      { category: 'finding', message: 'Fetal biometric measurements within expected range for gestational age.', severity: 'info', source: 'measurement' },
      { category: 'finding', message: 'Placenta identified — posterior in location, Grade II.', severity: 'info', source: 'image' },
      { category: 'finding', message: 'Amniotic fluid volume appears normal on visual assessment.', severity: 'info', source: 'image' },
      { category: 'missing', message: 'Cervical length not measured. Consider if clinically indicated.', severity: 'warning', source: 'checklist' },
      { category: 'finding', message: 'Fetal cardiac activity present. M-mode heart rate within normal limits.', severity: 'info', source: 'image' },
    ],
    PELVIS: [
      { category: 'finding', message: 'Uterus appears normal in size and echotexture.', severity: 'info', source: 'image' },
      { category: 'finding', message: 'Endometrial thickness measured and documented.', severity: 'info', source: 'measurement' },
      { category: 'finding', message: 'Both ovaries visualized. No adnexal pathology detected.', severity: 'info', source: 'image' },
      { category: 'finding', message: 'No free fluid in pouch of Douglas.', severity: 'info', source: 'image' },
    ],
    ABDOMEN: [
      { category: 'finding', message: 'Liver size and echotexture within normal limits.', severity: 'info', source: 'image' },
      { category: 'finding', message: 'Gallbladder well distended. No wall thickening or calculi.', severity: 'info', source: 'image' },
      { category: 'finding', message: 'Both kidneys show normal cortical echogenicity and size.', severity: 'info', source: 'image' },
      { category: 'finding', message: 'Pancreas adequately visualized. No focal lesion.', severity: 'info', source: 'image' },
      { category: 'missing', message: 'Spleen measurement not captured. Consider documenting.', severity: 'warning', source: 'checklist' },
    ],
    THYROID: [
      { category: 'finding', message: 'Thyroid gland normal in size. Homogeneous echotexture.', severity: 'info', source: 'image' },
      { category: 'finding', message: 'No focal thyroid nodules detected.', severity: 'info', source: 'image' },
      { category: 'finding', message: 'No cervical lymphadenopathy identified.', severity: 'info', source: 'image' },
    ],
    BREAST: [
      { category: 'finding', message: 'Bilateral breast parenchyma appears normal.', severity: 'info', source: 'image' },
      { category: 'finding', message: 'No suspicious masses or microcalcifications detected.', severity: 'info', source: 'image' },
      { category: 'finding', message: 'No axillary lymphadenopathy identified.', severity: 'info', source: 'image' },
    ],
  };

  const suggestions = [
    ...baseSuggestions,
    ...(typeSpecificSuggestions[studyType] || typeSpecificSuggestions['GENERAL'] || []),
  ];

  const keyImageCategories = studyType === 'OB'
    ? ['BPD', 'HC', 'AC', 'FL', 'PLACENTA', 'DOPPLER']
    : studyType === 'PELVIS'
      ? ['UTERUS', 'ENDOMETRIUM', 'RT_OVARY', 'LT_OVARY']
      : studyType === 'ABDOMEN'
        ? ['LIVER', 'GALLBLADDER', 'RT_KIDNEY', 'LT_KIDNEY', 'PANCREAS', 'SPLEEN']
        : studyType === 'THYROID'
          ? ['RT_LOBE', 'LT_LOBE', 'ISTHMUS']
          : ['IMAGE_1', 'IMAGE_2', 'IMAGE_3'];

  const keyImages = keyImageCategories.map((category, index) => ({
    category,
    aiScore: Math.round((0.78 + Math.random() * 0.2) * 100) / 100,
  }));

  const imageTypes = studyType === 'OB'
    ? ['BPD', 'HC', 'AC', 'FL', 'PLACENTA', 'CERVIX', 'DOPPLER', 'ANATOMY']
    : studyType === 'PELVIS'
      ? ['UTERUS', 'ENDOMETRIUM', 'RT_OVARY', 'LT_OVARY', 'POD']
      : studyType === 'ABDOMEN'
        ? ['LIVER', 'GB', 'CBD', 'PANCREAS', 'SPLEEN', 'RT_KIDNEY', 'LT_KIDNEY', 'AORTA']
        : ['GENERAL_1', 'GENERAL_2', 'GENERAL_3'];

  const qualityChecks = imageTypes.map((imageType) => {
    const score = Math.round((0.7 + Math.random() * 0.3) * 100) / 100;
    const quality = score >= 0.85 ? 'excellent' : score >= 0.7 ? 'good' : 'fair';
    const issues: string[] = [];
    if (score < 0.75) {
      issues.push('Suboptimal image resolution');
    }
    if (score < 0.7) {
      issues.push('Consider re-acquisition');
    }
    return { imageType, quality, issues };
  });

  return { suggestions, keyImages, qualityChecks };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { studyId } = body;

    if (!studyId) {
      return NextResponse.json(
        { error: 'studyId is required' },
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

    // Simulate AI processing delay
    await sleep(500);

    const analysis = generateMockAnalysis(study.studyType, studyId);

    // Persist AI suggestions to DB
    const aiSuggestions = await Promise.all(
      analysis.suggestions.map((s) =>
        db.aiSuggestion.create({
          data: {
            studyId,
            category: s.category,
            message: s.message,
            severity: s.severity,
            source: s.source,
          },
        })
      )
    );

    // Persist key images to DB
    const keyImages = await Promise.all(
      analysis.keyImages.map((ki) =>
        db.keyImage.create({
          data: {
            studyId,
            category: ki.category,
            rank: analysis.keyImages.indexOf(ki) + 1,
            aiScore: ki.aiScore,
          },
        })
      )
    );

    return NextResponse.json({
      studyId,
      suggestions: aiSuggestions,
      keyImages,
      qualityChecks: analysis.qualityChecks,
    });
  } catch (error) {
    console.error('Error during AI analysis:', error);
    return NextResponse.json(
      { error: 'Failed to analyze study' },
      { status: 500 }
    );
  }
}