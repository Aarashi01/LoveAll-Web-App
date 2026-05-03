import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

const PROJECT_ID = 'loveall-rules-test';
const TID = 'tour1';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'tournaments', TID), {
      id: TID,
      organizerId: 'organizerUid',
      publicViewEnabled: false,
    });
  });
});

function authedDb(uid: string) {
  return env.authenticatedContext(uid).firestore();
}

const futureTs = (mins: number) =>
  Timestamp.fromMillis(Date.now() + mins * 60 * 1000);

describe('scorekeeperAccess rules', () => {
  it('blocks a volunteer from self-granting access (the bypass we are closing)', async () => {
    const db = authedDb('volunteerUid');
    await assertFails(
      setDoc(doc(db, 'tournaments', TID, 'scorekeeperAccess', 'volunteerUid'), {
        tournamentId: TID,
        approvedAt: serverTimestamp(),
        approvedBy: 'volunteerUid',
        expiresAt: futureTs(60),
        deviceLabel: 'sneaky',
      }),
    );
  });

  it('allows the organizer to grant access', async () => {
    const db = authedDb('organizerUid');
    await assertSucceeds(
      setDoc(doc(db, 'tournaments', TID, 'scorekeeperAccess', 'volunteerUid'), {
        tournamentId: TID,
        approvedAt: serverTimestamp(),
        approvedBy: 'organizerUid',
        expiresAt: futureTs(60),
        deviceLabel: 'Pixel',
      }),
    );
  });

  it('rejects expiresAt more than 24h out', async () => {
    const db = authedDb('organizerUid');
    await assertFails(
      setDoc(doc(db, 'tournaments', TID, 'scorekeeperAccess', 'volunteerUid'), {
        tournamentId: TID,
        approvedAt: serverTimestamp(),
        approvedBy: 'organizerUid',
        expiresAt: futureTs(60 * 25),
        deviceLabel: 'Pixel',
      }),
    );
  });

  it('allows the organizer to revoke', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'tournaments', TID, 'scorekeeperAccess', 'volunteerUid'),
        {
          tournamentId: TID,
          approvedAt: serverTimestamp(),
          approvedBy: 'organizerUid',
          expiresAt: futureTs(60),
          deviceLabel: 'Pixel',
        },
      );
    });
    const db = authedDb('organizerUid');
    await assertSucceeds(
      deleteDoc(doc(db, 'tournaments', TID, 'scorekeeperAccess', 'volunteerUid')),
    );
  });
});

describe('pairingRequests rules', () => {
  const NONCE = 'a'.repeat(64);

  it('allows volunteer to create their own request', async () => {
    const db = authedDb('volunteerUid');
    await assertSucceeds(
      setDoc(doc(db, 'tournaments', TID, 'pairingRequests', 'r1'), {
        scorekeeperUid: 'volunteerUid',
        nonce: NONCE,
        deviceLabel: 'iPhone',
        createdAt: serverTimestamp(),
        expiresAt: futureTs(5),
      }),
    );
  });

  it('blocks volunteer from creating a request for someone else', async () => {
    const db = authedDb('volunteerUid');
    await assertFails(
      setDoc(doc(db, 'tournaments', TID, 'pairingRequests', 'r2'), {
        scorekeeperUid: 'someoneElse',
        nonce: NONCE,
        deviceLabel: 'iPhone',
        createdAt: serverTimestamp(),
        expiresAt: futureTs(5),
      }),
    );
  });

  it('blocks an expiresAt > 10 minutes out', async () => {
    const db = authedDb('volunteerUid');
    await assertFails(
      setDoc(doc(db, 'tournaments', TID, 'pairingRequests', 'r3'), {
        scorekeeperUid: 'volunteerUid',
        nonce: NONCE,
        deviceLabel: 'iPhone',
        createdAt: serverTimestamp(),
        expiresAt: futureTs(20),
      }),
    );
  });
});

describe('matches rules — scorekeeper access gating', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'tournaments', TID, 'matches', 'm1'),
        { id: 'm1', status: 'scheduled', scores: [] },
      );
    });
  });

  it('blocks a non-scorekeeper from updating a match', async () => {
    const db = authedDb('randomUid');
    await assertFails(
      updateDoc(doc(db, 'tournaments', TID, 'matches', 'm1'), { status: 'live' }),
    );
  });

  it('blocks an EXPIRED scorekeeper from updating a match', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'tournaments', TID, 'scorekeeperAccess', 'volunteerUid'),
        {
          tournamentId: TID,
          approvedAt: serverTimestamp(),
          approvedBy: 'organizerUid',
          expiresAt: Timestamp.fromMillis(Date.now() - 60 * 1000),
          deviceLabel: 'old',
        },
      );
    });
    const db = authedDb('volunteerUid');
    await assertFails(
      updateDoc(doc(db, 'tournaments', TID, 'matches', 'm1'), { status: 'live' }),
    );
  });

  it('allows an active scorekeeper to update a match', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'tournaments', TID, 'scorekeeperAccess', 'volunteerUid'),
        {
          tournamentId: TID,
          approvedAt: serverTimestamp(),
          approvedBy: 'organizerUid',
          expiresAt: futureTs(60),
          deviceLabel: 'OK',
        },
      );
    });
    const db = authedDb('volunteerUid');
    await assertSucceeds(
      updateDoc(doc(db, 'tournaments', TID, 'matches', 'm1'), { status: 'live' }),
    );
  });

  it('blocks a scorekeeper from CREATING a match', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'tournaments', TID, 'scorekeeperAccess', 'volunteerUid'),
        {
          tournamentId: TID,
          approvedAt: serverTimestamp(),
          approvedBy: 'organizerUid',
          expiresAt: futureTs(60),
          deviceLabel: 'OK',
        },
      );
    });
    const db = authedDb('volunteerUid');
    await assertFails(
      setDoc(doc(db, 'tournaments', TID, 'matches', 'mNew'), { id: 'mNew' }),
    );
  });
});

describe('public viewer', () => {
  it('reads matches when publicViewEnabled is true', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'tournaments', TID), {
        id: TID,
        organizerId: 'organizerUid',
        publicViewEnabled: true,
      });
      await setDoc(doc(ctx.firestore(), 'tournaments', TID, 'matches', 'mPub'), {
        id: 'mPub',
      });
    });
    const db = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, 'tournaments', TID, 'matches', 'mPub')));
  });

  it('denies match read when publicViewEnabled is false', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'tournaments', TID, 'matches', 'm1')));
  });
});
