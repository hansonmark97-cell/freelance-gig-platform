process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../src/app');
const firestoreMock = require('./firestoreMock');
const {
  WELDSCAN_PDF_PRICE_USD,
  WELDSCAN_DXF_PRICE_USD,
} = require('../src/constants');
const {
  computePPI,
  pixelsToInches,
  inchesToMm,
  angleBetween,
  miterAngle,
  kerfAdjustedLength,
  bendDeduction,
  bevelGap,
  weldVolume,
  filletCrossSection,
  buildCutList,
} = require('../src/weldscan/calculators');

// --------------------------------------------------------------------------
// Mock Stripe
// --------------------------------------------------------------------------
jest.mock('stripe', () =>
  jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: jest.fn().mockResolvedValue({
        id: 'pi_weldscan_test',
        client_secret: 'pi_weldscan_test_secret',
        amount: 299,
        currency: 'usd',
        metadata: {},
      }),
    },
  }))
);

// --------------------------------------------------------------------------
// Mock PDFKit — return a minimal valid PDF buffer so tests don't need
// to render a full document.
// --------------------------------------------------------------------------
jest.mock('pdfkit', () => {
  const { EventEmitter } = require('events');
  return jest.fn().mockImplementation(() => {
    const emitter = new EventEmitter();
    const doc = {
      ...emitter,
      fontSize: jest.fn().mockReturnThis(),
      font: jest.fn().mockReturnThis(),
      text: jest.fn().mockReturnThis(),
      moveDown: jest.fn().mockReturnThis(),
      moveTo: jest.fn().mockReturnThis(),
      lineTo: jest.fn().mockReturnThis(),
      stroke: jest.fn().mockReturnThis(),
      strokeColor: jest.fn().mockReturnThis(),
      lineWidth: jest.fn().mockReturnThis(),
      addPage: jest.fn().mockReturnThis(),
      on: emitter.on.bind(emitter),
      end: jest.fn().mockImplementation(function () {
        // Emit minimal PDF-like bytes
        emitter.emit('data', Buffer.from('%PDF-1.4 mock'));
        emitter.emit('end');
      }),
      y: 100,
    };
    return doc;
  });
});

beforeEach(() => {
  firestoreMock.reset();
});

// --------------------------------------------------------------------------
// Helper: register + login a user
// --------------------------------------------------------------------------
async function registerAndLogin(user) {
  const res = await request(app).post('/api/users/register').send(user);
  return res.body.token;
}

const welder = {
  name: 'Mark Welder',
  email: 'mark@weldshop.com',
  password: 'plasma99',
  role: 'freelancer',
};

// --------------------------------------------------------------------------
// Pure-math calculator unit tests
// --------------------------------------------------------------------------
describe('WeldScan Calculators — computePPI', () => {
  test('100 pixels / 1 inch → PPI = 100', () => {
    expect(computePPI(100, 1)).toBe(100);
  });

  test('1200 pixels / 12 inches → PPI = 100', () => {
    expect(computePPI(1200, 12)).toBe(100);
  });

  test('throws on zero pixel length', () => {
    expect(() => computePPI(0, 12)).toThrow();
  });

  test('throws on negative ref size', () => {
    expect(() => computePPI(100, -1)).toThrow();
  });
});

describe('WeldScan Calculators — pixelsToInches + inchesToMm', () => {
  test('500 px at PPI=100 → 5 inches', () => {
    expect(pixelsToInches(500, 100)).toBe(5);
  });

  test('5 inches → 127 mm', () => {
    expect(inchesToMm(5)).toBeCloseTo(127, 5);
  });
});

describe('WeldScan Calculators — angleBetween + miterAngle', () => {
  test('90° corner: A=(0,0) B=(1,0) C=(1,1)', () => {
    const angle = angleBetween({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 });
    expect(angle).toBeCloseTo(90, 1);
  });

  test('miter for 90° interior → 45°', () => {
    expect(miterAngle(90)).toBeCloseTo(45, 5);
  });

  test('miter for 120° interior → 30°', () => {
    expect(miterAngle(120)).toBeCloseTo(30, 5);
  });
});

describe('WeldScan Calculators — kerfAdjustedLength', () => {
  test('100mm piece with 1.5mm plasma kerf → 98.5mm', () => {
    expect(kerfAdjustedLength(100, 1.5)).toBeCloseTo(98.5, 5);
  });

  test('zero kerf returns nominal length', () => {
    expect(kerfAdjustedLength(200, 0)).toBe(200);
  });

  test('throws on negative kerf', () => {
    expect(() => kerfAdjustedLength(100, -1)).toThrow();
  });
});

describe('WeldScan Calculators — bendDeduction', () => {
  test('BD = (π/2) × (r + t/3)', () => {
    const r = 10, t = 6;
    const expected = (Math.PI / 2) * (r + t / 3);
    expect(bendDeduction(r, t)).toBeCloseTo(expected, 6);
  });

  test('throws on negative inside radius', () => {
    expect(() => bendDeduction(-1, 6)).toThrow();
  });

  test('throws on zero thickness', () => {
    expect(() => bendDeduction(5, 0)).toThrow();
  });
});

describe('WeldScan Calculators — bevelGap', () => {
  test('wire=0.9mm, thickness=10mm → rootGap=0.9, landing=1', () => {
    const result = bevelGap(0.9, 10);
    expect(result.rootGapMm).toBe(0.9);
    expect(result.landingMm).toBe(1); // max(1, 10*0.1)=1
  });

  test('wire=1.2mm, thickness=20mm → landing=2mm (10%)', () => {
    const result = bevelGap(1.2, 20);
    expect(result.landingMm).toBeCloseTo(2, 5);
  });

  test('throws on zero wire diameter', () => {
    expect(() => bevelGap(0, 10)).toThrow();
  });
});

describe('WeldScan Calculators — weldVolume', () => {
  test('50mm² × 100mm = 5000mm³ = 5cm³', () => {
    const result = weldVolume(50, 100);
    expect(result.volumeMm3).toBe(5000);
    expect(result.volumeCm3).toBeCloseTo(5, 3);
  });

  test('throws on zero cross-section', () => {
    expect(() => weldVolume(0, 100)).toThrow();
  });
});

describe('WeldScan Calculators — filletCrossSection', () => {
  test('8mm leg → 32mm²', () => {
    expect(filletCrossSection(8)).toBe(32);
  });
});

describe('WeldScan Calculators — buildCutList', () => {
  const segments = [
    { lengthPx: 500, angle: 0 },
    { lengthPx: 300, angle: 45 },
    { lengthPx: 400, angle: 0 },
  ];

  test('labels are P1, P2, P3', () => {
    const list = buildCutList(segments, 100, 0);
    expect(list.map(p => p.label)).toEqual(['P1', 'P2', 'P3']);
  });

  test('P1 length = 500px / 100ppi = 5in = 127mm', () => {
    const list = buildCutList(segments, 100, 0);
    expect(list[0].lengthIn).toBeCloseTo(5, 2);
    expect(list[0].lengthMm).toBeCloseTo(127, 1);
  });

  test('kerf adjustment applied', () => {
    const list = buildCutList(segments, 100, 1.5);
    expect(list[0].kerfAdjLengthMm).toBeCloseTo(127 - 1.5, 1);
  });
});

// --------------------------------------------------------------------------
// WeldScan Express API tests
// --------------------------------------------------------------------------
describe('POST /api/weldscan/calibrate', () => {
  test('creates calibration session and returns ppi', async () => {
    const token = await registerAndLogin(welder);
    const res = await request(app)
      .post('/api/weldscan/calibrate')
      .set('Authorization', `Bearer ${token}`)
      .send({ refPixelLength: 1200, refRealInches: 12 });

    expect(res.status).toBe(201);
    expect(res.body.sessionId).toBeDefined();
    expect(res.body.ppi).toBeCloseTo(100, 5);
  });

  test('returns 400 for missing params', async () => {
    const token = await registerAndLogin(welder);
    const res = await request(app)
      .post('/api/weldscan/calibrate')
      .set('Authorization', `Bearer ${token}`)
      .send({ refRealInches: 12 });

    expect(res.status).toBe(400);
  });

  test('returns 400 for non-positive values', async () => {
    const token = await registerAndLogin(welder);
    const res = await request(app)
      .post('/api/weldscan/calibrate')
      .set('Authorization', `Bearer ${token}`)
      .send({ refPixelLength: -100, refRealInches: 12 });

    expect(res.status).toBe(400);
  });

  test('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/weldscan/calibrate')
      .send({ refPixelLength: 1200, refRealInches: 12 });

    expect(res.status).toBe(401);
  });
});

// --------------------------------------------------------------------------
// Helper: create a calibrated session
// --------------------------------------------------------------------------
async function createSession(token) {
  const res = await request(app)
    .post('/api/weldscan/calibrate')
    .set('Authorization', `Bearer ${token}`)
    .send({ refPixelLength: 1200, refRealInches: 12 });
  return res.body.sessionId;
}

// --------------------------------------------------------------------------
// Minimal segments fixture: a simple 4-piece rectangle
// --------------------------------------------------------------------------
const rectangleSegments = [
  {
    lengthPx: 600,
    startPoint: { x: 0, y: 0 },
    endPoint: { x: 600, y: 0 },
  },
  {
    lengthPx: 400,
    startPoint: { x: 600, y: 0 },
    endPoint: { x: 600, y: 400 },
  },
  {
    lengthPx: 600,
    startPoint: { x: 600, y: 400 },
    endPoint: { x: 0, y: 400 },
  },
  {
    lengthPx: 400,
    startPoint: { x: 0, y: 400 },
    endPoint: { x: 0, y: 0 },
  },
];

describe('POST /api/weldscan/analyze', () => {
  test('returns cutList, summary, and welderCalcs', async () => {
    const token = await registerAndLogin(welder);
    const sessionId = await createSession(token);

    const res = await request(app)
      .post('/api/weldscan/analyze')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sessionId,
        segments: rectangleSegments,
        thicknessMm: 6,
        kerfMm: 1.5,
        wireDiameterMm: 0.9,
        insideRadiusMm: 6,
        weldLegMm: 6,
      });

    expect(res.status).toBe(200);
    expect(res.body.cutList).toHaveLength(4);
    expect(res.body.cutList[0].label).toBe('P1');
    expect(res.body.summary.totalPieces).toBe(4);
    expect(res.body.welderCalcs.bendDeductionMm).toBeGreaterThan(0);
    expect(res.body.welderCalcs.rootGapMm).toBe(0.9);
    expect(res.body.exportPrices.pdfUsd).toBe(WELDSCAN_PDF_PRICE_USD);
    expect(res.body.exportPrices.dxfUsd).toBe(WELDSCAN_DXF_PRICE_USD);
  });

  test('returns 400 when segments is missing', async () => {
    const token = await registerAndLogin(welder);
    const sessionId = await createSession(token);

    const res = await request(app)
      .post('/api/weldscan/analyze')
      .set('Authorization', `Bearer ${token}`)
      .send({ sessionId });

    expect(res.status).toBe(400);
  });

  test('returns 400 when segments has fewer than 2 entries', async () => {
    const token = await registerAndLogin(welder);
    const sessionId = await createSession(token);

    const res = await request(app)
      .post('/api/weldscan/analyze')
      .set('Authorization', `Bearer ${token}`)
      .send({ sessionId, segments: [rectangleSegments[0]] });

    expect(res.status).toBe(400);
  });

  test('returns 404 for non-existent session', async () => {
    const token = await registerAndLogin(welder);

    const res = await request(app)
      .post('/api/weldscan/analyze')
      .set('Authorization', `Bearer ${token}`)
      .send({ sessionId: 'no-such-session', segments: rectangleSegments });

    expect(res.status).toBe(404);
  });

  test('returns 403 for another user\'s session', async () => {
    const token1 = await registerAndLogin(welder);
    const token2 = await registerAndLogin({
      name: 'Other', email: 'other@weld.com', password: 'x', role: 'freelancer',
    });
    const sessionId = await createSession(token1);

    const res = await request(app)
      .post('/api/weldscan/analyze')
      .set('Authorization', `Bearer ${token2}`)
      .send({ sessionId, segments: rectangleSegments });

    expect(res.status).toBe(403);
  });
});

// --------------------------------------------------------------------------
// Helper: analyze a session so its status becomes 'analyzed'
// --------------------------------------------------------------------------
async function analyzeSession(token, sessionId) {
  await request(app)
    .post('/api/weldscan/analyze')
    .set('Authorization', `Bearer ${token}`)
    .send({ sessionId, segments: rectangleSegments });
}

describe('POST /api/weldscan/export/pdf', () => {
  test('returns Stripe clientSecret for PDF export', async () => {
    const token = await registerAndLogin(welder);
    const sessionId = await createSession(token);
    await analyzeSession(token, sessionId);

    const res = await request(app)
      .post('/api/weldscan/export/pdf')
      .set('Authorization', `Bearer ${token}`)
      .send({ sessionId });

    expect(res.status).toBe(201);
    expect(res.body.clientSecret).toBeDefined();
    expect(res.body.exportType).toBe('pdf');
    expect(res.body.priceUsd).toBe(WELDSCAN_PDF_PRICE_USD);
  });

  test('returns 400 if session not yet analyzed', async () => {
    const token = await registerAndLogin(welder);
    const sessionId = await createSession(token);

    const res = await request(app)
      .post('/api/weldscan/export/pdf')
      .set('Authorization', `Bearer ${token}`)
      .send({ sessionId });

    expect(res.status).toBe(400);
  });

  test('returns 400 for missing sessionId', async () => {
    const token = await registerAndLogin(welder);
    const res = await request(app)
      .post('/api/weldscan/export/pdf')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });
});

describe('POST /api/weldscan/export/dxf', () => {
  test('returns Stripe clientSecret for DXF export', async () => {
    const token = await registerAndLogin(welder);
    const sessionId = await createSession(token);
    await analyzeSession(token, sessionId);

    const res = await request(app)
      .post('/api/weldscan/export/dxf')
      .set('Authorization', `Bearer ${token}`)
      .send({ sessionId });

    expect(res.status).toBe(201);
    expect(res.body.clientSecret).toBeDefined();
    expect(res.body.exportType).toBe('dxf');
    expect(res.body.priceUsd).toBe(WELDSCAN_DXF_PRICE_USD);
  });

  test('returns 400 if session not yet analyzed', async () => {
    const token = await registerAndLogin(welder);
    const sessionId = await createSession(token);

    const res = await request(app)
      .post('/api/weldscan/export/dxf')
      .set('Authorization', `Bearer ${token}`)
      .send({ sessionId });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/weldscan/payment/intent', () => {
  test('creates payment intent for pdf export', async () => {
    const token = await registerAndLogin(welder);
    const res = await request(app)
      .post('/api/weldscan/payment/intent')
      .set('Authorization', `Bearer ${token}`)
      .send({ amountUsd: WELDSCAN_PDF_PRICE_USD, exportType: 'pdf' });

    expect(res.status).toBe(201);
    expect(res.body.clientSecret).toBeDefined();
    expect(res.body.exportType).toBe('pdf');
    expect(res.body.amountUsd).toBe(WELDSCAN_PDF_PRICE_USD);
  });

  test('creates payment intent for dxf export', async () => {
    const token = await registerAndLogin(welder);
    const res = await request(app)
      .post('/api/weldscan/payment/intent')
      .set('Authorization', `Bearer ${token}`)
      .send({ amountUsd: WELDSCAN_DXF_PRICE_USD, exportType: 'dxf' });

    expect(res.status).toBe(201);
    expect(res.body.exportType).toBe('dxf');
  });

  test('returns 400 for missing amountUsd', async () => {
    const token = await registerAndLogin(welder);
    const res = await request(app)
      .post('/api/weldscan/payment/intent')
      .set('Authorization', `Bearer ${token}`)
      .send({ exportType: 'pdf' });

    expect(res.status).toBe(400);
  });

  test('returns 400 for invalid exportType', async () => {
    const token = await registerAndLogin(welder);
    const res = await request(app)
      .post('/api/weldscan/payment/intent')
      .set('Authorization', `Bearer ${token}`)
      .send({ amountUsd: 2.99, exportType: 'svg' });

    expect(res.status).toBe(400);
  });

  test('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/weldscan/payment/intent')
      .send({ amountUsd: 2.99, exportType: 'pdf' });

    expect(res.status).toBe(401);
  });
});

describe('WeldScan constants', () => {
  test('WELDSCAN_PDF_PRICE_USD is 2.99', () => {
    expect(WELDSCAN_PDF_PRICE_USD).toBe(2.99);
  });

  test('WELDSCAN_DXF_PRICE_USD is 9.99', () => {
    expect(WELDSCAN_DXF_PRICE_USD).toBe(9.99);
  });
});

// --------------------------------------------------------------------------
// GET /api/weldscan/export/pdf/download
// --------------------------------------------------------------------------
describe('GET /api/weldscan/export/pdf/download', () => {
  test('returns 200 with PDF content-type for analyzed session', async () => {
    const token = await registerAndLogin(welder);
    const sessionId = await createSession(token);
    await analyzeSession(token, sessionId);

    const res = await request(app)
      .get(`/api/weldscan/export/pdf/download?sessionId=${sessionId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    // Body should start with %PDF (our mock emits that prefix)
    expect(res.body.toString()).toContain('%PDF');
  });

  test('returns 400 when session is not yet analyzed', async () => {
    const token = await registerAndLogin(welder);
    const sessionId = await createSession(token);

    const res = await request(app)
      .get(`/api/weldscan/export/pdf/download?sessionId=${sessionId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  test('returns 404 for non-existent session', async () => {
    const token = await registerAndLogin(welder);
    const res = await request(app)
      .get('/api/weldscan/export/pdf/download?sessionId=ghost-session')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  test('returns 403 for another user\'s session', async () => {
    const token1 = await registerAndLogin(welder);
    const token2 = await registerAndLogin({
      name: 'Thief', email: 'thief@hack.com', password: 'x', role: 'freelancer',
    });
    const sessionId = await createSession(token1);
    await analyzeSession(token1, sessionId);

    const res = await request(app)
      .get(`/api/weldscan/export/pdf/download?sessionId=${sessionId}`)
      .set('Authorization', `Bearer ${token2}`);

    expect(res.status).toBe(403);
  });

  test('returns 400 for missing sessionId param', async () => {
    const token = await registerAndLogin(welder);
    const res = await request(app)
      .get('/api/weldscan/export/pdf/download')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  test('returns 401 without auth', async () => {
    const res = await request(app)
      .get('/api/weldscan/export/pdf/download?sessionId=any');

    expect(res.status).toBe(401);
  });
});

// --------------------------------------------------------------------------
// GET /api/weldscan/export/dxf/download
// --------------------------------------------------------------------------
describe('GET /api/weldscan/export/dxf/download', () => {
  test('returns 200 with DXF content and correct content-type', async () => {
    const token = await registerAndLogin(welder);
    const sessionId = await createSession(token);
    await analyzeSession(token, sessionId);

    const res = await request(app)
      .get(`/api/weldscan/export/dxf/download?sessionId=${sessionId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/dxf/);
    // DXF must start with the SECTION header and end with EOF marker
    const body = res.text;
    expect(body).toContain('SECTION');
    expect(body).toContain('ENTITIES');
    expect(body).toContain('EOF');
  });

  test('returns 400 when session is not analyzed', async () => {
    const token = await registerAndLogin(welder);
    const sessionId = await createSession(token);

    const res = await request(app)
      .get(`/api/weldscan/export/dxf/download?sessionId=${sessionId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  test('returns 404 for non-existent session', async () => {
    const token = await registerAndLogin(welder);
    const res = await request(app)
      .get('/api/weldscan/export/dxf/download?sessionId=ghost-session')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  test('returns 403 for another user\'s session', async () => {
    const token1 = await registerAndLogin(welder);
    const token2 = await registerAndLogin({
      name: 'Intruder', email: 'intruder@dxf.com', password: 'y', role: 'freelancer',
    });
    const sessionId = await createSession(token1);
    await analyzeSession(token1, sessionId);

    const res = await request(app)
      .get(`/api/weldscan/export/dxf/download?sessionId=${sessionId}`)
      .set('Authorization', `Bearer ${token2}`);

    expect(res.status).toBe(403);
  });

  test('returns 401 without auth', async () => {
    const res = await request(app)
      .get('/api/weldscan/export/dxf/download?sessionId=any');

    expect(res.status).toBe(401);
  });
});
