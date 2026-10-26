'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { SectionHeader, fmtDate } from '@/components/dashboard/DashboardUI';
import { roleNamesOf } from '@/lib/portalNav';
import { accountsApi } from '@/lib/api';
import { formatGhanaCardInput, GHANA_CARD_HINT, GHANA_CARD_PLACEHOLDER } from '@/lib/ghanaCard';

const STATUS_TEXT = {
  NOT_CREATED: 'Not created',
  IN_PROGRESS: 'In progress',
  PENDING_REVIEW: 'Pending review',
  VERIFIED: 'Verified',
  ACTIVE: 'Active',
};

const ROLE_LABEL = {
  COMPANY_ADMIN: 'Company Admin',
  FLEET_MANAGER: 'Fleet Manager',
  COMPANY_MEMBER: 'Company Member',
  SERVICE_PROVIDER: 'Service Provider',
  DRIVER: 'Driver',
  OWNER: 'Owner',
};

const KIND_INFO = {
  DRIVER: {
    title: 'Driver Account',
    tagline: 'DRIVE AND EARN',
    explain: 'Drive vehicles for owners and companies. Get matched to Work & Pay, DriveOn and rental trips, track your earnings and build your driving record.',
    needsText: 'Two phases. Phase 1: Ghana Card number, front and back of the card, and a live camera face check you must pass. Phase 2: your Driver\u2019s Licence number with front and back of the licence. Our team compares everything before verifying you.',
    accessText: 'Open to every user. You can hold this together with Owner and Service Provider accounts.',
  },
  OWNER: {
    title: 'Owner Account',
    tagline: 'RENT OUT YOUR VEHICLE',
    explain: 'Put your vehicle to work. List it for Work & Pay, DriveOn or rental, follow payments, and place it with a company to manage for you when you join one.',
    needsText: 'Your National ID number (Ghana Card, format GHA-000000000-0), photos of the front and back of the card, and a live camera face check. Our team compares everything before verifying you.',
    accessText: 'Open to every user. You can hold this together with Driver and Service Provider accounts.',
  },
  SERVICE_PROVIDER: {
    title: 'Service Provider Account',
    tagline: 'GET SERVICE WORK',
    explain: 'Offer services to drivers, owners and companies — mechanics, tyre shops, towing, washing and more. Get discovered and receive work near you.',
    needsText: 'Business name, service type and city. Active immediately — no ID verification needed.',
    accessText: 'Open to every user. You can hold this together with Driver and Owner accounts.',
  },
  COMPANY: {
    title: 'Company Account',
    tagline: 'RUN A FLEET BUSINESS',
    explain: 'Run a transport or fleet company: manage vehicles and people in one place, invite drivers, owners and service providers, and assign them company roles.',
    needsText: 'Company name and type. You become the Company Admin.',
    accessText: 'Only for users without a Driver, Owner or Service Provider account.',
  },
};

const KINDS = ['DRIVER', 'OWNER', 'SERVICE_PROVIDER', 'COMPANY'];

// Shared My Account hub. In the plain user portal currentKind is null; in
// the Driver/Owner portals it names the account the user is operating as,
// which is highlighted as their current account.
export default function AccountsHub({ currentKind = null }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [ghanaCard, setGhanaCard] = useState({ driver: '', owner: '' });
  const [licence, setLicence] = useState({ licenseNumber: '', licenseClass: '', licenseExpiryDate: '' });
  const [sp, setSp] = useState({ businessName: '', serviceType: '', phone: '', city: '' });
  const [company, setCompany] = useState({ name: '', type: 'TRANSPORT', phone: '', city: '' });
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState('');
  const [stage, setStage] = useState('select'); // select | form | liveness
  const [idFiles, setIdFiles] = useState({ front: null, back: null });
  const [selfie, setSelfie] = useState(null);
  const [selfieUrl, setSelfieUrl] = useState('');
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  // Driver two-phase verification
  const [licenceFiles, setLicenceFiles] = useState({ front: null, back: null });
  const [livenessPassed, setLivenessPassed] = useState(false);
  const [liveAction, setLiveAction] = useState(0);
  const [liveStatus, setLiveStatus] = useState('');
  const [liveReady, setLiveReady] = useState(false);
  const landmarkerRef = useRef(null);
  const liveStateRef = useRef({ action: 0, hold: 0, blinkArmed: true, baseline: null, done: false, lastVideoTime: -1 });

  const isCompanyUser = roleNamesOf(user).has('COMPANY_ADMIN') || roleNamesOf(user).has('COMPANY_MEMBER') || roleNamesOf(user).has('FLEET_MANAGER');
  const pageTitle = isCompanyUser ? 'Accounts' : 'My Account';

  const load = useCallback(async () => {
    try {
      const res = await accountsApi.me();
      setData(res.data?.data || res.data);
    } catch { setError('Could not load your accounts.'); }
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraOn(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const startCamera = async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      setCameraOn(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch {
      setCameraError('Camera access was blocked. Allow camera access in your browser, then try again — the face check cannot be skipped.');
    }
  };

  const LIVE_ACTIONS = [
    { key: 'straight', label: 'Look straight at the camera' },
    { key: 'left', label: 'Turn your head to your LEFT' },
    { key: 'right', label: 'Turn your head to your RIGHT' },
    { key: 'blink', label: 'Blink your eyes' },
    { key: 'smile', label: 'Smile' },
  ];

  // Real liveness detection in the browser with Google's free MediaPipe
  // Face Landmarker: the actions must actually be performed — a held-up
  // photo cannot turn its head, blink and smile on cue.
  const startAutomaticLiveness = async () => {
    setLiveStatus('Starting camera…');
    setLiveReady(false);
    setLivenessPassed(false);
    setLiveAction(0);
    liveStateRef.current = { action: 0, hold: 0, blinkArmed: true, baseline: null, done: false, lastVideoTime: -1 };
    await startCamera();
    try {
      if (!landmarkerRef.current) {
        const vision = await import(/* webpackIgnore: true */ 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs');
        const fileset = await vision.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
        landmarkerRef.current = await vision.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numFaces: 2,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
        });
      }
      setLiveReady(true);
      setLiveStatus('Camera ready. Follow the action below.');
    } catch {
      setLiveStatus('Live detection could not start on this device or browser (it needs internet for the free face model). You can capture a photo and submit for manual review instead.');
    }
  };

  useEffect(() => {
    if (stage !== 'liveness' || (selected !== 'DRIVER' && selected !== 'OWNER') || !liveReady || !cameraOn) return undefined;
    let raf = 0;
    const loop = () => {
      const video = videoRef.current;
      const lm = landmarkerRef.current;
      const st = liveStateRef.current;
      if (video && lm && !st.done && video.readyState >= 2 && video.currentTime !== st.lastVideoTime) {
        st.lastVideoTime = video.currentTime;
        try {
          const res = lm.detectForVideo(video, performance.now());
          const shapes = {};
          (res?.faceBlendshapes?.[0]?.categories || []).forEach((c) => { shapes[c.categoryName] = c.score; });
          const matrix = res?.facialTransformationMatrixes?.[0]?.data;
          const faceCount = res?.faceLandmarks?.length || 0;
          const hasFace = faceCount === 1;
          if (faceCount > 1) setLiveStatus('More than one face is in the camera — only you should be in the frame.');
          let yaw = null;
          if (matrix && matrix.length >= 16) yaw = Math.atan2(-matrix[8], matrix[10]);
          const action = LIVE_ACTIONS[st.action]?.key;
          let pass = false;
          if (hasFace && action === 'straight') {
            if (st.baseline === null && yaw !== null) st.baseline = yaw;
            if (yaw !== null && st.baseline !== null && Math.abs(yaw - st.baseline) < 0.09) { st.hold += 1; pass = st.hold >= 12; } else st.hold = 0;
          } else if (hasFace && action === 'left') {
            // Either yaw direction counts for the first turn (camera mirroring
            // flips the sign); the second turn must go the opposite way.
            if (yaw !== null && st.baseline !== null && Math.abs(yaw - st.baseline) > 0.22) {
              st.hold += 1;
              if (st.hold >= 6) { pass = true; st.turnDir = Math.sign(yaw - st.baseline); }
            } else st.hold = 0;
          } else if (hasFace && action === 'right') {
            if (yaw !== null && st.baseline !== null && st.turnDir && Math.sign(yaw - st.baseline) === -st.turnDir && Math.abs(yaw - st.baseline) > 0.22) { st.hold += 1; pass = st.hold >= 6; } else st.hold = 0;
          } else if (hasFace && action === 'blink') {
            const blink = ((shapes.eyeBlinkLeft || 0) + (shapes.eyeBlinkRight || 0)) / 2;
            if (blink < 0.25) st.blinkArmed = true;
            if (st.blinkArmed && blink > 0.55) { pass = true; st.blinkArmed = false; }
          } else if (hasFace && action === 'smile') {
            const smile = ((shapes.mouthSmileLeft || 0) + (shapes.mouthSmileRight || 0)) / 2;
            if (smile > 0.45) { st.hold += 1; pass = st.hold >= 8; } else st.hold = 0;
          }
          if (!hasFace) setLiveStatus('No face seen — move into the light and face the camera.');
          else if (!pass) setLiveStatus(`Action ${st.action + 1} of ${LIVE_ACTIONS.length}: ${LIVE_ACTIONS[st.action].label}`);
          if (pass) {
            st.action += 1;
            st.hold = 0;
            setLiveAction(st.action);
            if (st.action >= LIVE_ACTIONS.length) {
              st.done = true;
              setLiveStatus('Live check passed. Capturing your photo…');
              setLivenessPassed(true);
              captureSelfie();
            } else {
              setLiveStatus(`Good. Next: ${LIVE_ACTIONS[st.action].label}`);
            }
          }
        } catch { /* frame skipped */ }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, selected, liveReady, cameraOn]);

  const captureSelfie = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) { setCameraError('Camera is not ready yet. Wait a moment and capture again.'); return; }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) { setCameraError('Could not capture your photo. Try again.'); return; }
      const file = new File([blob], 'liveness-selfie.jpg', { type: 'image/jpeg' });
      setSelfie(file);
      setSelfieUrl(URL.createObjectURL(blob));
      stopCamera();
    }, 'image/jpeg', 0.92);
  };

  const run = async (key, fn, okText) => {
    setBusy(key); setError(''); setMessage('');
    try {
      const res = await fn();
      setData(res.data?.data || res.data);
      if (okText) setMessage(okText);
      return res.data?.data || res.data;
    } catch (err) {
      const msg = err.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' ') : msg || 'Something went wrong. Please try again.');
      return null;
    } finally { setBusy(''); }
  };

  const accounts = Object.fromEntries((data?.accounts || []).map((a) => [a.kind, a]));
  const driver = accounts.DRIVER;
  const owner = accounts.OWNER;
  const serviceProvider = accounts.SERVICE_PROVIDER;
  const companyAccount = accounts.COMPANY;

  const eligible = data ? [
    driver?.status === 'NOT_CREATED' && 'DRIVER',
    owner?.status === 'NOT_CREATED' && 'OWNER',
    serviceProvider?.status === 'NOT_CREATED' && 'SERVICE_PROVIDER',
    companyAccount?.status === 'NOT_CREATED' && companyAccount?.canCreate && 'COMPANY',
  ].filter(Boolean) : [];

  const continuable = data ? [
    driver?.status !== 'NOT_CREATED' && driver?.needs?.length && 'DRIVER',
    owner?.status !== 'NOT_CREATED' && owner?.needs?.length && 'OWNER',
  ].filter(Boolean) : [];

  // Each account type appears once: either it can be added, or (when it
  // already exists but still needs details) it can be continued — never both.
  const options = [...new Set([...eligible, ...continuable])];

  const openAdd = () => {
    setSelected('');
    setStage('select');
    setError('');
    setShowCreate(true);
    requestAnimationFrame(() => document.getElementById('add-account')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const pick = (kind) => {
    setSelected(kind);
    // A driver who already finished Phase 1 goes straight to Phase 2 —
    // unless either document was sent back, which reopens its own phase.
    const acct = accounts[kind];
    const driverStage = acct?.identityVerification?.status === 'REJECTED'
      ? 'form'
      : acct?.licenceVerification?.status === 'REJECTED'
        ? 'licence'
        : acct?.identityVerification && !acct?.licenceVerification ? 'licence' : 'form';
    setStage(kind === 'DRIVER' ? driverStage : 'form');
    setIdFiles({ front: null, back: null });
    setLicenceFiles({ front: null, back: null });
    setSelfie(null);
    setSelfieUrl('');
    setLivenessPassed(false);
    setError('');
  };

  const selectedAccount = selected ? accounts[selected] : null;
  const isCreate = selectedAccount?.status === 'NOT_CREATED';

  const GHANA_RE = /^GHA-\d{9}-\d$/;
  const startLiveness = () => {
    setSelfie(null);
    setSelfieUrl('');
    setStage('liveness');
    startAutomaticLiveness();
  };

  const submitDriverPhase1 = async () => {
    if (!selfie) { setError('Complete the live camera check first.'); return null; }
    return run('identity', () => accountsApi.submitIdentityVerification('DRIVER', {
      ghanaCardNumber: ghanaCard.driver,
      idFront: idFiles.front,
      idBack: idFiles.back,
      selfie,
      livenessChallenge: LIVE_ACTIONS.map((a) => a.label).join(' → '),
      livenessPassed,
    }));
  };

  const submitForm = async () => {
    let result = null;
    if (selected === 'DRIVER') {
      if (stage === 'form') {
        // Phase 1: Ghana Card number + front/back, then the live face check.
        if (!GHANA_RE.test(ghanaCard.driver.trim())) { setError('Enter your National ID in the Ghana Card format GHA-000000000-0.'); return; }
        if (!idFiles.front || !idFiles.back) { setError('Upload the front and back of your Ghana Card.'); return; }
        startLiveness();
        return;
      }
      if (stage === 'liveness') {
        result = await submitDriverPhase1();
        if (!result) return;
        setMessage(livenessPassed
          ? 'Phase 1 passed: live face check complete. Now Phase 2 — your Driver\u2019s Licence. Our team still reviews everything before you are verified.'
          : 'Phase 1 submitted for manual review (live check not passed on this device). Now Phase 2 — your Driver\u2019s Licence.');
        setStage('licence');
        return;
      }
      // Phase 2: licence — only reachable after Phase 1 was submitted.
      if (!licence.licenseNumber.trim()) { setError("Enter your Driver's Licence number."); return; }
      if (!licenceFiles.front || !licenceFiles.back) { setError("Upload the front and back of your Driver's Licence."); return; }
      result = await run('licence-verification', () => accountsApi.submitLicenceVerification({
        licenseNumber: licence.licenseNumber,
        licenseClass: licence.licenseClass,
        licenseExpiryDate: licence.licenseExpiryDate,
        licenceFront: licenceFiles.front,
        licenceBack: licenceFiles.back,
      }));
      if (!result) return;
      setMessage('Driver account submitted. Phase 1 (Ghana Card + face) and Phase 2 (licence) are with our team for review — nothing is approved automatically.');
    }
    if (selected === 'OWNER') {
      const cardValue = ghanaCard.owner;
      const needsIdentity = isCreate || !selectedAccount?.identityVerification;
      if (needsIdentity) {
        if (!GHANA_RE.test(cardValue.trim())) { setError('Enter your National ID in the Ghana Card format GHA-000000000-0.'); return; }
        if (!idFiles.front || !idFiles.back) { setError('Upload the front and back of your Ghana Card.'); return; }
        if (stage === 'form') { startLiveness(); return; }
        if (!selfie) { setError('Complete the live camera check: follow the actions, then capture your photo.'); return; }
        result = await run('identity', () => accountsApi.submitIdentityVerification('OWNER', {
          ghanaCardNumber: cardValue,
          idFront: idFiles.front,
          idBack: idFiles.back,
          selfie,
          livenessChallenge: LIVE_ACTIONS.map((a) => a.label).join(' → '),
          livenessPassed,
        }));
        if (!result) return;
      }
      setMessage(livenessPassed
        ? 'Owner identity submitted — live face check passed. Our team will still compare your face to your Ghana Card before verifying you — nothing is approved automatically.'
        : 'Owner identity submitted for manual review (live check not passed on this device). Our team will compare your face to your Ghana Card before verifying you — nothing is approved automatically.');
    }
    if (selected === 'SERVICE_PROVIDER') {
      result = await run('add-sp', () => accountsApi.createServiceProvider(sp), 'Service Provider account created and active.');
      if (!result) return;
    }
    if (selected === 'COMPANY') {
      result = await run('add-company', () => accountsApi.createCompany(company), 'Company created. You are its Company Admin — invite people from the company Team page.');
      if (!result) return;
    }
    stopCamera();
    setShowCreate(false);
    setStage('select');
    setSelected('');
  };

  const accessFor = (kind) => {
    if (kind !== 'COMPANY') return KIND_INFO[kind].accessText;
    if (companyAccount?.status === 'ACTIVE') return 'You are a Company Admin. Manage your company from the Company dashboard.';
    if (companyAccount?.canCreate) return 'Available to you now — you have no Driver, Owner or Service Provider account yet.';
    return companyAccount?.lockedReason || KIND_INFO.COMPANY.accessText;
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <h2 className="text-[26px] font-bold leading-tight text-emerald-950 dark:text-white">My Accounts Hub</h2>
          <p className="mt-1.5 text-[15px] leading-relaxed text-steel dark:text-neutral-400">
            All your accounts in one place — drive, rent out your vehicle, provide services, or run a company with +Motive.
          </p>
          {currentKind && (
            <p className="mt-2 text-sm font-medium text-emerald-900 dark:text-emerald-300">
              You are currently using your {KIND_INFO[currentKind]?.title}. It is marked below — you can also add or manage your other accounts here.
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-3">
          <a href="#your-accounts" className="inline-flex min-h-[44px] items-center rounded-full bg-neutral-200/80 px-5 py-2.5 text-sm font-semibold text-emerald-950 transition hover:bg-neutral-300/80 dark:bg-dark-border dark:text-white">Manage Accounts</a>
          <button type="button" onClick={openAdd} className="inline-flex min-h-[44px] items-center rounded-full bg-emerald-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800">+ Add Account</button>
        </div>
      </div>

      {message && <div className="mb-4 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm font-medium text-green-700 dark:text-green-400">{message}</div>}
      {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div>}

      {!data ? (
        <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="skeleton h-36" />)}</div>
      ) : (
        <div id="your-accounts" className="grid gap-5 md:grid-cols-2">
          {KINDS.map((kind) => {
            const a = accounts[kind];
            const info = KIND_INFO[kind];
            return (
              <section key={kind} className={`flex flex-col rounded-[20px] bg-[#f3f7f0] p-6 dark:bg-dark-card ${kind === currentKind ? 'ring-2 ring-emerald-700 dark:ring-emerald-400' : ''}`}>
                <h3 className="text-lg font-semibold text-emerald-900 dark:text-white">{info.title}</h3>
                {kind === currentKind && <p className="mt-1"><span className="rounded-full bg-emerald-700 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">Current account</span></p>}
                <p className="mt-0.5 text-[11px] font-medium tracking-[0.14em] text-steel dark:text-neutral-400">{info.tagline}</p>
                <p className="mt-4 text-sm leading-relaxed text-steel dark:text-neutral-400">{info.explain}</p>
                <div className="mt-4 space-y-1.5 text-sm leading-relaxed">
                  <p className="text-steel dark:text-neutral-400"><strong className="text-emerald-950 dark:text-white">What you need:</strong> {info.needsText}</p>
                  <p className="text-steel dark:text-neutral-400"><strong className="text-emerald-950 dark:text-white">Access:</strong> {accessFor(kind)}</p>
                  <p className="text-steel dark:text-neutral-400"><strong className="text-emerald-950 dark:text-white">Status:</strong> {STATUS_TEXT[a?.status] || 'Not created'}</p>
                  {(kind === 'DRIVER' || kind === 'OWNER') && a?.identityVerification && (
                    <p className="text-steel dark:text-neutral-400"><strong className="text-emerald-950 dark:text-white">Identity check:</strong> {a.identityVerification.status === 'APPROVED' ? 'Approved' : a.identityVerification.status === 'REJECTED' ? 'Rejected — submit again' : `Submitted — waiting for our team to compare your face to your Ghana Card${a.identityVerification.livenessPassed ? ' (live check passed)' : ' (manual review)'}`}</p>
                  )}
                  {kind === 'DRIVER' && a?.licenceVerification && (
                    <p className="text-steel dark:text-neutral-400"><strong className="text-emerald-950 dark:text-white">Licence check:</strong> {a.licenceVerification.status === 'APPROVED' ? 'Approved' : a.licenceVerification.status === 'REJECTED' ? 'Resubmission requested — use Add Account to submit again' : 'Submitted — waiting for review'}</p>
                  )}
                  {a?.identityVerification?.status === 'REJECTED' && a.identityVerification.reviewNote && (
                    <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300"><strong>What to fix:</strong> {a.identityVerification.reviewNote}</p>
                  )}
                  {a?.licenceVerification?.status === 'REJECTED' && a.licenceVerification.reviewNote && (
                    <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300"><strong>Licence — what to fix:</strong> {a.licenceVerification.reviewNote}</p>
                  )}
                </div>
                {a?.status === 'VERIFIED' && kind === 'DRIVER' && <Link href="/driver/dashboard" className="mt-4 font-semibold text-emerald-800 hover:underline dark:text-emerald-300">Open Driver dashboard</Link>}
                {a?.status === 'VERIFIED' && kind === 'OWNER' && <Link href="/owner/dashboard" className="mt-4 font-semibold text-emerald-800 hover:underline dark:text-emerald-300">Open Owner dashboard</Link>}
                {a?.status === 'ACTIVE' && kind === 'COMPANY' && <Link href="/company/dashboard" className="mt-4 font-semibold text-emerald-800 hover:underline dark:text-emerald-300">Open Company dashboard</Link>}
                {a?.status === 'ACTIVE' && kind === 'SERVICE_PROVIDER' && <p className="mt-4 text-sm text-steel dark:text-neutral-400">{a.businessName} — {a.serviceType}{a.city ? `, ${a.city}` : ''}</p>}
              </section>
            );
          })}
        </div>
      )}

      {data?.memberships?.length > 0 && (
        <div className="mt-8">
          <SectionHeader title="Companies you belong to" description="Companies you created or joined by accepting an invitation. Your personal accounts above stay yours." />
          <div className="space-y-3">
            {data.memberships.map((m) => (
              <div key={m.membershipId} className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] bg-[#f3f7f0] p-4 dark:bg-dark-card">
                <div>
                  <p className="text-sm font-semibold text-emerald-950 dark:text-white">{m.companyName}</p>
                  <p className="text-xs text-steel dark:text-neutral-400">{ROLE_LABEL[m.role] || m.role}{m.title ? ` — ${m.title}` : ''} · Joined {fmtDate(m.joinedAt)}</p>
                </div>
                <Link href="/company/dashboard" className="font-semibold text-emerald-800 hover:underline dark:text-emerald-300">Open company</Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {showCreate && (
      <section id="add-account" className="mt-8 rounded-[20px] border border-emerald-900/15 bg-white p-6 shadow-card dark:border-dark-border dark:bg-dark-card dark:shadow-none">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-emerald-950 dark:text-white">{stage === 'select' ? 'Add Account' : KIND_INFO[selected]?.title}</h3>
            {stage !== 'select' && <p className="mt-0.5 max-w-xl text-sm text-steel dark:text-neutral-400">Complete every step — our team reviews your identity before this account is verified. +Motive helps people find each other; it does not guarantee anyone&rsquo;s identity. Never hand over a vehicle, keys or money until you have met in person, checked the person&rsquo;s ID yourself, and signed the final contract face to face.</p>}
          </div>
          <button type="button" onClick={() => { stopCamera(); setShowCreate(false); setStage('select'); setSelected(''); }} className="text-sm font-semibold text-steel hover:text-emerald-800 dark:text-neutral-400">Close</button>
        </div>
        <div className="mt-5">
        {stage === 'select' ? (
          options.length === 0 ? (
            <p className="text-sm text-steel dark:text-neutral-400">You already have every account you can add. Your accounts are on this page.</p>
          ) : (
            <div className="space-y-2">
              {options.map((kind) => (
                <button key={kind} type="button" onClick={() => pick(kind)} className="flex w-full items-center justify-between rounded-xl border border-line px-4 py-3.5 text-left transition hover:border-emerald-400 dark:border-dark-border">
                  <span className="text-sm font-semibold text-emerald-950 dark:text-white">{KIND_INFO[kind].title}</span>
                  <span aria-hidden="true" className="text-emerald-700 dark:text-emerald-300">→</span>
                </button>
              ))}
            </div>
          )
        ) : (
          <div className="space-y-3">
            <button type="button" onClick={() => { stopCamera(); setStage('select'); }} className="text-sm font-semibold text-emerald-800 hover:underline dark:text-emerald-300">← Back</button>

            {selected === 'DRIVER' && stage === 'form' && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-emerald-950 dark:text-white">Phase 1 of 2 — Ghana Card & live face check</p>
                <p className="text-sm text-steel dark:text-neutral-400">Enter your Ghana Card number and upload the front and back of the card. Next, your camera opens for a live face check — you must pass it to continue to your licence.</p>
                {(isCreate || driver.needs?.includes('nationalId') || !driver.identityVerification) && (
                  <>
                    <div><label htmlFor="d-ghana" className="label">National ID (Ghana Card) number</label><input id="d-ghana" className="input" placeholder={GHANA_CARD_PLACEHOLDER} maxLength={15} value={ghanaCard.driver} onChange={(e) => setGhanaCard({ ...ghanaCard, driver: formatGhanaCardInput(e.target.value) })} /><p className="mt-1 text-xs text-steel dark:text-neutral-500">{GHANA_CARD_HINT}</p></div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div><label htmlFor="d-front" className="label">Ghana Card — front photo</label><input id="d-front" type="file" accept="image/jpeg,image/png,image/webp" className="input" onChange={(e) => setIdFiles((p) => ({ ...p, front: e.target.files?.[0] || null }))} />{idFiles.front && <p className="mt-1 text-xs text-steel">{idFiles.front.name}</p>}</div>
                      <div><label htmlFor="d-back" className="label">Ghana Card — back photo</label><input id="d-back" type="file" accept="image/jpeg,image/png,image/webp" className="input" onChange={(e) => setIdFiles((p) => ({ ...p, back: e.target.files?.[0] || null }))} />{idFiles.back && <p className="mt-1 text-xs text-steel">{idFiles.back.name}</p>}</div>
                    </div>
                  </>
                )}
                {!isCreate && driver.status === 'PENDING_REVIEW' && !driver.needs?.length && <p className="text-sm text-steel dark:text-neutral-400">All details submitted — waiting for verification by our team.</p>}
              </div>
            )}

            {selected === 'DRIVER' && stage === 'licence' && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-emerald-950 dark:text-white">Phase 2 of 2 — Driver&rsquo;s Licence</p>
                <p className="text-sm text-steel dark:text-neutral-400">Phase 1 is submitted. Now add your licence — our team will check it against your Ghana Card identity.</p>
                <div><label htmlFor="d-lic" className="label">Driver&apos;s licence number</label><input id="d-lic" className="input" value={licence.licenseNumber} onChange={(e) => setLicence({ ...licence, licenseNumber: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label htmlFor="d-class" className="label">Licence class</label><input id="d-class" className="input" placeholder="e.g. B" value={licence.licenseClass} onChange={(e) => setLicence({ ...licence, licenseClass: e.target.value })} /></div>
                  <div><label htmlFor="d-exp" className="label">Licence expiry</label><input id="d-exp" className="input" type="date" value={licence.licenseExpiryDate} onChange={(e) => setLicence({ ...licence, licenseExpiryDate: e.target.value })} /></div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div><label htmlFor="l-front" className="label">Licence — front photo</label><input id="l-front" type="file" accept="image/jpeg,image/png,image/webp" className="input" onChange={(e) => setLicenceFiles((p) => ({ ...p, front: e.target.files?.[0] || null }))} />{licenceFiles.front && <p className="mt-1 text-xs text-steel">{licenceFiles.front.name}</p>}</div>
                  <div><label htmlFor="l-back" className="label">Licence — back photo</label><input id="l-back" type="file" accept="image/jpeg,image/png,image/webp" className="input" onChange={(e) => setLicenceFiles((p) => ({ ...p, back: e.target.files?.[0] || null }))} />{licenceFiles.back && <p className="mt-1 text-xs text-steel">{licenceFiles.back.name}</p>}</div>
                </div>
              </div>
            )}

            {selected === 'OWNER' && stage !== 'liveness' && (
              <div className="space-y-2">
                <div><label htmlFor="o-ghana" className="label">National ID (Ghana Card) number</label><input id="o-ghana" className="input" placeholder={GHANA_CARD_PLACEHOLDER} maxLength={15} value={ghanaCard.owner} onChange={(e) => setGhanaCard({ ...ghanaCard, owner: formatGhanaCardInput(e.target.value) })} /><p className="mt-1 text-xs text-steel dark:text-neutral-500">{GHANA_CARD_HINT}</p></div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div><label htmlFor="o-front" className="label">Ghana Card — front photo</label><input id="o-front" type="file" accept="image/jpeg,image/png,image/webp" className="input" onChange={(e) => setIdFiles((p) => ({ ...p, front: e.target.files?.[0] || null }))} />{idFiles.front && <p className="mt-1 text-xs text-steel">{idFiles.front.name}</p>}</div>
                  <div><label htmlFor="o-back" className="label">Ghana Card — back photo</label><input id="o-back" type="file" accept="image/jpeg,image/png,image/webp" className="input" onChange={(e) => setIdFiles((p) => ({ ...p, back: e.target.files?.[0] || null }))} />{idFiles.back && <p className="mt-1 text-xs text-steel">{idFiles.back.name}</p>}</div>
                </div>
              </div>
            )}

            {stage === 'liveness' && (selected === 'DRIVER' || selected === 'OWNER') && (
              <div className="space-y-3 rounded-xl border border-emerald-900/15 bg-[#f3f7f0] p-4 dark:bg-dark-card">
                <h4 className="text-sm font-semibold text-emerald-950 dark:text-white">Live face check{selected === 'DRIVER' ? ' — Phase 1' : ''}</h4>
                <p className="text-sm text-steel dark:text-neutral-400">Follow these actions in front of your camera, then capture your photo. Our team compares it with your Ghana Card — this step cannot be skipped or replaced with an uploaded photo.</p>
                <>
                  <ol className="list-decimal space-y-1 pl-5 text-sm font-medium text-emerald-950 dark:text-white">
                    {LIVE_ACTIONS.map((a, i) => (
                      <li key={a.key} className={i < liveAction ? 'text-green-700 dark:text-green-400' : i === liveAction ? '' : 'opacity-50'}>
                        {a.label}{i < liveAction ? ' ✓' : ''}
                      </li>
                    ))}
                  </ol>
                  <p aria-live="polite" className="rounded-lg bg-emerald-900/5 px-3 py-2 text-sm font-semibold text-emerald-900 dark:text-emerald-200">{liveStatus || 'Starting…'}</p>
                  {livenessPassed && <p className="text-sm font-semibold text-green-700 dark:text-green-400">Live check passed — now submit{selected === 'DRIVER' ? ' to finish Phase 1' : ''}.</p>}
                  <p className="text-xs leading-relaxed text-steel dark:text-neutral-500">
                    What this checks: exactly one real face in frame, head actually turning both ways, a real blink and a smile, held long enough to measure. A printed photo or a still image on a screen cannot turn, blink and smile on cue, so it fails. Follow the big arrow on the camera.
                  </p>
                </>
                {cameraError && <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-300">{cameraError}</p>}
                {!selfie ? (
                  <>
                    <div className="relative w-full max-w-md">
                      <video ref={videoRef} playsInline muted className="aspect-[4/3] w-full -scale-x-100 rounded-xl bg-black object-cover" />
                      {liveReady && cameraOn && !livenessPassed && (() => {
                        const action = LIVE_ACTIONS[liveAction]?.key;
                        const guide = {
                          straight: { symbol: '◎', cls: 'guide-arrow-up', text: 'Look straight' },
                          left: { symbol: '←', cls: 'guide-arrow-left', text: 'Turn your head this way' },
                          right: { symbol: '→', cls: 'guide-arrow-right', text: 'Turn your head this way' },
                          blink: { symbol: '◉', cls: 'guide-arrow-up', text: 'Blink now' },
                          smile: { symbol: '☺', cls: 'guide-arrow-up', text: 'Smile now' },
                        }[action] || { symbol: '', cls: '', text: '' };
                        return (
                          <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                            <span className={`text-[92px] font-bold leading-none text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.85)] ${guide.cls}`}>{guide.symbol}</span>
                            <span className="mt-1 rounded-full bg-black/65 px-4 py-1.5 text-sm font-semibold text-white">{guide.text}</span>
                          </div>
                        );
                      })()}
                      {liveReady && cameraOn && (
                        <span className="absolute left-3 top-3 rounded-full bg-black/65 px-3 py-1 text-xs font-semibold text-white">
                          Step {Math.min(liveAction + 1, LIVE_ACTIONS.length)} of {LIVE_ACTIONS.length}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!cameraOn ? (
                        <button type="button" onClick={startAutomaticLiveness} className="btn-primary">Turn camera on</button>
                      ) : liveReady ? (
                        <span className="text-sm text-steel dark:text-neutral-400">Perform the actions above — your photo is captured automatically when you pass.</span>
                      ) : (
                        <button type="button" onClick={captureSelfie} className="btn-primary">Capture photo for manual review</button>
                      )}
                      <button type="button" onClick={() => { stopCamera(); setStage('form'); }} className="btn-graphite">Back to ID details</button>
                    </div>
                  </>
                ) : (
                  <>
                    <img src={selfieUrl} alt="Your captured face check" className="aspect-[4/3] w-full max-w-md rounded-xl object-cover" />
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => { setSelfie(null); setSelfieUrl(''); startAutomaticLiveness(); }} className="btn-graphite">Retake photo</button>
                    </div>
                    <p className="text-sm text-steel dark:text-neutral-400">Happy with this photo? Submit below — your ID and face check go to our team for review.</p>
                  </>
                )}
              </div>
            )}

            {selected === 'SERVICE_PROVIDER' && (
              <div className="space-y-2">
                <div><label htmlFor="sp-name" className="label">Business name</label><input id="sp-name" className="input" value={sp.businessName} onChange={(e) => setSp({ ...sp, businessName: e.target.value })} /></div>
                <div><label htmlFor="sp-type" className="label">Service type</label><input id="sp-type" className="input" placeholder="e.g. Mechanic, Tyre shop, Towing" value={sp.serviceType} onChange={(e) => setSp({ ...sp, serviceType: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label htmlFor="sp-phone" className="label">Phone</label><input id="sp-phone" className="input" value={sp.phone} onChange={(e) => setSp({ ...sp, phone: e.target.value })} /></div>
                  <div><label htmlFor="sp-city" className="label">City</label><input id="sp-city" className="input" value={sp.city} onChange={(e) => setSp({ ...sp, city: e.target.value })} /></div>
                </div>
              </div>
            )}

            {selected === 'COMPANY' && (
              <div className="space-y-2">
                <div><label htmlFor="c-name" className="label">Company name</label><input id="c-name" className="input" value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label htmlFor="c-type" className="label">Company type</label>
                    <select id="c-type" className="input" value={company.type} onChange={(e) => setCompany({ ...company, type: e.target.value })}>
                      <option value="TRANSPORT">Transport</option>
                      <option value="FLEET_MANAGEMENT">Fleet management</option>
                      <option value="VEHICLE_PLACEMENT">Vehicle placement</option>
                      <option value="MAINTENANCE">Maintenance</option>
                      <option value="LEGAL_DISPUTE_RESOLUTION">Legal / dispute resolution</option>
                    </select>
                  </div>
                  <div><label htmlFor="c-city" className="label">City</label><input id="c-city" className="input" value={company.city} onChange={(e) => setCompany({ ...company, city: e.target.value })} /></div>
                </div>
                <div><label htmlFor="c-phone" className="label">Phone</label><input id="c-phone" className="input" value={company.phone} onChange={(e) => setCompany({ ...company, phone: e.target.value })} /></div>
              </div>
            )}

            <button type="button" disabled={!!busy} onClick={submitForm} className="btn-primary w-full">
              {busy ? 'Submitting…' : stage === 'licence' ? 'Submit licence for review' : stage === 'liveness' ? (livenessPassed ? (selected === 'DRIVER' ? 'Submit — finish Phase 1' : 'Submit for review') : 'Submit ID & face check for review') : selected === 'DRIVER' ? 'Continue to live face check' : selected === 'OWNER' ? 'Submit ID & verify your face' : isCreate ? `Add ${KIND_INFO[selected].title}` : 'Save details'}
            </button>
            {(selected === 'DRIVER' || selected === 'OWNER') && stage === 'form' && (
              <p className="text-xs text-steel dark:text-neutral-500">Next, your camera opens for a live face check. Nothing is verified until our team compares your face with your Ghana Card.</p>
            )}
          </div>
        )}
        </div>
      </section>
      )}
    </>
  );
}
