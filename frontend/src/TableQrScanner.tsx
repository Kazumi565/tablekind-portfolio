import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Camera, CameraOff, CheckCircle2 } from "lucide-react";
import { parseTableCode } from "./tableCode";

type Detector = {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
};
type DetectorConstructor = new (options: { formats: string[] }) => Detector;

/** The browser decodes live frames locally. No image is captured or sent to the API. */
export function TableQrScanner({
  onCode,
  onContinue,
  disabled,
  preview,
}: {
  onCode: (token: string) => void;
  onContinue: () => void;
  disabled: boolean;
  preview?: {
    restaurant: string;
    branch: string;
    table: string;
  } | null;
}) {
  const [phase, setPhase] = useState<"idle" | "requesting" | "scanning">("idle");
  const [message, setMessage] = useState("");
  const [manual, setManual] = useState("");
  const [source, setSource] = useState<"camera" | "link" | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const frame = useRef<number | null>(null);
  const generation = useRef(0);
  const starting = useRef(false);
  const confirmation = useRef<HTMLDialogElement>(null);

  const stop = useCallback(() => {
    generation.current++;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    starting.current = false;
    setPhase("idle");
  }, []);

  useEffect(() => {
    const hide = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", stop);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", stop);
      stop();
    };
  }, [stop]);

  useEffect(() => {
    if (disabled) stop();
  }, [disabled, stop]);

  useEffect(() => {
    if (preview && source) {
      setMessage("");
      if (!confirmation.current?.open) confirmation.current?.showModal();
    } else if (confirmation.current?.open) confirmation.current.close();
  }, [preview, source]);

  const start = async () => {
    if (starting.current || phase !== "idle" || disabled) return;
    setMessage("");
    const constructor = (globalThis as typeof globalThis & {
      BarcodeDetector?: DetectorConstructor;
    }).BarcodeDetector;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setMessage("Camera access needs HTTPS or localhost. Paste the table link below instead.");
      return;
    }
    if (!constructor) {
      setMessage("This browser cannot read QR codes in the page. Use your phone camera to open the printed link, or paste it below.");
      return;
    }
    let detector: Detector;
    try {
      detector = new constructor({ formats: ["qr_code"] });
    } catch {
      setMessage("QR detection is unavailable here. Use your phone camera or paste the link below.");
      return;
    }
    starting.current = true;
    const run = ++generation.current;
    setPhase("requesting");
    try {
      const camera = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      });
      if (generation.current !== run || !video.current) {
        camera.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = camera;
      video.current.srcObject = camera;
      await video.current.play();
      if (generation.current !== run) return;
      starting.current = false;
      setPhase("scanning");
      const scan = async () => {
        if (generation.current !== run || !video.current) return;
        try {
          const codes = await detector.detect(video.current);
          if (generation.current !== run) return;
          for (const code of codes) {
            try {
              const token = parseTableCode(code.rawValue, location.origin);
              stop();
              setSource("camera");
              setMessage("QR scanned successfully. Checking the restaurant and table…");
              onCode(token);
              return;
            } catch {
              setMessage("That is not a table QR for this Tablekind address. Keep scanning or paste the link below.");
            }
          }
        } catch {
          if (generation.current !== run) return;
          stop();
          setMessage("The camera could not read this QR. Use your phone camera or paste the link below.");
          return;
        }
        if (generation.current === run) frame.current = requestAnimationFrame(() => void scan());
      };
      frame.current = requestAnimationFrame(() => void scan());
    } catch (e) {
      if (generation.current !== run) return;
      stop();
      setMessage((e as DOMException).name === "NotAllowedError"
        ? "Camera permission was denied. Allow camera access or paste the table link below."
        : "Camera unavailable. Use your phone camera or paste the table link below.");
    }
  };

  const submitManual = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled) return;
    try {
      const token = parseTableCode(manual, location.origin);
      stop();
      setManual("");
      setSource("link");
      setMessage("Table link received. Check the restaurant and table below before joining.");
      onCode(token);
    } catch (e) {
      setMessage((e as Error).message);
    }
  };

  return (
    <section className="card table-scanner" aria-label="Scan a table QR">
      <div>
        <h2>Join a table</h2>
        <p>No account needed. Scan the table QR, then check the table before joining.</p>
      </div>
      <div className="row wrap">
        {phase === "idle" ? (
          <button type="button" className="primary" disabled={disabled} onClick={() => void start()}>
            <Camera size={18} /> Scan table QR
          </button>
        ) : (
          <button type="button" onClick={stop}>
            <CameraOff size={18} /> Stop camera
          </button>
        )}
      </div>
      <video
        ref={video}
        className="table-scanner-video"
        autoPlay muted playsInline
        hidden={phase === "idle"}
        aria-label="Live camera preview for scanning a table QR"
      />
      <p role="status">
        {phase === "requesting" ? "Requesting camera permission…" :
          message || (phase === "scanning" ? "Point the camera at the table QR." : "")}
      </p>
      <dialog
        ref={confirmation}
        className="scan-dialog"
        aria-labelledby="scan-dialog-title"
        onClose={onContinue}
      >
        {preview && source && (
          <div className="scan-dialog-content">
            <CheckCircle2 size={42} aria-hidden="true" />
            <div>
              <h2 id="scan-dialog-title">
                {source === "camera" ? "QR scanned successfully" : "Table link confirmed"}
              </h2>
              <p>{preview.restaurant} · {preview.branch}</p>
              <strong className="scan-table-name">{preview.table}</strong>
              <p>Confirm this is your table, then continue to enter your nickname.</p>
            </div>
            <button
              type="button"
              className="primary"
              autoFocus
              onClick={() => confirmation.current?.close()}
            >
              Continue to {preview.table}
            </button>
          </div>
        )}
      </dialog>
      <form onSubmit={submitManual} className="table-scanner-fallback">
        <label className="field">
          Paste table link or code
          <input value={manual} onChange={(e) => setManual(e.target.value)}
            autoComplete="off" maxLength={2048} />
        </label>
        <button type="submit" disabled={disabled || !manual.trim()}>Preview table</button>
      </form>
      <small>Camera frames stay on this device and are not saved or uploaded.</small>
    </section>
  );
}
