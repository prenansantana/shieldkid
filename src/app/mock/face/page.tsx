"use client";

import { useState, useRef, useCallback, useEffect } from "react";

type FaceResult = {
  age: number;
  gender: "M" | "F";
  confidence: number;
  bbox: number[];
};

type AnalyzeResponse = {
  faces: FaceResult[];
  face_count: number;
  processing_ms: number;
  error?: string;
};

type VerifyResponse = {
  verificationId?: string;
  ageBracket?: string;
  age?: number;
  source?: string;
  consistent?: boolean;
  suspicious?: boolean;
  estimatedAge?: number;
  ageDifference?: number;
  confidence?: number;
  processingMs?: number;
  action?: "allow" | "flag" | "block" | "retry";
  error?: string;
};

export default function FaceDemoPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AnalyzeResponse | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResponse | null>(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"estimate" | "verify">("estimate");
  const [apiToken, setApiToken] = useState("");
  const [externalUserId, setExternalUserId] = useState("");
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">("user");

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: cameraFacing, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setStreaming(true);
        setError("");
        setCapturedImage(null);
        setAiResult(null);
        setVerifyResult(null);
      }
    } catch {
      setError("Não foi possível acessar a câmera. Verifique as permissões do navegador.");
    }
  }, [cameraFacing]);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((t) => t.stop());
      videoRef.current.srcObject = null;
      setStreaming(false);
    }
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  function capture() {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setCapturedImage(dataUrl);
    stopCamera();
  }

  async function analyzeDirectly() {
    if (!capturedImage) return;
    setLoading(true);
    setError("");
    setAiResult(null);

    try {
      const blob = await (await fetch(capturedImage)).blob();
      const formData = new FormData();
      formData.append("image", blob, "selfie.jpg");

      const res = await fetch("/api/v1/age-ai-proxy", {
        method: "POST",
        body: formData,
      });

      const data = (await res.json()) as AnalyzeResponse;
      setAiResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao analisar imagem");
    } finally {
      setLoading(false);
    }
  }

  async function verifyWithCpf() {
    if (!capturedImage || !apiToken || !externalUserId) {
      setError("Preencha o API token e o External User ID");
      return;
    }
    setLoading(true);
    setError("");
    setVerifyResult(null);

    try {
      // Get SDK session first
      const sessionRes = await fetch("/api/v1/verify/session", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      const { sessionId } = await sessionRes.json();

      const blob = await (await fetch(capturedImage)).blob();
      const formData = new FormData();
      formData.append("image", blob, "selfie.jpg");
      formData.append("externalUserId", externalUserId);
      formData.append("sessionId", sessionId);

      const res = await fetch("/api/v1/verify", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiToken}` },
        body: formData,
      });

      const data = (await res.json()) as VerifyResponse;
      setVerifyResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na verificação");
    } finally {
      setLoading(false);
    }
  }

  const actionColors: Record<string, string> = {
    allow: "bg-green-100 border-green-300 text-green-800",
    flag: "bg-yellow-100 border-yellow-300 text-yellow-800",
    block: "bg-red-100 border-red-300 text-red-800",
    retry: "bg-gray-100 border-gray-300 text-gray-800",
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">ShieldKid — Face AI</h1>
          <p className="text-sm text-gray-500 mt-1">
            Estimativa de idade por reconhecimento facial
          </p>
        </div>

        {/* Mode selector */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setMode("estimate")}
            className={`flex-1 py-2 text-sm font-medium rounded-lg ${
              mode === "estimate"
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-600 border"
            }`}
          >
            Estimar idade
          </button>
          <button
            onClick={() => setMode("verify")}
            className={`flex-1 py-2 text-sm font-medium rounded-lg ${
              mode === "verify"
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-600 border"
            }`}
          >
            Comparar com CPF
          </button>
        </div>

        {/* Verify mode: extra fields */}
        {mode === "verify" && (
          <div className="bg-white rounded-lg shadow p-4 mb-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                API Token
              </label>
              <input
                type="text"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
                placeholder="test-token"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                External User ID (ja verificado com CPF)
              </label>
              <input
                type="text"
                value={externalUserId}
                onChange={(e) => setExternalUserId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="user_maria"
              />
            </div>
          </div>
        )}

        {/* Camera / Image */}
        <div className="bg-white rounded-lg shadow overflow-hidden mb-4">
          <div className="relative aspect-[4/3] bg-black">
            {!capturedImage ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: cameraFacing === "user" ? "scaleX(-1)" : "none" }}
              />
            ) : (
              <img
                src={capturedImage}
                alt="Selfie capturada"
                className="w-full h-full object-cover"
              />
            )}

            {!streaming && !capturedImage && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-gray-400 text-sm">Camera desligada</p>
              </div>
            )}

            {/* Overlay bounding boxes */}
            {aiResult && capturedImage && canvasRef.current && (
              <svg
                className="absolute inset-0 w-full h-full"
                viewBox={`0 0 ${canvasRef.current.width} ${canvasRef.current.height}`}
                preserveAspectRatio="xMidYMid slice"
              >
                {aiResult.faces.map((face, i) => {
                  const [x1, y1, x2, y2] = face.bbox;
                  return (
                    <g key={i}>
                      <rect
                        x={x1}
                        y={y1}
                        width={x2 - x1}
                        height={y2 - y1}
                        fill="none"
                        stroke="#22c55e"
                        strokeWidth="3"
                        rx="4"
                      />
                      <rect
                        x={x1}
                        y={y1 - 28}
                        width={120}
                        height={26}
                        fill="rgba(0,0,0,0.7)"
                        rx="4"
                      />
                      <text
                        x={x1 + 6}
                        y={y1 - 8}
                        fill="white"
                        fontSize="16"
                        fontFamily="monospace"
                      >
                        {face.age} anos ({face.gender})
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}
          </div>

          {/* Controls */}
          <div className="p-4 flex gap-2">
            {!streaming && !capturedImage && (
              <>
                <button
                  onClick={startCamera}
                  className="flex-1 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800"
                >
                  Ligar camera
                </button>
                <button
                  onClick={() => {
                    setCameraFacing((f) => (f === "user" ? "environment" : "user"));
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                  title="Alternar camera"
                >
                  {cameraFacing === "user" ? "Frontal" : "Traseira"}
                </button>
              </>
            )}

            {streaming && (
              <>
                <button
                  onClick={capture}
                  className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                >
                  Capturar foto
                </button>
                <button
                  onClick={stopCamera}
                  className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </>
            )}

            {capturedImage && (
              <>
                <button
                  onClick={mode === "estimate" ? analyzeDirectly : verifyWithCpf}
                  disabled={loading}
                  className="flex-1 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {loading
                    ? "Analisando..."
                    : mode === "estimate"
                      ? "Estimar idade"
                      : "Verificar"}
                </button>
                <button
                  onClick={() => {
                    setCapturedImage(null);
                    setAiResult(null);
                    setVerifyResult(null);
                    startCamera();
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50"
                >
                  Tirar outra
                </button>
              </>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* AI Result (estimate mode) */}
        {aiResult && mode === "estimate" && (
          <div className="bg-white rounded-lg shadow p-4 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-gray-900">Resultado</h3>
              <span className="text-xs text-gray-400">
                {aiResult.processing_ms}ms
              </span>
            </div>

            {aiResult.face_count === 0 ? (
              <p className="text-sm text-gray-500">
                Nenhum rosto detectado. Tente novamente com melhor iluminacao.
              </p>
            ) : (
              aiResult.faces.map((face, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 bg-gray-50 rounded-lg p-3"
                >
                  <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-xl font-bold text-blue-700">
                      {face.age}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {face.age} anos estimados
                    </p>
                    <p className="text-sm text-gray-500">
                      Genero: {face.gender === "M" ? "Masculino" : "Feminino"} |
                      Confianca: {(face.confidence * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Verify Result (compare mode) */}
        {verifyResult && mode === "verify" && (
          <div
            className={`rounded-lg border p-4 space-y-3 ${
              actionColors[verifyResult.action ?? "retry"] ?? actionColors.retry
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                  verifyResult.action === "allow"
                    ? "bg-green-500"
                    : verifyResult.action === "block"
                      ? "bg-red-500"
                      : "bg-yellow-500"
                }`}
              >
                {verifyResult.action === "allow"
                  ? "\u2713"
                  : verifyResult.action === "block"
                    ? "\u2717"
                    : "!"}
              </div>
              <div>
                <p className="font-semibold">
                  {verifyResult.action === "allow"
                    ? "Idade consistente"
                    : verifyResult.action === "flag"
                      ? "Diferenca de idade detectada"
                      : verifyResult.action === "block"
                        ? "Inconsistencia grave"
                        : verifyResult.error ?? "Resultado"}
                </p>
                {verifyResult.age !== undefined && (
                  <p className="text-sm mt-1">
                    Idade: {verifyResult.age} anos ({verifyResult.source})
                    {verifyResult.estimatedAge !== undefined && (
                      <> | IA: {verifyResult.estimatedAge} anos (diff: {verifyResult.ageDifference})</>
                    )}
                  </p>
                )}
              </div>
            </div>

            {verifyResult.action && verifyResult.action !== "retry" && (
              <div className="bg-white/50 rounded p-3">
                <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(verifyResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
