import { useServerFn } from "@tanstack/react-start";
import { Camera, CameraOff, CheckCircle2, ImageUp, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { CHECK_IN_MESSAGES } from "@/lib/check-in";
import { checkInWithPass, getCheckInAccess, type CheckInResult } from "@/lib/check-in.functions";

async function decodeImageData(img: ImageData) {
  const { default: jsQR } = await import("jsqr");
  return jsQR(img.data, img.width, img.height)?.data ?? null;
}

async function decodeFile(file: File) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return decodeImageData(ctx.getImageData(0, 0, canvas.width, canvas.height));
}

export function CheckInResultMessage({ result }: { result: CheckInResult }) {
  if (result.ok) {
    return (
      <div role="status" className="flex gap-3 rounded-lg border border-primary/40 bg-primary/10 p-4">
        <CheckCircle2 className="h-6 w-6 shrink-0 text-primary" />
        <div>
          <p className="font-semibold">Checked in</p>
          <p className="text-sm text-muted-foreground">
            {result.patientName ?? "Patient"} · {result.appointmentDate} at {result.appointmentTime.slice(0, 5)} · {result.reference}
          </p>
        </div>
      </div>
    );
  }
  return (
    <div role="alert" className="flex gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
      <XCircle className="h-6 w-6 shrink-0 text-destructive" />
      <div>
        <p className="font-semibold">Check-in failed</p>
        <p className="text-sm text-muted-foreground">{CHECK_IN_MESSAGES[result.reason]}</p>
      </div>
    </div>
  );
}

function StaffSignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) setError(err.message);
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-muted-foreground">Sign in with your clinic staff account.</p>
      <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
      <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="submit" className="w-full">Sign in</Button>
    </form>
  );
}

export function ClinicCheckInScanner() {
  const [session, setSession] = useState<"loading" | "out" | "in">("loading");
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const busyRef = useRef(false);
  const checkIn = useServerFn(checkInWithPass);
  const access = useServerFn(getCheckInAccess);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session ? "in" : "out"));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s ? "in" : "out"));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session !== "in") return setAllowed(null);
    access().then((r) => setAllowed(r.allowed)).catch(() => setAllowed(false));
  }, [session, access]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  const submit = useCallback(
    async (qr: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      try {
        setResult(await checkIn({ data: { qr } }));
      } catch {
        setResult({ ok: false, reason: "error" });
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [checkIn],
  );

  const startCamera = async () => {
    setCameraError(null);
    setResult(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera isn't available on this device. Upload a photo of the pass instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setCameraOn(true);
    } catch {
      setCameraError("Camera access was blocked. Allow the camera or upload a photo of the pass.");
    }
  };

  useEffect(() => {
    if (!cameraOn || !videoRef.current || !streamRef.current) return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    void video.play();
    const canvas = document.createElement("canvas");
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      if (video.readyState >= 2 && !busyRef.current) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx && canvas.width) {
          ctx.drawImage(video, 0, 0);
          const value = await decodeImageData(ctx.getImageData(0, 0, canvas.width, canvas.height));
          if (value) {
            stopCamera();
            await submit(value);
            return;
          }
        }
      }
      setTimeout(() => void tick(), 250);
    };
    void tick();
    return () => {
      cancelled = true;
    };
  }, [cameraOn, stopCamera, submit]);

  useEffect(() => stopCamera, [stopCamera]);

  const onUpload = async (file: File | undefined) => {
    if (!file) return;
    setResult(null);
    stopCamera();
    const value = await decodeFile(file).catch(() => null);
    if (!value) {
      setResult({ ok: false, reason: "invalid_format" });
      return;
    }
    await submit(value);
  };

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">CarePulse · Clinic staff</p>
      <h1 className="font-display mt-1 text-[26px] font-semibold tracking-tight">Patient check-in</h1>
      <p className="mt-1 text-sm text-muted-foreground">Scan the patient's appointment pass to check them in.</p>

      <div className="mt-6 space-y-4">
        {session === "loading" && <p className="text-sm text-muted-foreground">Loading…</p>}
        {session === "out" && <StaffSignIn />}
        {session === "in" && allowed === null && <p className="text-sm text-muted-foreground">Checking your clinic role…</p>}
        {session === "in" && allowed === false && (
          <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
            {CHECK_IN_MESSAGES.not_authorized}
          </div>
        )}
        {session === "in" && allowed && (
          <>
            <div className="overflow-hidden rounded-xl border bg-muted">
              {cameraOn ? (
                <video ref={videoRef} muted playsInline className="aspect-square w-full object-cover" aria-label="Camera preview" />
              ) : (
                <div className="flex aspect-square items-center justify-center text-sm text-muted-foreground">Camera is off</div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {cameraOn ? (
                <Button variant="outline" onClick={stopCamera}><CameraOff className="mr-2 h-4 w-4" />Stop camera</Button>
              ) : (
                <Button onClick={() => void startCamera()} disabled={busy}><Camera className="mr-2 h-4 w-4" />Scan with camera</Button>
              )}
              <Button variant="outline" asChild disabled={busy}>
                <label className="cursor-pointer">
                  <ImageUp className="mr-2 h-4 w-4" />Upload image
                  <input type="file" accept="image/*" className="sr-only" onChange={(e) => { void onUpload(e.target.files?.[0]); e.target.value = ""; }} />
                </label>
              </Button>
            </div>
            {cameraError && <p className="text-xs text-destructive">{cameraError}</p>}
            {busy && <p className="text-sm text-muted-foreground">Verifying pass…</p>}
            {result && <CheckInResultMessage result={result} />}
            <Button variant="ghost" className="w-full" onClick={() => void supabase.auth.signOut()}>Sign out</Button>
          </>
        )}
      </div>
    </main>
  );
}
